-- Índice financeiro por tarefa ("Performance" na tela de Encarregados).
-- Espelha `medicao_acumulada` do Supabase, que a view
-- `v_indices_financeiros_diario` lia junto com `tarefas`.
--
-- POR QUE continua havendo ingestão (decidido 21/09/2026, com medição):
-- a origem (`avancos_api/v1/receita_custos`) responde em ~10s para EAP
-- pequena, mas leva **73 a 96 segundos** para a `id_eap` 51 (obra 91, 54-60
-- tarefas) — medido em 3 janelas diferentes, de 1 a 180 dias, e o tempo NÃO
-- depende da janela. Consulta direta na hora do carregamento da tela, como foi
-- feito para Cards Ativos e Restrições, não se sustenta nesse tempo. Então
-- aqui o padrão volta a ser ingestão: o fluxo n8n paga a espera de madrugada e
-- a tela lê daqui.
--
-- `id_eap` entra como COLUNA, não como JOIN: no Supabase ele vinha de
-- `tarefas`, e trazer a tabela `tarefas` inteira só para resolver esse de-para
-- seria carregar um domínio que ninguém mais consome. A API de origem já
-- devolve o `id_eap` no envelope da resposta.

CREATE TABLE IF NOT EXISTS fin_medicao_acumulada (
  data_referencia date NOT NULL,
  tarefa_id bigint NOT NULL,
  id_eap bigint DEFAULT NULL,
  -- (18,2) cobre com folga: o maior valor visto na base e' 8.059.052,85
  receita decimal(18,2) DEFAULT NULL,
  custo_incorrido decimal(18,2) DEFAULT NULL,
  custo_projetado decimal(18,2) DEFAULT NULL,
  -- percentual 0..100 na origem
  avanco_total decimal(9,4) DEFAULT NULL,
  efetivo_total decimal(12,2) DEFAULT NULL,
  custo_incorrido_acima_projetado tinyint(1) DEFAULT NULL,

  -- A conta que a view fazia em SQL, agora como coluna gerada — assim ela
  -- mora num lugar só, como antes, em vez de ser reescrita em cada leitor.
  -- O NULLIF é o que impede custo zero de virar Infinity e pintar a tela de
  -- verde: sem custo, o índice é INDEFINIDO, não infinito.
  indice_receita_custo_incorrido double
    GENERATED ALWAYS AS (receita * (avanco_total / 100.0) / NULLIF(custo_incorrido, 0)) STORED,
  sem_custo tinyint(1)
    GENERATED ALWAYS AS (custo_incorrido IS NULL OR custo_incorrido = 0) STORED,

  criado_em datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- Mesma chave do upsert que alimentava `medicao_acumulada`.
  PRIMARY KEY (data_referencia, tarefa_id),
  -- A leitura da tela é sempre "as tarefas desta EAP neste dia".
  KEY fin_med_acum_eap_data_idx (id_eap, data_referencia),
  KEY fin_med_acum_tarefa_data_idx (tarefa_id, data_referencia)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
