-- Já existe em produção (Actions); faltava o schema para novos ambientes.
CREATE TABLE IF NOT EXISTS eap_apontamento_efetivo (
  data_consulta DATE NOT NULL,
  tarefa_id BIGINT NOT NULL,
  funcionario_id BIGINT NOT NULL,
  id_eap BIGINT NULL,
  nome_eap VARCHAR(120) NULL,
  id_obra BIGINT NULL,
  nome_obra VARCHAR(120) NULL,
  edt VARCHAR(60) NULL,
  tarefa_nome VARCHAR(255) NULL,
  funcionario_nome VARCHAR(120) NULL,
  nome_funcao VARCHAR(80) NULL,
  empresa VARCHAR(120) NULL,
  tabela_origem VARCHAR(40) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (data_consulta, tarefa_id, funcionario_id),
  KEY eap_alocacao_tarefa_idx (tarefa_id, data_consulta),
  KEY eap_alocacao_eap_idx (id_eap)
);
