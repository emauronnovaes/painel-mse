// Helpers compartilhados pelos specs de navegador.
//
// Dois problemas que os specs tinham e que estes helpers resolvem:
//
// 1. Passavam na tela de login. As asserções eram "#root visível" e "body contém
//    MSE" — a tela de login satisfaz as duas. Um teste que fica verde na tela
//    errada é pior que um vermelho, porque dá permissão pra mergear.
// 2. Cada spec repetia a URL de produção à mão, então mudar o alvo da suíte
//    exigia editar cada arquivo.

/** Neutraliza o portão de login antes de a página carregar. Precisa rodar em
 *  `addInitScript` (não em `evaluate`) porque o `MSEAuth.iniciar()` decide o que
 *  renderizar no primeiro paint. */
async function semLogin(page) {
  await page.addInitScript(() => { window.__MSE_TESTE_SEM_LOGIN = true; });
}

/** Abre uma rota do painel e espera o APP, não a tela de login.
 *  `.tabs-scroll` é a barra de setores: existe no app e não existe no login,
 *  então serve de prova de que a aplicação renderizou de verdade. */
async function abrirPainel(page, rota) {
  await semLogin(page);
  await page.goto(rota, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tabs-scroll', { timeout: 45_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
}

/** Falha se a tela de login apareceu — rede de segurança pra costura de teste
 *  quebrar de forma visível em vez de silenciosa. */
async function garantirQueNaoEhLogin(page, expect) {
  await expect(page.locator('.login-card')).toHaveCount(0);
}

module.exports = { semLogin, abrirPainel, garantirQueNaoEhLogin };
