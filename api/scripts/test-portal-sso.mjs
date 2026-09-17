import 'dotenv/config';
import crypto from 'node:crypto';

const segredo = process.env.PORTAL_SSO_SECRET;
const payload = {
  email: 'teste.migracao@mse.com.br',
  nome: 'Teste Migração',
  origem: 'mse',
  perfil: 'MSE',
  nonce: crypto.randomUUID(),
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 60,
};

const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
const assinatura = crypto.createHmac('sha256', segredo).update(payloadB64).digest('base64url');
const token = `${payloadB64}.${assinatura}`;

const r = await fetch('http://localhost:3001/auth/portal-sso', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token }),
});
console.log('status:', r.status);
console.log(await r.json());

// Segunda tentativa com o MESMO token: deve ser recusada (replay).
const r2 = await fetch('http://localhost:3001/auth/portal-sso', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token }),
});
console.log('replay status:', r2.status);
console.log(await r2.json());
