-- Etapa 2 — Orçamentos Complementares (OC/CO). Espelha
-- `orcamentos_complementares_obra` (schema conferido ao vivo, 17/09/2026):
-- 1 linha por obra, upsert por `id_obra` (mesmo padrão de `rest_restricoes`
-- — o n8n resubstitui o snapshot inteiro a cada sync). `nome_obra` dropado,
-- redundante com `obras.nome` via `id_obra` (mesma normalização já feita
-- em Restrições).

CREATE TABLE IF NOT EXISTS oc_orcamentos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_obra BIGINT UNSIGNED NOT NULL,
  total INT NULL,
  ocs JSON NOT NULL,
  resumo JSON NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY oc_orcamentos_id_obra_uk (id_obra),
  CONSTRAINT oc_orcamentos_id_obra_fk FOREIGN KEY (id_obra) REFERENCES obras (id)
);
