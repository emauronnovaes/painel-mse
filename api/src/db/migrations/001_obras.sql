-- Tabela canônica de mapa de obras (Etapa 0 da migração Supabase -> MySQL).
-- Substitui as 4 convenções de nome de obra hoje espalhadas
-- (curvas_s.obra, cards_ativos/vw_dados_tv.origem, pts_emitidas, código CP
-- do financeiro). Sem prefixo de domínio: é tabela de referência
-- compartilhada por todos os domínios, não pertence a um só.
-- Ids preservados de prototipo/lib/panel-config.js (OBRAS) — já são a
-- referência numérica usada em toda a frontend hoje (ADR-004).

CREATE TABLE IF NOT EXISTS obras (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(120) NOT NULL,
  alias_curva_s VARCHAR(120) NULL,
  alias_origem_tv VARCHAR(120) NULL,
  alias_pts VARCHAR(120) NULL,
  codigo_cp VARCHAR(20) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO obras (id, nome, alias_curva_s, alias_origem_tv, alias_pts, codigo_cp) VALUES
  (91, 'Novo Nordisk - UB/SP', 'NOVO NORDISK - UB SP', 'NN - UB/SP - ELETROMECÂNICA', 'Novo Nordisk UB', 'CP236'),
  (94, 'Porto Itapoá', 'PORTO', 'PORTO ITAPOÁ', NULL, 'CP002'),
  (106, 'CNPEM - Faseado', 'CNPEM - FASEADO', 'CNPEM-FASEADA', NULL, 'CP029'),
  (107, 'Novo Nordisk - AP', 'NOVO NORDISK - AP', 'NN - AP - ELETROMECÂNICA', 'Novo Nordisk AP', 'CP273'),
  (108, 'Novo Nordisk - AP - Reforço', 'NOVO NORDISK - REFORÇO AP', 'NN - REFORÇO EST. METÁLICAS', NULL, 'CP261'),
  (110, 'Hitachi', 'HITACHI', 'HITACHI', NULL, 'CP022'),
  (114, 'IPEN', 'IPEN', NULL, NULL, NULL)
ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  alias_curva_s = VALUES(alias_curva_s),
  alias_origem_tv = VALUES(alias_origem_tv),
  alias_pts = VALUES(alias_pts),
  codigo_cp = VALUES(codigo_cp);
