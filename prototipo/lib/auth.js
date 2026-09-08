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

  function loginObrigatorio() { return LOGIN_OBRIGATORIO; }

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
      notificar();
    });

    return sessaoAtual;
  }

  return Object.freeze({
    iniciar, entrarComGoogle, sair, aoMudar,
    headers, headersEfetivo,
    sessao, usuario, ehDaMSE, loginObrigatorio,
    DOMINIO_SUGERIDO,
  });
}));
