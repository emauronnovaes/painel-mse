-- Snapshot já alimentado pelo GitHub Actions em mse-avancos-sync.
-- Estrutura conferida no MySQL em 21/09/2026. Idempotente; não altera a
-- tabela existente nem cria um segundo agendador de ingestão.
CREATE TABLE IF NOT EXISTS eap_cards_ativos (
  card_id VARCHAR(30) NOT NULL PRIMARY KEY,
  id_eap_tabela INT NULL,
  nome_eap VARCHAR(120) NULL,
  id_obra INT NULL,
  nome_obra VARCHAR(120) NULL,
  edt VARCHAR(60) NULL,
  tarefa VARCHAR(255) NULL,
  resp_planejamento VARCHAR(120) NULL,
  responsavel_encarregado VARCHAR(120) NULL,
  supervisor_coordenador VARCHAR(120) NULL,
  sincronizado_em DATETIME NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY eap_cards_ativos_obra_idx (id_obra),
  KEY eap_cards_ativos_eap_idx (id_eap_tabela)
);
