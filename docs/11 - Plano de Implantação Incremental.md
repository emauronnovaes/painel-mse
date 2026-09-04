# Plano de Implantação Incremental

Este plano define a ordem da refatoração do `prototipo/index.html`. Cada fase
deve terminar com os testes indicados e uma validação visual antes da próxima.

## Linha de base preservada

- Backup local: `backups/pre-refactor-20260904-133720/`.
- O backup inclui o protótipo, configuração Firebase, manifests npm, testes e
  o workflow n8n que já tinha alterações locais.
- O working tree já estava sujo antes da refatoração; alterações existentes
  não devem ser descartadas ou sobrescritas.

## Regras de cada etapa

1. Fazer uma mudança pequena e isolada.
2. Rodar lint/checagem sintática e os testes automatizados.
3. Rodar o protótipo localmente e validar a aba afetada em desktop e mobile.
4. Registrar a alteração e qualquer decisão no Blueprint.
5. Só então iniciar a etapa seguinte.

## Fases

### 0. Baseline e inventário

Catalogar rotas, setores, fontes, consultas, cálculos e estados de erro.
Criar uma suíte mínima Playwright para carregar cada rota e capturar erros de
console. Critério: todas as rotas atuais continuam abrindo sem regressão.

### 1. Segurança operacional do Git

Trabalhar em branch própria (`refactor/prototipo-incremental`) e manter commits
pequenos por fase. Não misturar refatoração com mudanças de regra de negócio.

### 2. Camada de dados sem alterar o visual

Extrair um cliente Supabase único com paginação, timeout, tratamento de RLS,
`Content-Range`, retry limitado e metadados de frescor. Migrar primeiro as
consultas que ainda usam `fetch()` direto e `limit=1000`. Critério: respostas
iguais às atuais e nenhum dado truncado acima de 1.000 linhas.

### 3. Funções de domínio puras

Mover cálculos para módulos testáveis: datas, aderência, metas, criticidade,
status, Curva A, agrupamentos, medições e semáforos. Criar testes de borda para
`null`, vazio, datas reagendadas, escalas 0–1/0–100 e nomes divergentes.

### 4. Configuração declarativa

Separar obras, setores, contratos, aliases de fonte e configurações específicas
por obra. Validar a configuração na inicialização e impedir obra/setor
silenciosamente inválido.

### 5. Componentização mantendo o comportamento

Extrair Header, seletor de obra, abas, estados, modais e cada módulo de setor.
Nesta fase não redesenhar nem alterar fórmulas; o objetivo é apenas preservar
o comportamento com fronteiras claras.

### 6. Roteamento e estados de tela

Centralizar parsing/serialização do hash, validar slugs, tratar rota/obra
inexistente e preparar parâmetros compartilháveis na URL. Testar navegação,
back/forward e links diretos.

### 7. Testes e qualidade contínua

Configurar `npm test`, testes unitários e Playwright. Adicionar cobertura para
carga, vazio, erro, RLS, dado velho, filtros, popups, impressão e mobile.

### 8. Migração para Vite + TypeScript

Só depois de estabilizar as fases anteriores. Migrar por módulo, mantendo o
HTML publicado como fallback até a paridade visual/funcional ser comprovada.
Adicionar tipos para cada resposta e validar JSONB/nullable explicitamente.

### 9. Deploy controlado

Executar build, testes, smoke test local, deploy no site isolado e validação
remota. Fazer deploy de produção somente após aprovação visual e funcional.

## Registro de execução

### 2026-09-04 — Fases 0, 1 e início da Fase 2

- Criada a branch `refactor/prototipo-incremental` e preservado o backup em
  `backups/pre-refactor-20260904-133720/`.
- Adicionado o baseline Playwright das 9 rotas do Painel de Obra.
- Centralizadas as requisições HTTP do protótipo com timeout, paginação e falha
  integral quando uma página intermediária falha.
- Consultas do módulo de Efetivo, Encarregados, Restrições, OC/CO, Suprimentos
  e Medições migradas para o cliente central.
- Extraídos `parseValNum`, `parseDataFlexivel`,
  `normalizarNomeParaMatch` e `corDesvio` para
  `prototipo/lib/domain-utils.js`, com testes unitários.
- Validação atual: 4 testes unitários e 9 testes de rotas aprovados.

Commits: `ee45143`, `5688e54`, `e4bd02a`, `b677ace`, `8420cac`, `7d22df7`,
`45685c7` e `17598b4`.

Próximo passo: extrair as regras de aderência, dia de referência, metas
semanais e criticidade, preservando as fórmulas já validadas no dashboard.

## Critério de rollback

Se uma fase quebrar uma rota, alterar uma regra sem intenção ou introduzir
erro de dados, parar na fase atual, restaurar o último commit validado ou o
backup local e registrar a causa antes de continuar.
