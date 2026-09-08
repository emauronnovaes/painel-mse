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

7. Criar, **ao lado** das policies de `anon`, as equivalentes
   `to authenticated` com o predicado de domínio:
   `auth.jwt()->>'email' like '%@mse.com.br'`.
8. Recriar as 5 views com `security_invoker = true`.
9. Edge Function no projeto A para as leituras do `Efetivo`, exigindo sessão e
   lendo o B com `service_role`; migrar os 9 sítios do front-end.

Ao fim desta fase, usuário logado e `anon` funcionam em paralelo. Dá para
validar o app inteiro autenticado antes de fechar qualquer porta.

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
