-- Anti-replay do SSO do Portal (ver docs/15, seção 1d).
-- Aplicada em 09/09/2026 como `sso_nonce_para_edge_function`.
--
-- O `planejamento_dash` guarda o nonce em arquivo no /tmp do Flask; Edge
-- Function é stateless e roda em várias instâncias, então o único lugar que
-- serve é o banco.
--
-- A PK é o próprio nonce: o INSERT falhando com 23505 É a detecção de replay.
-- Não há SELECT-then-INSERT, que teria corrida entre duas requisições
-- simultâneas com o mesmo token.
create table public.sso_nonce (
  nonce     text primary key,
  criado_em timestamptz not null default now()
);

comment on table public.sso_nonce is
  'Nonces de SSO já consumidos. Insert conflitante = replay. Limpeza por idade '
  'na própria Edge Function; nada aqui precisa ser lido pelo painel.';

create index sso_nonce_criado_em_idx on public.sso_nonce (criado_em);

-- Ninguém além da service_role toca nisto. `anon` conseguir LER seria entregar
-- a lista de nonces válidos recém-usados; conseguir ESCREVER seria poder
-- queimar um nonce antes do portal, negando o login de alguém.
alter table public.sso_nonce enable row level security;
revoke all on public.sso_nonce from anon, authenticated;
