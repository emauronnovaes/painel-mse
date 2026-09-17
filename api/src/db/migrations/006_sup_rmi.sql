-- Etapa 2 — Suprimentos, RMI (Requisição de Material e Insumo). Espelha
-- `itens_rmi` (schema conferido ao vivo, 17/09/2026): schema enxuto, sem
-- coluna por campo (mesmo padrão de `oc_orcamentos`/`rest_restricoes`) —
-- `id` é o PRÓPRIO id do item na origem (API do PortalMSE, `rmi_api`), não
-- auto-incremento. Ingestão passa a ser feita DIRETO por um script Node
-- (`api/scripts/sync-rmi.js`), não mais via n8n — o motor de workflow do
-- n8n não estava dando conta do volume (obra 94/Porto Itapoá, a maior,
-- ~8 mil itens só nessa tabela).

-- Índice em coluna própria (não `CREATE INDEX` solto): o runner de
-- migrations (`migrate.js`) reaplica TODOS os arquivos a cada boot da API
-- agora (idempotente via `CREATE TABLE IF NOT EXISTS`) — um `CREATE INDEX`
-- fora da tabela quebraria na 2ª execução ("Duplicate key name"), travando
-- o boot pra sempre. Mesmo motivo pelo qual as migrations anteriores só
-- usam `KEY`/`UNIQUE KEY` inline.
CREATE TABLE IF NOT EXISTS sup_rmi (
  id BIGINT NOT NULL PRIMARY KEY,
  id_obra BIGINT UNSIGNED NOT NULL,
  raw JSON NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY sup_rmi_id_obra_idx (id_obra),
  CONSTRAINT sup_rmi_id_obra_fk FOREIGN KEY (id_obra) REFERENCES obras (id)
);
