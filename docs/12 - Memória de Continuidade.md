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

Os blocos legados comentados foram removidos fisicamente em 08/09/2026. O
módulo externo é a única fonte das configurações específicas por obra.

## Testes disponíveis

- `npm run test:unit`: 30 testes unitários.
- `npm run test:chromium -- tests/baseline-routes.spec.js`: 9 rotas gerais.
- `npm run test:supply-works`: 7 obras de Suprimentos.
- `npm run test:all`: executa o fluxo completo em sequência.
- `tests/suprimentos.spec.js`: suíte funcional do setor, estabilizada para
  aceitar tanto estado vazio quanto tabela com dados remotos.
- `scripts/validate-png-exports.cjs`: valida downloads PNG dos slides de
  Suprimentos, Histograma e a regra de ausência do botão em Porto.

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

## Fechamento do working tree (08/09/2026)

Branch pronta para merge: working tree limpo e suíte completa verde.

- `npm run test:all`: **30 unitários + 9 rotas + 7 obras de Suprimentos**, todos
  passando.
- Política de artefatos definida no `.gitignore`: `test-results/` e
  `playwright-report/` são regerados a cada execução e saíram do versionamento
  (7 arquivos de falhas antigas foram destrastreados); `backups/` sai porque o
  estado pré-refactor é o ponto de partida desta branch, recuperável pelo
  histórico.
- **`apresentacao/index.html` passou a ser versionado.** Era um alvo de hosting
  ativo no `firebase.json` (site `painel-mse-apresentacao`) cujo fonte existia
  somente no deploy — perder a máquina local significava perder o app.
- `apresentacao/assets/` fica fora do git: 178 MB (13.418 tiles da ortofoto +
  9 imagens) verificados por md5 como cópia byte-idêntica de
  `prototipo/assets/`, sem nenhum conteúdo exclusivo. Se algum dia a
  apresentação precisar de um asset próprio, versionar esse arquivo à parte.
- Workflow n8n de Suprimentos versionado (estava modificado e solto desde
  31/08): passa a iterar obra por obra, ganha ramo de requisições e troca a
  credencial de gravação para `supabaseApi`. Não foi executado — ver pendência 3.

## Financeiro por obra (09/09/2026)

Terceiro nível de acesso implantado — ver [[15 - Integração Portal MSE (superapp)]],
seção 1c, que tem o desenho, as armadilhas e as verificações.

**Banco: aplicado e verificado.** `acesso_total.obra_id`, `obra_chaves`, as
funções e o RLS por obra nas 5 tabelas financeiras estão em produção. A view
`v_indices_financeiros_diario` foi LIBERADA (não alimenta Medições, alimenta
Encarregados) e perdeu as colunas de R$.

**Front: commitado, NÃO deployado.** ⚠️ `firebase deploy` está travado por
COTA (09/09/2026). Consequência concreta: as **12 pessoas com recorte por obra
não veem Medições nem na própria obra** — o RLS já as liberou, mas produção
ainda serve o `auth.js` antigo, que só consulta `mse_acesso_total()`. Não há
risco de vazamento nisso: o estado intermediário esconde a mais, nunca a menos.
Assim que a cota liberar, `firebase deploy --only hosting:prototipo` resolve.

Validado à mão no `localhost:8899` com sessão Google real, percorrendo as três
variantes no `vinicius.tadashi` (global → obra 91 → sem linha) e restaurando.

23 linhas em `acesso_total`: 7 globais, 16 por obra cobrindo 12 pessoas.
Os e-mails foram conferidos pelo usuário em 09/09/2026.

## Pendências para retomada

1. **Deploy do front quando a cota liberar** — ver bloco acima. É o único passo
   entre o que está pronto e o que as pessoas veem.
2. **IPEN sem contrato CP.** `leonardo.bernardino` tem acesso à obra 114, mas ela
   não tem CP em `obra_chaves` nem linha nas tabelas financeiras — as abas vão
   aparecer VAZIAS. Quando o IPEN ganhar contrato, inserir
   `(114,'cp','<código>')` em `obra_chaves`, senão o acesso segue sem efeito.
3. Extrair componentes React grandes ainda embutidos no HTML.
4. Revisar performance, acessibilidade e segurança.
5. Validar a **execução** do workflow n8n de Suprimentos dentro do n8n. O export
   está versionado, mas a reestruturação (loop por obra + ramo de requisições +
   troca de credencial) nunca foi rodada de ponta a ponta.

## Regra de continuidade

Cada nova alteração deve ser pequena, testada, documentada neste vault e
registrada em commit próprio. Não limpar ou reverter alterações não relacionadas
sem confirmação explícita.
