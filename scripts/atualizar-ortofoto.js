// Passo único da atualização semanal da ortofoto: gera os tiles a partir de
// prototipo/assets/images/ORTOFOTO.jpg e publica (ver gerar-ortofoto-tiles.js
// e publicar-ortofoto.js) — só pergunta a data da foto, o resto é automático.
// Não mexe em git (commit/push fica manual, de propósito).
//
// Uso: node scripts/atualizar-ortofoto.js [DD/MM/AAAA] [--destino=local|supabase]
const { execFileSync } = require('child_process');
const readline = require('readline');

const args = process.argv.slice(2);
const destinoArg = args.find(a => a.startsWith('--destino='));
const dataArg = args.find(a => /^\d{2}\/\d{2}\/\d{4}$/.test(a));

function paraISO(dataBR) {
  const [d, m, a] = dataBR.split('/');
  return `${a}-${m}-${d}`;
}

function perguntar(pergunta) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(pergunta, resposta => { rl.close(); resolve(resposta.trim()); }));
}

async function main() {
  let dataBR = dataArg;
  while (!dataBR || !/^\d{2}\/\d{2}\/\d{4}$/.test(dataBR)) {
    dataBR = await perguntar('Data da foto (DD/MM/AAAA): ');
  }

  console.log('\n== 1/2: gerando tiles ==');
  execFileSync('node', ['scripts/gerar-ortofoto-tiles.js'], { stdio: 'inherit' });

  console.log('\n== 2/2: publicando ==');
  const publicarArgs = ['scripts/publicar-ortofoto.js', paraISO(dataBR)];
  if (destinoArg) publicarArgs.push(destinoArg);
  execFileSync('node', publicarArgs, { stdio: 'inherit' });

  console.log('\nPronto. Revise e suba pro git quando quiser (git add/commit/push).');
}

main().catch(err => { console.error(err); process.exit(1); });
