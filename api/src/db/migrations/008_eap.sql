-- Avanço físico / EAP. Espelha as tabelas `EAP` e `Apontamentos` do
-- Supabase (schema e chaves conferidos ao vivo via SQL em 2026-09-18),
-- porque nesta fase os DOIS bancos são alimentados em paralelo: o painel
-- continua lendo o Supabase, e o MySQL vai acumulando o mesmo dado até o
-- consumo migrar.
--
-- Fidelidade proposital ao original, mesmo onde o tipo parece "errado":
-- as datas (`data_inicio`, `data_termino`, `data_do_input`, ...) são TEXT
-- no Supabase, não DATE, e a origem manda coisas como "0000-00-00". Se
-- virassem DATE aqui, esses valores quebrariam o INSERT em SQL strict
-- mode; como VARCHAR, o espelho é 1:1 e a decisão de normalizar fica pra
-- quando o consumo migrar. Mesma lógica em `qtd`/`avanco_atual` de
-- `eap_apontamentos` (TEXT na origem) vs. `eap_tarefas` (double).
--
-- SEM foreign key pra `obras` de propósito: `id_eap=66` é da obra 103
-- (CNPEM - Auditório), que existe no Supabase mas nunca entrou no array
-- OBRAS do painel (nem na tabela `obras` daqui) — uma FK rejeitaria essa
-- linha e quebraria a sincronização inteira do grupo.

CREATE TABLE IF NOT EXISTS eap_tarefas (
  id BIGINT NOT NULL PRIMARY KEY,
  id_obra BIGINT NULL,
  nome_obra VARCHAR(255) NULL,
  id_eap INT NULL,
  edt VARCHAR(64) NULL,
  tarefa VARCHAR(512) NULL,
  disciplina VARCHAR(255) NULL,
  `local` VARCHAR(255) NULL,
  unidade VARCHAR(64) NULL,
  qtd DOUBLE NULL,
  saldo_qtd DOUBLE NULL,
  efetivo_previsto VARCHAR(64) NULL,
  ponderacao_reais DOUBLE NULL,
  ponderacao_hht DOUBLE NULL,
  avanco_atual DOUBLE NULL,
  desvio DOUBLE NULL,
  data_inicio VARCHAR(32) NULL,
  data_termino VARCHAR(32) NULL,
  data_inicio_reprogramado VARCHAR(32) NULL,
  data_termino_reprogramado VARCHAR(32) NULL,
  meta_diaria DOUBLE NULL,
  avanco_diario DOUBLE NULL,
  encarregado_nome VARCHAR(255) NULL,
  status_qualidade VARCHAR(64) NULL,
  hht_consumido DOUBLE NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY eap_tarefas_id_obra_idx (id_obra),
  KEY eap_tarefas_id_eap_idx (id_eap)
);

-- 1 linha por tarefa por dia. A PK aqui é a chave LÓGICA
-- (id, data_do_input) — que no Supabase é uma UNIQUE
-- (`apontamentos_id_data_do_input_unique`) — e não o uuid: lá o "UUID" é
-- PK mas tem `DEFAULT gen_random_uuid()`, ou seja, quem gera é o próprio
-- Postgres, a API de origem não manda esse campo. Replicar o uuid como PK
-- aqui exigiria inventar um valor diferente do que o Supabase gerou pra
-- mesma linha. A coluna fica como `uuid NULL` só pra receber o valor do
-- Supabase se um dia o histórico for migrado (rastreabilidade), sem
-- participar de chave nenhuma.
CREATE TABLE IF NOT EXISTS eap_apontamentos (
  id BIGINT NOT NULL,
  id_eap BIGINT NULL,
  nome_eap VARCHAR(512) NULL,
  nome_obra VARCHAR(255) NULL,
  data_do_input VARCHAR(32) NOT NULL,
  edt VARCHAR(64) NULL,
  tarefa VARCHAR(512) NULL,
  qtd VARCHAR(64) NULL,
  unidade VARCHAR(64) NULL,
  avanco_atual VARCHAR(64) NULL,
  avanco_atual_p100 DOUBLE NULL,
  avanco_diario DOUBLE NULL,
  usuario_avanco_diario VARCHAR(64) NULL,
  meta_diaria DOUBLE NULL,
  status_qualidade VARCHAR(64) NULL,
  uuid CHAR(36) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id, data_do_input),
  KEY eap_apontamentos_id_eap_idx (id_eap)
);
