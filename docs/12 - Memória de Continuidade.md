# Memória de Continuidade — Refatoração do Protótipo MSE

## Estado atual

- Branch ativa: `refactor/prototipo-incremental`.
- Arquivo principal: `prototipo/index.html`.
- Backup inicial: `backups/pre-refactor-20260904-133720`.
- Documentação de processo: `docs/11 - Plano de Implantação Incremental.md`.

## Módulos criados

- `prototipo/lib/domain-utils.js`: regras de domínio reutilizáveis.
- `prototipo/lib/panel-config.js`: obras, setores, status e configurações por obra.
- `MSEConfig.mesclarConfiguracaoSuprimentos`: merge profundo por categoria, com
  união de palavras-chave e remoção de duplicatas.

## Configurações externalizadas

- Hitachi (`110`): integral; bloco legado removido.
- Novo Nordisk Reforço AP (`108`): integral; legado isolado.
- IPEN (`114`): integral; legado isolado.
- Novo Nordisk AP (`107`): regras e catálogo externalizados; legado isolado.
- Novo Nordisk UB/SP (`91`): regras e catálogo externalizados; legado isolado.
- Porto Itapoá (`94`): regras, disciplinas e catálogo específico externalizados;
  legado isolado.
- Obra `106`: não possuía configuração específica no mapa original.

## Testes disponíveis

- `npm run test:unit`: 30 testes unitários.
- `npm run test:chromium -- tests/baseline-routes.spec.js`: 9 rotas gerais.
- `npm run test:supply-works`: 7 obras de Suprimentos.
- `npm run test:all`: executa o fluxo completo em sequência.
- `tests/suprimentos.spec.js`: suíte funcional do setor, estabilizada para
  aceitar tanto estado vazio quanto tabela com dados remotos.

Última validação unitária: todos os 30 testes passaram. A comparação
antes/depois de Suprimentos também foi concluída nas sete obras.

## Commits recentes relevantes

- `0c4e50c`: comando `test:all`.
- `305ba54`: cobertura funcional de Suprimentos por obra.
- `707e803`: contrato de ordem de carregamento dos módulos.
- `63287b6`: desativação do legado Porto.
- `b52df90`: desativação do legado AP.
- `151e107`: desativação do legado IPEN.
- `0216c9e`: desativação do legado UB/SP.
- `1ed4ee7`: remoção do legado Hitachi.
- `2afc9bd`: merge de palavras-chave por categoria.

## Pendências para retomada

1. Remover fisicamente comentários legados, agora que a comparação foi concluída.
2. Validar exportações PNG após a revisão visual/responsiva já realizada.
3. Extrair componentes React grandes ainda embutidos no HTML.
4. Revisar performance, acessibilidade e segurança.
5. Revisar alterações pendentes do workflow n8n e artefatos de teste.
6. Executar `npm run test:all` antes do merge da branch.

## Regra de continuidade

Cada nova alteração deve ser pequena, testada, documentada neste vault e
registrada em commit próprio. Não limpar ou reverter alterações não relacionadas
sem confirmação explícita.
