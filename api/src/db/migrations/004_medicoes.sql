-- Etapa 2 — Medições. Espelha `contratos_medicao`/`boletins_medicao` do
-- Supabase (schema conferido ao vivo via MCP, 17/09/2026), com os nomes de
-- tabela seguindo a convenção de prefixo por domínio (`med_`) decidida na
-- Etapa 0. Nenhuma coluna foi dropada — ao contrário de Restrições, aqui
-- não havia redundância com `obras` (chave é `cp_codigo`, não `id_obra`).

CREATE TABLE IF NOT EXISTS med_contratos (
  cp_codigo VARCHAR(32) NOT NULL PRIMARY KEY,
  gestor VARCHAR(255) NULL,
  contrato_nome VARCHAR(255) NULL,
  valor_contrato DECIMAL(16,2) NULL,
  valor_contrato_original DECIMAL(16,2) NULL,
  valor_ocs DECIMAL(16,2) NULL,
  valor_total DECIMAL(16,2) NULL,
  iss_fracao DECIMAL(9,6) NULL,
  prazo_vencimento_dias INT NULL,
  nota_planilha TEXT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- `id` é a PK técnica (o Supabase original não tinha uma — usava só a
-- combinação abaixo); `linha_planilha` é a chave de dedupe real (o mesmo
-- número de BM pode se repetir dentro de um contrato, ver comentário do
-- .gs) — por isso o upsert é sempre por (cp_codigo, linha_planilha), nunca
-- por número de BM.
CREATE TABLE IF NOT EXISTS med_boletins (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cp_codigo VARCHAR(32) NOT NULL,
  linha_planilha INT NOT NULL,
  bm_label VARCHAR(255) NULL,
  periodo_inicio DATE NULL,
  periodo_fim DATE NULL,
  valor_previsto DECIMAL(16,2) NULL,
  tendencia DECIMAL(16,2) NULL,
  valor_medido DECIMAL(16,2) NULL,
  desconto_fd DECIMAL(16,2) NULL,
  retencao DECIMAL(16,2) NULL,
  valor_faturado DECIMAL(16,2) NULL,
  data_faturamento DATE NULL,
  status_faturamento VARCHAR(64) NULL,
  iss_valor DECIMAL(16,2) NULL,
  desconto_adiantamento DECIMAL(16,2) NULL,
  valor_recebimento_previsto DECIMAL(16,2) NULL,
  valor_recebimento_real DECIMAL(16,2) NULL,
  vencimento DATE NULL,
  data_recebimento DATE NULL,
  status_recebimento VARCHAR(64) NULL,
  saldo_previsto_acumulado DECIMAL(16,2) NULL,
  saldo_realizado_acumulado_medido DECIMAL(16,2) NULL,
  avanco_previsto_acumulado DECIMAL(16,2) NULL,
  avanco_realizado_acumulado DECIMAL(16,2) NULL,
  observacao TEXT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY med_boletins_cp_linha_uk (cp_codigo, linha_planilha),
  CONSTRAINT med_boletins_cp_codigo_fk FOREIGN KEY (cp_codigo) REFERENCES med_contratos (cp_codigo)
);
