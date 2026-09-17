-- Etapa 1 (piloto) — Restrições EAP. Um snapshot por obra, sempre upsert
-- (o n8n resubstitui o total e a lista inteira a cada sync, não faz
-- append). `nome_obra` do Supabase foi dropado: é redundante com
-- `obras.nome` via `id_obra`, oportunidade de normalização da migração.

CREATE TABLE IF NOT EXISTS rest_restricoes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_obra BIGINT UNSIGNED NOT NULL,
  total INT NULL,
  restricoes JSON NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY rest_restricoes_id_obra_uk (id_obra),
  CONSTRAINT rest_restricoes_id_obra_fk FOREIGN KEY (id_obra) REFERENCES obras (id)
);
