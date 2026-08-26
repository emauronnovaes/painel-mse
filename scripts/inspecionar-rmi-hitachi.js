// Inspeção pontual da estrutura RMI da Hitachi (id_obra=110) antes de
// habilitar o setor Suprimentos pra essa obra — mesmo objetivo do
// comentário em index.html linha ~5055 ("checar RMI por RMI, uma de cada
// vez" antes de expandir a régua validada no CP029 pra outra obra).
const fs = require('fs');
const path = require('path');

const rows = JSON.parse(fs.readFileSync(path.join(process.env.TEMP, 'hitachi_rmi.json'), 'utf8'));
console.log('total linhas:', rows.length);

const porNivel = {};
rows.forEach(r => { const n = r.raw.nivel; porNivel[n] = (porNivel[n] || 0) + 1; });
console.log('linhas por nivel:', porNivel);

const idsRmi = new Set(rows.map(r => r.raw.id_rmi));
console.log('quantos RMIs distintos:', idsRmi.size, [...idsRmi]);

function codigoPaiRmi(codigoSeq){
  if (!codigoSeq) return null;
  const partes = String(codigoSeq).split('.');
  if (partes.length < 2) return null;
  return partes.slice(0, -1).join('.');
}
const normalizar = (s) => (s || '').toString().trim().toUpperCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '');

const nivel0 = rows.filter(r => r.raw.nivel === 0);
const nivel1 = rows.filter(r => r.raw.nivel === 1);
console.log('\n--- nivel 0 (raiz de cada RMI) ---');
nivel0.forEach(r => console.log(`  [${r.raw.id_rmi}] ${r.raw.codigo_seq} "${r.raw.descricao}" subtotal=${r.raw.subtotal_custo_meta_orcamento}`));

console.log('\n--- nivel 1 (filhos da raiz) — amostra de 40 ---');
nivel1.slice(0, 40).forEach(r => console.log(`  [${r.raw.id_rmi}] ${r.raw.codigo_seq} "${r.raw.descricao}" subtotal=${r.raw.subtotal_custo_meta_orcamento} unidade=${r.raw.unidade}`));

// EH_BALDE_ADMINISTRATIVO_RMI / AREA_HERDADA_MATERIAIS_RMI do index.html
const EH_BALDE = /^(MATERIAIS\s*-|CHANGE ORDER\b|OC\s*-|CO\s+\d)/;
console.log('\n--- nivel 0 que bateria como "balde administrativo" ---');
nivel0.forEach(r => { if (EH_BALDE.test(normalizar(r.raw.descricao))) console.log(`  BALDE: "${r.raw.descricao}"`); });

// distribuição de unidade em nivel >=1 (pra ver se ehMaterialRmi (unidade
// vazia/SERV/VB/VERBA) faz sentido aqui)
const porUnidade = {};
rows.forEach(r => { const u = (r.raw.unidade || '(vazio)').toString().trim().toUpperCase(); porUnidade[u] = (porUnidade[u] || 0) + 1; });
console.log('\n--- distribuição de `unidade` (todas as linhas) ---');
console.log(porUnidade);

// quantas linhas por nivel >=2 têm valor > 0 (candidatos a material)
for (let n = 2; n <= 6; n++) {
  const doNivel = rows.filter(r => r.raw.nivel === n);
  const comValor = doNivel.filter(r => (Number(r.raw.subtotal_custo_meta_orcamento) || 0) > 0);
  if (doNivel.length) console.log(`nivel ${n}: ${doNivel.length} linhas, ${comValor.length} com valor>0`);
}

// checa campos usados pela tela que podem faltar nesta obra
const camposEsperados = ['data_necessidade_compra', 'prazo_entrega', 'total_consumido', 'finalizado', 'saldo_orcamentario', 'desvio_saldo_orcamentario'];
console.log('\n--- preenchimento dos campos usados pela tela (linhas com valor>0) ---');
const comValorGeral = rows.filter(r => (Number(r.raw.subtotal_custo_meta_orcamento) || 0) > 0);
camposEsperados.forEach(c => {
  const preenchidos = comValorGeral.filter(r => r.raw[c] != null && r.raw[c] !== '').length;
  console.log(`  ${c}: ${preenchidos}/${comValorGeral.length} preenchidos`);
});
