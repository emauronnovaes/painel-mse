// Entrada pelo Portal MSE (superapp) — ver docs/15, seção 1d/2.
//
// Transporte EXATAMENTE igual ao planejamento_dash: o portal manda o token
// HMAC pela URL, `?sso=<token>`. A diferença fica do lado do painel: em vez de
// só confiar na identidade (como o `app.py` faz com `__SSO_BOOTSTRAP`), o
// painel troca esse token pela Edge Function `portal-sso`, que devolve uma
// SESSÃO REAL do Supabase (`setSession`).
//
// POR QUE SESSÃO REAL E NÃO "o portal diz quem é": quem entra sem JWT lê como
// `anon`, que é ISENTO das policies do financeiro. Alisson, com recorte em
// CP273, veria as 461 NFs de todas as obras em vez das 17 dele. O teste
// "token recusado NÃO entra" é o que trava essa regressão.
const { test, expect } = require('@playwright/test');

function jwtFalso(email) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return [
    b64({ alg: 'ES256', typ: 'JWT' }),
    b64({ sub: '00000000-0000-0000-0000-000000000003', email, role: 'authenticated', exp }),
    'assinatura-falsa',
  ].join('.');
}

const SESSAO_OK = {
  access_token: jwtFalso('portal.user@mse.com.br'),
  refresh_token: 'refresh-do-portal',
};

// Simula a Edge Function `portal-sso` e o resto da cadeia (setSession + RPCs),
// e abre o painel com `?sso=<token qualquer>` na URL — o conteúdo do token não
// importa aqui porque quem "valida" é a rota interceptada, não o Supabase real.
async function abrirViaPortal(page, { edgeFunctionOk = true, edgeFunctionErro = 'Acesso pelo portal nao validado.',
  setSessionOk = true } = {}) {
  await page.route('**/functions/v1/portal-sso', (rota) => rota.fulfill(
    edgeFunctionOk
      ? { status: 200, contentType: 'application/json', body: JSON.stringify(SESSAO_OK) }
      : { status: 401, contentType: 'application/json', body: JSON.stringify({ erro: edgeFunctionErro }) }
  ));

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

  await page.goto('/?sso=token-qualquer#/obra/106/curva-s', { waitUntil: 'domcontentloaded' });
}

test.describe('SSO do Portal MSE', () => {
  test('entra direto, sem tela de login', async ({ page }) => {
    await abrirViaPortal(page);
    await page.waitForSelector('.tabs-scroll', { timeout: 45_000 });
    expect(await page.evaluate(() => !!MSEAuth.sessao())).toBe(true);
    expect(await page.evaluate(() => MSEAuth.usuario().email)).toBe('portal.user@mse.com.br');
    await expect(page.locator('body')).not.toContainText('Entrar com Google');
  });

  test('a URL fica limpa depois de trocar o token', async ({ page }) => {
    // O token é de uso único (nonce) — não pode sobreviver a um F5.
    await abrirViaPortal(page);
    await page.waitForSelector('.tabs-scroll', { timeout: 45_000 });
    const url = new URL(page.url());
    expect(url.searchParams.has('sso')).toBe(false);
  });

  test('a sessão do portal é uma sessão REAL do Supabase', async ({ page }) => {
    await abrirViaPortal(page);
    await page.waitForSelector('.tabs-scroll', { timeout: 45_000 });
    // O ponto inteiro do desenho: o header de leitura carrega o token do
    // usuário, NÃO a anon key. É isso que faz o RLS enxergar a pessoa.
    const auth = await page.evaluate(() => MSEAuth.headers().Authorization);
    expect(auth).toBe('Bearer ' + SESSAO_OK.access_token);
  });

  test('Edge Function recusa o token NAO entra — cai no login com motivo', async ({ page }) => {
    // Fail-closed. Entrar sem identidade seria ler como `anon`, que é isento
    // das policies do financeiro — o oposto do que o SSO deveria garantir.
    await abrirViaPortal(page, { edgeFunctionOk: false });
    await page.waitForTimeout(3000);
    expect(await page.evaluate(() => !!MSEAuth.sessao())).toBe(false);
    await expect(page.locator('body')).toContainText('Portal');
    expect(await page.evaluate(() => MSEAuth.erroPortal())).toContain('não validado');
  });

  test('sessao recusada pelo Supabase NAO entra — cai no login com motivo', async ({ page }) => {
    await abrirViaPortal(page, { setSessionOk: false });
    await page.waitForTimeout(3000);
    expect(await page.evaluate(() => !!MSEAuth.sessao())).toBe(false);
    await expect(page.locator('body')).toContainText('Portal');
    expect(await page.evaluate(() => MSEAuth.erroPortal())).toContain('não foi aceita');
  });

  test('falha dentro do portal NAO oferece Google — oferece voltar ao Portal', async ({ page }) => {
    // O painel roda em IFRAME do portal. `signInWithOAuth` redireciona a janela,
    // e `accounts.google.com` recusa ser enquadrado — o botao levaria a uma tela
    // em branco. Botao que nao funciona e pior que botao nenhum.
    await abrirViaPortal(page, { setSessionOk: false });
    await page.waitForTimeout(3000);
    await expect(page.locator('body')).toContainText('Voltar ao Portal MSE');
    await expect(page.locator('body')).not.toContainText('Continuar com Google');
    await expect(page.locator('body')).toContainText('Seu acesso vem do Portal MSE');
  });

  test('FORA do portal a tela de login segue oferecendo Google', async ({ page }) => {
    // Regressao: o caminho normal (Firebase/localhost, sem `?sso=`) nao pode
    // ter perdido o login.
    await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
    await page.goto('/#/obra/106/curva-s', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await expect(page.locator('body')).toContainText('Continuar com Google');
    await expect(page.locator('body')).not.toContainText('Voltar ao Portal MSE');
  });

  test('sem `?sso=` na URL, nada muda no fluxo normal', async ({ page }) => {
    // Regressão: o caminho fora do portal (Firebase, localhost) não pode ter
    // sido afetado.
    await page.goto('/#/obra/106/curva-s', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => MSEAuth.viaPortal())).toBe(false);
    expect(await page.evaluate(() => MSEAuth.erroPortal())).toBe(null);
  });
});
