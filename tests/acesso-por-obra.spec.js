// Financeiro por obra — terceiro nível de acesso (ver docs/15, seção 1c).
//
// `mse_obras_financeiro()` devolve as obras em que o e-mail da sessão vê
// Medições e OC/CO. O SELETOR DE OBRAS NÃO É RECORTADO: todo mundo continua
// vendo as 7 obras (decisão de 09/09/2026, "não vai restringir o acesso geral
// das obras") — o teste `o seletor continua com as 7 obras` é o que trava isso.
//
// COMO ESTE TESTE RODA SEM A MIGRAÇÃO APLICADA: intercepta o RPC com
// `page.route` e devolve resposta canônica. Isso é melhor que depender do banco
// — testa a LÓGICA de recorte com cenários que nem existem na base real (uma
// pessoa com financeiro em 1 obra só), e não fica vermelho por oscilação de
// rede.
//
// A sessão é forjada do mesmo jeito de `acesso-restrito.spec.js`: JWT de forma
// válida e assinatura falsa, o suficiente pro MSEAuth reconhecer sessão.
const { test, expect } = require('@playwright/test');

const REF = 'gebjlhkywtnpfqjrakok';
const TODAS_AS_OBRAS = [106, 110, 94, 107, 108, 91, 114];
const SETORES_COM_FINANCEIRO = 9;
const SETORES_SEM_FINANCEIRO = 7;

function sessaoFalsa() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = [
    b64({ alg: 'ES256', typ: 'JWT' }),
    b64({
      sub: '00000000-0000-0000-0000-000000000002',
      email: 'financeiro.por.obra@mse.com.br',
      role: 'authenticated',
      exp,
    }),
    'assinatura-falsa',
  ].join('.');
  return {
    access_token: token, refresh_token: 'x', expires_at: exp, expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: '00000000-0000-0000-0000-000000000002',
      email: 'financeiro.por.obra@mse.com.br',
      user_metadata: {}, app_metadata: {},
    },
  };
}

// `respostas` = { mse_obras_financeiro: [...], mse_acesso_total: bool }.
// Valor `null` faz o RPC FALHAR (500), que é como se testa o caminho de erro.
async function abrir(page, respostas, rota = '/#/obra/106/curva-s') {
  await page.addInitScript(([k, v]) => {
    try { localStorage.setItem(k, v); } catch (e) { /* storage bloqueado */ }
  }, [`sb-${REF}-auth-token`, JSON.stringify(sessaoFalsa())]);

  for (const nome of Object.keys(respostas)) {
    const valor = respostas[nome];
    await page.route(`**/rest/v1/rpc/${nome}`, (rota_) => {
      if (valor === null) return rota_.fulfill({ status: 500, body: 'erro simulado' });
      return rota_.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(valor),
      });
    });
  }

  await page.goto(rota, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tabs-scroll', { timeout: 45_000 });
  await page.waitForFunction(() => MSEAuth.acessoTotal() !== null, null, { timeout: 30_000 });
}

// Financeiro só no CNPEM (106).
const RECORTE = {
  mse_acesso_total: false,
  mse_obras_financeiro: [106],
};

test.describe('Financeiro por obra', () => {
  test('o seletor continua com as 7 obras', async ({ page }) => {
    // O recorte é SÓ do financeiro. Se algum dia alguém filtrar o seletor por
    // acesso, este teste é que vai apontar.
    await abrir(page, RECORTE);
    await page.locator('.obra-btn').click();
    expect(await page.locator('.obra-item').count()).toBe(TODAS_AS_OBRAS.length);
  });

  test('aparece no CNPEM e some no Porto', async ({ page }) => {
    await abrir(page, RECORTE);
    // Obra 106 está no recorte -> 9 abas.
    expect(await page.locator('.tab-btn').count()).toBe(SETORES_COM_FINANCEIRO);
    await expect(page.locator('.tabs-scroll')).toContainText('Medições');

    // Troca pro Porto (94), que a pessoa VÊ mas sem financeiro. É o ponto
    // inteiro do terceiro nível.
    await page.locator('.obra-btn').click();
    await page.locator('.obra-item', { hasText: 'Porto' }).click();
    await expect(page.locator('.tab-btn')).toHaveCount(SETORES_SEM_FINANCEIRO);
    await expect(page.locator('.tabs-scroll')).not.toContainText('Medições');
    await expect(page.locator('.tabs-scroll')).not.toContainText('OC / CO');
  });

  test('a numeração acompanha a obra, sem buracos', async ({ page }) => {
    await abrir(page, RECORTE);
    await page.locator('.obra-btn').click();
    await page.locator('.obra-item', { hasText: 'Porto' }).click();
    await expect(page.locator('.tab-btn')).toHaveCount(SETORES_SEM_FINANCEIRO);
    const nums = (await page.locator('.tab-btn').allInnerTexts())
      .map(t => parseInt(t.trim().split(/\s/)[0], 10));
    expect(nums).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test('URL direta a Medições numa obra sem financeiro explica a permissão', async ({ page }) => {
    // Medições vazia se leria como "não houve faturamento" (ADR-005). Tem que
    // dizer que é permissão, e dizer em QUAL obra.
    await abrir(page, RECORTE, '/#/obra/94/medicoes');
    await expect(page.locator('body')).toContainText('é restrito');
    await expect(page.locator('body')).toContainText('Porto');
  });

  test('a mesma URL na obra com financeiro abre normal', async ({ page }) => {
    await abrir(page, RECORTE, '/#/obra/106/medicoes');
    await expect(page.locator('body')).not.toContainText('é restrito');
  });

  test('RPC fora do ar fecha o financeiro, não abre', async ({ page }) => {
    // Mesma regra do acesso total: mostrar Medições por falha de rede é o erro
    // caro, a aba a menos é o barato.
    await abrir(page, { mse_acesso_total: false, mse_obras_financeiro: null });
    expect(await page.evaluate(() => MSEAuth.restringirFinanceiroObra(106))).toBe(true);
    await expect(page.locator('.tabs-scroll')).not.toContainText('Medições');
    // E o seletor NÃO pode encolher por causa disso.
    await page.locator('.obra-btn').click();
    expect(await page.locator('.obra-item').count()).toBe(TODAS_AS_OBRAS.length);
  });

  test('sem cadastro nenhum: 7 obras, nenhuma com financeiro', async ({ page }) => {
    // O caso mais comum, e o que a migração precisa preservar: quem não tem
    // linha em `acesso_total`. Vê tudo MENOS Medições e OC/CO (confirmado pelo
    // usuário em 09/09/2026).
    await abrir(page, { mse_acesso_total: false, mse_obras_financeiro: [] });
    await page.locator('.obra-btn').click();
    expect(await page.locator('.obra-item').count()).toBe(TODAS_AS_OBRAS.length);
    await page.keyboard.press('Escape');

    await expect(page.locator('.tab-btn')).toHaveCount(SETORES_SEM_FINANCEIRO);
    for (const id of TODAS_AS_OBRAS) {
      expect(await page.evaluate((o) => MSEAuth.restringirFinanceiroObra(o), id)).toBe(true);
    }
  });

  test('acesso total global continua valendo em todas as obras', async ({ page }) => {
    // Quem tinha acesso total antes desta mudança (linha com obra_id NULL) não
    // pode perder nada: `acessoTotal() === true` curto-circuita o recorte.
    await abrir(page, { mse_acesso_total: true, mse_obras_financeiro: TODAS_AS_OBRAS });
    await expect(page.locator('.tab-btn')).toHaveCount(SETORES_COM_FINANCEIRO);
    for (const id of TODAS_AS_OBRAS) {
      expect(await page.evaluate((o) => MSEAuth.restringirFinanceiroObra(o), id)).toBe(false);
    }
  });
});
