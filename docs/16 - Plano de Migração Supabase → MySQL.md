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

Pra cada domínio novo: (0) **conferir RLS no Supabase primeiro**
(`pg_policies` — ver lição abaixo, "Etapa 2 não é 'sem auth complexa' por
padrão"); (1) migration MySQL seguindo a convenção da Etapa 0 (índice
sempre INLINE — `KEY`/`UNIQUE KEY` dentro do `CREATE TABLE`, nunca
`CREATE INDEX` solto: migrations rodam sozinhas a cada boot da API desde
17/09, e um `CREATE INDEX` fora da tabela quebra na 2ª execução); (2) `GET`
de leitura na API, montado em `server.js` (raiz + `/api`, já automático se
reusar o padrão do `for (prefixo of ['', '/api'])`); (3) ingestão — escolher
conforme volume e origem:
  - **Origem é planilha/Sheets (Apps Script)**: `Jdbc.getConnection` direto
    no MySQL — ver Medições.
  - **Origem é n8n e o volume é pequeno**: nó MySQL nativo, query inteira
    como expressão única (nunca "Query Parameters" — não confiável entre
    versões), com guard `INSERT ... SELECT ... WHERE EXISTS (SELECT 1 FROM
    obras WHERE id = X)` pra `id_obra` que não existe não quebrar o resto
    do lote — ver Restrições/OC.
  - **Origem é uma API HTTP e o volume é grande o bastante pro n8n travar**
    (motor de workflow mantém respostas inteiras em memória — sintoma:
    "roda e não retorna", sem erro): script Node dedicado em
    `api/scripts/`, paginando de verdade (página busca→grava→descarta,
    nunca `?all=true`/tudo de uma vez), agendado por cron/systemd timer no
    servidor da API — ver `sync-rmi.js`. Corta o n8n fora do domínio.
(4) trocar o `fetch` correspondente no `prototipo` pela URL da API,
incluindo `MSEAuth.headers()` se o domínio tiver RLS por e-mail/obra;
(5) validar local (`serve-local.js` + `node src/server.js`) antes de
validar em produção.

**Lição (17/09/2026, achada ao migrar Medições, antes de qualquer deploy em
produção):** nem todo domínio listado como "Etapa 2 — sem auth complexa" é
de fato sem auth. Medições tinha RLS restritiva por obra
(`mse_financeiro_lista`, ver docs/15 "financeiro por obra") que passou
batido na primeira versão — copiei o padrão aberto de Restrições sem
conferir. Corrigido: a API agora repassa o token de sessão do usuário pro
Supabase (`RPC mse_acesso_total`/`mse_cps_financeiro`) em vez de replicar
`acesso_total` no MySQL — ver `api/src/auth/financeiroSupabase.js`. **Antes
de expor qualquer leitura nova como pública, rodar**:
```sql
select tablename, policyname, roles, permissive, cmd, qual
from pg_policies where schemaname='public' and tablename in (...);
```
**OC/CO (`orcamentos_complementares_obra`) tem a MESMA restrição** (docs/15:
"vê Medições e OC/CO SÓ da sua obra") — quando esse domínio entrar na fila,
repetir o mesmo padrão de `exigirAcessoFinanceiroCp`, não o de Restrições.

### Etapa 2 — Domínios de leitura simples, sem auth complexa

- [x] Suprimentos — RMI (`itens_rmi` → `sup_rmi`) — **concluída 17/09/2026**,
      exceto o token de produção. Schema enxuto igual ao original
      (`id`/`id_obra`/`raw` JSON, sem coluna por campo). Sem RLS financeira
      (RMI não é financeiro). **Ingestão mudou de mecanismo**: o n8n não
      dava conta do volume (obra 94/Porto Itapoá, ~8 mil itens, travava
      sem erro — estouro de memória do motor de workflow, já documentado
      em `n8n/rmi-suprimentos.README.md`). Substituído por
      `api/scripts/sync-rmi.js`: busca página a página na API do PortalMSE
      (`rmi_api`) e grava cada página antes de pedir a próxima — memória
      pequena e constante. Lista de obras vem da tabela `obras`, não
      hardcoded. **Falta**: `RMI_API_TOKEN` real no `.env` de produção
      (token da API `rmi_api`, diferente do de `mapa_compras_api`) e um
      cron/systemd timer no servidor da API chamando o script (substitui o
      agendamento das 08:00 que era do n8n) — ver "Receita validada"
      abaixo, atualizada com essa mudança de padrão de ingestão.
- [ ] Suprimentos — Mapa de Compras (`itens_mapa_compras` +
      `requisicoes_mapa_compras`). **Mesmo problema de volume que RMI
      tinha, e pior**: `itens_mapa_compras` está sem dado pras obras 94 e
      108 no Supabase — o workflow n8n paginado que resolveria isso
      (`itens-mapa-compras-suprimentos.workflow.json`, citado em comentário
      no `prototipo/index.html`) nunca foi commitado, só existe (se ainda
      existir) direto no n8n. Aplicar o mesmo padrão de `sync-rmi.js`
      (script Node paginado) aqui também.
- [ ] Suprimentos — status manual.
- [x] Medições (`contratos_medicao`/`boletins_medicao` → `med_contratos`/
      `med_boletins`) — **concluída 17/09/2026**. Ingestão via Apps Script
      + `Jdbc` direto no MySQL (não via API — mesmo racional de Restrições,
      sem depender do deploy). Leitura pela API, com verificação de acesso
      financeiro (ver lição acima). `curvas_s` (farol Medido×Físico)
      continua no Supabase, fora de escopo até a Etapa 3. **Falta**: deploy
      em produção (mesmo bloqueio de infra de Restrições) e aplicar o
      `.gs` ajustado na planilha "Saldo a Faturar" (entregue fora do
      repo).
- [x] Orçamentos Complementares — OC/CO (`orcamentos_complementares_obra`
      → `oc_orcamentos`) — **concluída 17/09/2026**. Mesmo formato de
      `rest_restricoes` (1 linha/obra, upsert por `id_obra`, JSON). Acesso
      financeiro por `id_obra` desde o primeiro commit desta vez (não
      depois, como em Medições) — `exigirAcessoFinanceiroObra`,
      generalizado do middleware de Medições. Ingestão via n8n
      (`n8n/oc-no-mysql.snippet.json`, mesmo padrão de query-como-
      expressão-única de Restrições — o snippet antigo de Restrições
      ainda usava o padrão quebrado com `queryReplacement`, corrigido
      junto). `id_obra=103` (CNPEM-Auditório) existe no Supabase mas nunca
      esteve em `OBRAS`/`panel-config.js` — não migrado, mesma regra de
      "não transportar o que não está em uso". **Falta**: deploy em
      produção e aplicar o snippet n8n novo (ainda a fazer por quem
      administra o n8n).
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
