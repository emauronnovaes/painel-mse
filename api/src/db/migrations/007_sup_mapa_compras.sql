-- Etapa 2 — Suprimentos, Mapa de Compras. Espelha `itens_mapa_compras` e
-- `requisicoes_mapa_compras` (schema conferido ao vivo, 17/09/2026) —
-- diferente de RMI, aqui a maioria dos campos já tem coluna própria (não
-- só `raw`); mantemos `raw JSON` como rede de segurança, mesmo padrão do
-- Supabase. `obra`/`obra_nome` dropados (redundante com `obras.nome`).
--
-- Chave de upsert = id PRÓPRIO da origem (API do PortalMSE), não
-- auto-incremento: `itens_mapa_compras.id_item` (não `id`, que lá é só
-- identity técnico) e `requisicoes_mapa_compras.id` (já é o id de origem
-- direto) — mesmo padrão de `sup_rmi`.

CREATE TABLE IF NOT EXISTS sup_mapa_compras_requisicoes (
  id BIGINT NOT NULL PRIMARY KEY,
  id_obra BIGINT UNSIGNED NOT NULL,
  id_rmi BIGINT NULL,
  nome_rmi VARCHAR(255) NULL,
  requisicao VARCHAR(50) NULL,
  requisicao_tipo VARCHAR(50) NULL,
  tipo VARCHAR(50) NULL,
  grupo VARCHAR(100) NULL,
  categoria VARCHAR(100) NULL,
  descricao TEXT NULL,
  status_requisicao VARCHAR(50) NULL,
  status_requisicao_gravado VARCHAR(50) NULL,
  data_cadastro DATE NULL,
  data_necessidade DATE NULL,
  requisitante VARCHAR(255) NULL,
  cronograma INT NULL,
  data_cronograma_fechado DATE NULL,
  id_req_original BIGINT NULL,
  solicitacao_enviada TINYINT(1) NULL,
  necessario_contrato TINYINT(1) NULL,
  necessario_art TINYINT(1) NULL,
  total_itens INT NULL,
  raw JSON NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY sup_mc_req_id_obra_idx (id_obra),
  KEY sup_mc_req_id_rmi_idx (id_rmi),
  CONSTRAINT sup_mc_req_id_obra_fk FOREIGN KEY (id_obra) REFERENCES obras (id)
);

CREATE TABLE IF NOT EXISTS sup_mapa_compras_itens (
  id BIGINT NOT NULL PRIMARY KEY,
  id_obra BIGINT UNSIGNED NOT NULL,
  id_mapa_compras BIGINT NOT NULL,
  codigo_seq VARCHAR(50) NOT NULL,
  descricao TEXT NULL,
  unidade VARCHAR(20) NULL,
  quantidade DECIMAL(16,4) NULL,
  preco_referencia_bd_s1 DECIMAL(16,4) NULL,
  subtotal_referencia_bd_s1 DECIMAL(16,2) NULL,
  custo_meta_orcamento DECIMAL(16,4) NULL,
  subtotal_custo_meta_orcamento DECIMAL(16,2) NULL,
  saldo_orcamentario DECIMAL(16,2) NULL,
  saldo_quantidade DECIMAL(16,4) NULL,
  quantidade_pedida DECIMAL(16,4) NULL,
  total_consumido DECIMAL(16,2) NULL,
  tem_pedido TINYINT(1) NULL,
  fornecedor_ref VARCHAR(255) NULL,
  projeto_ref VARCHAR(255) NULL,
  melhor_oferta_unitario DECIMAL(16,4) NULL,
  melhor_oferta_subtotal DECIMAL(16,2) NULL,
  melhor_oferta_fornecedor VARCHAR(255) NULL,
  raw JSON NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY sup_mc_itens_id_obra_idx (id_obra),
  KEY sup_mc_itens_id_mapa_compras_idx (id_mapa_compras),
  KEY sup_mc_itens_tem_pedido_idx (tem_pedido),
  CONSTRAINT sup_mc_itens_id_obra_fk FOREIGN KEY (id_obra) REFERENCES obras (id)
);
