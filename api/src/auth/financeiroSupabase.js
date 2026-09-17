// Verifica acesso financeiro por obra chamando o PRÓPRIO Supabase (RPCs
// `mse_acesso_total`/`mse_cps_financeiro`, ver docs/15 seção 1c), em vez de
// replicar `acesso_total`/RLS no MySQL. Motivo: essa lógica já existe,
// testada (16/16, docs/15) e é usada pelo front pra gate de UI — duplicá-la
// aqui criaria duas fontes de verdade que podem dessincronizar. A API só
// repassa o MESMO token de sessão do usuário pro Supabase responder "esta
// pessoa pode ver este cp_codigo?" — nunca decide isso sozinha.
//
// Achado ao migrar Medições (17/09/2026): as rotas de leitura tinham saído
// sem NENHUMA verificação (copiei o padrão de Restrições, que de fato não
// tem recorte por obra) — isso teria reproduzido o antipadrão que o
// ADR-007/docs/15 existem pra evitar (RLS é a proteção real, esconder no
// front é decoração). Corrigido antes de qualquer deploy em produção.
//
// Falha sempre RESTRINGE, nunca libera — mesma regra do
// `carregarAcessoTotal()`/`carregarAcessoObras()` do front
// (`prototipo/lib/auth.js`): sem sessão, RPC fora do ar, ou resposta
// inesperada = sem acesso financeiro.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function chamarRpc(nome, token) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!r.ok) throw new Error(`rpc ${nome}: HTTP ${r.status}`);
  return r.json();
}

// `SETOF text`/`SETOF integer` do PostgREST chega como `[{nome: valor}, ...]`
// ou `[valor, ...]`, dependendo da versão — aceita as duas (mesma defesa que
// `chamarRpcIds` já faz em auth.js).
function listaEscalar(dados, nomeCampo) {
  if (!Array.isArray(dados)) return [];
  return dados.map(d => (typeof d === 'object' && d !== null ? d[nomeCampo] ?? Object.values(d)[0] : d));
}

async function temAcessoFinanceiro(token, { cpCodigo, idObra }) {
  const total = await chamarRpc('mse_acesso_total', token);
  if (total === true) return true;

  if (cpCodigo) {
    const cps = listaEscalar(await chamarRpc('mse_cps_financeiro', token), 'mse_cps_financeiro');
    if (cps.includes(cpCodigo)) return true;
  }
  if (idObra != null) {
    const obras = listaEscalar(await chamarRpc('mse_obras_financeiro', token), 'mse_obras_financeiro');
    if (obras.includes(idObra)) return true;
  }
  return false;
}

function extrairToken(req) {
  const cabecalho = req.headers['authorization'] || '';
  return cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : '';
}

/** Middleware: exige `req.query.cp_codigo` autorizado pro e-mail da sessão
 *  (`Authorization: Bearer <token>` — o mesmo token que o front já usa pra
 *  falar com o Supabase). 401 sem token; 403 com token válido mas sem
 *  acesso a este cp_codigo. Usado por Medições (`contratos_medicao`/
 *  `boletins_medicao` são chaveados por `cp_codigo`). */
export async function exigirAcessoFinanceiroCp(req, res, next) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[financeiro] SUPABASE_URL/SUPABASE_ANON_KEY nao configurados');
    return res.status(500).json({ erro: 'Funcao mal configurada.' });
  }
  const token = extrairToken(req);
  if (!token) return res.status(401).json({ erro: 'Sessao necessaria para ver dados financeiros.' });

  try {
    const cpCodigo = String(req.query.cp_codigo || '').trim();
    if (await temAcessoFinanceiro(token, { cpCodigo })) return next();
    return res.status(403).json({ erro: 'Sem acesso financeiro para esta obra.' });
  } catch (err) {
    console.error('[financeiro] falha ao verificar acesso via Supabase', err);
    return res.status(403).json({ erro: 'Nao foi possivel verificar acesso financeiro.' });
  }
}

/** Mesma verificação, mas por `id_obra` (numérico) em vez de `cp_codigo` —
 *  usado por OC/CO (`orcamentos_complementares_obra`, chaveada por
 *  `id_obra` direto, sem convenção de código de contrato). */
export async function exigirAcessoFinanceiroObra(req, res, next) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[financeiro] SUPABASE_URL/SUPABASE_ANON_KEY nao configurados');
    return res.status(500).json({ erro: 'Funcao mal configurada.' });
  }
  const token = extrairToken(req);
  if (!token) return res.status(401).json({ erro: 'Sessao necessaria para ver dados financeiros.' });

  const idObra = Number(req.query.id_obra);
  if (!Number.isInteger(idObra)) return res.status(400).json({ erro: 'id_obra invalido.' });

  try {
    if (await temAcessoFinanceiro(token, { idObra })) return next();
    return res.status(403).json({ erro: 'Sem acesso financeiro para esta obra.' });
  } catch (err) {
    console.error('[financeiro] falha ao verificar acesso via Supabase', err);
    return res.status(403).json({ erro: 'Nao foi possivel verificar acesso financeiro.' });
  }
}
