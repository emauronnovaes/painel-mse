-- Acesso geral e livre para rafael@mse.com.br (pedido 09/09/2026).
-- Aplicada em 09/09/2026 como `acesso_total_rafael`.
--
-- `obra_id` NULL é o que significa "financeiro de todas as obras" — o mesmo que
-- as 7 linhas do nível 1 já usam. NÃO confundir com ausência de linha, que é o
-- oposto (nenhum financeiro).
insert into public.acesso_total (email, obra_id, nota) values
  (lower('rafael@mse.com.br'), null, 'acesso geral e livre - pedido 09/09/2026');

-- Verificado com `set local role authenticated` dentro de begin/rollback:
--   mse_acesso_total() = true, obras [91,94,106,107,108,110,114],
--   461 nfs / 184 boletins / 8 contratos / 7 OCs — a base inteira.
