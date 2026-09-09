-- Guardas para edição À MÃO de `acesso_total`.
-- Aplicada em 09/09/2026 como `acesso_total_guardas_de_edicao_manual`.
--
-- ✅ O TABLE EDITOR FUNCIONA para esta tabela. Um comentário anterior meu dizia
-- o contrário, e estava errado: o GRANT foi revogado de `anon` e
-- `authenticated`, mas o dashboard conecta como `postgres`, que tem grants
-- completos e `rolbypassrls = true`. Incluir gente é só adicionar linha.
--
-- Daí estes guardas. A lista é mantida por pessoa, digitando, e as duas formas
-- de errar falham em SILÊNCIO — a pessoa simplesmente não vê Medições, sem
-- erro no console, sem log, sem nada apontando a causa:
--
--   1. E-mail com maiúscula ou espaço. `mse_acesso_total()` compara com
--      `lower(auth.jwt() ->> 'email')`; valor não normalizado nunca casa.
--   2. `obra_id` inexistente (dígito trocado). Acesso a uma obra que não existe
--      é o mesmo que acesso a nada.
--
-- O e-mail é CORRIGIDO em vez de recusado: quem digita no Table Editor não
-- merece um erro por escrever "Fulano@MSE.com.br". O obra_id é RECUSADO, porque
-- não há como adivinhar qual obra a pessoa queria — e a mensagem lista as
-- válidas.
create or replace function public.acesso_total_normaliza()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(trim(new.email));

  if new.obra_id is not null
     and not exists (select 1 from public.obra_chaves o
                      where o.tipo = 'nome' and o.obra_id = new.obra_id) then
    raise exception
      'obra_id % nao existe. Obras validas: %',
      new.obra_id,
      (select string_agg(o.obra_id || ' (' || o.chave || ')', ', ' order by o.obra_id)
         from public.obra_chaves o where o.tipo = 'nome');
  end if;

  return new;
end;
$$;

create trigger acesso_total_normaliza_trg
  before insert or update on public.acesso_total
  for each row execute function public.acesso_total_normaliza();

comment on trigger acesso_total_normaliza_trg on public.acesso_total is
  'Normaliza o e-mail e recusa obra_id inexistente. Existe porque as duas '
  'coisas falhavam em silencio: a pessoa so nao via Medicoes, sem erro nenhum.';

-- Verificado em 09/09/2026:
--   '  Teste.Maiuscula@MSE.com.BR  ' -> gravado como 'teste.maiuscula@mse.com.br'
--   obra_id 999 -> ERRO listando as 7 obras validas
