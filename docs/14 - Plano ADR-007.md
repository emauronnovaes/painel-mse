# Plano ADR-007 — Autenticação Google + RLS

Execução da decisão registrada em [[06 - Decisões de Arquitetura]] (ADR-007).
Medição feita em 08/09/2026 sobre os dois projetos Supabase em uso.

## Princípio da ordem

Cada fase é verificável sozinha e **nenhuma derruba nada enquanto a seguinte não
estiver pronta**. O corte do `anon` é a última coisa a acontecer, nunca a
primeira. Enquanto o RLS ainda aceita `anon`, o app com login já funciona; e
quando o `anon` fecha, todo consumidor legítimo já está usando outra credencial.

## Superfície medida — projeto `API - Portal` (`gebjlhkywtnpfqjrakok`)

**Policy de leitura explícita para `anon` (13):**
`Apontamentos`, `curva_avanco_historico`, `desvios_provisorio_ubsp`,
`itens_mapa_compras`, `itens_rmi`, `nfs`, `orcamentos_complementares_obra`,
`pedidos_suprimentos`, `proximos_faturamentos`, `pts_emitidas`,
`relatorio_produtividade_semanal`, `requisicoes_mapa_compras`, `restricoes_obra`

**Policy sem cláusula `TO` — vale para `PUBLIC`, que inclui `anon` (9):**
`EAP`, `apontamento_efetivo`, `atividades_3d`, `boletins_medicao`,
`cards_ativos`, `contratos_medicao`, `curvas_s`, `suprimentos`,
`suprimentos_status_manual`

Esse grupo é a pegadinha do levantamento: uma consulta que procura `'anon' =
any(polroles)` diz que estão fechadas, e não estão. Policy criada sem `TO`
default para `PUBLIC`.

**Views com RLS desligada e grant para `anon` (5):**
`v_indices_financeiros_diario`, `view_atividades_3d`,
`view_avanco_duas_semanas`, `vw_cards_ativos_contexto`, `vw_dados_tv`

View não aplica RLS própria. Sem `security_invoker = true`, ela lê as tabelas de
baixo com a permissão do **dono**, furando o RLS delas — é um bypass, não uma
exposição adicional. Precisam ser recriadas com `security_invoker`.

**Já fechadas — RLS ligada e nenhuma policy de leitura (5):**
`diario_semanal_obras`, `medicao_acumulada`, `medicao_diaria`,
`relatorio_semanal_obra`, `tarefas`

Servem de referência do estado final desejado: grant existe, policy não, leitura
negada.

## Consumidores das anon keys (quem quebra se o corte vier antes da migração)

| Consumidor | Onde | Lê |
|---|---|---|
| Painel (protótipo) | `prototipo/index.html` | 16 sítios no Portal + 9 no Efetivo |
| Apresentação | `apresentacao/index.html` | mesmas do protótipo |
| Relatório semanal PDF | `relatorios-pdf/gerar_relatorio.py` | `EAP`, `apontamento_efetivo`, `relatorio_produtividade_semanal`, `curvas_s` |
| Curva S diária do Drive | `planejamento_dash/curva_s_drive.py` | `curvas_s` |
| Dashboard antigo | `dashboard-main` | várias |

## Fases

### Fase 1 — Identidade (não altera RLS, não quebra nada)

1. **Google Cloud Console** (ação do usuário, exige navegador): criar OAuth 2.0
   Client ID no projeto `planejamento-mse`, com o redirect URI do Supabase
   (`https://gebjlhkywtnpfqjrakok.supabase.co/auth/v1/callback`).
2. **Supabase Auth**: habilitar provider Google com o Client ID/Secret; incluir
   as URLs do Hosting em *Redirect URLs*.
3. **Front-end**: `prototipo/lib/auth.js` (global `MSEAuth`, mesmo padrão de
   `MSEConfig`/`MSEDomain`), tela de login e centralização dos 25 sítios de
   header em `MSEAuth.headers()` / `MSEAuth.headersEfetivo()`.

   Nesta fase o header cai para a anon key quando não há sessão, então o app
   continua funcionando igual antes do login existir. É deploy seguro.

   ✅ **Validado em 08/09/2026 no `localhost:8899`**: login com Google
   `@mse.com.br` funciona ponta a ponta, sessão registrada em `auth.sessions`,
   painel abre depois de entrar. `LOGIN_OBRIGATORIO = true`.

   ⚠️ **Produção nunca foi testada.** A allow-list de *Redirect URLs* do Supabase
   não é verificável de fora — o endpoint `/authorize` aceita qualquer
   `redirect_to` e só valida no callback, caindo no *Site URL* quando a URL não
   está na lista. Então o primeiro deploy com o portão ligado tem que ser
   testado na hora. Se o login falhar em produção, o rollback é voltar
   `LOGIN_OBRIGATORIO` para `false` e redeployar — uma linha.

### Fase 2 — Consumidores server-side (antes do corte, obrigatoriamente)

4. ✅ **Feito em 08/09/2026.** `relatorios-pdf/gerar_relatorio.py` e as **três**
   cópias de `curva_s_drive.py` resolvem a credencial por
   `os.getenv("MSE_SUPABASE_SERVICE_KEY")`, caindo na anon key com aviso
   explícito quando a variável não existe. A chave nunca entra no código.

   O fallback com aviso é deliberado: hoje a anon ainda lê, então o relatório
   semanal e a Curva S diária continuam saindo; o aviso é o que impede a
   migração de parecer concluída sem estar. Quando a Fase 4 cortar, a ausência
   da variável deixa de ser aviso e passa a ser falha — visível, por ADR-005.

   As três cópias foram alteradas de propósito (`planejamento_dash/`, que é a
   que roda; `curva-s-agendado/`, o pacote distribuível; e a do Desktop): depois
   do corte, qualquer cópia que alguém execute precisa funcionar. Isso NÃO
   promove as outras divergências da cópia do Desktop, que seguem pendentes.

   Verificado: `USANDO_SERVICE_ROLE` alterna corretamente com e sem a variável,
   e o relatório semanal roda ponta a ponta gerando os 4 PNGs.

   **Pendente do usuário:** definir `MSE_SUPABASE_SERVICE_KEY` na máquina que
   roda os jobs (`setx`, nível de usuário). Enquanto não for definida, os dois
   consumidores seguem na anon key.

5. ⏳ Definir o destino do `dashboard-main`: migrar igual, ou aposentar. Se ficar
   com anon key, o corte da Fase 4 o derruba.
6. ⏳ Investigar **quem mais autentica neste projeto**. `auth.users` tem 34
   contas `@mse.com.br` via Google criadas entre julho e agosto/2026 — o
   provider já estava configurado antes do ADR-007. Existe outro app usando
   esse OAuth, e o corte da Fase 4 o afeta também.

### Fase 3 — Aditivo no banco (reversível, não fecha nada)

7. ✅ **Feito em 08/09/2026** — migração `adr007_fase3_policies_authenticated_dominio_mse`.
   Predicado de domínio numa função única, `public.mse_email_do_dominio()`, e
   policy `mse_select_authenticated` nas **22** relações hoje legíveis por
   `anon`. `grant select` para `authenticated` incluído.

   Detalhes que valem lembrar:
   - `split_part(lower(email), '@', 2) = 'mse.com.br'` em vez de
     `like '%@mse.com.br'` — comparação exata de domínio, e case-insensitive
     porque o e-mail do provider pode vir com maiúscula.
   - O predicado está embrulhado em `(select ...)` para virar InitPlan, avaliado
     **uma vez por statement** em vez de por linha. Em tabela grande como `EAP`
     isso é a diferença entre a tela abrir e travar.
   - Migração `adr007_fase3_dominio_coalesce_false`: sem JWT a função devolvia
     `NULL`. Em RLS `USING (NULL)` nega, então o comportamento já estava certo,
     mas `coalesce(..., false)` torna isso explícito em vez de depender da
     sutileza.

   Verificado: 22 policies criadas, **26 policies de `anon`/`PUBLIC` seguem de
   pé** (aditivo confirmado), e leitura com a anon key continua devolvendo dado
   em todas as tabelas e views testadas. `npm run test:all` verde.

8. ✅ **Feito em 08/09/2026** — migração `adr007_fase3_views_security_invoker`.
   Quatro views receberam `security_invoker = true`:
   `view_atividades_3d`, `view_avanco_duas_semanas`, `vw_cards_ativos_contexto`,
   `vw_dados_tv`. Seguro porque todas leem só de `EAP`, `cards_ativos`,
   `Apontamentos` e `apontamento_efetivo`, que têm policy para `anon` (hoje) e
   para `authenticated` (passo 7).

   ⚠️ **`v_indices_financeiros_diario` ficou de fora, de propósito.** Ela lê de
   `medicao_acumulada` e `tarefas`, que têm RLS ligada e **nenhuma** policy de
   leitura. Com `security_invoker` ela passaria a respeitar esse fechamento e
   devolveria **zero linhas para todos, inclusive logado** — a tela financeira
   sairia de "dado parado desde 11/08" para "vazia".

   As alternativas eram abrir leitura nessas duas tabelas (aumenta a superfície,
   direção oposta ao ADR-007) ou manter a view `security_definer` e controlar
   pelo `GRANT`. Escolhida a segunda: um bypass de RLS explícito e restrito por
   grant é melhor que abrir duas tabelas hoje fechadas. O motivo está gravado
   num `COMMENT ON VIEW`, para ninguém "consertar" isso sem contexto. Na Fase 4
   o fechamento dela é por `revoke select from anon`, não por `security_invoker`.

9. 🚧 **Função no ar em 08/09/2026; migração do front-end aguardando o secret.**
   `supabase/functions/efetivo/index.ts`, deployada no projeto A como `efetivo`
   (v2, `verify_jwt = true`).

   **Por que existe:** o JWT do projeto A não vale no projeto B — bases de
   autenticação distintas. A função roda em A, exige sessão de A e lê B com a
   `service_role` de B. Sem ela, fechar o `anon` de B exigiria um segundo fluxo
   de OAuth, com o usuário logando duas vezes.

   **Não amplia acesso.** A allow-list tem as 12 relações que o `anon` de B já
   lê hoje, só por GET. Outras 10 relações de B ficam de fora.

   Portões, na ordem: método `GET` → sessão presente → `role = authenticated`
   → `exp` não vencido → domínio `@mse.com.br` → relação na allow-list →
   secret configurado → proxy.

   Detalhes que a implementação exigiu:
   - **A allow-list é gerada, não escrita à mão.** O front-end monta dois nomes
     dinamicamente (`vw_efetivo_${gran}_total`/`_moimod_total` em
     `index.html:3432` e `vw_efetivo_${gran}_pessoas` em `:3480`, com `gran` em
     `diario|semanal|mensal`). Lista manual esqueceria uma granularidade e a
     tela quebraria só naquele filtro, difícil de notar.
   - **Repassa `Range`/`Range-Unit`.** O `fetchPaginado` do painel
     (`index.html:692`) pagina por header `Range`, não por `limit`/`offset`. Sem
     repassar, toda consulta voltaria capada em 1000 linhas.
   - **Bug de ordem encontrado no teste, corrigido na v2.** A checagem do secret
     estava antes da autorização, então todo caso negativo devolvia 500 com o
     nome da variável de ambiente — contava o estado da configuração para quem
     nem passou da porta, e mascarava a autorização (nenhum 401/403 aparecia).
     Foi só testar de fato que apareceu.

   Verificado: sem `Authorization` → 401 (gateway); anon key como Bearer → 403
   `necessario usuario autenticado`; `POST` → 405. Allow-list conferida por
   geração contra o `pg_class` de B: 12/12 existem, 0 que o front pede ficam
   bloqueadas, 10 relações de B não expostas.

   **Pendente do usuário:** definir o secret `EFETIVO_SERVICE_KEY` na função
   (Supabase → Edge Functions → `efetivo` → Secrets, ou
   `supabase secrets set EFETIVO_SERVICE_KEY=...`) com a `service_role` **do
   projeto Efetivo** (`wnldmumgjwujveeimyef`), não a do Portal. Sem isso a
   função devolve 503 com a mensagem apontando para este documento.

   **Depois do secret**, e só então: migrar os 9 sítios do front-end de
   `MSEAuth.headersEfetivo()` + `EFETIVO_SUPABASE_URL` para a função. Antes
   disso a migração deixaria a tela de Histograma/Efetivo quebrada.

Ao fim desta fase, usuário logado e `anon` funcionam em paralelo. Dá para
validar o app inteiro autenticado antes de fechar qualquer porta.

### ⚠️ Fora do plano original: escrita alcançável pela anon key

Descoberto em 08/09/2026 ao gerar o snapshot de rollback. O levantamento inicial
mediu só **leitura**; o dump das policies revelou **11 policies de escrita** que
o `anon` alcança, com os `GRANT`s correspondentes (INSERT/UPDATE/DELETE
concedidos), então são efetivas:

| Tabela | anon pode |
|---|---|
| `suprimentos` | INSERT, UPDATE, **DELETE** |
| `suprimentos_status_manual` | INSERT, UPDATE, **DELETE** |
| `curvas_s` | INSERT, UPDATE |
| `apontamento_efetivo` | **DELETE** |
| `cards_ativos` | **DELETE** |

Isso é destruição de dado, não vazamento: `curvas_s` alimenta o relatório
semanal dos diretores e a Curva S diária do Drive. Não há evidência de que tenha
ocorrido — a conclusão vem das policies mais os grants, sem teste de escrita
contra a base.

**Fechar escrita é mais barato que fechar leitura** e não depende das decisões
pendentes do `dashboard-main` nem da `apresentacao/`: o painel escreve em **uma**
tabela só, `suprimentos_status_manual` (`prototipo/index.html:6194-6202`, upsert
e delete do status manual). As outras quatro nenhum consumidor conhecido escreve
— quem grava é o n8n, com `service_role`, que ignora RLS.

#### Auditoria dos escritores (08/09/2026) — e o falso negativo que quase custou caro

A auditoria de **código** nesta máquina achou **zero** sítios de escrita em
`curvas_s`, `suprimentos`, `apontamento_efetivo` e `cards_ativos`. Concluir dali
que ninguém escreve teria sido errado: os **logs** (`edge_logs`, 24h) mostram
escrita ativa e intensa nessas mesmas tabelas — 3.285 POSTs em
`apontamento_efetivo`, 303 em `curvas_s`, 96 POSTs e 72 DELETEs em
`suprimentos`. Existe um ETL server-side que não vive nesta máquina.

Lição de método: para decidir sobre permissão, **log de tráfego real vale mais
que arqueologia de código**. O código local é um subconjunto dos clientes.

Os logs identificaram exatamente dois escritores, e **ambos usam
`service_role`**, que ignora RLS:

| Escritor | `user_agent` | Grava em |
|---|---|---|
| ETL Node | `axios/1.15.0` | `apontamento_efetivo`, `EAP`, `Apontamentos`, `tarefas`, `medicao_acumulada`, `medicao_diaria`, `pts_emitidas`, `cards_ativos`, `orcamentos_complementares_obra`, `restricoes_obra` |
| Google Apps Script (vários scripts) | `Google-Apps-Script` | `curvas_s`, `suprimentos`, `boletins_medicao`, `contratos_medicao`, `relatorio_produtividade_semanal`, `nfs`, `proximos_faturamentos` |

**Como se provou o papel, sem acesso às credenciais:** os dois gravam com
sucesso (200/201/204) em tabelas que têm RLS ligada e **nenhuma policy de
INSERT** — `tarefas`, `medicao_acumulada` e `medicao_diaria` no caso do axios;
`boletins_medicao`, `contratos_medicao`, `nfs` e `proximos_faturamentos` no caso
do Apps Script. Sob `anon` isso seria negado pelo RLS. Só `bypassrls` passa.
Confirmação direta no código de um deles: `sheet_to_supabase.gs` lê
`SUPABASE_SERVICE_KEY` do `PropertiesService`, sem JWT literal no arquivo.

#### Fechamento aplicado — migração `adr007_fecha_escrita_anon_sem_uso`

Como nenhum escritor legítimo dependia delas, as policies de escrita do `anon`
eram resíduo. Removidas, com `revoke insert, update, delete from anon`:

- `apontamento_efetivo` e `cards_ativos` — policy `"Delete"` (`TO public USING (true)`)
- `curvas_s` — `"insert anon"`, `"update anon"` (mantida a `"escrita service_role"`)
- `suprimentos` — `"delete anon"`, `"escrita anon"`, `"insert anon"`, `"update anon"`

Verificado por requisição real com a anon key: `INSERT` e `DELETE` nas quatro
devolvem **401**, e a leitura continua devolvendo dado. `service_role` e
`authenticated` com privilégios intactos. `npm run test:all` verde.

**`suprimentos_status_manual` ficou de fora, de propósito.** É a única tabela em
que o painel escreve (`prototipo/index.html:6194-6202`) e, em produção, ele
ainda escreve como `anon` porque o login não foi deployado. Fechar agora
quebraria o status manual de Suprimentos. A policy `mse_write_authenticated`
já foi criada (aditiva) para o painel logado; a remoção da escrita `anon` dessa
tabela é o **primeiro passo depois do deploy do login**.

#### Resíduo conhecido, sem risco ativo

`tarefas` e `medicao_diaria` (e as outras três do grupo "RLS sem policy")
mantêm `GRANT` de INSERT/DELETE para `anon`. O RLS nega, porque não há policy —
então não há exposição real, mas o grant é frouxo. Revogar junto com a Fase 4,
por higiene.

### Fase 4 — O corte ⚠️

10. Tabela por tabela: dropar a policy de `anon`/`PUBLIC` e
    `revoke select on <tabela> from anon`. Validar a tela correspondente do
    painel a cada grupo, não tudo de uma vez.
11. Repetir no projeto `Efetivo`.
12. Rodar `npm run test:all` autenticado e conferir o relatório semanal e a
    Curva S do Drive depois do corte.

**Ponto de não retorno:** a partir do passo 10 qualquer consumidor esquecido para
de ler, com erro visível (o que é o comportamento correto por ADR-005 — falhar
alto, não em silêncio). Reverter é recriar a policy, então o risco é de
indisponibilidade, não de perda de dado.

## Pendências de decisão

- **`dashboard-main`**: migrar para `service_role`/sessão ou aposentar? Decide se
  o passo 9 pode avançar sem quebrá-lo.
- **`apresentacao/`**: é o app de demo para cliente. Exigir login da MSE nele
  contradiz o propósito (o cliente não tem conta `@mse.com.br`). Precisa de
  tratamento próprio — provavelmente um perfil de acesso separado, não a mesma
  regra de domínio.
