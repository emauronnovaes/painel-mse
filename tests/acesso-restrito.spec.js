// Acesso restrito — setores financeiros escondidos (ver docs/15).
//
// COMO ESTE TESTE CONSEGUE UMA SESSÃO: injeta no `localStorage` a chave que o
// supabase-js usa (`sb-<ref>-auth-token`) com um JWT de FORMA válida e
// ASSINATURA falsa. O `MSEAuth` reconhece a sessão, chama o RPC
// `mse_acesso_total()`, e o Supabase recusa o token — o que faz o código cair no
// caminho "na dúvida, restringe".
//
// Isso testa três coisas de uma vez, sem precisar de OAuth real:
//   1. a UI no estado restrito (o que só se via logando à mão);
//   2. o fail-closed: falha de rede/token NÃO pode liberar o financeiro;
//   3. a renumeração e a navegação, que quebraram na primeira versão.
const { test, expect } = require('@playwright/test');

const REF = 'gebjlhkywtnpfqjrakok';
const SETORES_VISIVEIS_RESTRITO = [
  'Curva S', 'Encarregados', 'Desvios', 'Restrições', 'Histograma',
  'Suprimentos', 'Tour 360°',
];

function sessaoFalsa() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = [
    b64({ alg: 'ES256', typ: 'JWT' }),
    b64({
      sub: '00000000-0000-0000-0000-000000000001',
      email: 'nao.esta.na.lista@mse.com.br',
      role: 'authenticated',
      exp,
    }),
    'assinatura-falsa',
  ].join('.');
  return {
    access_token: token, refresh_token: 'x', expires_at: exp, expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'nao.esta.na.lista@mse.com.br',
      user_metadata: {}, app_metadata: {},
    },
  };
}

async function abrirRestrito(page, rota = '/#/obra/106/curva-s') {
  await page.addInitScript(([k, v]) => {
    try { localStorage.setItem(k, v); } catch (e) { /* storage bloqueado */ }
  }, [`sb-${REF}-auth-token`, JSON.stringify(sessaoFalsa())]);
  await page.goto(rota, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tabs-scroll', { timeout: 45_000 });
  await page.waitForFunction(() => MSEAuth.acessoTotal() !== null, null, { timeout: 30_000 });
}

test.describe('Acesso restrito ao financeiro', () => {
  test('sessão fora da lista é tratada como restrita', async ({ page }) => {
    await abrirRestrito(page);
    expect(await page.evaluate(() => !!MSEAuth.sessao())).toBe(true);
    // O ponto do fail-closed: token recusado tem que virar RESTRITO, nunca
    // liberado. Se isto inverter, o financeiro vaza por falha de rede.
    expect(await page.evaluate(() => MSEAuth.acessoTotal())).toBe(false);
    expect(await page.evaluate(() => MSEAuth.restringirFinanceiro())).toBe(true);
  });

  test('Medições e OC/CO não aparecem na barra', async ({ page }) => {
    await abrirRestrito(page);
    const abas = await page.locator('.tab-btn').allInnerTexts();
    const texto = abas.join(' | ');
    expect(texto).not.toMatch(/Medi[çc][õo]es/i);
    expect(texto).not.toMatch(/OC\s*\/\s*CO/i);
    expect(abas).toHaveLength(SETORES_VISIVEIS_RESTRITO.length);
  });

  test('a numeração das abas é sequencial, sem buracos', async ({ page }) => {
    await abrirRestrito(page);
    const nums = (await page.locator('.tab-btn').allInnerTexts())
      .map(t => parseInt(t.trim().split(/\s/)[0], 10));
    // Regressão real: o `num` vem fixo de SETORES, então esconder o 7 e o 8
    // deixava 1,2,3,4,5,6,9 na tela.
    expect(nums).toEqual(SETORES_VISIVEIS_RESTRITO.map((_, i) => i + 1));
  });

  test('as setas de navegação não pousam em setor escondido', async ({ page }) => {
    await abrirRestrito(page);
    // Da PRIMEIRA aba, "anterior" tem que dar a volta no último VISÍVEL. Antes
    // ciclava por SETORES inteiro e caía em Medições/OC-CO.
    await page.locator('.nav-arrow').first().click();
    await expect(page.locator('.tab-btn.ativo')).toContainText('Tour 360');
    await expect(page.locator('body')).not.toContainText('é restrito');

    // E percorrer a barra toda pra frente nunca deve exibir o cartão de permissão.
    for (let i = 0; i < SETORES_VISIVEIS_RESTRITO.length; i++) {
      await page.locator('.nav-arrow').last().click();
      await page.waitForTimeout(150);
      await expect(page.locator('body')).not.toContainText('é restrito');
    }
  });

  test('URL direta a um setor escondido explica a permissão, não finge vazio', async ({ page }) => {
    await abrirRestrito(page, '/#/obra/106/medicoes');
    // ADR-005: ausência nunca deve parecer dado. Medições sem linhas se leria
    // como "não houve faturamento".
    await expect(page.locator('body')).toContainText('é restrito');
    await expect(page.locator('body')).toContainText(/financeira/i);
  });
});
