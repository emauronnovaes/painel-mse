-- Segundo lote de cadastros do nível "financeiro por obra" (pedido 09/09/2026).
-- Aplicada em 09/09/2026 como `acesso_financeiro_por_obra_lote_09_09`.
--
-- Uma linha por (pessoa, obra): quem tem mais de um contrato ganha mais de uma
-- linha. O índice único é `(email, coalesce(obra_id,-1))`, então o mesmo e-mail
-- repete à vontade desde que a obra mude.
insert into public.acesso_total (email, obra_id, nota) values
  (lower('marcelo.pereira@mse.com.br'),      94, 'CP002 / Porto Itapoá - lote 09/09/2026'),
  (lower('jose.borges@mse.com.br'),          94, 'CP002 / Porto Itapoá - lote 09/09/2026'),

  (lower('guilherme.andrade@mse.com.br'),    91, 'CP236 / Novo Nordisk - UB/SP - lote 09/09/2026'),
  (lower('guilherme.andrade@mse.com.br'),   108, 'CP261 / Novo Nordisk - AP - Reforço - lote 09/09/2026'),
  (lower('guilherme.andrade@mse.com.br'),   107, 'CP273 / Novo Nordisk - AP - lote 09/09/2026'),

  (lower('renan.justino@mse.com.br'),       108, 'CP261 / Novo Nordisk - AP - Reforço - lote 09/09/2026'),
  (lower('renan.justino@mse.com.br'),       107, 'CP273 / Novo Nordisk - AP - lote 09/09/2026'),

  (lower('carlos.viruez@mse.com.br'),        91, 'CP236 / Novo Nordisk - UB/SP - lote 09/09/2026'),

  (lower('douglas.ribeiro@mse.com.br'),     106, 'CP029 / CNPEM - Faseado - lote 09/09/2026'),

  (lower('ricardo.filho@mse.com.br'),       106, 'CP029 / CNPEM - Faseado - lote 09/09/2026'),
  (lower('ricardo.filho@mse.com.br'),       110, 'CP022 / Hitachi - lote 09/09/2026'),

  -- ⚠️ IPEN não tem contrato CP em `obra_chaves` nem uma linha sequer em
  -- boletins_medicao / nfs / orcamentos_complementares_obra. O acesso é válido e
  -- fica pronto para quando a obra tiver financeiro, mas HOJE as abas aparecem
  -- vazias para ele — que é o modo de falha do ADR-005. Quando o IPEN ganhar CP,
  -- é obrigatório inserir (114,'cp','<código>') em obra_chaves, senão o acesso
  -- continua sem efeito nas tabelas de Medições.
  (lower('leonardo.bernardino@mse.com.br'), 114, 'IPEN - lote 09/09/2026 - obra ainda sem CP nem dado financeiro');

-- Verificado em 09/09/2026 com `set local role authenticated` dentro de
-- begin/rollback (sem isso a conexão administrativa roda como postgres e ignora
-- RLS — a checagem dá "tudo liberado" e parece sucesso):
--
--   guilherme.andrade -> obras [91,107,108], CPs CP236,CP261,CP273,
--                        98 boletins, 0 de vazamento, OCs das 3 obras.
--   leonardo.bernardino -> obra [114], CPs NULL, 0 boletins / 0 nfs / 0 OCs,
--                        mas `mse_financeiro_obra(114)` = true, ou seja as abas
--                        APARECEM vazias. Ver aviso acima.
