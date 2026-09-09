// Testa a Edge Function `portal-sso` de ponta a ponta, sem depender do portal.
//
// Emite um token HMAC no MESMO formato que o portal usa para o
// `planejamento_dash`, chama a função, e confere que a sessão devolvida é uma
// sessão real do Supabase — que é o ponto inteiro do desenho (ver docs/15, 1d).
//
// USO:
//   set MSE_PORTAL_SSO_SECRET=<o mesmo segredo do portal>
//   node scripts/testar-portal-sso.js fulano@mse.com.br
//
// O segredo NUNCA entra em arquivo aqui. No planejamento_dash ele vive em
// `config/sso.local.json` (que é gitignored) ou na env `SUPER_APP_SSO_SECRET`.

const crypto = require('crypto');

const URL_BASE = 'https://gebjlhkywtnpfqjrakok.supabase.co';
const ANON = process.env.MSE_ANON_KEY || '';
const SEGREDO = process.env.MSE_PORTAL_SSO_SECRET || '';
const EMAIL = process.argv[2] || 'treinamento.planejamento@mse.com.br';

if (!SEGREDO) {
  console.error('Defina MSE_PORTAL_SSO_SECRET (o mesmo segredo do portal).');
  process.exit(1);
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

// Mesmo formato do `planejamento_dash`: base64url(payload).base64url(hmac).
function emitirToken(extra = {}) {
  const agora = Math.floor(Date.now() / 1000);
  const payload = Object.assign({
    email: EMAIL,
    nome: 'Teste Portal',
    origem: 'mse',
    perfil: 'MSE',
    nonce: crypto.randomUUID(),
    id_origem: 1,
    id_cliente: 0,
    iat: agora,
    exp: agora + 60,
  }, extra);
  const p = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', SEGREDO).update(p).digest());
  return `${p}.${sig}`;
}

async function chamar(token) {
  const r = await fetch(`${URL_BASE}/functions/v1/portal-sso`, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, ANON ? { apikey: ANON } : {}),
    body: JSON.stringify({ token }),
  });
  let corpo;
  try { corpo = await r.json(); } catch (_) { corpo = await r.text(); }
  return { status: r.status, corpo };
}

function ok(cond, texto) {
  console.log(`${cond ? 'OK  ' : 'FALHA'}  ${texto}`);
  if (!cond) process.exitCode = 1;
}

(async () => {
  console.log(`Testando portal-sso para ${EMAIL}\n`);

  // 1. Caminho feliz.
  const bom = await chamar(emitirToken());
  ok(bom.status === 200, `token valido -> 200 (veio ${bom.status})`);
  if (bom.status !== 200) { console.log('   corpo:', bom.corpo); return; }
  ok(!!bom.corpo.access_token, 'devolveu access_token');
  ok(!!bom.corpo.refresh_token, 'devolveu refresh_token');
  ok(bom.corpo.email === EMAIL.toLowerCase(), 'e-mail confere');

  // 2. A sessão é REAL: o Supabase tem que aceitar o token e devolver o usuário.
  //    Se isto falhar, o painel entraria e leria como anon — o bug que o
  //    desenho inteiro existe pra evitar.
  const u = await fetch(`${URL_BASE}/auth/v1/user`, {
    headers: { apikey: ANON || bom.corpo.access_token, Authorization: `Bearer ${bom.corpo.access_token}` },
  });
  const perfil = u.ok ? await u.json() : null;
  ok(u.ok, `Supabase aceita o access_token (GET /auth/v1/user -> ${u.status})`);
  ok(perfil && perfil.email === EMAIL.toLowerCase(), 'o token identifica a pessoa certa');
  ok(perfil && perfil.role === 'authenticated', `role = authenticated (veio ${perfil && perfil.role})`);

  // 3. Replay: o MESMO token nao pode passar duas vezes.
  const t = emitirToken();
  const p1 = await chamar(t);
  const p2 = await chamar(t);
  ok(p1.status === 200, `primeira vez -> 200 (veio ${p1.status})`);
  ok(p2.status === 401, `replay do mesmo token -> 401 (veio ${p2.status})`);

  // 4. Assinatura adulterada.
  //
  // Mexe no MEIO da assinatura, nao no ultimo caractere. Em base64url o ultimo
  // caractere carrega bits que nao sao usados, entao trocar so ele pode
  // decodificar para os MESMOS bytes -- a primeira versao deste teste fazia
  // isso e acusava falha na funcao quando a funcao estava certa.
  const [pOk, sigOk] = emitirToken().split('.');
  const meio = Math.floor(sigOk.length / 2);
  const sigRuim = sigOk.slice(0, meio) + (sigOk[meio] === 'A' ? 'B' : 'A') + sigOk.slice(meio + 1);
  ok((await chamar(`${pOk}.${sigRuim}`)).status === 401, 'assinatura adulterada -> 401');

  // 4b. Payload adulterado com a assinatura original: e o ataque real -- trocar
  // o e-mail para o de outra pessoa e reaproveitar a assinatura.
  const outro = Buffer.from(JSON.stringify(Object.assign(
    JSON.parse(Buffer.from(pOk, 'base64url').toString()), { email: 'outra.pessoa@mse.com.br' },
  ))).toString('base64url');
  ok((await chamar(`${outro}.${sigOk}`)).status === 401, 'payload trocado com assinatura antiga -> 401');

  // 5. Token expirado e TTL acima do teto (120s).
  const agora = Math.floor(Date.now() / 1000);
  ok((await chamar(emitirToken({ iat: agora - 300, exp: agora - 60 }))).status === 401, 'token expirado -> 401');
  ok((await chamar(emitirToken({ iat: agora, exp: agora + 86400 }))).status === 401, 'TTL acima do teto -> 401');

  // 6. Campos fora do enum.
  ok((await chamar(emitirToken({ origem: 'qualquer' }))).status === 401, 'origem invalida -> 401');
  ok((await chamar(emitirToken({ perfil: 'ROOT' }))).status === 401, 'perfil invalido -> 401');
  ok((await chamar(emitirToken({ email: 'sem-arroba' }))).status === 401, 'e-mail invalido -> 401');

  console.log(`\n${process.exitCode ? 'HOUVE FALHA' : 'tudo certo'}`);
})();
