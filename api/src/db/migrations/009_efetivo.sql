-- Efetivo diário. Origem: `hub_mse/api_efetivo` (fluxo n8n
-- `Efetivo API - Efetivo diário`), que grava aqui e, em paralelo, nas
-- tabelas `efetivo_diario_raw` / `efetivo_resumo_diario` do Supabase do
-- projeto Efetivo (`wnldmumgjwujveeimyef` — NÃO o principal). O painel
-- ainda lê o Supabase; o MySQL vai acumulando o mesmo dado até o
-- consumo migrar.
--
-- Colunas renomeadas em relação ao Supabase: `obra_id` vira `id_obra`
-- (ADR-004 / doc 16). Renomear no Supabase quebraria as 5 leituras do
-- front, então a tradução fica no node de montagem do n8n.
--
-- Tipos apertados de propósito (DATE de verdade, INT nos contadores),
-- diferente do espelho 1:1 de `008_eap.sql`: esta origem é JSON tipado,
-- não texto do Supabase — em amostra real de 21 obras / 1 547 pessoas
-- (2026-09-18) nenhum campo veio nulo, `data_admissao` sempre
-- `YYYY-MM-DD` e os contadores sempre inteiros.
--
-- SEM foreign key pra `obras` de propósito, mesma razão de `008_eap.sql`:
-- a API devolve 21 obras (SEDE, AFASTADOS, LMS, DTE...) e a const OBRAS
-- do fluxo pode ser aberta pra todas; uma FK derrubaria a carga inteira.

CREATE TABLE IF NOT EXISTS efet_diario (
  data_efetivo_diario date NOT NULL,
  id_obra bigint NOT NULL,
  id_funcionario bigint NOT NULL,
  -- id_empresa entra na chave porque é assim no Supabase de origem: a
  -- mesma pessoa pode aparecer por duas contratantes no mesmo dia.
  id_empresa bigint NOT NULL,
  nome_obra varchar(120) DEFAULT NULL,
  nome varchar(120) DEFAULT NULL,
  tipo_funcionario varchar(40) DEFAULT NULL,
  moi_mod varchar(20) DEFAULT NULL,
  id_funcao bigint DEFAULT NULL,
  nome_funcao varchar(120) DEFAULT NULL,
  razao_social varchar(120) DEFAULT NULL,
  data_admissao date DEFAULT NULL,
  -- 'Presente D', 'Ausente', 'Sede', 'Mobilização', 'Sem atividade'
  situacao varchar(40) DEFAULT NULL,
  observacao text,
  criado_em datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (data_efetivo_diario, id_obra, id_funcionario, id_empresa),
  KEY efet_diario_obra_data_idx (id_obra, data_efetivo_diario),
  KEY efet_diario_funcionario_data_idx (id_funcionario, data_efetivo_diario),
  KEY efet_diario_situacao_idx (situacao),
  KEY efet_diario_data_idx (data_efetivo_diario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Agregado por obra/dia que a própria API já devolve pronto (bloco
-- `resumo`). Guardado como veio, sem recalcular a partir de efet_diario:
-- se um dia os dois divergirem, a divergência é informação.
CREATE TABLE IF NOT EXISTS efet_resumo_diario (
  data_efetivo_diario date NOT NULL,
  id_obra bigint NOT NULL,
  nome_obra varchar(120) DEFAULT NULL,
  is_hoje tinyint(1) DEFAULT NULL,
  fonte varchar(60) DEFAULT NULL,
  -- total_obra = `obras[].total`; total = `obras[].resumo.total`. Vêm
  -- iguais hoje, mas são campos distintos na origem.
  total_obra int DEFAULT NULL,
  total int DEFAULT NULL,
  presentes int DEFAULT NULL,
  presentes_d int DEFAULT NULL,
  presentes_int int DEFAULT NULL,
  presentes_n int DEFAULT NULL,
  ausentes int DEFAULT NULL,
  mobilizacao int DEFAULT NULL,
  sede int DEFAULT NULL,
  sem_atividade int DEFAULT NULL,
  outros int DEFAULT NULL,
  criado_em datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (data_efetivo_diario, id_obra),
  KEY efet_resumo_obra_data_idx (id_obra, data_efetivo_diario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
