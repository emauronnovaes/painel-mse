-- Financeiro por obra (ver docs/15, seção 1c).
--
-- Terceiro nível de acesso: além de "vê tudo" e "não vê financeiro nenhum",
-- passa a existir "vê Medições e OC/CO SÓ da sua obra".
--
-- ⚠️ O recorte é SÓ do financeiro. A lista de obras do seletor continua inteira
-- para todo mundo (decisão do usuário, 09/09/2026: "não vai restringir o acesso
-- geral das obras"). Uma versão anterior deste arquivo tinha uma segunda
-- dimensão, `acesso_obra`, que escondia obras do seletor — removida por não ter
-- consumidor.
--
-- ADITIVA E REVERSÍVEL: cria o mapa de obras, adiciona uma coluna nulável e
-- redefine funções. NÃO altera nenhuma policy existente — o painel se comporta
-- IDENTICAMENTE até a fatia D (RLS nas tabelas financeiras) entrar.
--
-- Aplicar no projeto "API - Portal" (gebjlhkywtnpfqjrakok), pelo SQL Editor do
-- dashboard (o Table Editor não serve: a tabela nasce com GRANT revogado).

-- ── 1. Mapa de obras ───────────────────────────────────────────────
-- O banco não sabia o que é uma obra: a identidade aparece em 5 formatos de
-- coluna e 4+ convenções de nome, e só `panel-config.js` amarrava tudo.
--
-- Duas convenções bastam para o financeiro, e só essas entram:
--   tipo='nome' — a lista canônica das obras do painel, fonte de "todas as
--                 obras" em `mse_obras_financeiro()`.
--   tipo='cp'   — código de contrato, como as tabelas financeiras identificam a
--                 obra: `contratos_medicao.cp_codigo`, `boletins_medicao`,
--                 `nfs.obra`, `proximos_faturamentos.obra`.
--
-- PK (tipo, chave) é a invariante que importa: uma chave resolve para no
-- máximo UMA obra. Se uma origem nova trouxer chave ambígua, o insert falha
-- aqui em vez de a RLS entregar dado da obra errada.
create table public.obra_chaves (
  obra_id int  not null,
  tipo    text not null check (tipo in ('nome','cp')),
  chave   text not null,
  nota    text,
  primary key (tipo, chave)
);
comment on table public.obra_chaves is
  'Mapa id_obra <-> chave textual. tipo=nome é a lista das obras do painel '
  '(fonte de "todas as obras"); tipo=cp é como as tabelas financeiras a nomeiam.';

insert into public.obra_chaves (obra_id, tipo, chave, nota) values
  (106,'nome','CNPEM - Faseado',             null),
  (110,'nome','Hitachi',                     null),
  ( 94,'nome','Porto Itapoá',                null),
  (107,'nome','Novo Nordisk - AP',           null),
  (108,'nome','Novo Nordisk - AP - Reforço', null),
  ( 91,'nome','Novo Nordisk - UB/SP',        null),
  (114,'nome','IPEN',                        null),

  (106,'cp','CP029', null),
  (110,'cp','CP022', null),
  ( 94,'cp','CP002', null),
  (107,'cp','CP273', null),
  (108,'cp','CP261', null),
  ( 91,'cp','CP236', null);
-- NOTA: falta aqui (114,'cp','CP079') -- o IPEN. Corrigido na migração
-- `20260909_mapeia_cp079_ipen.sql`; ver o porquê lá.

-- ⚠️ FORA do mapa de propósito. Chave não mapeada não é devolvida por
-- `mse_cps_financeiro()` (fatia D), então só quem tem acesso GLOBAL vê essas
-- linhas — quem tem recorte por obra, não:
--   'CP040' -> obra 103 (CNPEM - Auditório), real na base, nunca esteve em OBRAS
--   `nfs.obra` tem 40 códigos CP; 34 são contratos de outras frentes
--     (CP1708, CP2027, OP153_25...) sem obra correspondente no painel
--
-- As outras convenções de nome de obra (curvas_s.obra, vw_dados_tv,
-- pts_emitidas.obra, suprimentos.obra) ficaram fora porque nenhuma tabela
-- NÃO-financeira é recortada por obra — estavam mapeadas numa versão anterior
-- deste arquivo e são recuperáveis pelo histórico do git se um dia precisar.

alter table public.obra_chaves enable row level security;
revoke all on public.obra_chaves from anon, authenticated;

-- ── 2. Financeiro deixa de ser só global ────────────────────────────────────
-- `acesso_total` ganha obra_id NULÁVEL: NULL = financeiro de todas as obras
-- (o que as 6 linhas de hoje já significam, então nada muda para elas),
-- preenchido = financeiro só daquela obra.
--
-- A PK vira índice único com COALESCE porque NULL não participa de PK no
-- Postgres — sem isso, o mesmo e-mail poderia receber duas linhas globais.
alter table public.acesso_total add column obra_id int;
alter table public.acesso_total drop constraint acesso_total_pkey;
create unique index acesso_total_email_obra_uniq
    on public.acesso_total (email, coalesce(obra_id, -1));
comment on column public.acesso_total.obra_id is
  'NULL = financeiro de todas as obras. Preenchido = só daquela obra.';

-- ── 3. Funções ──────────────────────────────────────────────────────────────
-- Todas SECURITY DEFINER pelo mesmo motivo de `mse_acesso_total()`: precisam
-- ler tabelas cujo GRANT foi revogado, para que o cliente receba a RESPOSTA
-- sem nunca conseguir listar as listas. Corpo fixo, search_path travado.

-- Sentido inalterado para as 5 policies RESTRITIVAS que já existem: "tem
-- financeiro de tudo". Como as 6 linhas atuais têm obra_id NULL, o resultado
-- é idêntico ao de antes desta migração.
create or replace function public.mse_acesso_total() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.acesso_total t
     where t.email = lower(auth.jwt() ->> 'email')
       and t.obra_id is null
  )
$$;

create or replace function public.mse_obras_financeiro() returns setof int
language sql stable security definer set search_path = '' as $$
  -- acesso global (obra_id NULL): financeiro de todas as obras do painel
  select o.obra_id from public.obra_chaves o
   where o.tipo = 'nome'
     and exists (select 1 from public.acesso_total t
                  where t.email = lower(auth.jwt() ->> 'email')
                    and t.obra_id is null)
  union
  select t.obra_id from public.acesso_total t
   where t.email = lower(auth.jwt() ->> 'email')
     and t.obra_id is not null
$$;

create or replace function public.mse_financeiro_obra(p_obra int) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.acesso_total t
     where t.email = lower(auth.jwt() ->> 'email')
       and (t.obra_id is null or t.obra_id = p_obra)
  )
$$;

grant execute on function public.mse_obras_financeiro()   to anon, authenticated;
grant execute on function public.mse_financeiro_obra(int) to anon, authenticated;

-- ── 4. Cadastro inicial do nível novo ───────────────────────────────────────
-- Mesmo padrão da migração `acesso_total_por_email_restringe_financeiro`, que
-- semeou os 6 e-mails iniciais junto do schema.
--
-- ⚠️ `obra_id` PRECISA vir preenchido. Uma linha com obra_id NULL significa
-- financeiro de TODAS as obras — o oposto do pedido. Foi por isso que este
-- cadastro esperou a migração em vez de ser inserido antes dela.
insert into public.acesso_total (email, obra_id, nota) values
  (lower('alisson.marcondes@mse.com.br'),   107, 'CP273 / Novo Nordisk - AP - pedido 09/09/2026'),
  (lower('pedro.vasconcellos@mse.com.br'),   91, 'CP236 / Novo Nordisk - UB/SP - pedido 09/09/2026'),
  (lower('warley.campos@mse.com.br'),        91, 'CP236 / Novo Nordisk - UB/SP - pedido 09/09/2026'),
  (lower('lucas.carmo@mse.com.br'),         108, 'CP261 / Novo Nordisk - AP - Reforço - pedido 09/09/2026');

-- Confere o recorte dos 4: cada um vê a SUA obra e mais nenhuma, e nenhum
-- deles cai no acesso global. Rodar depois de aplicar.
--
--   select set_config('request.jwt.claims',
--     '{"email":"alisson.marcondes@mse.com.br","role":"authenticated"}', true) as _,
--          public.mse_financeiro_obra(107) as sua_obra,   -- esperado true
--          public.mse_financeiro_obra(91)  as outra_obra, -- esperado false
--          public.mse_acesso_total()       as ve_tudo;    -- esperado false
--
-- Idem trocando o e-mail e a obra: pedro/warley -> 91, lucas -> 108.
