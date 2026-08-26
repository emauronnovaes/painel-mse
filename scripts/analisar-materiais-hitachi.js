// Roda o pipeline completo (escopo permitido -> materiais -> família)
// pros 4 escopos validados da Hitachi (cp281/cp001/cp006), pra medir
// quanto do catálogo padrão (copiado verbatim de index.html) já cobre e
// listar o que cai no fallback (sem categoria), maior valor primeiro —
// insumo pra desenhar os grupos de materiais padrão, mesmo espírito do
// catálogo já validado pro CP029.
const fs = require('fs');
const path = require('path');
const rows = JSON.parse(fs.readFileSync(path.join(process.env.TEMP, 'hitachi_rmi.json'), 'utf8'));

function normalizarNomeParaMatch(s){ return String(s || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
function codigoPaiRmi(c){ if(!c) return null; const p=String(c).split('.'); return p.length<2?null:p.slice(0,-1).join('.'); }
const PALAVRAS_CANTEIRO_RMI = ['CANTEIRO DE OBRAS','ALOJAMENTO','FILIAL','CONSUMI','UNIFORME','FRETE','COMBUSTIVEL','DIESEL','MOBILIZA','FERRAMENTA','SEGURO','ONIBUS','ESCAVADEIRA','MOTONIVELADORA','ROLO COMPACTADOR','CAMINHAO BASCULANTE','PLATAFORMA DE LANCA ARTICULADA','RETROESCAVADEIRA','GUINDASTE','MUNCK'];
const REGEX_CANTEIRO_RMI = /\b(ASO|EPIS?|QUALIFICACAO DE SOLDADORES|TREINAMENTO)\b/;
function ehItemCanteiroRmi(d){ const n=normalizarNomeParaMatch(d); if(!n) return false; if(PALAVRAS_CANTEIRO_RMI.some(p=>n.includes(p))) return true; return REGEX_CANTEIRO_RMI.test(n); }
const PALAVRAS_NAO_MATERIAL_RMI = ['TESTES','COMISSIONAMENTO','OMISSOS','ENSAIO','GERENCIAMENTO','SUPERVISAO','ADMINISTRACAO','TREINAMENTO'];
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
// Catálogo copiado verbatim de index.html (CATALOGO_MATERIAIS_RMI)
const CATALOGO_MATERIAIS_RMI = {
  'Molas': ['RMTAC', 'RMG ', 'BASES INERCIAIS'],
  'Chiller': ['CHILLER'],
  'Elevadores': ['ELEVADOR'],
  'Isolamento térmico': ['ALUCLAD', 'MANTA SUPERLON', 'TUBO SUPERLON', 'ISOLAMENTO', 'LA DE VIDRO', 'PLACAS DE LA', 'LENCOL DE BORRACHA'],
  'Tubulação Aço Carbono': ['TUBULACAO ACO CARBONO', 'TUBO DE ACO CARBONO'],
  'Tubulação Inox': ['TUBULACAO ACO INOX', 'TUBO INOX', 'CHAPA INOX'],
  'Tubulação Alumínio': ['TUBULACAO ALUMINIO', 'TUBO DE ALUMINIO'],
  'Cabos': ['CABO', 'COND CU FLEX', 'CORDAO OPTICO', 'FIBRA OTICA', 'CABO OPTICO', 'PIGTAIL', 'TERMINAL DE COMPESSAO'],
  'Painéis': ['PAINEL', 'PAINEIS', 'QUADRO ELETRICO', 'QEE'],
  'Fancoils e Fancoletes': ['FANCOLETE', 'FANCOIL'],
  'Ventiladores e Exaustores': ['VENTILADOR', 'EXAUSTAO'],
  'Difusores e Grelhas': ['DIFUSOR', 'GRELHA DE RETORNO', /^DI-\d/, /^GR-\d/],
  'Bombas': ['BOMBA'],
  'Instrumentação': ['TERMOMETRO', 'MANOMETRO'],
  'Detecção e Alarme': ['DETECTOR DE FUMACA', 'BASE PARA DETECTOR', 'SENSOR DE PRESENCA', 'LEITORA DE CARTAO'],
  'Combate a Incêndio': ['SPK ', 'SPRINKLER', 'MANGUEIRA FLEXIVEL PARA SPRINKLERS'],
  'Ventilação e Dutos': ['DUTO FLEXIVEL', 'DUTO SUPORTADO', 'CHAPA GALVANIZADA', 'CANTO TDC'],
  'Automação e Controle': ['AUTOMACAO', 'CONTROLADORA', 'INVERSOR'],
  'Rede/Cabeamento Estruturado': ['PATCH PANEL', 'PATCH CORD', 'CONECTOR', 'RACK', 'DIO CASSETE'],
  'CFTV (câmeras)': ['ILLUSTRA', 'BULLET', 'DOME'],
  'Iluminação': ['LUMINARIA'],
  'Eletrodutos e Infraestrutura Elétrica': ['CANALETA', 'CONDULETE', 'BANDEJA', 'LEITO ', 'LUVA ARREMATE', 'PERFILADO', 'ELETRODUTO', 'ELETROCALHA', 'CURVA VERTICAL', 'PERF FZE'],
  'Estrutura e Suportação Metálica': ['VIGA U', 'VERGALHAO', 'CHAPA ACO', 'CANTONEIRA', 'ACO CA-50', 'ACO CA-60'],
  'Concreto e Impermeabilização': ['CONCRETO', 'REATERRO', 'VIAPLUS', 'PLANISEAL'],
  'Pisos': ['PISO DE BORRACHA', 'PISO PORCELANATO', 'PREPARACAO DO PISO'],
  'Rodapés e Acabamentos': ['RODAPE'],
  'Divisórias': ['DIVISORIA'],
  'Esquadrias (janelas)': ['CAIXILHO', 'ESQUADRIA'],
  'Portas': ['PORTA MADEIRA', 'PORTA DE MADEIRA'],
  'Pintura': ['PINTURA'],
  'Forros e Drywall': ['FORRO', 'DRYWALL', 'SANCA'],
  'Louças e Metais': ['CUBA', 'TORNEIRA', 'ESPELHO CRISTAL', 'BACIA', 'SIFAO', 'BARRA DE ACESSIBILIDADE', 'CAIXA ACOPLADA', 'CAIXA DE DESCARGA', 'MICTORIO', 'LAVATORIO', 'VALVULA DE DESCARGA', 'VALVULA PARA TANQUE'],
  'Marcenaria e Mobiliário': ['ARMARIO'],
  'Revestimentos': ['PASTILHA', 'FRONTAO EM GRANITO', 'TAMPO EM GRANITO'],
  'Válvulas e acessórios': ['VALVULA', 'FILTRO Y', 'FLANGE', 'JUNTA FLEXIVEL', 'CURVA 90'],
};
// Extra da Hitachi copiado verbatim de CONFIG_SUPRIMENTOS_POR_OBRA[110]
// em index.html — mantém este script fiel ao código real.
const CATALOGO_EXTRA_HITACHI = {
  'Isoladores': ['ISOL. CERAM', 'ISOLADOR CERAMICO', 'ISOLADOR EPOXI', 'ISOLADOR SUPORTE'],
  'Barramentos (AT)': ['TUBO AL EXTRUD', 'BARRA PERF. AL', 'BARRA CIRCULAR', 'BARRA RETANGULAR DE COBRE', 'BARRA CHATA DE ALUMINIO'],
  'Conectores e Ferragens de Linha (AT)': ['CONEC. SUP', 'CONEC SUP', 'CONECT. SUP', 'CONECT SUP', 'CONECT. TERM', 'CONECT TERM', 'CONEC TERMINAL', 'CONECT. EMENDA', 'CONECT EMENDA', 'CONEC. EMENDA', 'CONEC EMENDA'],
  'Controle de Acesso': ['LEITOR BIOMETRICO', 'FECHADURA ELETROMAGNETICA', 'SENSOR MAGNETICO', 'BOTOEIRA'],
  'Parafusos e Fixação': ['PARAFUSO', 'PARARAFUSO', 'CHUMBADOR', 'ARRUELA', 'PORCA QUADRADA', 'PORCA SEXTAVADA', 'PORCA SEX'],
  'Equipamentos de TI': ['NOTEBOOK'],
  'Estrutura e Suportação Metálica': ['SUPORTE', 'PERFIL U EM ACO', 'PERFIL Z', 'CHAPA EM ACO GALVANIZADO'],
  'Tubulação Aço Carbono': ['TUBO ACO PTO NBR', 'RED CONC PTO', 'TE 90º ACO PRETO', 'ACO PRETO A-234', 'CAP ACO CARBONO'],
  'Acoplamentos e Conexões Ranhuradas': ['ACOPLAMENTO RIGIDO', 'ACOPLAMENTO DE REDUCAO', 'TEE RANHURADO', 'GRAMPO U', 'CRUZETA EM ACO', 'CAP RANHURADO'],
  'Automação e Controle': ['CORTINA DE LUZ'],
  'Combate a Incêndio': ['WATER SPRAY', 'PROJETOR DE ALTA VAZAO'],
  'Cabos': ['COND COBRE NU', 'TERMINAL COMPRESSAO'],
  'Rede/Cabeamento Estruturado': ['KIT DE ANCORAGEM', 'PARA DIO'],
  'Eletrodutos e Infraestrutura Elétrica': ['PERF FGF', 'PARALEITO'],
};
const CATALOGO_COMBINADO = { ...CATALOGO_MATERIAIS_RMI };
Object.entries(CATALOGO_EXTRA_HITACHI).forEach(([cat, palavras]) => {
  CATALOGO_COMBINADO[cat] = CATALOGO_COMBINADO[cat] ? [...CATALOGO_COMBINADO[cat], ...palavras] : palavras;
});
function classificarMaterialRmi(descNorm){
  for (const [categoria, palavras] of Object.entries(CATALOGO_COMBINADO)) {
    if (palavras.some(p => p instanceof RegExp ? p.test(descNorm) : descNorm.includes(p))) return categoria;
  }
  return null;
}
function familiaMaterialRmi(descricao){
  if (!descricao) return descricao;
  const catalogo = classificarMaterialRmi(normalizarNomeParaMatch(descricao));
  if (catalogo) return catalogo;
  const idxTraco = descricao.indexOf(' - ');
  const bateVirgula = /(?<!\d),(?!\d)/.exec(descricao);
  const idxVirgula = bateVirgula ? bateVirgula.index : -1;
  const candidatos = [idxTraco, idxVirgula].filter(i => i !== -1);
  if (!candidatos.length) return descricao.trim();
  return descricao.slice(0, Math.min(...candidatos)).trim();
}

// ── pipeline (escopo permitido = nivel0 com cp281/cp001/cp006) ──
const ESCOPOS_PERMITIDOS = ['cp281', 'cp001', 'cp006'];
const itensNivel0 = rows.filter(r => r.raw.nivel === 0).filter(r => {
  const norm = normalizarNomeParaMatch(r.raw.descricao);
  return ESCOPOS_PERMITIDOS.some(cod => norm.includes(normalizarNomeParaMatch(cod)));
});
console.log('escopos permitidos encontrados:', itensNivel0.map(r => r.raw.descricao));

const filhosPorPaiGeral = new Map();
rows.forEach(r => {
  const pai = codigoPaiRmi(r.raw.codigo_seq);
  if (pai == null) return;
  const chave = `${r.raw.id_rmi}::${pai}`;
  if (!filhosPorPaiGeral.has(chave)) filhosPorPaiGeral.set(chave, []);
  filhosPorPaiGeral.get(chave).push(r);
});

let brutos = [];
itensNivel0.forEach(item => {
  if (ehItemCanteiroRmi(item.raw.descricao)) return;
  const nome = (item.raw.descricao || '').trim();
  coletarMateriaisDaDisciplina(item, null, filhosPorPaiGeral).forEach(({ item: m }) => {
    const valor = Number(m.raw.subtotal_custo_meta_orcamento) || 0;
    if (valor <= 0) return;
    brutos.push({ descricao: m.raw.descricao, disciplina: nome, area: nome, valor, unidade: m.raw.unidade, finalizado: !!m.raw.finalizado });
  });
});
console.log('materiais brutos (valor>0):', brutos.length, 'valor total', brutos.reduce((s,b)=>s+b.valor,0).toFixed(2));

// classifica cada bruto (sem consolidar ainda) pra medir cobertura do
// catálogo de VERDADE — só conta como "coberto" se bateu uma categoria
// do dicionário (não confundir com o corte por separador do fallback,
// que só encurta o texto sem categorizar).
let cobertos = [], naoCobertos = [];
brutos.forEach(b => {
  const catalogo = classificarMaterialRmi(normalizarNomeParaMatch(b.descricao));
  const fam = familiaMaterialRmi(b.descricao);
  (catalogo ? cobertos : naoCobertos).push({ ...b, familia: fam });
});
const somaValor = arr => arr.reduce((s,x)=>s+x.valor,0);
console.log(`\nCOBERTOS pelo catálogo atual: ${cobertos.length} itens, R$ ${somaValor(cobertos).toFixed(2)}`);
console.log(`NÃO COBERTOS (cairiam no fallback = descrição inteira): ${naoCobertos.length} itens, R$ ${somaValor(naoCobertos).toFixed(2)}`);

// agrupa os NÃO cobertos por um "prefixo" grosseiro (1ª palavra ou 2) só
// pra ajudar a visualizar candidatos a categoria nova
console.log('\n--- não cobertos, maior valor primeiro (top 40) ---');
naoCobertos.sort((a,b)=>b.valor-a.valor).slice(0,40).forEach(b => console.log(`  R$ ${b.valor.toFixed(2).padStart(12)}  [${b.disciplina}]  ${b.descricao}`));

console.log('\n--- cobertos, por categoria do catálogo ---');
const porCategoria = new Map();
cobertos.forEach(b => { const g = porCategoria.get(b.familia) || { qtd:0, valor:0 }; g.qtd++; g.valor += b.valor; porCategoria.set(b.familia, g); });
[...porCategoria.entries()].sort((a,b)=>b[1].valor-a[1].valor).forEach(([cat,g]) => console.log(`  ${cat}: ${g.qtd} itens, R$ ${g.valor.toFixed(2)}`));
