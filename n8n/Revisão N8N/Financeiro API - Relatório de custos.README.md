# Ingestão n8n — Índice financeiro / Performance (`avancos_api`)

Workflow: `Financeiro API - Relatório de custos.json`. Substitui o fluxo antigo
`Relatório de Custos` (id `R31QL8jIOJyqnzjg`), reescrito no padrão dos fluxos
revisados em 18–21/09.

Fonte: `GET https://portalmse.com.br/microservices/avancos_api/v1/receita_custos/{id_eap}?dia_start=&dia_end=`

⚠️ **Não é o `hub_mse/api_avancos`.** É o `avancos_api` antigo, com token
próprio. Trocar as chaves dá 403.

Destinos:

| | tabela | chave | quem lê |
|---|---|---|---|
| MySQL `painelmse` | `fin_medicao_acumulada` | `data_referencia + tarefa_id` | rota `/eap/indices-financeiros` → Encarregados em `prototipo/index.html` |
| Supabase principal | `medicao_acumulada` | `tarefa_id, data_referencia` | view `v_indices_financeiros_diario` → `apresentacao/index.html` |
| Supabase principal | `tarefas` | `id` | a mesma view, só pelo `id_eap` |

## Por que continua existindo ingestão

Foi testado consultar a API na hora, como se faz em `/cards-ativos` e
`/restricoes`. **Não se sustenta.** Medição de 21/09/2026, `dia_end` 19/09:

| id_eap | janela | tempo | tarefas |
|---|---|---|---|
| 90 | 1 dia | 12,4 s | 3 |
| 32 | 1 dia | 9,8 s | 3 |
| 51 | 1 dia | **96,2 s** | 54 |
| 51 | 30 dias | **73,2 s** | 60 |
| 51 | 180 dias | não respondeu em 120 s | — |

O `id_eap` 51 é a obra 91. Nenhum carregamento de tela espera 90 segundos. O
tempo **não depende da janela** — sete janelas de 1 a 180 dias deram o mesmo
resultado num teste anterior, todas estourando o limite de 60 s do cliente da
API. Então o fluxo paga a espera de madrugada e a tela lê do banco.

## Antes de importar

**1. Criar a credencial** `Custos (avancos_api)` no n8n, tipo **Bearer Auth**.
O token está em texto puro no export do fluxo antigo (node `Credenciais API`),
junto com uma `service_role` do Supabase — **rotacionar os dois**. Os nodes do
Supabase e do MySQL já apontam para as credenciais existentes
(`Supabase account`, `MySQL account`).

**2. Aplicar a migration** `api/src/db/migrations/010_financeiro.sql` (o boot
da API já aplica sozinho).

**3. Desligar o fluxo antigo** (`Relatório de Custos`, `R31QL8jIOJyqnzjg`)
antes de ativar este — os dois escrevem nas mesmas tabelas do Supabase.

## Desenho

```
Diariamente 04h → Listar EAPs (MySQL) → Combinar dia × EAP
   → Loop (1 por vez)
      → Buscar receita e custos (timeout 180s)
      → Montar índices
      → Upsert medicao_acumulada (Supabase) → Upsert tarefas (Supabase)
      → Gravar fin_medicao_acumulada (MySQL) → Remover tarefa que saiu (MySQL)
   ↩ volta pro Loop
```

**04h e 1 por vez.** 15 EAPs × 2 dias, com a maior levando ~90 s, passa de meia
hora. Em paralelo a origem devolve timeout em todas.

**A lista de EAPs vem do banco**, não de constante: `SELECT DISTINCT id_eap FROM
eap_tarefas` — a mesma consulta que a rota `/eap/indices-financeiros` usa. A
lista fixa do fluxo antigo tinha 13 ids e já estava faltando 2 (114 e 127).

## A regra da janela

A API devolve as tarefas com **movimento** dentro de `[dia_start, dia_end]`, e o
bloco `acumulado` de cada uma é o estado **no `dia_end`** — não o de hoje. Isso
foi conferido contra a view: para o `id_eap` 90 em 19/09, janela de 1 dia traz 3
tarefas e janela de 30 dias traz as 13 que a view tinha, **batendo valor a valor**
(`avanco_total` e índice, tolerância 1e-4).

`JANELA_DIAS = 30` no node "Combinar dia × EAP". Aumentar só acrescenta tarefa,
nunca troca valor de quem já veio — mas 180 dias passa do que a origem aguenta.

⚠️ **Mudança de comportamento:** com janela de 30 dias, cada dia recebe MAIS
tarefas do que o fluxo antigo gravava (ele usava `dia_start = dia_end`). Na
prática a Performance passa a aparecer em mais cards. Se a intenção for paridade
exata com o comportamento anterior, é só pôr `JANELA_DIAS = 0`.

## O que este fluxo deixou de fazer

**`medicao_diaria` não é mais alimentada.** O bloco `diario` de cada tarefa só
vem quando `dia_start == dia_end`; com a janela de 30 dias ele vem `null` em
100% das tarefas (conferido na origem). Alimentar as duas coisas exigiria uma
**segunda** chamada por EAP/dia numa origem que já leva 73–96 s na maior delas.

`medicao_diaria` não tem nenhum leitor — grep no repo, em `apresentacao/` e nas
cópias legadas do Dropbox, 21/09/2026. A tabela fica no Supabase com o histórico
até a última execução do fluxo antigo. **Se alguém lê essa tabela por fora e eu
não achei, é aqui que quebra.**

## O índice é coluna gerada, não conta no código

`fin_medicao_acumulada.indice_receita_custo_incorrido` é
`GENERATED ALWAYS AS (receita * (avanco_total / 100.0) / NULLIF(custo_incorrido, 0)) STORED`
— a mesma expressão que a view fazia. Assim a conta continua morando num lugar
só, em vez de ser reescrita em cada leitor. `sem_custo` idem.

Por isso as duas colunas **não entram no INSERT** do fluxo: o MySQL as calcula e
recusa valor explícito.

## Proteções que o fluxo antigo não tinha

- **Carga vazia silenciosa**: se vieram tarefas e nenhuma sobreviveu ao
  mapeamento, o node estoura com a amostra do registro problemático. Sem isso o
  `INSERT` vira `SELECT 1` e o fluxo termina verde sem gravar nada.
- **Formato inesperado**: se `tarefas` não vier como array, estoura listando as
  chaves recebidas — em vez do `IF - Skip Fantasma` do fluxo antigo, que
  engolia o caso em silêncio.
- **Resposta vazia não apaga nada**: o `DELETE` só roda quando pelo menos uma
  tarefa veio. Origem lenta/instável não limpa histórico.
- **Escape de SQL** e **`AS novo`** em vez de `VALUES(col)` (deprecado no
  MySQL 8.4).
- **Timeout de 180 s** no node HTTP, contra os 60 s padrão que faziam a `id_eap`
  51 falhar sempre.

## Verificação feita (21/09/2026)

- Node "Montar índices" rodado contra a resposta real do `id_eap` 90
  (janela 30 dias, 19/09): 14 tarefas, 0 descartadas.
- Casos cobertos: payload já desembrulhado, dia sem tarefa nenhuma, tarefa sem
  `id`, todas sem `id`, formato inesperado, aspas/backslash no texto.
- Colunas geradas testadas no MySQL: `receita 1000 / custo 500 / avanço 25%` →
  índice `0,5`, `sem_custo 0`; custo `0` → índice `NULL`, `sem_custo 1`.
- Carga real de 19/09 executada contra `painelmse` para as 15 EAPs.
