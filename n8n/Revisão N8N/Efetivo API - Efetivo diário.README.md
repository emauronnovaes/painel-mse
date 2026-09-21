# Ingestão n8n — Efetivo diário (`hub_mse/api_efetivo`)

Workflow: `Efetivo API - Efetivo diário.json`. Substitui o fluxo antigo
`Efetivo Diário` (id `FRWjR2Rdbqfa2fvn`), reescrito no padrão dos 4 fluxos de
Avanços revisados em 18/09.

Fonte: `GET https://portalmse.com.br/microservices/hub_mse/api_efetivo/efetivo`.

Destinos (grava nos dois, como os fluxos de Avanços):

| | tabela | chave | quem lê hoje |
|---|---|---|---|
| Supabase **projeto Efetivo** (`wnldmumgjwujveeimyef`) | `efetivo_diario_raw` | `obra_id + data_efetivo_diario + id_funcionario + id_empresa` | `prototipo/index.html` (Histograma, selo "Ausente", status `nao_lancado`) e `prototipo/combinado/index.html` |
| Supabase **projeto Efetivo** | `efetivo_resumo_diario` | `obra_id + data_efetivo_diario` | — |
| MySQL `painelmse` | `efet_diario` | `data_efetivo_diario + id_obra + id_funcionario + id_empresa` | ninguém ainda (destino da migração) |
| MySQL `painelmse` | `efet_resumo_diario` | `data_efetivo_diario + id_obra` | ninguém ainda |

⚠️ **Não é o Supabase principal.** Efetivo mora num projeto separado
(`wnldmumgjwujveeimyef`), não no `gebjlhkywtnpfqjrakok` do resto do painel. O
front tem duas constantes justamente por isso (`SUPABASE_URL` e
`EFETIVO_SUPABASE_URL`).

## Antes de importar

**1. Criar 2 credenciais no n8n** (o fluxo antigo tinha token e service_role
key escritos em texto puro dentro dos nodes — este não tem):

- `Efetivo (Hub MSE)` — tipo **Bearer Auth**. O token da `api_efetivo` é
  próprio dela: os tokens de `rmi_api`, `mapa_compras_api`,
  `orcamentos_complementares_api` e `api_avancos` todos dão **403
  `{"error":"Token inválido para esta API."}`** aqui (testado 21/09).
  O token em uso está no export do fluxo antigo — **rotacionar**, porque esse
  JSON está espalhado em 5 pastas do disco (`tmp-n8n-export`,
  `tmp-n8n-after-import`, `tmp-n8n-verify`, `tmp-n8n-manual-verify`,
  `tmp-n8n-endpoint-verify`).
- `Supabase Efetivo (service_role)` — tipo **Supabase API**, apontando para
  `https://wnldmumgjwujveeimyef.supabase.co`. Precisa ser a **service_role**;
  a `anon` não escreve. A key atual também está em texto puro no export antigo
  — **rotacionar junto**.

Os nodes vêm com `id` de credencial falso (`CRIAR-CREDENCIAL-...`) de
propósito: ao importar, o n8n vai pedir para selecionar. O node MySQL já
aponta para a credencial `MySQL account` (`xtOj1i1tyu03Ztar`), a mesma dos
fluxos de Avanços.

**2. Desligar o fluxo antigo** (`Efetivo Diário`, `FRWjR2Rdbqfa2fvn`) antes de
ativar este — os dois escrevem nas mesmas duas tabelas do Supabase.

## Desenho

```
Diariamente 23h → Definir datas → Loop data (1 por vez)
   → Buscar efetivo do dia (1 chamada, TODAS as obras)
   → Montar efetivo do dia (filtro de obras + montagem do SQL)
   → Upsert detalhe Supabase → Upsert resumo Supabase
   → Gravar efet_diario → Gravar efet_resumo_diario
   → Remover detalhe que saiu → Remover resumo órfão
   ↩ volta pro Loop
```

**Uma chamada por dia, não por obra.** Omitindo `obra_id`, a API devolve as
21 obras de uma vez (~400 KB, confirmado 21/09). O fluxo antigo fazia loop
`obra × dia` sem precisar — num backfill de 30 dias isso era 210 chamadas
contra 30.

**Escritas em cadeia, não em leque.** Os 6 nodes de gravação estão em série e
só o último volta pro `splitInBatches`. Em leque (o desenho do
`Avanços API - Efetivo ocupado`), o loop pode puxar o dia seguinte antes das
outras pontas terminarem. Por isso os nodes de escrita leem
`$('Montar efetivo do dia').first().json.<campo>` em vez de `$json`.

## Ajustes no node "Definir datas"

- Modo normal: `DIAS = 2` — regrava hoje e ontem. O dia corrente ainda muda
  até o fim do turno, então regravar ontem corrige o que entrou depois das 23h.
- Backfill/recarga: preencher `DATA_INICIO` e `DATA_FIM` (`'YYYY-MM-DD'`, os
  dois). Estoura se só um estiver preenchido ou se `DATA_FIM < DATA_INICIO`.

## Ajustes no node "Montar efetivo do dia"

`const OBRAS = [91, 94, 106, 107, 108, 110, 114]` — as 7 obras da tabela
canônica `painelmse.obras`. Para gravar tudo que a API devolver (inclui
`MSE SEDE`, `AFASTADOS`, `LMS`, `DTE`…), trocar por `null`. Para voltar ao
conjunto do fluxo antigo, acrescentar `103` (CNPEM-AUDITÓRIO, que não está na
tabela `obras`).

## Proteções que o fluxo antigo não tinha

- **Carga vazia silenciosa**: se a resposta traz funcionários e nenhum sobrevive
  ao mapeamento, o node estoura com a amostra do registro problemático. Sem
  isso o `INSERT` vira `SELECT 1` e o fluxo termina verde sem gravar nada.
- **Formato inesperado**: se `obras` não vier como array, estoura listando as
  chaves recebidas.
- **Resposta vazia não apaga nada**: os dois `DELETE` só rodam quando pelo
  menos uma obra veio na resposta, e só dentro das obras que vieram. API fora
  do ar ou dia sem lançamento não limpa histórico.
- **Escape de SQL**: aspas, barra e `\x00` escapados (`D'AVILA` e afins).
- **`AS novo` em vez de `VALUES(col)`** no `ON DUPLICATE KEY UPDATE` —
  `VALUES()` está deprecado no MySQL 8.4 e gerava um warning 1287 por coluna
  por statement (10 e 14 por execução). Zero warnings agora.

## Campos da API (amostra real de 2026-09-18, 21 obras, 1 547 pessoas)

Envelope: `{data: {data_efetivo_diario, is_hoje, fonte, obra_id, total_obras,
obras: [{id_obra, nome_obra, total, resumo: {...}, efetivo: [...]}]}}`.

- `resumo` — `total`, `presentes`, `presentes_d`, `presentes_int`,
  `presentes_n`, `ausentes`, `mobilizacao`, `sede`, `sem_atividade`, `outros`.
- `efetivo[]` — `id_funcionario`, `nome`, `tipo_funcionario` (`MSE`/`TERCEIRO`),
  `moi_mod`, `id_funcao`, `nome_funcao`, `id_empresa`, `razao_social`,
  `data_admissao`, `situacao`, `observacao`.
- `situacao` observadas: `Presente D`, `Ausente`, `Sede`, `Mobilização`,
  `Sem atividade`. Nenhum campo veio `null` na amostra; `observacao` veio
  sempre `""`.

O MySQL não guarda `raw` (as tabelas irmãs `eap_*` também não). O Supabase
continua guardando, porque a coluna já existe lá.

## Diferenças de nome entre os dois destinos

O Supabase usa `obra_id` e o MySQL usa `id_obra` — o padrão do doc
[[16 - Plano de Migração Supabase → MySQL]] (ADR-004) é `id_obra`, mas
renomear no Supabase quebraria as 5 leituras do front. O node monta os dois
formatos; quando o front migrar, as tabelas do Supabase morrem e o `obra_id`
some junto.

## Verificação feita (21/09/2026)

- `GET /efetivo?data_efetivo_diario=2026-09-18` → 200, 21 obras.
- Node "Montar efetivo do dia" rodado contra a resposta real: 1 069 linhas de
  detalhe e 7 de resumo para as 7 obras; 0 descartados.
- SQL executado de verdade contra `painelmse`: insert 1 069 + 7, 0 warnings,
  segunda execução idempotente (continua 1 069 e 7, `DELETE` afeta 0 linhas).
- Payload do Supabase validado com 1 linha de detalhe e 1 de resumo da obra 91
  em 2026-09-18 (dia que o fluxo antigo já carregava): 201 e sem duplicar.
- Casos cobertos em teste: payload já desembrulhado, dia sem obra nenhuma,
  aspas/backslash no nome, funcionário sem `id_empresa`, todos os
  funcionários inválidos, formato inesperado.
