// Publica a pirâmide DZI gerada em prototipo/assets/ortofoto-porto (ver
// gerar-ortofoto-tiles.js) no destino que serve o painel, e atualiza a data
// da foto em panel-config.js — os dois passos da atualização semanal.
//
// --destino=local (padrão): copia pra bucket-local/ (ver serve-bucket-local.js),
//   pra testar antes de mexer em produção.
// --destino=supabase: sobe pro bucket público do Supabase Storage via
//   Storage API, usando SUPABASE_SERVICE_ROLE_KEY (variável de ambiente —
//   nunca cole a chave aqui nem em nenhum arquivo do repo).
//
// Uso: node scripts/publicar-ortofoto.js 2026-09-08 [--destino=local|supabase]
const fs = require('fs');
const path = require('path');

const ORIGEM = path.join(__dirname, '..', 'prototipo', 'assets', 'ortofoto-porto');
const CONFIG_PATH = path.join(__dirname, '..', 'prototipo', 'lib', 'panel-config.js');
const SUPABASE_URL = 'https://gebjlhkywtnpfqjrakok.supabase.co';
const BUCKET = 'ortofoto-porto';

const dataFoto = process.argv[2];
const destino = (process.argv.find(a => a.startsWith('--destino=')) || '--destino=local').split('=')[1];
if (!dataFoto || !/^\d{4}-\d{2}-\d{2}$/.test(dataFoto)) {
  console.error('uso: node scripts/publicar-ortofoto.js AAAA-MM-DD [--destino=local|supabase]');
  process.exit(1);
}

function listarArquivos(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listarArquivos(p) : [p];
  });
}

function contentType(p) {
  const ext = path.extname(p).toLowerCase();
  return ext === '.dzi' ? 'application/xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';
}

async function publicarLocal() {
  const destinoDir = path.join(__dirname, '..', 'bucket-local', 'ortofoto-porto');
  const arquivos = listarArquivos(ORIGEM);
  for (const arquivo of arquivos) {
    const rel = path.relative(ORIGEM, arquivo);
    const alvo = path.join(destinoDir, rel);
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.copyFileSync(arquivo, alvo);
  }
  console.log(`${arquivos.length} arquivos copiados para bucket-local/ortofoto-porto`);
  return 'http://localhost:8900/ortofoto-porto/ortofoto.dzi';
}

async function publicarSupabase() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) {
    console.error('faltou SUPABASE_SERVICE_ROLE_KEY no ambiente (Settings > API > service_role no dashboard do Supabase — nunca cole a chave num arquivo do repo).');
    process.exit(1);
  }
  const arquivos = listarArquivos(ORIGEM);
  let enviados = 0;
  const CONCORRENCIA = 20;
  for (let i = 0; i < arquivos.length; i += CONCORRENCIA) {
    const lote = arquivos.slice(i, i + CONCORRENCIA);
    await Promise.all(lote.map(async arquivo => {
      const rel = path.relative(ORIGEM, arquivo).split(path.sep).join('/');
      const resp = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${rel}`, {
        method: 'POST',
        headers: {
          apikey: chave,
          Authorization: `Bearer ${chave}`,
          'Content-Type': contentType(arquivo),
          'x-upsert': 'true',
        },
        body: fs.readFileSync(arquivo),
      });
      if (!resp.ok) throw new Error(`falha em ${rel}: HTTP ${resp.status} ${await resp.text()}`);
      enviados++;
    }));
    process.stdout.write(`\r${enviados}/${arquivos.length} enviados`);
  }
  console.log(`\n${enviados} arquivos publicados no bucket ${BUCKET}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/ortofoto.dzi`;
}

function atualizarConfig(dziUrl) {
  const conteudo = fs.readFileSync(CONFIG_PATH, 'utf8');
  const linhaAtual = conteudo.match(/94: Object\.freeze\(\{ dzi: '[^']*', data: '[^']*' \}\)/);
  if (!linhaAtual) throw new Error('não achei a linha do OBRA_ORTOFOTO[94] em panel-config.js — atualize manualmente');
  const novaLinha = `94: Object.freeze({ dzi: '${dziUrl}', data: '${dataFoto}' })`;
  fs.writeFileSync(CONFIG_PATH, conteudo.replace(linhaAtual[0], novaLinha));
  console.log('panel-config.js atualizado:', novaLinha);
}

async function main() {
  if (!fs.existsSync(ORIGEM)) throw new Error(`${ORIGEM} não existe — rode gerar-ortofoto-tiles.js antes`);
  const dziUrl = destino === 'supabase' ? await publicarSupabase() : await publicarLocal();
  atualizarConfig(dziUrl);
}

main().catch(err => { console.error(err); process.exit(1); });
