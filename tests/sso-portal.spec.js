// Entrada pelo Portal MSE (superapp) — ver docs/15, seção 2.
//
// O painel é servido DENTRO do portal, que já autenticou a pessoa. O portal
// injeta `window.__MSE_PORTAL = { access_token, refresh_token }` no HTML, e o
// MSEAuth instala isso como SESSÃO REAL do Supabase (`setSession`).
//
// POR QUE SESSÃO REAL E NÃO "o portal diz quem é": quem entra sem JWT lê como
// `anon`, que é ISENTO das policies do financeiro. Alisson, com recorte em
// CP273, veria as 461 NFs de todas as obras em vez das 17 dele. O teste
// "token recusado NÃO entra" é o que trava essa regressão.
const { test, expect } = require('@playwright/test');

const REF = 'gebjlhkywtnpfqjrakok';

function jwtFalso(email) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return [
    b64({ alg: 'ES256', typ: 'JWT' }),
    b64({ sub: '00000000-0000-0000-0000-000000000003', email, role: 'authenticated', exp }),
    'assinatura-falsa',
  ].join('.');
}

// Injeta o bootstrap do portal ANTES de qualquer script da página, que é como o
// PHP faria ao servir o HTML.
async function abrirViaPortal(page, bootstrap, { setSessionOk = true } = {}) {
  await page.addInitScript((b) => { window.__MSE_PORTAL = b; }, bootstrap);

  // `setSession` valida o access_token em GET /auth/v1/user (NAO em
  // /auth/v1/token, que e o refresh). Interceptar o endpoint errado deixa o
  // Supabase real recusar o token forjado com 401, e o teste passa a medir o
  // caminho de erro achando que mede o de sucesso -- foi o que aconteceu na
  // primeira versao deste spec.
  await page.route('**/auth/v1/user**', (rota) => rota.fulfill(
    setSessionOk
      ? { status: 200, contentType: 'application/json',
          body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000003',
                                 email: 'portal.user@mse.com.br',
                                 user_metadata: {}, app_metadata: {} }) }
      : { status: 401, contentType: 'application/json',
          body: JSON.stringify({ message: 'invalid claim: missing sub claim' }) }
  ));

  // Os RPCs de acesso não são o objeto deste spec; responde canônico.
  await page.route('**/rest/v1/rpc/mse_acesso_total', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: 'true' }));
  await page.route('**/rest/v1/rpc/mse_obras_financeiro', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: '[106,110,94,107,108,91,114]' }));

  await page.goto('/#/obra/106/curva-s', { waitUntil: 'domcontentloaded' });
}

const BOOTSTRAP_OK = {
  access_token: jwtFalso('portal.user@mse.com.br'),
  refresh_token: 'refresh-do-portal',
};

test.describe('SSO do Portal MSE', () => {
  test('entra direto, sem tela de login', async ({ page }) => {
    await abrirViaPortal(page, BOOTSTRAP_OK);
    await page.waitForSelector('.tabs-scroll', { timeout: 45_000 });
    expect(await page.evaluate(() => !!MSEAuth.sessao())).toBe(true);
    expect(await page.evaluate(() => MSEAuth.usuario().email)).toBe('portal.user@mse.com.br');
    await expect(page.locator('body')).not.toContainText('Entrar com Google');
  });

  test('a sessão do portal é uma sessão REAL do Supabase', async ({ page }) => {
    await abrirViaPortal(page, BOOTSTRAP_OK);
    await page.waitForSelector('.tabs-scroll', { timeout: 45_000 });
    // O ponto inteiro do desenho: o header de leitura carrega o token do
    // usuário, NÃO a anon key. É isso que faz o RLS enxergar a pessoa.
    const auth = await page.evaluate(() => MSEAuth.headers().Authorization);
    expect(auth).toBe('Bearer ' + BOOTSTRAP_OK.access_token);
  });

  test('token recusado NAO entra — cai no login com motivo', async ({ page }) => {
    // Fail-closed. Entrar sem identidade seria ler como `anon`, que é isento
    // das policies do financeiro — o oposto do que o SSO deveria garantir.
    await abrirViaPortal(page, BOOTSTRAP_OK, { setSessionOk: false });
    await page.waitForTimeout(3000);
    expect(await page.evaluate(() => !!MSEAuth.sessao())).toBe(false);
    await expect(page.locator('body')).toContainText('Portal');
    expect(await page.evaluate(() => MSEAuth.erroPortal())).toContain('não foi aceita');
  });

  test('portal sem sessão emitida mostra o erro que ele mandou', async ({ page }) => {
    await abrirViaPortal(page, { erro: 'Usuario sem permissao no Portal.' }, { setSessionOk: false });
    await page.waitForTimeout(2000);
    expect(await page.evaluate(() => MSEAuth.viaPortal())).toBe(true);
    expect(await page.evaluate(() => MSEAuth.erroPortal())).toBe('Usuario sem permissao no Portal.');
    await expect(page.locator('body')).toContainText('Usuario sem permissao');
  });

  test('sem bootstrap, nada muda no fluxo normal', async ({ page }) => {
    // Regressão: o caminho fora do portal (Firebase, localhost) não pode ter
    // sido afetado. Sem `window.__MSE_PORTAL`, viaPortal() é false.
    await page.goto('/#/obra/106/curva-s', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => MSEAuth.viaPortal())).toBe(false);
    expect(await page.evaluate(() => MSEAuth.erroPortal())).toBe(null);
  });
});
