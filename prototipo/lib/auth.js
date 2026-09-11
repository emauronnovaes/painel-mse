// Autenticação do painel — ADR-007 (ver docs/06 e docs/14).
//
// Por que Supabase Auth e não Firebase Auth: o Hosting é Firebase, o que torna o
// Firebase Auth o reflexo natural — mas identidade do Firebase deixa o Supabase
// sem saber quem é o usuário, e o RLS sem `auth.uid()` pra se apoiar. Ligar os
// dois exigiria um servidor assinando JWT customizado. O Supabase Auth devolve um
// JWT que o RLS entende nativamente, pelo mesmo trabalho de front-end.
//
// O que este módulo NÃO é: proteção de dado. Enquanto o RLS aceitar `anon`
// (Fase 4 do plano), qualquer pessoa com a anon key — que está no HTML servido —
// lê o Supabase direto, sem passar por aqui. Este módulo é a identidade que
// torna o RLS possível; a proteção vem do RLS. Tratar a tela de login como
// segurança seria repetir exatamente o antipadrão que o ADR-007 existe pra
// evitar (ver docs/05, "senha literal no cliente").
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MSEAuth = factory();
}(typeof self !== 'undefined' ? self : this, function () {

  // Interruptor de implantação, NÃO controle de acesso. Fica `false` até o
  // provider Google estar configurado no Google Cloud + Supabase (Fase 1, passos
  // 1 e 2 do docs/14) — assim este código pode ir pra produção sem trancar
  // ninguém fora de um login que ainda não funciona. Vira `true` quando o fluxo
  // for validado, e deixa de existir no fim da Fase 4, quando o RLS passa a ser
  // o que decide.
  const LOGIN_OBRIGATORIO = true;

  // Dica pro Google mostrar direto as contas do domínio. É UX, não trava: o
  // usuário consegue contornar. A checagem que vale é o predicado de RLS sobre
  // `auth.jwt()->>'email'` (Fase 3). Não confiar nisto pra autorizar nada.
  const DOMINIO_SUGERIDO = 'mse.com.br';

  // ── Entrada pelo Portal MSE (superapp) ─────────────────────────────────────
  // O painel é servido DENTRO do portal, que já autenticou a pessoa. Repetir a
  // tela de login ali seria absurdo — mas a alternativa óbvia (o portal mandar
  // "quem é o usuário" e o painel acreditar) é o antipadrão que o ADR-007
  // existe pra eliminar, e aqui teria consequência concreta: quem entrasse por
  // esse caminho leria como `anon`, que é ISENTO das policies do financeiro.
  // Alisson, com recorte em CP273, veria as 461 NFs de todas as obras em vez
  // das 17 dele. Ver docs/15, seção 2.
  //
  // Transporte: EXATAMENTE igual ao planejamento_dash — o portal manda o mesmo
  // token HMAC que já manda pra lá, pela URL (`?sso=<token>` no `<iframe src>`).
  // Zero código novo de geração ou transporte do lado do PHP.
  //
  // A diferença fica do lado do painel: o planejamento_dash troca o token só
  // por IDENTIDADE (`window.__SSO_BOOTSTRAP.user`, sem JWT do Supabase) — não
  // serve aqui, porque o RLS do financeiro precisa de `auth.jwt()->>'email'`.
  // Por isso o painel troca o MESMO token pela Edge Function `portal-sso`
  // (docs/15, seção 1d), que devolve uma sessão REAL do Supabase.
  const PORTAL_SSO_URL = 'https://gebjlhkywtnpfqjrakok.supabase.co/functions/v1/portal-sso';

  let veioDoPortal = false;
  let erroPortalDetalhe = null;

  function tokenPortalDaUrl() {
    try { return new URLSearchParams(location.search).get('sso'); } catch (e) { return null; }
  }

  // Tira o `sso=` da URL assim que lido. O token é de uso único (nonce) — um
  // F5 reenviando o mesmo token bateria em "nonce já usado", e não há motivo
  // pra ele sobreviver no histórico do navegador.
  function limparTokenDaUrl() {
    try {
      const url = new URL(location.href);
      url.searchParams.delete('sso');
      history.replaceState(null, '', url.toString());
    } catch (e) { /* ambiente sem History API: token fica, sem quebrar nada */ }
  }

  async function trocarTokenPortal(token) {
    try {
      const r = await fetch(PORTAL_SSO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token }),
      });
      const dados = await r.json().catch(function () { return {}; });
      if (!r.ok || !dados.access_token || !dados.refresh_token) {
        return { erro: dados.erro || ('HTTP ' + r.status) };
      }
      return { access_token: dados.access_token, refresh_token: dados.refresh_token };
    } catch (e) {
      return { erro: 'Falha de rede ao validar o acesso pelo Portal.' };
    }
  }

  // Verdadeiro quando a pessoa chegou pelo portal (havia `?sso=` na URL de
  // entrada). Muda só a UI (o botão "sair" vira "Portal"); não afeta permissão
  // nenhuma.
  function viaPortal() { return veioDoPortal; }

  // Motivo, quando veio do portal e mesmo assim não há sessão. Serve pra tela de
  // login dizer algo útil em vez de oferecer "entrar com Google" — que dentro do
  // iframe do portal frequentemente nem completa.
  function erroPortal() {
    if (!veioDoPortal || sessaoAtual) return null;
    return erroPortalDetalhe;
  }

  let cliente = null;
  let sessaoAtual = null;
  let anonKeyPortal = null;
  let anonKeyPortalUrl = null;
  let anonKeyEfetivo = null;
  const ouvintes = [];

  function exigeCliente() {
    if (!cliente) throw new Error('MSEAuth.iniciar() não foi chamado ainda.');
    return cliente;
  }

  // Monta o header de leitura do Supabase. `apikey` continua sendo a anon key
  // porque é o que o gateway do Supabase usa pra rotear a requisição; o que
  // carrega identidade é o `Authorization`. Sem sessão, cai na anon key — é o
  // que mantém o app funcionando durante as Fases 1 a 3, antes do corte.
  function montarHeaders(anonKey, extra) {
    const token = (sessaoAtual && sessaoAtual.access_token) || anonKey;
    return Object.assign({ apikey: anonKey, Authorization: 'Bearer ' + token }, extra || {});
  }

  function headers(extra) { return montarHeaders(anonKeyPortal, extra); }

  // ⚠️ SEM USO desde 08/09/2026 — os 9 sítios do Efetivo migraram para a Edge
  // Function (`EFETIVO_API` em index.html) e passaram a usar `headers()`.
  // Mantida SÓ como rollback enquanto a Fase 3 não é confirmada em produção.
  // REMOVER quando o Histograma estiver validado autenticado — código morto é
  // antipadrão explícito do projeto (docs/05, "se não usa, não entra").
  function headersEfetivo(extra) {
    return Object.assign({ apikey: anonKeyEfetivo, Authorization: 'Bearer ' + anonKeyEfetivo }, extra || {});
  }

  function sessao() { return sessaoAtual; }

  function usuario() {
    if (!sessaoAtual || !sessaoAtual.user) return null;
    const u = sessaoAtual.user;
    return {
      email: u.email || null,
      nome: (u.user_metadata && (u.user_metadata.full_name || u.user_metadata.name)) || u.email || null,
      foto: (u.user_metadata && (u.user_metadata.avatar_url || u.user_metadata.picture)) || null,
    };
  }

  // Verdadeiro só se houver sessão E o e-mail for do domínio. Serve pra decidir
  // o que a UI mostra; a recusa de dado é do RLS, não daqui.
  function ehDaMSE() {
    const u = usuario();
    return !!(u && u.email && u.email.toLowerCase().endsWith('@' + DOMINIO_SUGERIDO));
  }

  // Costura de teste, não bypass de produção.
  //
  // A suíte roda contra o working copy (playwright.config.ts) e não tem como
  // completar um OAuth do Google. Sem esta costura, todo teste de navegador
  // bateria na tela de login — e, pior, os specs antigos PASSARIAM nela, porque
  // asseguravam só "#root visível e body contém MSE", que a tela de login também
  // satisfaz. Teste verde numa tela que não é a testada é pior que teste
  // vermelho.
  //
  // Só é acionável por `page.addInitScript`, ou seja, por quem já controla o
  // navegador antes do carregamento — não por URL, query string ou clique. E
  // desativa apenas o PORTÃO DE UI: o acesso ao dado é decidido pelo RLS, que
  // esta flag não alcança. Depois da Fase 4, contornar o portão não devolve dado
  // nenhum, o que é justamente a diferença entre isto e a "trava cosmética" que
  // o ADR-007 existe pra evitar (docs/05).
  // ── Acesso total (financeiro) ──────────────────────────────────────────────
  // A lista de e-mails com acesso total vive em `public.acesso_total`, e a
  // tabela tem o GRANT revogado de propósito: ninguém consegue LISTAR quem tem
  // acesso. O painel então não lê a lista — ele PERGUNTA sobre si mesmo, pelo
  // RPC `mse_acesso_total()`, e recebe só um booleano.
  //
  // Isto é para a UI, não é a proteção. Quem recusa o dado é o RLS (policies
  // RESTRITIVAS no financeiro) e o WHERE da view `v_indices_financeiros_diario`.
  // Esconder o setor evita o pior modo de falha: uma tela de Medições vazia se
  // lê como "não houve faturamento", não como "você não tem permissão" — o
  // oposto do ADR-005.
  let acessoTotalCache = null;   // null = ainda não sabido
  let acessoTotalPromessa = null;

  async function carregarAcessoTotal() {
    if (acessoTotalCache !== null) return acessoTotalCache;
    if (acessoTotalPromessa) return acessoTotalPromessa;
    acessoTotalPromessa = (async () => {
      try {
        const r = await fetch(anonKeyPortalUrl + '/rest/v1/rpc/mse_acesso_total', {
          method: 'POST',
          headers: Object.assign(headers(), { 'Content-Type': 'application/json' }),
          body: '{}',
        });
        if (!r.ok) throw new Error('rpc mse_acesso_total: HTTP ' + r.status);
        acessoTotalCache = (await r.json()) === true;
      } catch (e) {
        // Falha alto no console, mas assume RESTRITO: na dúvida, esconder é o
        // erro seguro. Mostrar o financeiro por falha de rede seria o inverso.
        console.error('[MSEAuth] nao foi possivel checar acesso total', e);
        acessoTotalCache = false;
      } finally {
        acessoTotalPromessa = null;
      }
      return acessoTotalCache;
    })();
    return acessoTotalPromessa;
  }

  function acessoTotal() { return acessoTotalCache; }

  // ── Financeiro por obra ────────────────────────────────────────────────────
  // `mse_obras_financeiro()` devolve as obras em que este e-mail vê Medições e
  // OC/CO (docs/15, seção 1c). Terceiro nível de acesso, entre "vê tudo" e
  // "não vê financeiro nenhum".
  //
  // Mesmo desenho do acesso total: o painel não LÊ a lista (o GRANT de
  // `acesso_total` está revogado), ele pergunta sobre si mesmo e recebe só os
  // ids das obras em que ELE tem financeiro.
  //
  // ⚠️ O recorte é SÓ do financeiro. A lista de obras do seletor continua
  // inteira para todo mundo (decisão do usuário, 09/09/2026: "não vai
  // restringir o acesso geral das obras"). Uma versão anterior tinha uma
  // segunda dimensão, `acesso_obra`, que escondia obras do seletor; foi
  // removida por não ter consumidor — recuperável pelo histórico do git.
  let obrasFinanceiroCache = null;   // null = ainda não sabido
  let acessoObrasPromessa = null;

  async function chamarRpcIds(nome) {
    const r = await fetch(anonKeyPortalUrl + '/rest/v1/rpc/' + nome, {
      method: 'POST',
      headers: Object.assign(headers(), { 'Content-Type': 'application/json' }),
      body: '{}',
    });
    if (!r.ok) throw new Error('rpc ' + nome + ': HTTP ' + r.status);
    const dados = await r.json();
    if (!Array.isArray(dados)) throw new Error('rpc ' + nome + ': resposta não é lista');
    // `returns setof int` chega como [{ mse_obras_financeiro: 106 }, ...] ou
    // como [106, ...] dependendo da versão do PostgREST. Aceita as duas.
    return dados.map(function (d) {
      return typeof d === 'number' ? d : Number(d[nome] !== undefined ? d[nome] : Object.values(d)[0]);
    }).filter(function (n) { return Number.isFinite(n); });
  }

  async function carregarAcessoObras() {
    if (obrasFinanceiroCache !== null) return obrasFinanceiroCache;
    if (acessoObrasPromessa) return acessoObrasPromessa;
    acessoObrasPromessa = (async () => {
      try {
        obrasFinanceiroCache = await chamarRpcIds('mse_obras_financeiro');
      } catch (e) {
        // FECHA, mesma regra de `carregarAcessoTotal`: `[]` = nenhuma obra com
        // financeiro. Mostrar Medições por falha de rede é o erro caro; a aba a
        // menos é o barato.
        console.error('[MSEAuth] nao foi possivel checar financeiro por obra', e);
        obrasFinanceiroCache = [];
      } finally {
        acessoObrasPromessa = null;
      }
      return obrasFinanceiroCache;
    })();
    return acessoObrasPromessa;
  }

  // Financeiro AGORA É POR OBRA. Mantém a regra de `restringirFinanceiro()` —
  // sem sessão não restringe, e restringe até prova em contrário — só que a
  // prova passou a depender de QUAL obra está aberta.
  //
  // O acesso global (linha com `obra_id` NULL em `acesso_total`) continua
  // valendo: o RPC devolve todas as obras nesse caso, então quem tinha acesso
  // total antes desta mudança segue com as 9 abas em todas as obras.
  function restringirFinanceiroObra(obraId) {
    if (!sessaoAtual) return false;
    if (acessoTotalCache === true) return false;       // acesso global
    if (obrasFinanceiroCache === null) return true;    // ainda não sabido: esconde
    return obrasFinanceiroCache.indexOf(obraId) === -1;
  }

  // Sem sessão devolve `false` de propósito: o RLS restringe apenas
  // `authenticated`, e produção ainda lê como `anon` (a Fase 4 do docs/14 não
  // aconteceu). Se a UI restringisse sem sessão, o painel em produção perderia
  // Medições hoje, divergindo do banco.
  //
  // COM sessão, restringe até PROVA em contrário — `null` (ainda não sabido)
  // conta como restrito, não como liberado. A primeira versão comparava
  // `=== false`, então enquanto o RPC não respondia a função devolvia `false` e
  // as abas de Medições/OC-CO apareciam por um instante a cada refresh. Mostrar
  // primeiro e esconder depois revela justamente o que deveria ficar escondido.
  function restringirFinanceiro() {
    if (!sessaoAtual) return false;
    return acessoTotalCache !== true;
  }

  function loginObrigatorio() {
    try {
      if (typeof window !== 'undefined' && window.__MSE_TESTE_SEM_LOGIN === true) return false;
    } catch (e) { /* ambiente sem window: segue a regra normal */ }
    return LOGIN_OBRIGATORIO;
  }

  function notificar() {
    ouvintes.forEach(function (cb) {
      try { cb(sessaoAtual); } catch (e) { console.error('[MSEAuth] ouvinte falhou', e); }
    });
  }

  function aoMudar(cb) {
    if (typeof cb === 'function') ouvintes.push(cb);
  }

  async function entrarComGoogle() {
    // `redirectTo` sem hash/query: o Supabase devolve a sessão no fragmento da
    // URL e o supabase-js a consome sozinho no próximo `iniciar()`. Apontar pro
    // caminho atual (e não pra `location.href`) evita carregar de volta o estado
    // de navegação do painel, que é gerido por rota própria (ADR-004).
    const { error } = await exigeCliente().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: location.origin + location.pathname,
        queryParams: { hd: DOMINIO_SUGERIDO, prompt: 'select_account' },
      },
    });
    if (error) throw error;
  }

  // Os dois caches de acesso são POR E-MAIL. Quem os invalida é a troca de
  // identidade — e só ela (ver `onAuthStateChange`).
  let emailDaSessao = null;

  function emailDe(sess) {
    return (sess && sess.user && sess.user.email) ? sess.user.email.toLowerCase() : null;
  }

  function limparCachesDeAcesso() {
    acessoTotalCache = null;
    acessoTotalPromessa = null;
    obrasFinanceiroCache = null;
    acessoObrasPromessa = null;
  }

  async function sair() {
    await exigeCliente().auth.signOut();
    sessaoAtual = null;
    emailDaSessao = null;
    limparCachesDeAcesso();
    notificar();
  }

  // Cria o cliente, consome a sessão que o Google devolveu no fragmento da URL
  // (se for um retorno de OAuth) e passa a acompanhar mudanças. Devolve a sessão
  // — ou `null`, que NÃO é erro: é o estado normal de quem ainda não entrou.
  async function iniciar(cfg) {
    if (!cfg || !cfg.url || !cfg.anonKey) {
      throw new Error('MSEAuth.iniciar({ url, anonKey, urlEfetivo, anonKeyEfetivo })');
    }
    anonKeyPortal = cfg.anonKey;
    anonKeyPortalUrl = cfg.url;
    anonKeyEfetivo = cfg.anonKeyEfetivo || null;

    if (typeof supabase === 'undefined' || !supabase.createClient) {
      // Falha alto (ADR-005): sem a lib não há como saber se existe sessão, e
      // seguir em silêncio faria o app parecer deslogado por um motivo errado.
      throw new Error('supabase-js não carregou — confira a tag <script> no <head>.');
    }

    cliente = supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });

    // A sessão do portal tem PRECEDÊNCIA sobre a que estiver no localStorage:
    // dentro do superapp, quem manda é quem está logado no portal agora. Sem
    // isso, uma sessão antiga de outra pessoa no mesmo navegador venceria a do
    // portal — e o RLS obedeceria a ela, não ao portal.
    const tokenPortal = tokenPortalDaUrl();
    if (tokenPortal) {
      veioDoPortal = true;
      limparTokenDaUrl();

      const trocado = await trocarTokenPortal(tokenPortal);
      if (trocado.erro) {
        // Falha alto e NÃO entra: token do portal recusado significa que a
        // identidade não vale. Cair no fluxo normal mostra a tela de login, que
        // é o comportamento certo — melhor pedir login do que entrar sem
        // identidade e ler como `anon`, isento das policies do financeiro.
        console.error('[MSEAuth] token do portal recusado', trocado.erro);
        erroPortalDetalhe = 'Acesso pelo Portal não validado. Recarregue a página pelo Portal.';
      } else {
        // `setSession` PERSISTE e passa a renovar sozinha (autoRefreshToken),
        // que é a diferença de mandar o token só no header: aqui o supabase-js
        // assume o ciclo de vida e o painel não precisa saber quando ele vence.
        const { data: dp, error: ep } = await cliente.auth.setSession({
          access_token: trocado.access_token,
          refresh_token: trocado.refresh_token,
        });
        if (ep) {
          console.error('[MSEAuth] sessao do portal recusada pelo Supabase', ep);
          erroPortalDetalhe = 'A sessão do Portal não foi aceita pelo Supabase. '
            + 'Recarregue a página pelo Portal.';
        } else if (dp && dp.session) {
          sessaoAtual = dp.session;
        }
      }
    }

    // Só consulta o armazenamento local se o portal não resolveu. O `if` é o
    // que dá a precedência descrita acima — e ficar FORA de um `return`
    // antecipado é o que garante que o `onAuthStateChange` abaixo seja sempre
    // registrado, inclusive na entrada pelo portal (senão o refresh automático
    // atualizaria o token sem o painel re-renderizar).
    if (!sessaoAtual) {
      const { data, error } = await cliente.auth.getSession();
      if (error) console.error('[MSEAuth] getSession falhou', error);
      sessaoAtual = (data && data.session) || null;
    }

    emailDaSessao = emailDe(sessaoAtual);

    cliente.auth.onAuthStateChange(function (_evento, novaSessao) {
      sessaoAtual = novaSessao || null;
      // Invalida o cache de acesso SÓ quando a IDENTIDADE muda — não a cada
      // evento. O acesso é por e-mail; um token novo para o mesmo e-mail não
      // muda permissão nenhuma.
      //
      // Zerar em todo evento (versão anterior) fazia as abas do financeiro
      // sumirem sozinhas depois de ~50min com a página aberta: o
      // `TOKEN_REFRESHED` automático limpava os caches, `restringirFinanceiro*`
      // trata `null` como restrito (fail-closed, correto), e a releitura que
      // devia devolver as abas não forçava re-render — elas só voltavam se a
      // pessoa clicasse em algo. Ver `useAcessoTotal` em index.html.
      //
      // A propriedade de segurança está preservada: trocou de e-mail (ou
      // deslogou), o cache do e-mail anterior não sobrevive.
      const novoEmail = emailDe(sessaoAtual);
      if (novoEmail !== emailDaSessao) {
        emailDaSessao = novoEmail;
        limparCachesDeAcesso();
      }
      notificar();
    });

    return sessaoAtual;
  }

  return Object.freeze({
    iniciar, entrarComGoogle, sair, aoMudar,
    headers, headersEfetivo,
    sessao, usuario, ehDaMSE, loginObrigatorio, viaPortal, erroPortal,
    carregarAcessoTotal, acessoTotal, restringirFinanceiro,
    carregarAcessoObras, restringirFinanceiroObra,
    DOMINIO_SUGERIDO,
  });
}));
