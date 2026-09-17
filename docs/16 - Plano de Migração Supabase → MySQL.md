# Plano de Migração — Supabase → MySQL (painelmse)

Mapa de ação completo para tirar o painel-mse do Supabase e passar a operar
sobre o MySQL `painelmse` (host `dbsubdominios.portalmse.com.br`, usuário
`painelmse`). Estratégia escolhida: **big bang por feature** — cada domínio
migra inteiro de uma vez (ingestão + consumo), sem rodar em paralelo nos dois
bancos. Ver decisões de fundo em [[06 - Decisões de Arquitetura]] e o
inventário de fontes em [[07 - Modelo de Dados]].

Cada tarefa marcada aqui vira commit/registro próprio, seguindo a regra de
continuidade de [[12 - Memória de Continuidade]].

## Panorama real (ponto de partida)

Não é "um Supabase" — são **dois projetos**:

| Projeto | ID | Conteúdo |
|---|---|---|
| **API - Portal** (principal) | `gebjlhkywtnpfqjrakok` | EAP, apontamentos, curvas, suprimentos, PTs, financeiro, acesso/RLS, Edge Functions |
| **Efetivo** | `wnldmumgjwujveeimyef` | Efetivo diário realizado + previsto (MOI/MOD), 14+ views agregadas |

O MySQL novo é um servidor só — a Etapa 0 decide se os dois projetos viram um
schema único ou continuam logicamente separados.

## Problemas de raiz identificados (não é só trocar a connection string)

1. **RLS + Supabase Auth (GoTrue) + SSO custom não têm equivalente em MySQL.**
   O controle de acesso por obra/e-mail (`mse_acesso_total()`,
   `mse_financeiro_obra()`) e o SSO do Portal (Edge Function `portal-sso`,
   sessões GoTrue — ver [[15 - Integração Portal MSE (superapp)]]) são
   Postgres/Supabase-específicos. Precisa de uma **API intermediária** nova —
   o painel não pode falar direto com o MySQL como fala hoje com o Supabase
   via anon key.
2. **Metade das ingestões não está no repo.** Restrições EAP, PTs, Efetivo
   realizado e parte das integrações rodam em n8n não versionado ou em syncs
   do próprio PortalMSE. Acesso confirmado (16/09/2026) — usuário já
   administra n8n e PortalMSE — mas o código dessas ingestões segue fora do
   repo, a versionar quando cada domínio migrar.
3. **4 convenções diferentes de nome de obra** coexistem sem tabela de mapa
   única (`curvas_s.obra`, `cards_ativos.origem`, nome próprio do
   `pts_emitidas`, código CP do financeiro). Copiar esse caos perpetua o
   problema — normalizar agora.

## Lixo a descartar (não migrar)

**Decisão (16/09/2026): o que não estiver em uso não é transportado — fica
para trás no Supabase**, desligado por inteiro na Etapa 6. Não há exclusão
isolada a autorizar; a lista serve para não migrar por engano.

- [x] `nfs` e `proximos_faturamentos` — mortas, substituídas por
      `contratos_medicao`/`boletins_medicao` em 19/08/2026.
- [x] Workflows n8n nunca aplicados: `pedidos-suprimentos`,
      `mapa-compras-suprimentos` (parcial), lado "OC" de orçamentos
      complementares (só "CO" está implementado).
- [x] 2 cópias mortas de `curva_s_drive.py` (só a de `planejamento_dash`
      roda de fato, a cada 12h).
- [x] `Dropbox\dashboard-main` e `Documents\dashboard-main` — cópias legadas
      pré-consolidação (ADR-002), ainda lendo Supabase direto com anon key.
      Aposentam junto com o desligamento do Supabase, não migram.

## Inventário de domínios (fonte → destino, referência rápida)

| Domínio | Ingestão atual | Consumo atual | Acoplamento/observação |
|---|---|---|---|
| Avanço físico / EAP | n8n (não versionado) | `prototipo/index.html` (`EAP`, `Apontamentos`, `cards_ativos`, `vw_dados_tv`) | — |
| Curva S (física) | `planejamento_dash/curva_s_drive.py`, thread 12h → `curvas_s` | `prototipo`, `Dropbox\dashboard-main`, `Documents\dashboard-main` | valores em fração 0–1 |
| Curva financeira | não localizada no código | `curva_avanco_historico` (só legados) | realizado parado desde 29/07/2026 |
| Suprimentos (curada) | manual | `suprimentos` (só legados) | — |
| Suprimentos — RMI | n8n `rmi-suprimentos.workflow.json` | `prototipo` lê `itens_rmi` | fonte atual da Curva A/crítico |
| Suprimentos — Mapa de Compras | n8n `mapa-compras-suprimentos.workflow.json` | `prototipo` lê `requisicoes_mapa_compras` | guia de API incompleto |
| Suprimentos — status manual | o próprio painel escreve | `suprimentos_status_manual` | única exceção "painel escreve" |
| Medições | Apps Script (planilha "Saldo a Faturar") | `prototipo` lê `contratos_medicao`/`boletins_medicao` | — |
| Restrições EAP | sync PortalMSE (fora do repo) | `prototipo` lê `restricoes_obra` | RLS teve bug histórico |
| Orçamentos Complementares | n8n `orcamentos-complementares.workflow.json`, 06:00 | `prototipo` lê `orcamentos_complementares_obra` | só lado CO |
| Efetivo (realizado) | API externa, ingestão fora do repo | Edge Function `efetivo` → projeto Efetivo (`efetivo_diario_raw`, `efetivo_real_historico`, `vw_efetivo_*`) | proxy autenticado entre os 2 projetos |
| Efetivo (previsto) | manual via SQL direto | `vw_efetivo_previsto_mensal_detalhe` | RLS bloqueia anon key p/ escrita — ver [[Efetivo Previsto (RLS)]] |
| Produtividade semanal | Apps Script `relatorios-pdf/sheet_to_supabase.gs` | `prototipo` **e** `relatorios-pdf/gerar_relatorio.py` | `relatorios-pdf` não é git — ver [[relatorios-pdf sem git]] |
| PTs | não localizada no repo | `prototipo` lê `pts_emitidas` | 3ª convenção própria de nome de obra |
| Financeiro/Acesso | migrations SQL manuais | RPC `mse_acesso_total()`, `mse_obras_financeiro()`, `mse_financeiro_obra()` | `SECURITY DEFINER`, depende de `auth.jwt()` |
| SSO Portal | Edge Function `portal-sso` | `window.__MSE_PORTAL` → `setSession()` | depende 100% de GoTrue |
| View 3D | não localizada | `view_atividades_3d` (só legados) | — |

## Etapas

### Etapa 0 — Fundação (bloqueia todas as demais)

- [x] Decidir schema único vs. dois schemas no MySQL para os dois projetos
      Supabase atuais. **Decidido (16/09/2026): schema único** — todas as
      tabelas (EAP, Suprimentos, Financeiro, Efetivo etc.) no mesmo schema
      `painelmse`. Facilita JOIN entre domínios (ex: Efetivo x EAP), custo é
      um namespace só para todas as tabelas — mitigar com prefixo por
      domínio na convenção de nomes (ver item de convenção abaixo).
- [x] Especificar a API intermediária (stack, auth, forma de expor dados ao
      `prototipo` — hoje é REST direto com anon key, isso muda). **Decidido
      (16/09/2026): Node.js.** Framework a confirmar na primeira tarefa de
      implementação (Express como default por simplicidade/ecossistema,
      ajustável se surgir necessidade de validação de schema mais rígida).
- [x] Construir o esqueleto da API intermediária (autenticação própria +
      regras de acesso que hoje são RLS). **Feito (16/09/2026)**: pasta
      `api/` no próprio repo (ADR-002 — uma fonte de código), Node.js +
      Express + `mysql2`, pool de conexão em `api/src/db/pool.js`,
      `GET /health` validado contra o MySQL `painelmse` real. Credenciais em
      `api/.env`, fora do git (regra `api/.env` adicionada ao `.gitignore`
      da raiz antes de o arquivo existir). Falta ainda: autenticação própria
      e regras de acesso (substitutas do RLS) — não implementadas nesta
      tarefa.
- [x] Portar a lógica do SSO Portal (`portal-sso`) para a API intermediária.
      **Confirmado (16/09/2026) que este é o mecanismo de login REAL e ativo
      hoje** — corrigindo um engano meu no meio da investigação: quem chama
      a Edge Function não é o PHP do Portal, é o próprio `painel-mse`,
      client-side, dentro de `prototipo/lib/auth.js`
      (`trocarTokenPortal()` → `PORTAL_SSO_URL` → `setSession()`). O PHP só
      embute `?sso=<token>` na URL do iframe — o mesmo token HMAC que já
      gera para o `planejamento_dash`, sem função própria do lado PHP (daí a
      confusão: "o PHP não tem essa function" está certo, mas quem chama é o
      front, não o PHP). **Este item permanece bloqueante de verdade** para
      a Etapa 5 — código pronto em `api/src/auth/portalSso.js`, rota
      `POST /auth/portal-sso`, migration `002_sso_nonces.sql`. Falta ainda:
      apontar `prototipo/lib/auth.js` (`PORTAL_SSO_URL`) para a API nova —
      isso é trabalho da Etapa 5, não desta etapa.
- [ ] (Baixa prioridade, não bloqueia nada por ora) Login Google OAuth direto
      (`entrarComGoogle()` em `auth.js`, ADR-007) existe no código mas
      **nunca foi ativado** (provider Google nunca configurado no Supabase) —
      só serve para acesso fora do superapp do Portal, caminho que hoje não
      está em uso real. Revisitar só se/quando existir demanda de acesso
      direto (fora do Portal).
- [x] ~~Portar a lógica da Edge Function `efetivo`~~ — **não se aplica**: ela
      só existe porque hoje são dois projetos Supabase separados; com o
      schema único decidido, vira query normal no mesmo banco quando a
      Etapa 4 (Efetivo) migrar.
- [x] Criar tabela canônica de mapa de obras (`id_obra` único), substituindo
      as 4 convenções de nome hoje espalhadas. **Feito (16/09/2026)**:
      `api/src/db/migrations/001_obras.sql`, aplicada via `npm run migrate`
      (roda `api/src/db/migrate.js`, primeiro migration runner do projeto —
      reutilizável para as próximas tabelas). 7 obras carregadas com os
      mesmos `id` já usados em `prototipo/lib/panel-config.js` (OBRAS) —
      preserva ADR-004 em vez de reinventar identificador. Colunas:
      `alias_curva_s`, `alias_origem_tv`, `alias_pts`, `codigo_cp` — as 4
      convenções antigas viram alias na mesma linha, sem prefixo de domínio
      (é tabela de referência compartilhada, exceção deliberada à convenção
      de prefixo).
- [x] Levantar acesso a todas as ingestões fora do repo. **Resolvido
      (16/09/2026): usuário já tem acesso a tudo** (n8n, PortalMSE) — sem
      pedido externo pendente. Lista de onde mexer, quando cada domínio for
      migrado (Etapas 1–5):
      - Avanço físico/EAP — n8n que alimenta `EAP`, `Apontamentos`,
        `cards_ativos`, `vw_dados_tv`. Não versionado no repo ainda.
      - Restrições EAP — sync do PortalMSE que alimenta `restricoes_obra`.
      - PTs — ingestão de `pts_emitidas`, origem a confirmar dentro do n8n/
        PortalMSE ao chegar a hora.
      - Efetivo (realizado) — "API externa" que alimenta
        `efetivo_diario_raw` no projeto Efetivo.
      - Efetivo (previsto) — hoje é humano rodando SQL manual
        (`execute_sql`) direto no Supabase; troca de processo, não de acesso.
      - Curva financeira (`curva_avanco_historico`) — ver decisão de não
        migrar, abaixo (só cópias legadas leem).
- [x] Descartar o que não é usado. **Decisão (16/09/2026): o que não estiver
      em uso simplesmente NÃO é transportado — fica para trás no Supabase**,
      que já está previsto para ser desligado por inteiro na Etapa 6. Não há
      exclusão isolada a autorizar agora; a lista abaixo é só para não migrar
      por engano quando cada domínio for a vez:
      - Tabelas `nfs` e `proximos_faturamentos` — substituídas por
        `contratos_medicao`/`boletins_medicao` em 19/08/2026.
      - Workflow n8n `pedidos-suprimentos` — desenhado, nunca aplicado.
      - Workflow n8n `mapa-compras-suprimentos` — aplicado parcialmente.
      - Lado "OC" (ordens de compra) de `orcamentos-complementares` — só o
        lado "CO" está implementado.
      - 2 cópias mortas de `curva_s_drive.py`:
        `Documents\curva-s-agendado\curva_s_drive.py` e
        `Dropbox\curva-s-atualizacao\curva_s_drive.py` — só a de
        `planejamento_dash` roda (thread de 12h).
      - Cópias legadas de frontend: `Dropbox\dashboard-main` e
        `Documents\dashboard-main`, ainda lendo Supabase direto com anon key.
      - `curva_avanco_historico` — só as cópias legadas acima leem; morre
        junto com elas.
- [x] Definir e documentar a convenção de nomes de tabela/coluna no MySQL
      (schema novo é oportunidade de padronizar). **Decidido (16/09/2026):**
      - `snake_case` em tabelas e colunas, sem acento, sem maiúscula (hoje o
        Postgres tem `EAP`, `Apontamentos` capitalizados — normalizar).
      - Tabelas no plural, prefixadas por domínio: `eap_`, `sup_`
        (suprimentos), `fin_` (financeiro/acesso), `efet_` (efetivo), `sso_`,
        `med_` (medições), `rest_` (restrições), `pt_` (PTs), `oc_`
        (orçamentos complementares). Mitiga o custo do schema único (item
        acima) sem reintroduzir dois bancos.
      - Chave primária sempre `id` `BIGINT UNSIGNED AUTO_INCREMENT`.
      - FK nomeada `<tabela_no_singular>_id`.
      - Timestamps `criado_em`/`atualizado_em` (`DATETIME`), preenchidos
        pela aplicação, não por trigger.
      - `id_obra` (ADR-004) é mantido como padrão de referência a obra, mas
        passa a apontar para a tabela canônica `obras` (ver item de mapa de
        obras abaixo) em vez das 4 convenções de nome hoje espalhadas.

### Etapa 1 — Prova de conceito com domínio isolado

- [x] Escolher entre **PTs** e **Restrições EAP** como piloto. **Decidido
      (16/09/2026): Restrições EAP** — origem de PTs é totalmente
      desconhecida (nem repo, nem n8n localizado), Restrições tem origem
      identificada (n8n) e menor risco de descoberta no meio do piloto.
      Ingestão confirmada pelo usuário: **fluxo do n8n** (não é sync direto
      do PortalMSE como o inventário original supunha).
- [x] Tabela MySQL `rest_restricoes` criada (`api/src/db/migrations/003_restricoes.sql`),
      schema espelhando o Supabase (`id_obra`, `total`, `restricoes` JSON)
      menos `nome_obra` (dropada, redundante com `obras.nome`). **Sempre
      upsert por `id_obra`** (o n8n resubstitui o snapshot inteiro a cada
      sync, não faz append) — `UNIQUE KEY` em `id_obra` garante isso.
- [x] Endpoint `POST /ingest/restricoes` na API (`api/src/routes/ingest.js`),
      autenticado por `INGEST_API_KEY` própria (não é a chave do Supabase —
      gerada especificamente pra essa integração server-to-server). Testado:
      upsert confirmado (2 envios pro mesmo `id_obra`, 1 linha só no fim, com
      o segundo valor).
- [x] ~~Nó HTTP Request para `/ingest/restricoes`~~ — **substituído**: como o
      usuário não tem acesso SSH pro deploy da API (item abaixo), optou por
      nó **MySQL nativo do n8n**, upsert direto no banco (mesmas credenciais
      do HeidiSQL: host/porta/usuário/banco de `api/.env`). Desbloqueia o
      teste real sem esperar infra — troca validação de campo da API por
      confiar no processo (aceitável pra este piloto, revisar caso a caso
      nas próximas etapas). A API e `/ingest/restricoes` continuam no repo
      como referência/fallback, fora do caminho crítico deste domínio.
      **Lição pra Etapas 2–5** (nó MySQL nativo do n8n, versão 2.4): o campo
      de "Query Parameters" não é confiável entre versões — dei 2 palpites
      errados (`options.queryReplacement`, depois um campo separado) antes
      de acertar. **O que funciona de verdade**: colocar a query INTEIRA
      como uma única expressão no campo Query (modo fx), montada como
      template string JS, com `Number(...)` nos campos numéricos e
      `JSON.stringify(...).replace(/\\/g,'\\\\').replace(/'/g,"\\'")` pra
      escapar o JSON como string literal SQL. Sem depender de nenhum campo
      de parâmetros à parte. Snippet de referência em
      `n8n/restricoes-no-mysql.snippet.json` (desatualizado, era a versão
      HTTP — atualizar se este padrão for reusado).
- [x] **Validado com dado real de produção (16/09/2026)**: obra 91 (Novo
      Nordisk UB/SP), 9 restrições reais gravadas via upsert, todos os
      campos do payload original (`edt`, `id_eap`, `criticidade`,
      `nome_responsavel` etc.) intactos dentro do JSON. Ingestão do piloto
      funcionando ponta a ponta com produção, não só teste sintético.
- [x] **Deploy da API resolvido (17/09/2026)**: no ar em
      `painelmse.portalmse.com.br` (mesmo domínio que já servia o
      `prototipo` estaticamente — não é o `dbsubdominios` original, o
      admin escolheu manter os dois no mesmo host), exposta em `/api/*`
      via proxy reverso nginx (`proxy_pass` removendo o prefixo — o
      `server.js` responde na raiz normalmente) e mantida no ar por
      processo persistente (systemd/pm2, gerido pelo admin). `api/.env`
      criado direto no servidor, nunca via git.
- [x] Expor o domínio na API intermediária: `GET /restricoes?id_obra=`
      (`api/src/routes/restricoes.js`), 404 quando a obra não tem
      snapshot ainda (estado válido, não erro). Rotas montadas tanto na
      raiz quanto sob `/api` (`server.js`), robusto a como o proxy tratar
      o prefixo.
- [x] Trocar o consumo no `prototipo` para a API intermediária.
      `ModuloRestricoes` não chama mais `SUPABASE_URL/rest/v1/restricoes_obra`.
      URL pública vem de `PUBLIC_API_URL` (`api/.env`, pedido do admin) via
      `scripts/gerar-config-publico.js` → `prototipo/lib/config-publico.js`
      (gerado, não versionado — o navegador não lê `.env` direto, não há
      build step neste projeto); fallback por hostname se o arquivo não
      existir.
- [x] **Validado ponta a ponta em produção (17/09/2026)**: dentro do Portal
      MSE (`portalmse.com.br`, iframe SSO), obra 91, aba Restrições — 9
      restrições reais renderizadas, `GET
      painelmse.portalmse.com.br/api/restricoes?id_obra=91` → `200`.
      Ciclo completo ingestão (n8n) → MySQL → API → tela, com dado real,
      fechado.

**Etapa 1 CONCLUÍDA (17/09/2026).** Pronta pra servir de modelo repetível
pras próximas etapas — ver "Receita validada" abaixo.

### Receita validada (repetir a partir da Etapa 2)

Pra cada domínio novo: (1) migration MySQL seguindo a convenção da Etapa 0;
(2) `GET` de leitura na API, montado em `server.js` (raiz + `/api`, já
automático se reusar o padrão do `for (prefixo of ['', '/api'])`); (3)
ingestão — nó MySQL nativo do n8n se não houver acesso SSH pra deploy de
webhook, seguindo a lição de escaping registrada na Etapa 1; (4) trocar o
`fetch` correspondente no `prototipo` pela URL da API; (5) validar local
(`serve-local.js` + `node src/server.js`) antes de validar em produção.

### Etapa 2 — Domínios de leitura simples, sem auth complexa

- [ ] Suprimentos — RMI.
- [ ] Suprimentos — Mapa de Compras.
- [ ] Suprimentos — status manual.
- [ ] Medições (`contratos_medicao`/`boletins_medicao`).
- [ ] Produtividade semanal — **atenção**: re-apontar também o
      `relatorios-pdf/gerar_relatorio.py`, não só o painel.

### Etapa 3 — Domínios de maior volume/frequência

- [ ] Avanço físico / EAP (hoje 100% n8n).
- [ ] Curva S — reescrever o writer (`curva_s_drive.py`) para o MySQL.

### Etapa 4 — Efetivo

- [ ] Migrar o projeto Supabase "Efetivo" inteiro (realizado + previsto + 14
      views agregadas).
- [ ] Substituir a Edge Function `efetivo` pela lógica já portada na Etapa 0.

### Etapa 5 — Financeiro/Acesso + SSO (mais acoplado, por último)

- [ ] `obra_chaves`, `acesso_total`.
- [ ] Reimplementar as funções RPC financeiras na API intermediária.
- [ ] Cortar o SSO do Portal para a versão nova (API intermediária), com o
      lado PHP re-apontado.

### Etapa 6 — Descomissionamento

- [ ] Desligar os dois projetos Supabase.
- [ ] Remover credenciais/anon keys do frontend.
- [ ] Apagar `Dropbox\dashboard-main` e `Documents\dashboard-main` (cópias
      legadas).

## Regra de continuidade

Cada etapa só começa depois que a anterior estiver validada em produção. Toda
mudança de ingestão ou consumo é pequena, testada, e registrada aqui (marcar
o checkbox) e em [[12 - Memória de Continuidade]] se afetar o estado geral do
projeto.
