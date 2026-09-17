import { Router } from 'express';
import { validarToken, consumirNonce, emitirSessao } from '../auth/portalSso.js';

export const authRouter = Router();

// Mensagem pública ÚNICA para toda recusa de token, de propósito: o motivo
// real (`detalhe`) só vai para o log do servidor. Distinguir "assinatura
// inválida" de "nonce já usado" para quem chama é dar um oráculo para quem
// estiver tentando forjar token — mesmo cuidado da função original.
function recusar(res, status, detalhe) {
  if (detalhe) console.error(`[portal-sso] recusado :: ${detalhe}`);
  return res.status(status).json({ erro: 'Acesso pelo portal nao validado.' });
}

authRouter.post('/portal-sso', async (req, res) => {
  const segredo = process.env.PORTAL_SSO_SECRET?.trim();
  if (!segredo || segredo.length < 32) {
    console.error('[portal-sso] PORTAL_SSO_SECRET ausente ou curto demais');
    return res.status(500).json({ erro: 'Funcao mal configurada.' });
  }
  if (!process.env.JWT_SECRET) {
    console.error('[portal-sso] JWT_SECRET ausente');
    return res.status(500).json({ erro: 'Funcao mal configurada.' });
  }

  const token = (req.body?.token ?? '').trim();
  if (!token) return res.status(400).json({ erro: 'Informe `token`.' });

  const identidade = validarToken(token, segredo);
  if (typeof identidade === 'string') return recusar(res, 401, identidade);

  const nonceOk = await consumirNonce(identidade.nonce);
  if (!nonceOk) return recusar(res, 401, `nonce ja usado: ${identidade.nonce}`);

  const sessao = emitirSessao(identidade);
  res.set('Cache-Control', 'no-store');
  return res.json({
    access_token: sessao.access_token,
    expires_in: sessao.expires_in,
    email: identidade.email,
    perfil: identidade.perfil,
  });
});
