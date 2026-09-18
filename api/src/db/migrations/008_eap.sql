-- Reconstrução do fluxo "Avanço físico/EAP" (perdido junto com o acesso à
-- máquina Oracle Cloud que hospedava o n8n, 18/09/2026 — nunca tinha sido
-- versionado no repo). Espelha as 3 tabelas do Supabase confirmadas ao vivo
-- em 2026-09-18 (`EAP`, `Apontamentos`, `cards_ativos`) com colunas
-- granulares (não o padrão enxuto raw JSON de `sup_rmi`/`sup_mapa_compras`
-- — volume aqui é bem menor, e o consumo (Curva S/Encarregados/Desvios)
-- filtra e ordena por várias colunas ao mesmo tempo). `vw_dados_tv`
-- (junção Apontamentos×EAP no Postgres) NÃO tem equivalente aqui ainda —
-- só entra quando o consumo do `prototipo` for migrado de fato (fora de
-- escopo por enquanto: hoje é só popular o banco nomeando o fluxo de novo).
--
-- Nomes de origem (API hub_mse) tinham 2 campos DIFERENTES ambos chamados
-- "id_eap" nas 3 tabelas do Supabase (um é a tarefa em si, outro é um
-- agrupamento macro) — aqui os 2 têm nomes distintos pra nunca mais
-- confundir: `id` é sempre a tarefa (== card), `id_eap_grupo` é o
-- agrupamento macro (era `id_eap_tabela` em `cards_ativos` no Supabase).

CREATE TABLE IF NOT EXISTS eap_tarefas (
  id BIGINT NOT NULL PRIMARY KEY,
  id_obra BIGINT UNSIGNED NOT NULL,
  nome_obra VARCHAR(255) NULL,
  id_eap_grupo BIGINT NULL,
  edt VARCHAR(64) NULL,
  tarefa VARCHAR(500) NULL,
  disciplina VARCHAR(255) NULL,
  `local` VARCHAR(255) NULL,
  unidade VARCHAR(32) NULL,
  qtd DECIMAL(18,4) NULL,
  saldo_qtd DECIMAL(18,4) NULL,
  efetivo_previsto DECIMAL(12,2) NULL,
  ponderacao_reais DECIMAL(16,2) NULL,
  ponderacao_hht DECIMAL(14,4) NULL,
  data_inicio DATE NULL,
  data_termino DATE NULL,
  data_inicio_reprogramado DATE NULL,
  data_termino_reprogramado DATE NULL,
  encarregado_nome VARCHAR(255) NULL,
  -- Snapshot de progresso — atualizado pelo fluxo "Avanços diários", não
  -- pelo fluxo "eaps" (que só toca estrutura). Fica na mesma linha por
  -- conveniência de leitura (mesmo padrão do Supabase original).
  avanco_atual DECIMAL(9,4) NULL,
  desvio DECIMAL(9,4) NULL,
  meta_diaria DECIMAL(9,4) NULL,
  avanco_diario DECIMAL(9,4) NULL,
  status_qualidade VARCHAR(64) NULL,
  hht_consumido DECIMAL(14,4) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY eap_tarefas_id_obra_idx (id_obra),
  CONSTRAINT eap_tarefas_id_obra_fk FOREIGN KEY (id_obra) REFERENCES obras (id)
);

-- "Retrato atual do planejamento" — sem histórico, o fluxo "eaps"
-- resubstitui (upsert por card_id) a cada rodada. Existe separado de
-- `eap_tarefas` porque tem colunas de responsável que a tarefa não tem
-- (planejamento/encarregado/supervisor), mesma separação que já existia
-- no Supabase.
CREATE TABLE IF NOT EXISTS eap_cards_ativos (
  card_id BIGINT NOT NULL PRIMARY KEY,
  id_eap_grupo BIGINT NULL,
  nome_eap VARCHAR(500) NULL,
  id_obra BIGINT UNSIGNED NOT NULL,
  nome_obra VARCHAR(255) NULL,
  edt VARCHAR(64) NULL,
  tarefa VARCHAR(500) NULL,
  resp_planejamento VARCHAR(255) NULL,
  responsavel_encarregado VARCHAR(255) NULL,
  supervisor_coordenador VARCHAR(255) NULL,
  sincronizado_em DATETIME NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY eap_cards_ativos_id_obra_idx (id_obra),
  CONSTRAINT eap_cards_ativos_id_obra_fk FOREIGN KEY (id_obra) REFERENCES obras (id),
  CONSTRAINT eap_cards_ativos_card_id_fk FOREIGN KEY (card_id) REFERENCES eap_tarefas (id)
);

-- "1 linha por card por dia. Guarda histórico" (igual ao Supabase) — `id`
-- aqui é técnico (auto-increment), a chave de dedupe real é
-- (tarefa_id, data_do_input), igual à convenção já usada em
-- `med_boletins` (cp_codigo, linha_planilha).
CREATE TABLE IF NOT EXISTS eap_apontamentos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tarefa_id BIGINT NOT NULL,
  id_eap_grupo BIGINT NULL,
  nome_eap VARCHAR(500) NULL,
  nome_obra VARCHAR(255) NULL,
  data_do_input DATE NOT NULL,
  edt VARCHAR(64) NULL,
  tarefa VARCHAR(500) NULL,
  qtd DECIMAL(18,4) NULL,
  unidade VARCHAR(32) NULL,
  avanco_atual DECIMAL(9,4) NULL,
  avanco_atual_p100 DECIMAL(9,4) NULL,
  avanco_diario DECIMAL(9,4) NULL,
  usuario_avanco_diario VARCHAR(32) NULL,
  uuid_origem CHAR(36) NULL,
  meta_diaria DECIMAL(9,4) NULL,
  status_qualidade VARCHAR(64) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY eap_apontamentos_tarefa_data_uk (tarefa_id, data_do_input),
  CONSTRAINT eap_apontamentos_tarefa_id_fk FOREIGN KEY (tarefa_id) REFERENCES eap_tarefas (id)
);
