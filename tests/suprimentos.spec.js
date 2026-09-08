// Setor Suprimentos — obra 106 (CNPEM - Faseado).
//
// REESCRITO em 08/09/2026. A versão anterior tinha 11 testes verdes que não
// afirmavam nada:
//   * 6 deles eram `if (await table.isVisible()) { ...asserções... }`, e esta
//     tela NÃO TEM <table> — é uma árvore Área/Disciplina/Material. A condição
//     era sempre falsa, o corpo nunca rodava, e o teste passava vazio.
//   * `expect(count).toBeGreaterThanOrEqual(0)` e `expect(true).toBe(true)`
//     passam por construção.
//   * `expect(searchInput).toBeDefined()` — um locator está sempre definido,
//     mesmo apontando pra nada.
//   * procurava o texto "Nenhum suprimento", que não existe no app (a mensagem
//     real é "Nenhum material com valor lançado para esta obra"), e usava
//     `text=A|B`, que o Playwright trata como literal, não como alternativa.
// Suíte verde que não pode falhar é pior que suíte vermelha: dá permissão pra
// mergear sem informação.
//
// Os estados terminais reais estão em index.html:6898-6901.
//
// ARMADILHA, custou 3 falhas: os títulos aparecem em CAIXA ALTA na tela, mas o
// maiúsculo vem de `text-transform` no CSS. `toContainText` compara com
// `textContent` (DOM cru), onde o texto é "Área / Disciplina / Material". Ou
// seja: asserção escrita a partir do que se VÊ na tela falha. Daí os regex
// insensíveis a caixa abaixo, que sobrevivem tanto ao CSS quanto à grafia.
const { test, expect } = require('@playwright/test');
const { abrirPainel } = require('./helpers');

const BUSCA = 'input[placeholder*="Buscar"]';

/** A tela leva ~6,5s pra paginar `itens_rmi`. O teste antigo esperava 2s fixos e
 *  falhava por isso. Aqui se espera o FIM do carregamento, não um relógio. */
async function esperarCarregar(page) {
  await page.waitForFunction(
    () => !/Carregando itens de RMI/i.test(document.body.innerText),
    null, { timeout: 60_000 },
  );
}

test.describe('Setor Suprimentos', () => {
  test.beforeEach(async ({ page }) => {
    await abrirPainel(page, '/#/obra/106/suprimentos-criticos');
  });

  test('sai do carregamento e chega num estado terminal conhecido', async ({ page }) => {
    await esperarCarregar(page);
    const texto = await page.locator('body').innerText();
    const arvore = /área \/ disciplina \/ material/i.test(texto);
    const terminais = [
      'Em desenvolvimento',                              // obra não validada
      'Erro ao carregar itens_rmi',                       // erro de dado
      'Nenhum material com valor lançado para esta obra', // vazio legítimo
    ].filter(t => texto.includes(t));
    expect(arvore || terminais.length > 0,
      `nem árvore nem estado terminal. Texto: ${texto.slice(0, 300)}`).toBe(true);
  });

  test('a obra 106 renderiza a árvore com dado, não um estado vazio', async ({ page }) => {
    await esperarCarregar(page);
    // Esta obra é validada e tem material lançado: qualquer estado vazio ou de
    // erro aqui é regressão, não "sem dado".
    await expect(page.locator('body')).not.toContainText('Erro ao carregar itens_rmi');
    await expect(page.locator('body')).not.toContainText('Nenhum material com valor lançado');
    await expect(page.locator('body')).toContainText(/área \/ disciplina \/ material/i);
  });

  test('os três botões de nível existem e respondem', async ({ page }) => {
    await esperarCarregar(page);
    const niveis = page.locator('.btn-nivel');
    await expect(niveis).toHaveCount(3);
    // Nível 1 fecha tudo, 3 abre tudo — o texto visível tem que mudar entre os
    // dois, senão o botão não está agindo sobre a árvore.
    await niveis.nth(0).click();
    const nivel1 = await page.locator('body').innerText();
    await niveis.nth(2).click();
    const nivel3 = await page.locator('body').innerText();
    expect(nivel3.length, 'abrir até o nível 3 deve revelar mais linhas que o nível 1')
      .toBeGreaterThan(nivel1.length);
  });

  test('a busca filtra a árvore', async ({ page }) => {
    await esperarCarregar(page);
    const busca = page.locator(BUSCA);
    await expect(busca).toBeVisible();
    const antes = (await page.locator('body').innerText()).length;
    await busca.fill('zzzzzznaoexiste');
    await page.waitForFunction(
      n => document.body.innerText.length < n,
      antes, { timeout: 10_000 },
    );
    const depois = (await page.locator('body').innerText()).length;
    expect(depois, 'busca sem resultado deve encolher a árvore').toBeLessThan(antes);
  });

  test('o painel de status agregado aparece', async ({ page }) => {
    await esperarCarregar(page);
    await expect(page.locator('body')).toContainText(/status dos materiais/i);
    await expect(page.locator('body')).toContainText(/total geral/i);
  });

  test('a exportação em PDF está oferecida', async ({ page }) => {
    await esperarCarregar(page);
    await expect(page.locator('body')).toContainText(/pdf completo/i);
  });

  test('o status manual pode ser atribuído item por item', async ({ page }) => {
    await esperarCarregar(page);
    // O `<select>` de status é da linha de MATERIAL, e a árvore inicia recolhida
    // (só o nível Área). Sem abrir até o nível 3 não existe select nenhum na
    // página — foi o que me fez achar, num primeiro teste, que a feature estava
    // quebrada quando era só a árvore fechada.
    await page.locator('.btn-nivel').nth(2).click();
    const selects = page.locator('select').filter({ has: page.locator('option', { hasText: 'Em cotação' }) });
    await expect(selects.first()).toBeVisible();
    await expect(selects.first()).toBeEnabled();
    // As 5 opções manuais mais a primeira, que é o status automático e serve de
    // "voltar ao automático" (grava value="" e o app faz DELETE do override).
    const opcoes = await selects.first().locator('option').allTextContents();
    for (const o of ['Em cotação', 'Comprado Parcial', 'Comprado', 'Entregue Parcial', 'Entregue']) {
      expect(opcoes, `falta a opção "${o}"`).toContain(o);
    }
    expect(opcoes.length, 'deve haver a opção de voltar ao automático além das 5 manuais')
      .toBeGreaterThan(5);
  });

  test('sobrevive a viewport mobile', async ({ page }) => {
    await esperarCarregar(page);
    await page.setViewportSize({ width: 375, height: 667 });
    // A barra de setores tem que continuar presente: se sumir, o layout quebrou
    // de um jeito que deixa a tela inalcançável no celular.
    await expect(page.locator('.tabs-scroll')).toBeVisible();
    await expect(page.locator('body')).toContainText(/área \/ disciplina \/ material/i);
  });
});
