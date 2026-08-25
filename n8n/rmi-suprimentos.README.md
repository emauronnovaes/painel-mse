# Ingestão n8n — RMI (aba Suprimentos)

Workflow: `rmi-suprimentos.workflow.json`. Alimenta a tabela `itens_rmi`
(Supabase, projeto `gebjlhkywtnpfqjrakok`, o mesmo já usado pelo
dashboard-main e pelo painel-mse).

Fonte: `rmi_api` do PortalMSE — guia em
`https://portalmse.com.br/microservices/rmi_api/GUIA_USUARIO.php`.

## Antes de importar — não confundir com `itens_mapa_compras`

**São 2 serviços PortalMSE diferentes, confirmado pelo `/health` de
cada um** (2026-08-20): `mapa_compras_api` responde
`{"service":"mapa_compras_api", ...}` sem campo `time`;
`rmi_api` responde `{"service":"rmi_api", ..., "time":"..."}`. Cada um
tem sua PRÓPRIA chave Bearer — a chave de um dá 403 no outro (confirmado
na prática: uma chave testada direto via `Invoke-RestMethod`, fora do
n8n, deu 403 mesmo com o header montado certo, porque era a chave errada
pro serviço). As 2 alimentam a mesma tela de Suprimentos, mas são fontes
e grãos diferentes — ver a tabela comparativa no fim desta seção.

**Por que este guia é mais confiável que o do `mapa_compras_api`**: o
guia da `rmi_api` traz exemplo de JSON completo (request+response) e
confirma o formato do envelope (`{page, per_page, total, data:[...]}`) —
o outro guia não tinha nem uma coisa nem outra, só uma tabela de campos
em texto corrido. Por isso este workflow tem menos suposição no ar que o
de Mapa de Compras (ver `mapa-compras-suprimentos.README.md`, seção
"Antes de importar", pros 3 pontos que continuam pendentes lá).

**Diferencial importante desta fonte**: os itens já vêm com
`prazo_status` (`atrasado`/`no_prazo`/`sem_data`) e
`desvio_saldo_orcamentario` (`positivo`/`negativo`) **prontos da
origem** — a API até aceita filtrar direto por `?prazo=atrasado` e
`?desvio=negativo`. Isso é candidato forte pra resolver a regra de
"crítico" do setor Suprimentos, pendente desde 2026-08-05/08-11 (ver
[[02 - Escopo e Telas]]) — decisão de produto ainda a tomar (crítico =
`prazo_status=atrasado` sozinho? cruzado com `desvio_saldo_orcamentario`?
com algum limiar de valor?), mas agora existe DADO pra decidir em cima,
o que não existia antes.

| | `itens_mapa_compras` (`mapa_compras_api`) | `itens_rmi` (`rmi_api`) |
|---|---|---|
| Chave única | `id_obra+id_mapa_compras+codigo_seq` (suposição) | `id` (id próprio do item na origem) |
| Tem prazo por item? | Não | Sim (`prazo_status`, dentro de `raw`) |
| Tem hierarquia (item pai/filho)? | Não | Sim (`nivel`, `eh_item_pai`, dentro de `raw`) |
| Melhor oferta de fornecedor? | Sim (`melhor_oferta_*`, nomes não confirmados) | Não documentado |
| Formato do envelope confirmado? | Não (suposição) | Sim (`{page,per_page,total,data}`) |
| Colunas individuais por campo? | Sim | **Não** — só `raw jsonb` (ver abaixo) |

## SQL da tabela (rodar no SQL Editor do Supabase)

**Schema simplificado** (pedido explícito, 2026-08-20: "é possível
retirar esta etapa?", referindo-se à tradução campo-a-campo no Code
node) — mesmo padrão já usado em `orcamentos_complementares_obra` neste
projeto: sem coluna por campo da API, só o essencial pro pipeline
funcionar (`id` pro upsert, `id_obra` pro filtro por obra — todo
`GET .../rest/v1/<tabela>?id_obra=eq.X` deste projeto depende disso) +
o item inteiro em `raw`. Filtrar por `prazo_status`/
`desvio_saldo_orcamentario` continua possível, só que via `raw->>campo`
em vez de coluna própria — ver "Consumo no painel" mais abaixo.

**Trade-off**: menos manutenção (campo novo/renomeado na API não exige
migração de coluna), mas consulta por campo de dentro do `raw` é um
pouco mais verbosa e só é rápida com os índices de expressão abaixo
(sem eles, cada filtro por `prazo_status` varre a tabela inteira).

```sql
create table public.itens_rmi (
  -- `id` é o PRÓPRIO id do item na origem (a API devolve um `id`
  -- numérico de verdade, coisa que nem pedidos_suprimentos nem
  -- itens_mapa_compras tinham) -- por isso vira a PK direto, sem coluna
  -- identity separada. Suposição a confirmar com dado real: que esse
  -- `id` é globalmente único (entre obras/RMIs), não só dentro de 1 RMI.
  id bigint primary key,
  id_obra bigint not null,
  raw jsonb not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index itens_rmi_id_obra_idx on public.itens_rmi (id_obra);

-- Índices de expressão pros 2 campos que a tela de "crítico" mais
-- provavelmente vai filtrar (ver seção acima) -- sem coluna própria,
-- mas ainda rápido de consultar.
create index itens_rmi_prazo_status_idx on public.itens_rmi ((raw->>'prazo_status'));
create index itens_rmi_desvio_idx on public.itens_rmi ((raw->>'desvio_saldo_orcamentario'));

comment on table public.itens_rmi is
  'Itens de RMI (Requisicao de Material e Insumo) por obra, via API do PortalMSE (rmi_api) -- fonte separada de itens_mapa_compras (mapa_compras_api), mesma tela de Suprimentos. Schema enxuto de proposito (so id/id_obra + raw jsonb, sem coluna por campo -- mesmo padrao de orcamentos_complementares_obra): tudo que a API devolve fica em raw, consultado via raw->>campo. Chave = id (id proprio do item na origem, presumido globalmente unico -- confirmar na 1a carga real).';

alter table public.itens_rmi enable row level security;

create policy "leitura anon itens_rmi"
  on public.itens_rmi
  for select
  to anon, authenticated
  using (true);

create policy "service_role tem acesso total"
  on public.itens_rmi
  for all
  to service_role
  using (true)
  with check (true);
```

## Passo a passo

1. **Rodar o SQL acima** no Supabase (SQL Editor) antes de qualquer coisa.
2. **Importar o workflow** no n8n: Workflows → Import from File →
   `rmi-suprimentos.workflow.json`.
3. **Criar a credencial da API do PortalMSE** (nó "Buscar itens de RMI
   por obra"):
   - Tipo: **Bearer Token** (`httpBearerAuth`)
   - Nome: `PortalMSE - RMI (Suprimentos)` (nome exato esperado pelo
     workflow — **não** é a mesma credencial/chave do fluxo de Mapa de
     Compras, mesmo os dois alimentando "Suprimentos")
   - Token: a chave fornecida pela equipe MSE **para o `rmi_api`
     especificamente**. **Nunca cole o token em chat/documento** —
     cadastre direto no formulário de credencial do n8n. Antes de
     cadastrar, vale testar fora do n8n:
     ```powershell
     Invoke-RestMethod -Uri "https://portalmse.com.br/microservices/rmi_api/v1/itens?obra_id=91&per_page=1" -Headers @{ Authorization = "Bearer SEU_TOKEN_AQUI" }
     ```
     Se der 200, a chave está certa e o problema (se houver depois) é
     configuração do n8n, não a chave.
4. **Credencial do Supabase**: reaproveita `Supabase - API Portal
   (service_role)`, já cadastrada pelos outros fluxos de ingestão deste
   projeto — não precisa recriar.
5. **Rodar manualmente uma vez** ("Execute Workflow") antes de ativar o
   agendamento. **Se a máquina que hospeda o n8n for fraca/limitada**,
   teste antes com 1 obra só: edite temporariamente o node "Lista de
   obras" pra `return [{ json: { id_obra: 91, nome_obra: 'Novo Nordisk - UB/SP' } }];`
   (comente a lista de 6 e volte depois), rode, confirme que termina e
   grava, e só então volte a lista completa. Isso isola se o processamento
   1-a-1 já resolveu o travamento ou se ainda existe alguma obra grande
   demais pro hardware disponível.
   - Se o node "Montar linhas da obra" lançar erro de "total não bate
     com data.length", `all=true` não trouxe tudo de uma vez pra alguma
     obra — precisa trocar por paginação manual (`page`) nessa obra
     específica.
   - Conferir por obra: `select id_obra, count(*) from itens_rmi group by id_obra;`
   - Conferir a distribuição de prazo (dá pra já visualizar o que "crítico"
     poderia significar) — agora via `raw->>'prazo_status'`, já que não
     tem coluna própria:
     `select raw->>'prazo_status' as prazo_status, count(*) from itens_rmi group by 1;`
6. **Ativar** o workflow (agendado pra 08:00 — 06:00 é Orçamentos
   Complementares, 07:00 é Pedidos, 07:30 é Mapa de Compras).

## Decisões de desenho, pra quem for mexer depois

- **Processa 1 obra por vez, em loop (`Split In Batches`), não as 6 de
  uma vez** — diferente dos outros 3 fluxos deste projeto (que buscam
  TODAS as obras primeiro e só depois processam tudo junto). Mudança
  feita em 2026-08-20 porque a 1ª versão (fan-out das 6 obras) ficava
  "rodando e não retornava" numa máquina com hardware limitado —
  provavelmente precisava manter as 6 respostas inteiras na memória ao
  mesmo tempo antes de gravar qualquer coisa, e isso trava sem erro
  nenhum aparecer (sintoma clássico de estouro de memória/troca com
  disco num host fraco, não é bug de lógica). Com o loop, cada obra é
  buscada → transformada → gravada → só então a próxima é buscada; a
  memória da obra anterior é liberada antes de pegar a próxima.
  **Efeito colateral bom**: o Code node "Montar linhas da obra" ficou
  mais simples — não precisa mais do guard de "contagem de obras bate
  com contagem de respostas" (o loop já garante 1-pra-1 por natureza).
  Se mesmo assim travar na 1ª obra, o problema não é volume — é a chave
  ou a rede; ver seção de teste no Postman/PowerShell mais acima.
- **6 obras fixas na lista** (`Lista de obras`), sem CNPEM - Auditório
  (id 103) — mesmo padrão dos outros 3 fluxos de ingestão deste projeto.
- **`?all=true` por obra, não globalmente** — mesmo raciocínio dos outros
  fluxos. Diferente deles, aqui dá pra CONFERIR se funcionou de verdade
  (o campo `total` no envelope da resposta), então o Code node trava com
  erro explícito se `all=true` não tiver trazido tudo — ver guard no
  código. Se uma obra específica tiver volume grande demais e travar
  mesmo com o processamento 1-a-1, trocar `all=true` por paginação manual
  (`per_page=100` + loop de `page`) só nessa obra é o próximo passo — o
  campo `total` já confirmado facilita montar esse loop depois.
- **Upsert por obra** (1 POST com array de N itens daquela obra), mesmo
  padrão de "lote" dos outros fluxos — a diferença é só o TIMING: agora
  cada obra é gravada e descartada da memória antes da próxima ser
  buscada, em vez de acumular as 6 primeiro.
- **`id` da própria API vira a PK direto** (sem coluna identity
  separada) — é a 1ª das 4 fontes de ingestão deste projeto que confirma
  ter um id numérico de verdade; as outras 3 precisaram de chave
  composta "no chute" por não terem isso.
- **Sem coluna por campo — só `id`/`id_obra` + `raw jsonb`** (pedido
  explícito, 2026-08-20, ver seção "Antes de importar" acima). O Code
  node "Montar linhas da obra" ficou bem mais curto: não tem mais
  tradução campo-a-campo nem `num()`/`bool()` — só extrai `id`, injeta
  `id_obra` (vindo do loop, não da API, mesmo padrão de sempre) e joga o
  item inteiro em `raw`. A checagem de paginação (`total` vs
  `data.length`) continua, porque não é tradução de campo, é
  integridade dos dados. Índices de expressão (`raw->>campo`) cobrem os
  2 campos mais prováveis de filtro; se aparecer necessidade de filtrar
  por outro campo com frequência, criar mais um índice de expressão é
  mais barato que voltar a ter coluna própria pra tudo.

## Consumo no painel (ainda não implementado)

Sem coluna própria, o filtro/ordenação por campo da API usa a sintaxe
`raw->>campo` do PostgREST (funciona igual a uma coluna normal nos
operadores de filtro):

```
GET {SUPABASE_URL}/rest/v1/itens_rmi?id_obra=eq.{obraId}&select=id,id_obra,raw&order=raw->>prazo_status.asc

# só os itens atrasados de 1 obra:
GET {SUPABASE_URL}/rest/v1/itens_rmi?id_obra=eq.{obraId}&raw->>prazo_status=eq.atrasado&select=*
```

No front-end, o item vem inteiro dentro de `row.raw` (ex.:
`row.raw.descricao`, `row.raw.saldo_orcamentario_formatado` — essa API
já manda a versão formatada em R$ pronta, então nem precisa de
`fmtReais()` pra esses campos específicos, só pros que não tem
`_formatado`).

Pra montar a régua de "crítico" combinando as 2 fontes (ver tabela
comparativa acima), o consumo provavelmente vai precisar ler
`itens_mapa_compras` E `itens_rmi` juntos — decisão de produto de como
cruzar as 2 (por `codigo_seq`? por descrição? são grãos realmente
equivalentes item-a-item, ou uma é subconjunto da outra?) ainda não foi
tomada, e não dá pra responder sem comparar dado real das 2 tabelas lado
a lado depois da 1ª carga.
