# Corte EAP e histórico de setembro no MySQL

## Resultado em 21/09/2026

Pedido: tratar a EAP como estado atual (sem restaurar registros removidos) e
trazer setembro inteiro de Apontamentos e alocação de efetivo para migrar o
consumo. Escopo de datas da carga: **01/09/2026 inclusivo a 01/10/2026
exclusivo**, com os dados disponíveis até a execução (21/09). Não se criam
dados para dias futuros. A ingestão Actions existente segue alimentando os
próximos dias; não foi duplicado cron nem removido dual-write.

### EAP atual

Consulta direta à API do Hub confirmou os **45 IDs ausentes** também fora da
origem: EAP 51 (43), 115 (1), 89 (1). Portanto, não são tarefas a reimportar.
Nenhuma linha do Supabase foi excluída e nenhuma dessas 45 foi restaurada.
O painel principal passa a ler `eap_tarefas` em Desvios, tarefa da restrição,
popup, produtividade HH e supressão de atividades no ranking.

### Histórico efetivamente importado

| Tabela MySQL | Antes | Inseridos | Depois (setembro) |
|---|---:|---:|---:|
| `eap_apontamentos` | 202 | 1.130 | 1.332 |
| `eap_apontamento_efetivo` | 1.097 | 8.211 | 9.308 |

Fonte da carga: Supabase principal, que contém os snapshots históricos; a
API do Hub dá o estado atual, não substitui esse histórico.

Importação em transação, sem DELETE. Chaves existentes não são sobrescritas
por um upsert geral. O script compara contagem da origem, rejeita chaves
duplicadas/nulas, verifica cobertura antes de COMMIT, cancela com rollback
em aviso de conversão. O primeiro ensaio de escrita foi revertido por esse
guard. Após ajuste dos tipos, carga concluída e reexecução em auditoria
confirmou **zero chaves pendentes e zero extras** em setembro.

### Correção de precisão

O schema real anterior divergia da migration 008: usava DECIMAL(18,6) em
`avanco_diario` e `meta_diaria`. Na amostra do mês, 3 avanços e 1 meta não
nulos seriam arredondados a zero; isso pode mudar a aderência. Migration 013:

- `qtd` → VARCHAR(64), igual à intenção da migration 008, preservando texto
  numérico da origem (em vez de truncar a quatro casas);
- `avanco_diario` e `meta_diaria` → DOUBLE, como na migration 008;
- examina schema antes de ALTER, não altera novamente se já adequado;
- não remove linhas nem reduz VARCHAR preexistente maior que 64.

Um avanço já existente foi recomposto da origem: diferença de aproximadamente
1,192 × 10⁻⁸, comprovadamente o arredondamento ao antigo DECIMAL. O UPDATE
usa chave e comparação com o valor antigo (compare-and-set), sem substituir
outros campos/snapshots. Essas recomposições são contadas pelo importador.

O runner de migrations agora admite `.js` idempotente para alterações
condicionais de schema, além dos `.sql`. A migration 012 documenta a tabela
de alocação que já existia em produção mas faltava em ambientes novos.

## Consumo do painel principal

Rotas montadas em `/eap` e `/api/eap`:

| Rota | Uso / fonte |
|---|---|
| `/tarefas` | EAP atual, por `ids`, `id_obra` ou `id_eap` + `edt` |
| `/apontamentos` | Qualidade e avanço por `ids`, `desde`, `ate` |
| `/alocacoes` | Pessoas alocadas nas tarefas por `ids`, `desde`, `ate` |
| `/aderencia` | Equivalente consumido de `vw_dados_tv`, JOIN Apontamentos × EAP |

Consultas parametrizadas; `Range` até 1.000 itens; IDs em lotes de até 200;
ordem estável; array vazio só quando realmente sem dado; falha de banco 503;
data inválida 400; histórico anterior a setembro na API MySQL retorna 422.

`prototipo/lib/eap-data.js` divide as janelas por data:

- **Desde 01/09/2026:** exclusivamente MySQL.
- **Até 31/08/2026:** Supabase (ranking ainda permite meses antigos).
- Janela cruzando o corte: duas faixas não sobrepostas, ambas paginadas;
  falha de qualquer parte invalida o conjunto. Não há fallback por erro nem
  fallback quando o MySQL retorna vazio.

Qualidade e alocação do módulo de Encarregados consultam o **dia exato da
Data de Status**. Ranking consulta o período selecionado. O popup conserva
a janela recente e a referência selecionada. Falhas de histórico/EAP agora
mostram erro explícito, não deixam os indicadores parecerem vazios ou o
ranking eternamente carregando.

O recuo automático vale apenas quando não há escolha manual. Ao selecionar uma
data no campo `Data de Status`, o painel mantém exatamente o dia solicitado,
mesmo que a obra não tenha lançamento; nesse caso os indicadores ficam sem
valor (`—`). A consulta da aderência também desloca sua janela para perto da
data escolhida, permitindo consultar manualmente períodos mais antigos.

### Aderência e UUID

A definição da view Supabase foi consultada antes da implementação. A regra
é arredondar `LEAST(avanco_diario / NULLIF(meta_diaria, 0), 1.2)` a quatro
casas. No Postgres, LEAST ignora NULL; no MySQL, não. O SQL novo usa COALESCE
para reproduzir inclusive meta zero/nula e avanço nulo (resultado 1,2 na
regra original), sem inventar uma regra de negócio nesta migração.

O popup recebe `ADERENCIA_LINEAR` no próprio apontamento MySQL. **Não precisa
de UUID gerado pelo Supabase** para novos registros. O cruzamento por UUID
permanece apenas quando exibe um apontamento anterior a setembro. UUIDs não
foram sintetizados nem usados como nova chave; a chave é tarefa/data. A view
de aderência usa o encarregado da EAP atual, como o JOIN da view original.
As tarefas retiradas da origem não são ressuscitadas para preencher esse JOIN.

### Acesso

Políticas verificadas ao vivo em `pg_policies`: EAP/alocação permitem SELECT
public true; Apontamentos permite anon true. Novas rotas não expõem colunas
administrativas e mantêm o acesso já disponível. Nenhuma mudança no login,
RLS de financeiro ou Edge Function de Efetivo diário foi feita.

## Testes e operação

Resultado desta etapa: **50 testes unitários e 10 testes Chromium aprovados**.
A verificação HTTP com MySQL real também passou: **zero divergências** nos
campos consumidos das 1.332 linhas de apontamentos e 9.308 de alocação,
1.332 linhas de aderência, oito obras EAP paginadas e seis casos da fórmula.
`git diff --check` e checagens de sintaxe sem erros.

Na raiz:

```sh
npm run test:unit
npx playwright test --project=chromium tests/eap-mysql.spec.js tests/cards-mysql.spec.js tests/data-client-contract.spec.js --reporter=line --workers=3
```

Na pasta `api` (credenciais em `api/.env`, gestão Supabase em
`SUPABASE_ACCESS_TOKEN`, nunca impressas):

```sh
node scripts/conferir-eap-origem.mjs
node scripts/importar-setembro-eap.mjs
node scripts/importar-setembro-eap.mjs --aplicar
node scripts/verificar-dados-eap.mjs
```

O importador sem `--aplicar` é somente leitura. Com a flag, aplica apenas a
migration condicional 013 e a carga delimitada acima; não roda cron nem
outras migrations. A verificação HTTP sobe a API em porta local efêmera e
compara campos consumidos das 1.332/9.308 linhas com a origem, paginação,
oito obras na EAP e seis casos da fórmula de aderência. Não imprime dados
pessoais. Os testes de navegador usam fixtures; a integração HTTP usa MySQL
real e lê Supabase apenas para comparação.

## Publicação e limites

**Banco já atualizado; código ainda local, sem deploy.** Publicar primeiro
API/migrations, confirmar as quatro rotas, depois frontend incluindo
`lib/eap-data.js`. Em banco novo, executar carga de setembro antes de mudar
o frontend. Não publicar só o HTML sem o módulo JavaScript novo.

Os testes não autorizam desligar Supabase: permanece necessário antes do
corte, no login e em outros domínios (Efetivo diário/Histograma, Curva S,
PTs, relatórios e status manuais). `apresentacao` e `prototipo/combinado`
continuam entradas legadas, fora desta alteração.

Rollback de consumo: reverter apenas os consumidores desta fatia; os dados
importados e o schema ampliado podem permanecer, compatíveis com os Actions.
Não apagar setembro nem reduzir novamente a precisão dos campos.
