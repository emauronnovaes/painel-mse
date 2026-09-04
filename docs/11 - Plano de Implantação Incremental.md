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

### 2026-09-04 — Regras puras de aderência e metas

- Criado `prototipo/lib/domain-utils.js` como módulo UMD, reutilizável pelo
  navegador e pelos testes Node.
- `parseValNum`, `parseDataFlexivel` e `normalizarNomeParaMatch` foram retirados
  do HTML e passaram a ser importados do módulo.
- `aderenciaSemanal` preserva a convenção da planilha: 100% quando previsto e
  realizado são zero; realizado sem previsto não gera percentual.
- `calcularMetaSemana` preserva o fator 1,15, o último corte realizado antes
  da janela e o limite da meta pelo saldo restante.
- Os testes de data validam componentes locais, pois a regra cria datas locais
  e `toISOString()` desloca o valor conforme o fuso horário.
- Validação: 6 testes unitários e 9 rotas Playwright aprovados.

Commit: `17598b4` (utilitários iniciais) e alterações desta etapa em andamento.

### 2026-09-04 — Criticidade e monitoramento

- Extraídos `criticidadeBase` e `monitoramentoBase` para o módulo de domínio.
- A camada visual continua responsável somente por mapear níveis semânticos
  para cores do Design System.
- Preservadas as regras: urgente/alta/moderada/baixa por prazo; monitoramento
  apenas para restrições abertas; atraso sempre prevalece; criticidade alta
  força “Em risco”.
- Validação: 8 testes unitários e 9 rotas Playwright aprovados após ajuste do
  fixture de teste para uma data realmente superior a 30 dias.

Commit desta etapa: `50ca963`.

### 2026-09-04 — Status e agregação de Suprimentos

- Extraídos `statusAtrasadoOuPendente`, `statusItemFolha` e
  `statusAutomaticoItem` para o módulo de domínio.
- Mantida a precedência: item finalizado → Entregue; `Aprovado` → Comprado;
  `Em Aberto`/`EmAprovacao`/`EmCotacao` → Em cotação; sem requisição ativa →
  Atrasado ou Pendente pela data de necessidade.
- Mantida a agregação de famílias: todos entregues → Entregue; parte entregue
  → Entregue Parcial; qualquer comprado → Comprado.
- A camada visual continua decidindo apenas cores, badges e rótulos.
- Validação: 10 testes unitários e 9 rotas Playwright aprovados.

Commit desta etapa: `23798b9`.

### 2026-09-04 — Contrato da configuração declarativa

- Criado `prototipo/lib/panel-config.js` com validação independente do React.
- O protótipo agora valida na inicialização IDs de obra, slugs de setor,
  números e rótulos antes de renderizar.
- Adicionados testes para configuração válida, IDs duplicados, slugs inválidos
  e slugs duplicados.
- A movimentação dos arrays de configuração para arquivo externo fica para a
  próxima subetapa, após este contrato estar estabilizado.
- Validação: 13 testes unitários e 9 rotas Playwright aprovados.

### 2026-09-04 — Setores em configuração externa

- O array `SETORES` foi movido para `prototipo/lib/panel-config.js`.
- A ordem e os nove slugs continuam declarativos e validados na inicialização.
- O HTML deixou de duplicar a lista de navegação; rótulos especiais por obra
  continuam na camada de apresentação.
- Validação: 14 testes unitários e 9 rotas Playwright aprovados.

### 2026-09-04 — Obras em configuração externa

- O array `OBRAS` ativo foi movido para `prototipo/lib/panel-config.js`,
  preservando os 7 IDs, aliases de origem, contratos e curvas alternativas.
- O HTML passou a consumir `MSEConfig.OBRAS` e validar essa configuração antes
  da renderização.
- A cópia anterior permanece temporariamente nomeada `OBRAS_LEGACY`, sem uso,
  para permitir uma remoção isolada e facilmente revertível na próxima etapa.
- Validação: 15 testes unitários e 9 rotas Playwright aprovados.

### 2026-09-04 — Remoção da configuração legada

- A cópia `OBRAS_LEGACY` foi removida do HTML.
- `MSEConfig.OBRAS` passou a ser a única fonte de configuração de obras.
- Validação: 15 testes unitários e 9 rotas Playwright aprovados após a remoção.

### 2026-09-04 — Configurações de apresentação externalizadas

- Movidos `OBRA_FOTOS`, `OBRA_TOUR_360` e `OBRA_ORTOFOTO` para
  `prototipo/lib/panel-config.js`.
- Removidas as cópias legadas do HTML; cada configuração agora possui uma
  única fonte declarativa.
- Mantidos o fallback do Tour 360°, a prioridade da ortofoto e a data da foto.
- Validação: 16 testes unitários e 9 rotas Playwright aprovados.

### 2026-09-04 — Listas de configuração de Suprimentos

- Externalizados `OBRAS_SUPRIMENTOS_VALIDADAS`,
  `OBRAS_STATUS_MANUAL_DESATIVADO`,
  `NIVEL_EXPORTACAO_GRAFICOS_POR_OBRA` e
  `OBRAS_SEM_EXPORTACAO_GRAFICOS`.
- Removida a cópia legada do mapa de nível de exportação do HTML.
- O grande `CONFIG_SUPRIMENTOS_POR_OBRA` permanece para uma etapa separada,
  pois contém regras e exceções específicas por obra.
- Validação: 17 testes unitários e 9 rotas Playwright aprovados.

### 2026-09-04 — Vocabulário de status externalizado

- Movidos `STATUS_MANUAL_OPCOES` e `ORDEM_STATUS_RMI` para
  `prototipo/lib/panel-config.js`.
- Filtros, badges, donuts e exportações passam a compartilhar a mesma ordem
  declarativa de status.
- Validação: 18 testes unitários e 9 rotas Playwright aprovados.

### 2026-09-04 — Contrato para configurações por obra

- Adicionada `validarConfiguracaoSuprimentos` ao módulo de configuração.
- O `CONFIG_SUPRIMENTOS_POR_OBRA` agora é validado na inicialização contra
  as obras cadastradas e contra os tipos esperados de listas/mapas.
- A extração do objeto grande fica para uma subetapa própria, protegida por
  esse contrato para não perder exceções específicas.
- Validação: 19 testes unitários e 9 rotas Playwright aprovados.

### 2026-09-04 — Primeira configuração de Suprimentos externalizada

- A configuração específica da Hitachi (`id_obra=110`) foi copiada para
  `MSEConfig.CONFIG_SUPRIMENTOS_POR_OBRA`, incluindo escopos permitidos e
  catálogo adicional completo.
- O HTML mantém as demais obras no mapa legado e faz merge determinístico,
  permitindo migrar uma obra por vez sem alterar as regras ainda não validadas.
- O validador passou a aceitar e verificar mapas `catalogoExtra`.
- Validação: 20 testes unitários e 9 rotas Playwright aprovados.

### 2026-09-04 — Segunda configuração de Suprimentos externalizada

- Externalizada a configuração do Novo Nordisk — Reforço AP (`id_obra=108`),
  preservando a RMI excluída, a linha com `codigo_seq` duplicado e o catálogo
  de estrutura metálica.
- O merge incremental continua permitindo rollback por obra, sem tocar nas
  regras ainda mantidas no legado.
- Validação: 21 testes unitários e 9 rotas Playwright aprovados.

### 2026-09-04 — Terceira configuração de Suprimentos externalizada

- Externalizada a configuração da IPEN (`id_obra=114`), incluindo filtros de
  escopo, troca de níveis da árvore, catálogo completo e prioridades de
  classificação.
- Validação: 22 testes unitários e 9 rotas Playwright aprovados.

### 2026-09-04 — Regras globais do Novo Nordisk AP externalizadas

- Movidas para o módulo externo as regras estáveis da obra `id_obra=107`:
  RMI Geral excluída, área derivada do nome da RMI, Curva A desativada e
  exclusão de cortadores de tubos.
- O catálogo detalhado permanece no legado até ser migrado integralmente,
  evitando substituir parcialmente listas de palavras-chave.
- Validação: 23 testes unitários e 9 rotas Playwright aprovados.

### 2026-09-04 — Configuração do Novo Nordisk UB/SP externalizada

- Externalizada a configuração da obra `id_obra=91`, incluindo a exclusão da
  RMI Geral e o catálogo específico de perfis, tubulação, instrumentação,
  combate a incêndio e demais famílias.
- Validação: 24 testes unitários e 9 rotas Playwright aprovados.

### 2026-09-04 — Regras estruturais do Porto Itapoá externalizadas

- Movidos para o módulo externo os filtros de RMI, limites de códigos, limite
  de zona e mapa canônico de áreas da obra `id_obra=94`.
- O catálogo de materiais permanece no legado para ser migrado integralmente
  em etapa separada.
- Validação: 25 testes unitários e 9 rotas Playwright aprovados.

### 2026-09-04 — Merge profundo das configurações por obra

- Corrigido o merge incremental para combinar mapas `catalogoExtra` e
  `catalogoDisciplinaExtra` com o legado, evitando que uma obra parcialmente
  migrada perca categorias ainda não externalizadas.
- Validação: 26 testes unitários e 9 rotas Playwright aprovados.

### 2026-09-04 — Catálogo de disciplinas do Porto externalizado

- Externalizado o `catalogoDisciplinaExtra` do Porto Itapoá, preservando as
  13 famílias de normalização de disciplinas.
- O merge profundo garante coexistência com o catálogo de materiais legado.
- Validação: 27 testes unitários e 9 rotas Playwright aprovados.

## Critério de rollback

Se uma fase quebrar uma rota, alterar uma regra sem intenção ou introduzir
erro de dados, parar na fase atual, restaurar o último commit validado ou o
backup local e registrar a causa antes de continuar.
