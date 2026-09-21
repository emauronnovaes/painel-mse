# Auditoria das fontes e consumo MySQL — 21/09/2026

> Registro da auditoria inicial. A pendência de EAP/histórico foi resolvida
> na continuação: [[18 - Corte EAP e histórico de setembro no MySQL]].
> Desde setembro, EAP/Apontamentos/Alocação/Aderência usam MySQL no código
> atualizado; as tabelas abaixo registram o estado **antes dessa continuação**.

Escopo implementado: `prototipo/index.html`, aplicação principal. Alterações
locais anteriores (especialmente índices financeiros) foram preservadas.
Não houve deploy, mudança de cron, exclusão nem carga de dados nesta etapa.

## Fonte efetiva por domínio

Uma URL da API intermediária **não significa** que a fonte seja MySQL.
Inventário conferido nos consumidores e nos handlers da API:

| Consumo | Fonte efetiva nesta versão | Próxima dependência |
|---|---|---|
| Cards: Encarregados, popup e ranking geral | **MySQL `eap_cards_ativos`, nova rota `/eap/cards`** | Publicar API antes do frontend |
| Índice financeiro por tarefa no painel principal | MySQL `fin_medicao_acumulada`, `/eap/indices-financeiros` (alteração local preexistente) | Conferir cobertura dos dias exibidos e proteção dos valores financeiros antes do deploy |
| Medições | MySQL `med_contratos` / `med_boletins` | Autorização continua por RPC Supabase |
| RMI e Mapa de Compras | MySQL `sup_rmi` / `sup_mapa_compras_*` | Status manuais ainda fora do MySQL |
| Restrições | API do Hub, com cache; **não** `rest_restricoes` | Confirmar atualização da ingestão antes de usar o snapshot antigo |
| OC/CO | API de orçamentos, com cache; **não** `oc_orcamentos` | Confirmar atualização da ingestão e preservar autorização financeira |
| EAP / Desvios / tarefa da restrição | Supabase `EAP` | Reconciliar 45 IDs e tipos/precisão |
| Qualidade, histórico de avanço e aderência | Supabase `Apontamentos` / `vw_dados_tv` | Importar histórico e portar view, preservando UUIDs usados nos cruzamentos |
| Pessoas alocadas por tarefa | Supabase `apontamento_efetivo` | Importar histórico; o painel compara com a Data de Status |
| Presença / Histograma / previsto | Edge Function `efetivo` no projeto principal → projeto Supabase Efetivo | Histórico, agregado diário/semanal/mensal, previsto e sessão MSE |
| Curva S | Supabase `curvas_s` | Portar tabela e escritor externo; API deve preservar séries e nomes das obras |
| PTs | Supabase `pts_emitidas` | Identificar ingestão e portar tabela |
| Relatório semanal | Supabase `relatorio_produtividade_semanal` | Portar produtor e referências dos relatórios |
| Status manual de suprimentos | Supabase `suprimentos_status_manual` (GET, POST, DELETE) | Migrar escrita e permissões, não só consulta |
| Login/SSO e acesso por obra | Supabase Auth, Edge Function e RPCs | Etapa própria de autenticação; não removida |
| Fotos, ortofoto, Tour 360° | Assets estáticos e Constructin | Não são dados relacionais a migrar |

`apresentacao/index.html` e `prototipo/combinado/index.html` são entradas
separadas, ainda com consultas Supabase. Não foram convertidas nem devem ser
contadas como migradas. Não é seguro desligar Supabase ou o dual-write.

## Comparação real dos espelhos

Auditoria somente leitura via MySQL e Management API Supabase:

| Dataset | MySQL | Supabase | Resultado |
|---|---:|---:|---|
| Cards ativos | 258 | 258 | Mesmos IDs e campos de negócio, nenhuma divergência |
| EAP | 7.052 | 7.097 | 45 ausentes no MySQL; nenhuma linha extra |
| Apontamentos | 202 | 8.426 | MySQL começa em 17/09; Supabase em 13/04 |
| Alocação de efetivo | 1.097 | 15.251 | MySQL começa em 18/09; Supabase em 17/08 |

EAP ausente: 43 linhas da obra 91/EAP 51, uma da obra 110/EAP 115 e uma da
obra 107/EAP 89. Não foi presumido se são tarefas removidas da origem ou
lacunas de ingestão. Há uma diferença de `nome_obra` e arredondamentos em
352 `qtd` / 353 `saldo_qtd` (máximo aproximadamente 0,00005). O schema MySQL
real usa DECIMAL/DATE, diferentemente dos DOUBLE/VARCHAR na migration 008;
`CREATE TABLE IF NOT EXISTS` não reconcilia tabelas preexistentes.

Há 4.273 linhas em `efet_diario`, mas isso **não** comprova equivalência com
as views do Efetivo. A Edge Function exige sessão autenticada `@mse.com.br`;
uma rota pública de pessoas seria regressão de segurança. `efet_resumo_diario`
também não deve substituir as views sem conferir a regra de agregação.

## Fatia migrada: cards ativos

- `GET /eap/cards` (também `/api/eap/cards`) lê apenas MySQL e retorna array.
- Filtros: `id_obra`, `id_eap`, `encarregado` (trecho literal, sem distinção
  de maiúsculas) e `com_encarregado=true` (não nulo, como o PostgREST).
- Paginação `Range: inicio-fim`, `Range-Unit: items`, até 1.000 itens por
  página, ordenação por obra/EDT/card_id; última página vazia encerra a leitura.
- Erro de banco retorna 503. Não faz fallback silencioso nem retorna `[]`
  como se fosse sucesso. Filtros/intervalos inválidos retornam 400.
- Políticas de `cards_ativos` conferidas ao vivo em `pg_policies`: existe
  SELECT público permissivo `qual=true`. A rota mantém esse nível, com
  seleção explícita dos dez campos de negócio, sem colunas administrativas.
- Fonte alimentada pelo Actions do `mse-avancos-sync`, a cada quatro horas.
  Não foi criado outro cron. A rota antiga `/eap/cards-ativos` continua sendo
  Hub, com seu contrato original, para não alterar consumidores externos.
- Migration 011 reproduz a tabela para novos ambientes; não altera a
  estrutura nem os dados da tabela já existente.

## Validação e publicação

Resultados desta etapa: 38 testes unitários aprovados, cinco testes Chromium
aprovados (incluindo os três consumidores/erro e os dois contratos do cliente),
integração de leitura com MySQL real aprovada: 258 cards em três páginas de
100, sem IDs repetidos e com filtro real por responsável/obra/EAP. Os testes
de navegador usam respostas controladas; não equivalem a validar um deploy
em produção. `git diff --check` sem erros.

Na raiz: `npm run test:unit` e
`npx playwright test --project=chromium tests/cards-mysql.spec.js tests/data-client-contract.spec.js`.

Na pasta `api`:

```sh
node scripts/auditar-fontes-eap.mjs
node scripts/verificar-cards-mysql.mjs
```

A auditoria exige `SUPABASE_ACCESS_TOKEN` no ambiente; ambas usam o
`api/.env` explicitamente para o MySQL (havia credenciais homônimas de outro
contexto no terminal). Não imprimem chaves, nomes de pessoas nem valores
financeiros. O teste de integração monta só a rota em porta local efêmera,
sem aplicar migrations, disparar cron ou executar escritas.

Publicação: primeiro API (incluindo migration 011), testar `/api/eap/cards`,
depois frontend. Revalidar equivalência/frescor antes do corte. Rollback da
fatia de consumo: restaurar apenas as três URLs de cards para Supabase;
ingestão dual permanece intacta.

Essa etapa seguinte foi concluída em [[18 - Corte EAP e histórico de setembro
no MySQL]]: 45 tarefas realmente removidas da origem, setembro importado,
fórmula da view portada sem depender de novos UUIDs. Períodos anteriores
permanecem explicitamente no legado.
