-- Anti-replay do SSO do Portal (Etapa 0 — porte da Edge Function portal-sso).
-- O INSERT conflitante É a detecção de replay, mesma lógica da função
-- original: sem SELECT-antes-de-INSERT, que teria corrida entre duas
-- requisições simultâneas carregando o mesmo token.

CREATE TABLE IF NOT EXISTS sso_nonces (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nonce VARCHAR(128) NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY sso_nonces_nonce_uk (nonce)
);
