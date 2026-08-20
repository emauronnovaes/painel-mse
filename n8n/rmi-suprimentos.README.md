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
| Tem prazo por item? | Não | Sim (`prazo_status`) |
| Tem hierarquia (item pai/filho)? | Não | Sim (`nivel`, `eh_item_pai`) |
| Melhor oferta de fornecedor? | Sim (`melhor_oferta_*`, nomes não confirmados) | Não documentado |
| Formato do envelope confirmado? | Não (suposição) | Sim (`{page,per_page,total,data}`) |

## SQL da tabela (rodar no SQL Editor do Supabase)

```sql
create table public.itens_rmi (
  -- Diferente das outras 2 tabelas de ingestão deste projeto, aqui o `id`
  -- é o PRÓPRIO id do item na origem (a API devolve um `id` numérico de
  -- verdade, coisa que nem pedidos_suprimentos nem itens_mapa_compras
  -- tinham) -- por isso vira a PK direto, sem coluna identity separada.
  -- Suposição a confirmar com dado real: que esse `id` é globalmente
  -- único (entre obras/RMIs), não só dentro de 1 RMI.
  id bigint primary key,
  id_rmi bigint not null,
  nome_rmi text,
  id_obra bigint not null,
  obra_nome text,
  codigo_seq text,
  nivel integer,
  eh_item_pai boolean,
  codigo_lam text,
  codigo_s1 text,
  descricao text,
  unidade text,
  quantidade numeric,
  quantidade_consumida numeric,
  data_necessidade_compra date,
  preco_referencia_bd_s1 numeric,
  subtotal_referencia_bd_s1 numeric,
  custo_meta_orcamento numeric,
  subtotal_custo_meta_orcamento numeric,
  total_consumido numeric,
  total_consumido_proprio numeric,
  saldo_orcamentario numeric,
  desvio_saldo_orcamentario text,
  desvio_cor text,
  prazo_status text,
  prazo_cor text,
  raw jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index itens_rmi_id_obra_idx on public.itens_rmi (id_obra);
create index itens_rmi_id_rmi_idx on public.itens_rmi (id_rmi);
create index itens_rmi_prazo_status_idx on public.itens_rmi (prazo_status);
create index itens_rmi_desvio_idx on public.itens_rmi (desvio_saldo_orcamentario);

comment on table public.itens_rmi is
  'Itens de RMI (Requisicao de Material e Insumo) por obra, via API do PortalMSE (rmi_api) -- fonte separada de itens_mapa_compras (mapa_compras_api), mesma tela de Suprimentos. Tem prazo_status/desvio_saldo_orcamentario prontos da origem. Chave = id (id proprio do item na origem, presumido globalmente unico -- confirmar na 1a carga real).';

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
   agendamento:
   - Se o node "Montar linhas por obra" lançar erro de "total não bate
     com data.length", `all=true` não trouxe tudo de uma vez pra alguma
     obra — precisa trocar por paginação manual (`page`) nessa obra
     específica.
   - Conferir por obra: `select id_obra, count(*) from itens_rmi group by id_obra;`
   - Conferir a distribuição de prazo (dá pra já visualizar o que "crítico"
     poderia significar):
     `select prazo_status, count(*) from itens_rmi group by prazo_status;`
6. **Ativar** o workflow (agendado pra 08:00 — 06:00 é Orçamentos
   Complementares, 07:00 é Pedidos, 07:30 é Mapa de Compras).

## Decisões de desenho, pra quem for mexer depois

- **6 obras fixas na lista** (`Lista de obras`), sem CNPEM - Auditório
  (id 103) — mesmo padrão dos outros 3 fluxos de ingestão deste projeto.
- **`?all=true` por obra, não globalmente** — mesmo raciocínio dos outros
  fluxos. Diferente deles, aqui dá pra CONFERIR se funcionou de verdade
  (o campo `total` no envelope da resposta), então o Code node trava com
  erro explícito se `all=true` não tiver trazido tudo — ver guard no
  código.
- **Upsert em LOTE por obra** (1 POST com array de N itens), mesmo padrão
  dos outros fluxos.
- **`id` da própria API vira a PK direto** (sem coluna identity
  separada) — é a 1ª das 4 fontes de ingestão deste projeto que confirma
  ter um id numérico de verdade; as outras 3 precisaram de chave
  composta "no chute" por não terem isso.
- **Conversão numérica/booleana explícita no Code node** (`num()`/
  `bool()`) — mesmo raciocínio defensivo do fluxo de Mapa de Compras (a
  API irmã `pedidos_usuarios_api` já mandou número como string apesar da
  doc dizer "número").
- **`raw jsonb` guarda o item inteiro** — rede de segurança padrão deste
  projeto pra campo que a doc não detalhou o suficiente (aqui, menos
  necessário que nos outros fluxos, já que este guia é o mais completo,
  mas mantido por consistência).

## Consumo no painel (ainda não implementado)

```
GET {SUPABASE_URL}/rest/v1/itens_rmi?id_obra=eq.{obraId}&select=*&order=prazo_status.asc,codigo_seq.asc
```

Pra montar a régua de "crítico" combinando as 2 fontes (ver tabela
comparativa acima), o consumo provavelmente vai precisar ler
`itens_mapa_compras` E `itens_rmi` juntos — decisão de produto de como
cruzar as 2 (por `codigo_seq`? por descrição? são grãos realmente
equivalentes item-a-item, ou uma é subconjunto da outra?) ainda não foi
tomada, e não dá pra responder sem comparar dado real das 2 tabelas lado
a lado depois da 1ª carga.
