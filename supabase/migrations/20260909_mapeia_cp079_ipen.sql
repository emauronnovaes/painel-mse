-- CP079 é o contrato do IPEN (obra 114), confirmado pelo usuário em 09/09/2026 e
-- batido contra `contratos_medicao.contrato_nome` = 'Ipen'.
-- Aplicada em 09/09/2026 como `mapeia_cp079_para_ipen`.
--
-- A fatia A deixou CP079 fora do mapa por engano de leitura: como a obra 114 não
-- aparecia em nenhuma convenção textual conhecida (curvas_s, vw_dados_tv,
-- pts_emitidas, suprimentos), tratei o código como "contrato de outra frente".
--
-- Consequência real, não teórica: `leonardo.bernardino` recebeu acesso à obra 114
-- e via Medições VAZIA. Os 10 boletins existiam e eram recusados pelo RLS,
-- porque `mse_cps_financeiro()` não devolvia CP079. E o diagnóstico que escrevi
-- na época ("obra sem dado financeiro") estava errado — conferi as tabelas pelo
-- id_obra, que as financeiras não têm, em vez de procurar o contrato pelo nome.
insert into public.obra_chaves (obra_id, tipo, chave, nota) values
  (114, 'cp', 'CP079', 'contrato do IPEN - mapeado em 09/09/2026');

update public.acesso_total
   set nota = 'CP079 / IPEN - lote 09/09/2026'
 where email = 'leonardo.bernardino@mse.com.br' and obra_id = 114;

-- Verificado com `set local role authenticated` dentro de begin/rollback:
--   leonardo.bernardino -> CPs [CP079], 10 boletins, 1 contrato, 1 nf,
--                          0 de vazamento.
