const fs = require('fs');
const path = require('path');
const rows = JSON.parse(fs.readFileSync(path.join(process.env.TEMP, 'hitachi_rmi.json'), 'utf8'));
function codigoPaiRmi(c){ if(!c) return null; const p=String(c).split('.'); return p.length<2?null:p.slice(0,-1).join('.'); }
const porRmi = {};
rows.forEach(r => { (porRmi[r.raw.id_rmi] = porRmi[r.raw.id_rmi]||[]).push(r); });
Object.entries(porRmi).forEach(([idRmi, itens]) => {
  const n0 = itens.filter(r=>r.raw.nivel===0);
  const n1 = itens.filter(r=>r.raw.nivel===1);
  const filhosPorPai = {};
  n1.forEach(r=>{ const pai=codigoPaiRmi(r.raw.codigo_seq); if(pai==null) return; const k=idRmi+'::'+pai; (filhosPorPai[k]=filhosPorPai[k]||[]).push(r); });
  console.log('=== RMI', idRmi, '===');
  n0.forEach(pai => {
    const chave = idRmi+'::'+pai.raw.codigo_seq;
    const filhos = filhosPorPai[chave] || [];
    const somaFilhos = filhos.reduce((s,f)=>s+(Number(f.raw.subtotal_custo_meta_orcamento)||0),0);
    const subtotalProprio = Number(pai.raw.subtotal_custo_meta_orcamento)||0;
    const desce = subtotalProprio===0 && somaFilhos>0;
    if (desce) {
      console.log('  DESCE de "' + pai.raw.descricao + '" (subtotal=0) para', filhos.length, 'filhos nivel1:');
      filhos.forEach(f => console.log('     -> disciplina="' + f.raw.descricao + '" unidade=' + f.raw.unidade + ' valor=' + f.raw.subtotal_custo_meta_orcamento));
    }
  });
});
