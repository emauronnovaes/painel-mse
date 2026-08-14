# Ingestão n8n — Orçamentos Complementares (aba OC/CO)

Workflow: `orcamentos-complementares.workflow.json`. Alimenta a tabela
`orcamentos_complementares_obra` (Supabase, projeto `gebjlhkywtnpfqjrakok`,
o mesmo já usado pelo dashboard-main e pelo painel-mse).

## Antes de importar

**Importante — escopo**: essa API cobre só **Orçamentos Complementares**
(o lado "CO"/Change Order do setor OC/CO). Ela **não** cobre Ordens de
Compra de material/serviço (o lado "OC") — essa fonte continua sem existir.
A aba OC/CO no painel só pode virar "pronto" de verdade quando as duas
pontas tiverem dado; por ora dá pra montar só a metade CO.

**Obra "extra" encontrada na carga real (2026-08-11)**: a API retornou OCs
com `obra_id: 103, obra_nome: "CNPEM - AUDITÓRIO"` — essa obra **não existe**
no array `OBRAS` do `prototipo/index.html` (só tem 106/110/94/107/108/91).
O workflow foi corrigido para **não depender mais de uma lista fixa de
obras** — ele deriva as obras direto do que a API devolve (`obra_id` +
`obra_nome` de cada OC), então essa obra 103 (e qualquer outra que apareça
no futuro) entra na tabela do Supabase normalmente. **Decisão pendente,
não é técnica**: CNPEM - Auditório deve entrar como 7ª obra do painel-mse,
ou fica de fora por ser outro contrato/projeto? Isso não afeta a ingestão
(já grava certo de qualquer forma) — só afeta o que o front-end do setor
OC/CO vai mostrar quando for construído.

**Campos reais confirmados** (mais ricos que o exemplo simplificado da doc
da API): `id, id_solicitacao, numero_oc, numero_oc_formatado, obra_id,
obra_nome, id_eap, tipo_solicitacao, descricao, temos_interesse,
interesse_contrato_original, credito_debito, status_oc,
link_evidencia_aprovacao, url_evidencia, solicitado_cliente,
responsavel_mse, data_inicio, validade_oc, data_revisao, enviado_medicao,
link_envio_medicao, valor_material, valor_servicos, valor_fd, valor_final,
material_comprado, status_execucao, observacao, status_cadastro,
usuario_cadastro, data_cadastro`. Os campos `solicitacao`/`anexos`/
`form_descricao`/`historico` do exemplo da doc **não apareceram** na carga
real — provavelmente exemplo desatualizado ou específico de outro
endpoint. Valores monetários (`valor_final` etc.) vêm como **string**
("418607.66"), não number — ficam assim dentro do `ocs` jsonb; quem for
consumir precisa fazer o cast (`::numeric` no SQL, `Number()` no
front-end).

## Passo a passo

1. **Importar o workflow** no n8n: Workflows → Import from File →
   `orcamentos-complementares.workflow.json`.
2. **Criar a credencial da API do PortalMSE** (nó "Buscar todas as OCs" e
   "Buscar resumo por obra"):
   - Tipo: **Bearer Token** (`httpBearerAuth`)
   - Nome: `PortalMSE - Orçamentos Complementares` (nome exato esperado
     pelo workflow — se usar outro nome, precisa reatribuir manualmente
     nos 2 nós HTTP que chamam a API)
   - Token: o token fornecido pela equipe MSE para essa API. **Nunca cole
     o token em chat/documento** — cadastre direto no formulário de
     credencial do n8n.
3. **Criar a credencial do Supabase** (nó "Upsert no Supabase"):
   - Tipo: **Custom Auth** (`httpCustomAuth`)
   - Nome: `Supabase - API Portal (service_role)`
   - JSON da credencial:
     ```json
     { "headers": { "apikey": "<SERVICE_ROLE_KEY>", "Authorization": "Bearer <SERVICE_ROLE_KEY>" } }
     ```
   - `<SERVICE_ROLE_KEY>` é a chave `service_role` do projeto Supabase
     `gebjlhkywtnpfqjrakok` (Settings → API no painel do Supabase) — **não**
     é a mesma chave `anon` usada pelo front-end. Precisa ser a
     `service_role` porque a tabela tem RLS ativo e só essa role tem
     permissão de escrita (mesmo padrão de `restricoes_obra`/`pts_emitidas`).
4. **Ajustar o agendamento** se quiser horário diferente das 06:00 (nó
   "Agendamento Diário") — outros carregamentos do projeto rodam em
   horários espalhados entre 03:00 e 16:35 (ver memória
   `ingestao-n8n-supabase`), 06:00 foi só um chute razoável.
5. **Rodar manualmente uma vez** ("Execute Workflow") antes de ativar o
   agendamento, pra conferir se todas as obras que aparecem na API (hoje
   inclui pelo menos 7: as 6 do painel + CNPEM - Auditório) chegam certas
   em `orcamentos_complementares_obra` no Supabase.
6. **Ativar** o workflow.

**Se você já importou uma versão anterior deste workflow**: reimporte de
novo, ou pelo menos aplique estas 2 correções manualmente nos nodes
existentes:

1. **"Agrupar OCs por obra"** — versão antiga tinha uma lista fixa de 6
   obras que descartava em silêncio qualquer obra fora dela (foi assim que
   a obra 103 apareceu nos dados brutos mas não teria ido pro Supabase).
2. **"Montar registro final"** — **bug real, confirmado numa execução completa
   que só gravou 1 obra em vez de todas, sem nenhum erro reportado pelo
   n8n**: esse node estava sem `mode: "runOnceForEachItem"` nos parâmetros.
   Sem isso, o n8n roda o código do Code node **1 VEZ SÓ para o workflow
   inteiro** (modo padrão "Run Once for All Items"), então mesmo recebendo
   6-7 obras diferentes, o `return` só devolvia 1 item — e como o n8n
   considera isso uma execução bem-sucedida (o código não jogou erro, só
   processou "menos" do que devia), **nenhum node fica vermelho, não
   aparece nada de errado nos logs**. Pra corrigir manualmente sem
   reimportar: abrir o node "Montar registro final" → no topo do editor de
   código, mudar "Run Once for All Items" pra **"Run Once for Each Item"**
   → ajustar o código pra usar `$input.item.json` (item atual) em vez de
   `$json` cru, e `return {json:{...}}` (objeto único, sem colchetes de
   array) em vez de `return [{json:{...}}]`.

**Diagnóstico gerador desse achado**: 2 execuções completas ("Execute
Workflow") em sequência gravaram só 1 obra nova cada (nunca as 6-7 juntas),
e uma obra já gravada (CNPEM/106) ficou com o MESMO `atualizado_em` da
primeira carga mesmo depois de 2 reexecuções — sinal de que ela nunca foi
reprocessada de novo, e sim sempre alguma outra obra "vencia" a disputa por
ser a única que sobrevivia ao `return` de 1 item só (o resultado varia
conforme a ordem de chegada dos dados, não é fixo).

## Se o n8n reclamar de versão de nó ao importar

Os `typeVersion` usados (`scheduleTrigger` 1.2, `httpRequest` 4.2, `code`
2) são de versões razoavelmente recentes e estáveis do n8n. Se a instância
usada for mais antiga/mais nova e o import reclamar, abra cada nó com aviso
e deixe o n8n oferecer a atualização automática de versão — a lógica
(parâmetros, expressões) não muda entre essas revisões menores.

## Por que 2 chamadas HTTP por obra em vez de 1

A API não tem endpoint único "tudo por obra" — `/v1/orcamentos_complementares`
traz TODAS as obras de uma vez (por isso só 1 chamada, agrupada depois no
código pelas obras que realmente aparecerem nos dados), mas `/v1/resumo`
exige `obra_id` por chamada (por isso roda 1 vez por obra encontrada — hoje
pelo menos 7, pode mudar conforme a API ganha/perde obras). Sem paginação
em nenhum dos dois, então não tem lógica de "próxima página" a implementar.

## Consumo no painel (ainda não implementado)

Front-end (painel-mse) ainda não lê essa tabela — o setor 5 (OC/CO)
continua placeholder. Consumo esperado, mesmo padrão de `restricoes_obra`:

```
GET {SUPABASE_URL}/rest/v1/orcamentos_complementares_obra?id_obra=eq.{obraId}&select=ocs,resumo,total,atualizado_em
```
