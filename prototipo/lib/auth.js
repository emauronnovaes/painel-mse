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

  async function sair() {
    await exigeCliente().auth.signOut();
    sessaoAtual = null;
    acessoTotalCache = null;
    acessoTotalPromessa = null;
    obrasFinanceiroCache = null;
    acessoObrasPromessa = null;
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

    const { data, error } = await cliente.auth.getSession();
    if (error) console.error('[MSEAuth] getSession falhou', error);
    sessaoAtual = (data && data.session) || null;

    cliente.auth.onAuthStateChange(function (_evento, novaSessao) {
      sessaoAtual = novaSessao || null;
      // Sessao trocou: o acesso e por e-mail, entao nenhum cache vale mais.
      acessoTotalCache = null;
      acessoTotalPromessa = null;
      obrasFinanceiroCache = null;
      acessoObrasPromessa = null;
      notificar();
    });

    return sessaoAtual;
  }

  return Object.freeze({
    iniciar, entrarComGoogle, sair, aoMudar,
    headers, headersEfetivo,
    sessao, usuario, ehDaMSE, loginObrigatorio,
    carregarAcessoTotal, acessoTotal, restringirFinanceiro,
    carregarAcessoObras, restringirFinanceiroObra,
    DOMINIO_SUGERIDO,
  });
}));
