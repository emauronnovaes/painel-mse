// Porte da Edge Function `portal-sso` (Supabase) para a API intermediária.
// Contrato de entrada preservado (mesmo token HMAC que o Portal PHP já
// emite para o planejamento_dash) — só a emissão de sessão muda: em vez de
// pedir ao GoTrue do Supabase, esta API assina o próprio JWT.
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';

// Teto de validade aceito para o token do portal, independente do que ele
// peça — um portal comprometido não consegue emitir passe permanente.
const TTL_MAXIMO_SEGUNDOS = 120;

// Idade a partir da qual um nonce consumido pode sumir da tabela. Tem que
// ser MAIOR que TTL_MAXIMO_SEGUNDOS, senão a limpeza reabriria a janela de
// replay que o nonce existe para fechar.
const NONCE_RETENCAO_SEGUNDOS = 600;

const NONCE_VALIDO = /^[a-z0-9-]{8,128}$/;
const ORIGENS = new Set(['mse', 'cliente']);
const PERFIS = new Set(['MSE', 'CLIENTE', 'MASTER']);

function assinaturaConfere(segredo, payloadB64, assinaturaB64) {
  const esperada = crypto.createHmac('sha256', segredo).update(payloadB64).digest();
  let recebida;
  try {
    recebida = Buffer.from(assinaturaB64, 'base64url');
  } catch {
    return false;
  }
  if (recebida.length !== esperada.length) return false;
  return crypto.timingSafeEqual(esperada, recebida);
}

function texto(payload, campo, max, obrigatorio = true) {
  const v = payload[campo];
  if (typeof v !== 'string') return obrigatorio ? null : '';
  const t = v.trim();
  if (obrigatorio && !t) return null;
  if (Buffer.byteLength(t, 'utf8') > max) return null;
  return t;
}

/** Valida o token HMAC do portal. Retorna a identidade ou uma string com o
 *  motivo da recusa (uso interno/log — nunca vai para o corpo da resposta,
 *  ver comentário em routes/auth.js). */
export function validarToken(token, segredo) {
  if (!token || token.length > 8192) return 'token malformado (tamanho)';
  const partes = token.split('.');
  if (partes.length !== 2) return 'token malformado (partes)';
  const [payloadB64, assinaturaB64] = partes;

  if (!assinaturaConfere(segredo, payloadB64, assinaturaB64)) return 'assinatura invalida';

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return 'payload nao e JSON';
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return 'payload nao e objeto';
  }

  const { iat, exp } = payload;
  if (!Number.isInteger(iat) || !Number.isInteger(exp)) return 'iat/exp ausentes ou nao inteiros';
  const agora = Math.floor(Date.now() / 1000);
  if (iat > agora + 5) return 'token emitido no futuro';
  if (exp <= agora) return 'token expirado';
  if (exp <= iat) return 'exp anterior a iat';
  if (exp - iat > TTL_MAXIMO_SEGUNDOS) return 'TTL acima do teto';

  const email = texto(payload, 'email', 254)?.toLowerCase() ?? null;
  if (!email || email.split('@').length !== 2 || email.startsWith('@') || email.endsWith('@') || /\s/.test(email)) {
    return 'email invalido';
  }

  const origem = texto(payload, 'origem', 16)?.toLowerCase() ?? null;
  if (!origem || !ORIGENS.has(origem)) return 'origem invalida';

  const perfil = texto(payload, 'perfil', 16)?.toUpperCase() ?? null;
  if (!perfil || !PERFIS.has(perfil)) return 'perfil invalido';

  const nonce = texto(payload, 'nonce', 128)?.toLowerCase() ?? null;
  if (!nonce || !NONCE_VALIDO.test(nonce)) return 'nonce invalido';

  const nome = texto(payload, 'nome', 150, false) || email.split('@')[0];
  return { email, nome, origem, perfil, nonce };
}

/** Consome o nonce. O INSERT conflitante é a própria detecção de replay. */
export async function consumirNonce(nonce) {
  pool
    .query('DELETE FROM sso_nonces WHERE criado_em < (NOW() - INTERVAL ? SECOND)', [NONCE_RETENCAO_SEGUNDOS])
    .catch((e) => console.error('[portal-sso] limpeza de nonce falhou', e));

  try {
    await pool.query('INSERT INTO sso_nonces (nonce) VALUES (?)', [nonce]);
    return true;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return false; // já usado
    throw err;
  }
}

/** Emite a sessão própria da API (substitui a chamada ao GoTrue). */
export function emitirSessao(identidade) {
  const ttl = Number(process.env.JWT_SESSION_TTL_SECONDS || 28800);
  const accessToken = jwt.sign(
    {
      email: identidade.email,
      nome: identidade.nome,
      perfil: identidade.perfil,
      origem: identidade.origem,
      role: 'authenticated',
    },
    process.env.JWT_SECRET,
    { expiresIn: ttl, algorithm: 'HS256' },
  );
  return { access_token: accessToken, expires_in: ttl };
}
