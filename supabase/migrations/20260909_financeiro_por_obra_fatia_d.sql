-- Fatia D — RLS por obra nas tabelas financeiras (ver docs/15, seção 1c).
--
-- ⚠️ DEPENDE DA FATIA A. Aplicar `20260909_acesso_por_obra_fatia_a.sql` PRIMEIRO:
-- esta migração usa `obra_chaves`, `acesso_total.obra_id` e
-- `mse_obras_financeiro()`, que nascem lá. Rodar fora de ordem falha no
-- `create function` abaixo.
--
-- O que muda, em duas direções opostas:
--   FECHA — as 5 tabelas de Medições/OC-CO passam a recortar por obra no RLS,
--           não só na UI.
--   ABRE  — `v_indices_financeiros_diario` deixa de ser restrita: ela alimenta
--           Encarregados, não Medições (seção 3).
--
-- Aplicar no projeto "API - Portal" (gebjlhkywtnpfqjrakok), pelo SQL Editor.

-- ── 1. Por que uma função a mais ────────────────────────────────────────────
-- A expressão de uma policy roda com as permissões de QUEM CONSULTA, e
-- `obra_chaves` tem o GRANT revogado de `authenticated` de propósito. Uma
-- policy que fizesse `... from public.obra_chaves` devolveria vazio para todo
-- mundo — ou seja, esconderia o financeiro até de quem tem acesso.
--
-- `mse_cps_financeiro()` resolve isso: SECURITY DEFINER, lê o mapa, e devolve
-- só os códigos de contrato que ESTE e-mail pode ver. Como é set-returning e
-- não recebe parâmetro, o `in (select ...)` das policies vira um InitPlan
-- avaliado UMA vez por consulta, não por linha.
create or replace function public.mse_cps_financeiro() returns setof text
language sql stable security definer set search_path = '' as $$
  select o.chave
    from public.obra_chaves o
   where o.tipo = 'cp'
     and o.obra_id in (select public.mse_obras_financeiro())
$$;

grant execute on function public.mse_cps_financeiro() to anon, authenticated;

-- ── 2. As policies ──────────────────────────────────────────────────────────
-- Forma de todas: `acesso_total OR pertence a uma obra minha`.
--
-- ⚠️ O ramo `mse_acesso_total()` NÃO É REDUNDANTE, e tirá-lo é uma regressão
-- silenciosa. As tabelas têm linhas cujo contrato NÃO é obra do painel — 325
-- das 461 de `nfs`, 26 de `boletins_medicao`, 1 de `proximos_faturamentos`
-- (contratos de outras frentes: CP1708, CP2027, OP153_25...). Essas chaves não
-- estão em `obra_chaves`, então `mse_cps_financeiro()` não as devolve. Sem o
-- ramo global, quem hoje vê a tabela inteira passaria a ver só um terço dela.
--
-- Para quem tem recorte POR OBRA o efeito é o inverso, e é o desejado: chave
-- não mapeada não pertence a obra nenhuma, logo não aparece. Fecha por padrão.
--
-- Continuam RESTRICTIVE e `TO authenticated` pelos mesmos motivos da migração
-- original (permissivas se somariam com OR às que já liberam `authenticated`;
-- produção lê como `anon` em alguns caminhos e não pode perder o financeiro).

alter policy mse_financeiro_lista on public.contratos_medicao
  using ( (select public.mse_acesso_total())
          or cp_codigo in (select public.mse_cps_financeiro()) );

alter policy mse_financeiro_lista on public.boletins_medicao
  using ( (select public.mse_acesso_total())
          or cp_codigo in (select public.mse_cps_financeiro()) );

alter policy mse_financeiro_lista on public.nfs
  using ( (select public.mse_acesso_total())
          or obra in (select public.mse_cps_financeiro()) );

alter policy mse_financeiro_lista on public.proximos_faturamentos
  using ( (select public.mse_acesso_total())
          or obra in (select public.mse_cps_financeiro()) );

-- A exceção boa: já tem `id_obra`, não precisa passar pelo mapa de CP.
alter policy mse_financeiro_lista on public.orcamentos_complementares_obra
  using ( (select public.mse_acesso_total())
          or id_obra in (select public.mse_obras_financeiro()) );

-- ── 3. A view volta a ser LIVRE ───────────────────────────────────────
-- `v_indices_financeiros_diario` NÃO alimenta Medições nem OC/CO. Alimenta o
-- indicador de Produtividade do Setor 2, ENCARREGADOS — que não é financeiro e
-- nunca é escondido da barra.
--
-- Restringi-la (feito em 08/09/2026, junto do resto do financeiro) produziu um
-- efeito colateral silencioso: quem não estava em `acesso_total` abria
-- Encarregados e via a coluna Produtividade VAZIA, sem explicação — o modo de
-- falha do ADR-005, ausência parecendo dado.
--
-- Decisão do usuário em 09/09/2026: "se não alimenta a tela de medições/ocs
-- deverá estar liberado". Some o WHERE de acesso inteiro.
--
-- ⚠️ MAS as colunas de dinheiro saem junto. A versão restrita expõe `receita`,
-- `receita_ponderada` e `custo_incorrido` — R$ por tarefa. Liberar a view COM
-- elas publicaria receita e custo de toda obra para qualquer sessão logada, o
-- que é mais do que "liberar o indicador de produtividade".
--
-- Nenhum consumidor lê essas colunas: as três cópias do painel (prototipo,
-- apresentacao, combinado) selecionam sempre e somente
-- `tarefa_id,data,indice_receita_custo_incorrido`. O índice que sobra é uma
-- RAZÃO (receita÷custo), não um valor — é o que Encarregados mostra.
--
-- Então a view fica livre e ENXUTA. Se algum dia precisar dos valores, eles
-- continuam em `medicao_acumulada`, que segue restrita.
--
-- Precisa de DROP porque `create or replace view` não remove coluna. Verificado
-- que nada depende dela (nenhuma view/matview referencia).
drop view public.v_indices_financeiros_diario;

create view public.v_indices_financeiros_diario as
 SELECT a.tarefa_id,
    t.id_eap,
    a.data_referencia AS data,
    a.avanco_total,
    a.receita * (a.avanco_total / 100.0) / NULLIF(a.custo_incorrido, 0::numeric) AS indice_receita_custo_incorrido,
    a.custo_incorrido IS NULL OR a.custo_incorrido = 0::numeric AS sem_custo
   FROM medicao_acumulada a
     JOIN tarefas t ON t.id = a.tarefa_id;

comment on view public.v_indices_financeiros_diario is
  'Indicador de Produtividade do Setor Encarregados. LIVRE de propósito: não '
  'alimenta Medições/OC-CO (decisão 09/09/2026). Sem colunas de R$ — só a razão '
  'receita/custo; os valores ficam em medicao_acumulada, que segue restrita.';

grant select on public.v_indices_financeiros_diario to anon, authenticated;

-- ── 4. Conferência ──────────────────────────────────────────────────────────
-- Rodar DEPOIS de aplicar. Simula as claims do JWT e compara o que cada perfil
-- enxerga. Os números esperados foram medidos em 09/09/2026.
--
-- (a) acesso GLOBAL — tem que continuar vendo TUDO, inclusive os contratos que
--     não são obra do painel. Se `nfs` vier 136 em vez de 461, o ramo
--     `mse_acesso_total()` caiu de alguma policy.
--
--   select set_config('request.jwt.claims',
--     '{"email":"w.silva@mse.com.br","role":"authenticated"}', true) as _;
--   select (select count(*) from nfs)                            as nfs,        -- 461
--          (select count(*) from boletins_medicao)                as boletins,   -- 184
--          (select count(*) from contratos_medicao)               as contratos,  -- 8
--          (select count(*) from orcamentos_complementares_obra)  as ocs,        -- 7
--          (select count(*) from v_indices_financeiros_diario)    as indices;    -- 6135
--
-- (b) recorte POR OBRA (alisson, CP273 / obra 107) — só o contrato dele.
--
--   select set_config('request.jwt.claims',
--     '{"email":"alisson.marcondes@mse.com.br","role":"authenticated"}', true) as _;
--   select (select count(*) from boletins_medicao where cp_codigo <> 'CP273') as vazamento_outros_cps,  -- 0
--          (select count(*) from boletins_medicao)                            as so_os_dele,           -- > 0
--          (select count(*) from orcamentos_complementares_obra where id_obra <> 107) as ocs_vazadas;   -- 0
--
-- (c) SEM acesso nenhum — zero nas tabelas de Medições/OC-CO, mas a view
--     LIBERADA. É o conserto do Encarregados: antes vinha 0 aqui e a coluna
--     Produtividade nascia vazia sem explicação.
--
--   select set_config('request.jwt.claims',
--     '{"email":"treinamento.planejamento@mse.com.br","role":"authenticated"}', true) as _;
--   select (select count(*) from nfs)                         as nfs,      -- 0
--          (select count(*) from boletins_medicao)            as boletins, -- 0
--          (select count(*) from v_indices_financeiros_diario) as indices;  -- 6135
--
-- (d) anon — INTOCADO, é o que segura produção hoje.
--
--   select set_config('request.jwt.claims', '{"role":"anon"}', true) as _;
--   select (select count(*) from v_indices_financeiros_diario) as indices;  -- 6135
--
-- (e) as colunas de R$ SUMIRAM da view — tem que dar erro, não valor.
--
--   select receita from v_indices_financeiros_diario limit 1;
--   -- esperado: ERROR 42703 column "receita" does not exist
