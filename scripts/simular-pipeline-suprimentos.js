// Roda a MESMA lógica de ModuloSuprimentos (index.html) contra um dump
// local de itens_rmi, pra medir o efeito de cada filtro sem precisar
// abrir o navegador — funções copiadas verbatim (não reimplementadas).
const fs = require('fs');
const path = require('path');

const arquivo = process.argv[2];
const rows = JSON.parse(fs.readFileSync(arquivo, 'utf8'));

function normalizarNomeParaMatch(s){
  return String(s || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function soma(lista, campo){
  const vals = lista.map(t => t[campo]).filter(v => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
}
const PALAVRAS_CANTEIRO_RMI = [
  'CANTEIRO DE OBRAS', 'ALOJAMENTO', 'FILIAL', 'CONSUMI', 'UNIFORME',
  'FRETE', 'COMBUSTIVEL', 'DIESEL', 'MOBILIZA', 'FERRAMENTA', 'SEGURO',
  'ONIBUS', 'ESCAVADEIRA', 'MOTONIVELADORA', 'ROLO COMPACTADOR',
  'CAMINHAO BASCULANTE', 'PLATAFORMA DE LANCA ARTICULADA',
  'RETROESCAVADEIRA', 'GUINDASTE', 'MUNCK',
];
const REGEX_CANTEIRO_RMI = /\b(ASO|EPIS?|QUALIFICACAO DE SOLDADORES|TREINAMENTO)\b/;
function ehItemCanteiroRmi(descricao){
  const d = normalizarNomeParaMatch(descricao);
  if (!d) return false;
  if (PALAVRAS_CANTEIRO_RMI.some(p => d.includes(p))) return true;
  return REGEX_CANTEIRO_RMI.test(d);
}
const EH_BALDE_ADMINISTRATIVO_RMI = /^(MATERIAIS\s*-|CHANGE ORDER\b|OC\s*-|CO\s+\d)/;
const AREA_HERDADA_MATERIAIS_RMI = /^MATERIAIS\s*-\s*(.+)$/;
const PALAVRAS_NAO_MATERIAL_RMI = [
  'TESTES', 'COMISSIONAMENTO', 'OMISSOS', 'ENSAIO', 'GERENCIAMENTO',
  'SUPERVISAO', 'ADMINISTRACAO', 'TREINAMENTO',
];
function codigoPaiRmi(codigoSeq){
  if (!codigoSeq) return null;
  const partes = String(codigoSeq).split('.');
  if (partes.length < 2) return null;
  return partes.slice(0, -1).join('.');
}
function resolverDisciplinasRmi(itensNivel0, itensNivel1){
  const porChaveNivel0 = new Map();
  itensNivel0.forEach(r => porChaveNivel0.set(`${r.raw.id_rmi}::${r.raw.codigo_seq}`, r));
  const filhosPorPai = new Map();
  itensNivel1.forEach(r => {
    const pai = codigoPaiRmi(r.raw.codigo_seq);
    if (pai == null) return;
    const chave = `${r.raw.id_rmi}::${pai}`;
    if (!filhosPorPai.has(chave)) filhosPorPai.set(chave, []);
    filhosPorPai.get(chave).push(r);
  });
  const disciplinas = [];
  const nivel0Resolvidos = new Set();
  filhosPorPai.forEach((filhos, chave) => {
    const pai = porChaveNivel0.get(chave);
    const somaFilhos = filhos.reduce((s, f) => s + (Number(f.raw.subtotal_custo_meta_orcamento) || 0), 0);
    if (!pai) { filhos.forEach(f => disciplinas.push({ item: f, nome: f.raw.descricao, areaHerdada: null })); return; }
    nivel0Resolvidos.add(chave);
    const subtotalProprio = Number(pai.raw.subtotal_custo_meta_orcamento) || 0;
    const ehBalde = EH_BALDE_ADMINISTRATIVO_RMI.test(normalizarNomeParaMatch(pai.raw.descricao) || '');
    const desce = ehBalde || (subtotalProprio === 0 && somaFilhos > 0);
    const bateArea = ehBalde ? AREA_HERDADA_MATERIAIS_RMI.exec(normalizarNomeParaMatch(pai.raw.descricao) || '') : null;
    const areaHerdada = bateArea ? bateArea[1].trim() : null;
    if (desce) filhos.forEach(f => disciplinas.push({ item: f, nome: f.raw.descricao, areaHerdada }));
    else disciplinas.push({ item: pai, nome: pai.raw.descricao, areaHerdada: null });
  });
  itensNivel0.forEach(r => {
    const chave = `${r.raw.id_rmi}::${r.raw.codigo_seq}`;
    if (!nivel0Resolvidos.has(chave)) disciplinas.push({ item: r, nome: r.raw.descricao, areaHerdada: null });
  });
  return disciplinas;
}
function ehMaterialRmi(item, filhosPorPaiGeral){
  const un = String(item.raw.unidade || '').trim().toUpperCase();
  if (!un || un === 'SERV' || un === 'VB' || un === 'VERBA') return false;
  const d = normalizarNomeParaMatch(item.raw.descricao) || '';
  if (PALAVRAS_NAO_MATERIAL_RMI.some(p => d.includes(p))) return false;
  const filhos = filhosPorPaiGeral.get(`${item.raw.id_rmi}::${item.raw.codigo_seq}`) || [];
  const filhoComValorReal = filhos.some(f => ehMaterialRmi(f, filhosPorPaiGeral) && (Number(f.raw.subtotal_custo_meta_orcamento) || 0) > 0);
  return !filhoComValorReal;
}
function coletarMateriaisDaDisciplina(disciplinaItem, areaHerdada, filhosPorPaiGeral){
  const materiais = [];
  function caminhar(item, area, profundidade){
    if (ehMaterialRmi(item, filhosPorPaiGeral)) { materiais.push({ item, area }); return; }
    const filhos = filhosPorPaiGeral.get(`${item.raw.id_rmi}::${item.raw.codigo_seq}`) || [];
    filhos.forEach(f => {
      const areaParaFilho = (profundidade === 0 && area == null && !ehMaterialRmi(f, filhosPorPaiGeral)) ? f.raw.descricao : area;
      caminhar(f, areaParaFilho, profundidade + 1);
    });
  }
  caminhar(disciplinaItem, areaHerdada, 0);
  return materiais;
}

const itensNivel0 = rows.filter(r => r.raw.nivel === 0);
const itensNivel1 = rows.filter(r => r.raw.nivel === 1);
const disciplinas = resolverDisciplinasRmi(itensNivel0, itensNivel1);
console.log('disciplinas resolvidas:', disciplinas.length);

const filhosPorPaiGeral = new Map();
rows.forEach(r => {
  const pai = codigoPaiRmi(r.raw.codigo_seq);
  if (pai == null) return;
  const chave = `${r.raw.id_rmi}::${pai}`;
  if (!filhosPorPaiGeral.has(chave)) filhosPorPaiGeral.set(chave, []);
  filhosPorPaiGeral.get(chave).push(r);
});

let brutos = [];
let qtdCanteiro = 0, valorCanteiro = 0;
let qtdSemArea = 0, valorSemArea = 0;
let brutosComArea = [];
disciplinas.forEach(({ item, nome, areaHerdada }) => {
  if (ehItemCanteiroRmi(item.raw.descricao)) { qtdCanteiro++; valorCanteiro += Number(item.raw.subtotal_custo_meta_orcamento) || 0; return; }
  coletarMateriaisDaDisciplina(item, areaHerdada, filhosPorPaiGeral).forEach(({ item: m, area }) => {
    const valor = Number(m.raw.subtotal_custo_meta_orcamento) || 0;
    if (valor <= 0) return;
    const linha = { disciplina: nome, area, descricao: m.raw.descricao, valor, unidade: m.raw.unidade };
    if (!area) { qtdSemArea++; valorSemArea += valor; brutos.push(linha); return; }
    brutosComArea.push(linha);
    brutos.push(linha);
  });
});

console.log('canteiro excluido:', qtdCanteiro, 'itens, valor', valorCanteiro.toFixed(2));
console.log('SEM AREA (excluido pela regra atual):', qtdSemArea, 'itens, valor', valorSemArea.toFixed(2));
console.log('COM AREA (sobreviveria hoje):', brutosComArea.length, 'itens, valor', soma(brutosComArea, 'valor')?.toFixed(2));
console.log('TOTAL (canteiro+valor>0, antes do filtro de area):', brutos.length, 'itens, valor', soma(brutos, 'valor')?.toFixed(2));

console.log('\n--- amostra de disciplinas encontradas (nome, quantos materiais, valor total) ---');
const porDisciplina = new Map();
brutos.forEach(b => {
  const g = porDisciplina.get(b.disciplina) || { qtd: 0, valor: 0, comArea: 0 };
  g.qtd++; g.valor += b.valor; if (b.area) g.comArea++;
  porDisciplina.set(b.disciplina, g);
});
[...porDisciplina.entries()].sort((a, b) => b[1].valor - a[1].valor).forEach(([nome, g]) => {
  console.log(`  "${nome}": ${g.qtd} materiais (${g.comArea} com área), valor total R$ ${g.valor.toFixed(2)}`);
});

console.log('\n--- amostra de 15 materiais SEM área (os que a regra atual descarta) ---');
brutos.filter(b => !b.area).slice(0, 15).forEach(b => console.log(`  [${b.disciplina}] "${b.descricao}" (${b.unidade}) = R$ ${b.valor.toFixed(2)}`));

console.log('\n--- amostra de 15 materiais COM área (se algum sobrou) ---');
brutosComArea.slice(0, 15).forEach(b => console.log(`  [${b.disciplina} / área="${b.area}"] "${b.descricao}" = R$ ${b.valor.toFixed(2)}`));
