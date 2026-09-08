# Integração com o Portal MSE — painel como superapp

O painel vai ser embutido num app PHP em `portalmse.com.br`, que autentica o
usuário e envia identidade **e um papel (role)** ao painel.

Este documento é o **contrato**: o que o portal precisa entregar, em que forma, e
por quê. Quem implementa o lado PHP deve conseguir ler só este arquivo. Existe
porque, em 08/09/2026, o transporte da identidade ainda não estava definido —
e adivinhar aqui produziria uma integração insegura de um jeito difícil de
perceber depois.

Contexto de decisão: [[06 - Decisões de Arquitetura]] (ADR-007) e
[[14 - Plano ADR-007]].

## 1. A regra que não é negociável

**O papel não pode chegar como dado que o navegador repassa.**

Se o portal enviar `?role=diretor` na URL do iframe, por `postMessage`, ou num
cabeçalho que o JavaScript do painel reenvia, então **o navegador pode alterar o
valor**. Qualquer pessoa abre o DevTools, troca para `diretor` e passa a ver o
financeiro.

Isso é exatamente o antipadrão que o ADR-007 existe para eliminar — a mesma
classe da `SENHA_CLIENTE='admin'` e do `1234` que o dashboard antigo tem no HTML
servido (ver [[05 - Herança do Dashboard Atual]]). Serve para esconder botão,
não para proteger informação.

O papel tem que chegar **dentro de algo que o banco de dados verifica sozinho**.

### Por que não basta o painel "confiar" no portal

O painel roda no navegador do usuário. Tudo que ele recebe, o usuário também
recebe e pode modificar antes de reenviar. O único lugar onde a decisão de acesso
tem valor é **no servidor que guarda o dado** — no caso, o Postgres do Supabase,
via RLS. Qualquer verificação feita apenas no JavaScript do painel é decoração.

## 1b. Atalho que dispensa o portal — lista de e-mails

Proposto pelo usuário em 08/09/2026: **uma lista de e-mails com acesso total; os
demais, acesso restrito.** É mais simples que papel vindo do portal, e melhor por
um motivo estrutural: **o e-mail já está dentro do JWT assinado pelo Supabase**.

Consequências:

- Não precisa de papel em trânsito, nem de Custom Access Token Hook, nem de
  tabela que o PHP mantenha, nem de contrato acordado com quem constrói o portal.
- A propriedade de segurança da seção 1 sai de graça: o cliente não altera o
  e-mail sem invalidar a assinatura.
- **Funciona antes de o portal existir**, com o login Google já implementado.

```sql
create table public.acesso_total (
  email text primary key,
  nota  text,
  criado_em timestamptz default now()
);

create function public.mse_acesso_total() returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.acesso_total
                  where email = lower(auth.jwt() ->> 'email'))
$$;
```

Manter a lista é `insert`/`delete` numa tabela — sem migração e sem deploy.

Funciona bem porque o financeiro está isolado em **tabelas próprias**, e RLS
restringe tabela inteira nativamente. O limite conhecido é `itens_rmi`, que guarda
tudo num `raw` JSON com valor dentro: ali não há recorte por coluna (ver seção 4).

Quando o portal entrar, esta abordagem continua válida — e se houver papéis mais
finos que "total vs restrito", aí sim vale o hook da seção 3.

## 2. O caminho recomendado (se o papel vier do portal)

**O portal PHP cria uma sessão real do Supabase e entrega o access token ao
painel.**

Fluxo:

1. Usuário faz login no portal (como já faz hoje).
2. O PHP, **no servidor**, chama a Admin API do Supabase usando a `service_role`
   — nunca no navegador — para obter uma sessão para aquele usuário.
3. O PHP entrega ao painel o `access_token` e o `refresh_token` resultantes.
4. O painel injeta a sessão no `MSEAuth` em vez de mostrar tela de login.
5. Toda leitura já sai com esse token no `Authorization`, e o RLS decide.

**Por que este caminho:** o token é emitido e assinado pelo **próprio Supabase**.
O painel não precisa ser confiável, o navegador não precisa ser confiável, e o
papel viaja numa claim que o cliente não consegue alterar sem invalidar a
assinatura.

O que o portal precisa ter:
- a `service_role` do projeto `gebjlhkywtnpfqjrakok`, guardada **no servidor**
  (variável de ambiente ou cofre; nunca em código, nunca em página);
- o e-mail do usuário, para casar com `auth.users`.

## 3. Onde o papel vive, e como entra no token

Padrão suportado do Supabase (`Custom Claims & RBAC`), e é o que resolve a regra
da seção 1:

**a) Uma tabela é a fonte da verdade.** O papel não fica em `user_metadata`, que
o próprio usuário consegue editar via API de auth. Fica numa tabela que só
`service_role` escreve:

```sql
create table public.usuario_papel (
  user_id uuid primary key references auth.users on delete cascade,
  papel   text not null,          -- ex.: 'diretor', 'engenharia', 'suprimentos'
  atualizado_em timestamptz default now()
);
```

Se a restrição for por obra (ver seção 4), some-se:

```sql
create table public.usuario_obra (
  user_id  uuid references auth.users on delete cascade,
  id_obra  int  not null,
  primary key (user_id, id_obra)
);
```

**b) Um Custom Access Token Hook injeta a claim na emissão do token**, do lado do
servidor, antes de o token existir:

```sql
-- roda no Supabase a cada emissão de token
select papel into v_papel from public.usuario_papel
 where user_id = (event->>'user_id')::uuid;
claims := jsonb_set(claims, '{mse_papel}', to_jsonb(coalesce(v_papel, 'nenhum')));
```

**c) O RLS lê a claim:**

```sql
using ( (select auth.jwt() ->> 'mse_papel') = 'diretor' )
```

O portal, então, **não envia papel nenhum ao painel**. Ele mantém a tabela
`usuario_papel` atualizada (por `service_role`, no servidor) e o papel aparece
sozinho no token. Isso elimina a classe inteira de problema: não há valor em
trânsito para o cliente falsificar.

## 4. Linha ou coluna — muda o tamanho do trabalho

"Restringir determinadas informações" tem duas leituras, com custos bem
diferentes:

**Linhas — quais obras cada pessoa vê.** RLS resolve nativamente:

```sql
using ( id_obra in (select id_obra from public.usuario_obra where user_id = auth.uid()) )
```

**Colunas — esconder valores de quem não é diretor.** **RLS é row-level, não
column-level.** Não existe policy que devolva a linha sem uma coluna. As saídas
são: uma view por papel, `GRANT SELECT (lista de colunas)`, ou colunas ausentes
de uma view. Qualquer uma exige mexer também no front-end, que hoje pede
`select=*` em vários lugares.

### Levantamento do que é sensível hoje

Colunas com valor financeiro, por tabela (medidas em 08/09/2026):

| Tabela | Telas | Colunas sensíveis |
|---|---|---|
| `nfs` | Medições | `valor`, `nf`, `empresa` |
| `proximos_faturamentos` | Medições | `valor_previsto`, `data_prevista` |
| `boletins_medicao` | Medições | `valor_previsto`, `valor_medido`, `valor_faturado`, `retencao`, `iss_valor`, `desconto_adiantamento`, `valor_recebimento_previsto`, `valor_recebimento_real`, `saldo_*` |
| `contratos_medicao` | Medições | `valor_contrato`, `valor_ocs`, `valor_total`, `gestor` |
| `orcamentos_complementares_obra` | OC/CO | `total`, `ocs` |
| `v_indices_financeiros_diario` | Encarregados, Curva S | `receita`, `custo_incorrido`, `indice_receita_custo_incorrido` |
| `pedidos_suprimentos` | Suprimentos | `valor`, `valor_liquido`, `desconto`, `frete`, `fornecedor`, `fornecedor_cnpj` |
| `itens_rmi` | Suprimentos | tudo dentro de `raw` (JSON) — **inclui valor**, então é indivisível por coluna |

Duas observações que afetam a decisão:

- **`itens_rmi` guarda tudo num `raw` JSON.** Não há como esconder "só o valor"
  por coluna: ou a linha vem, ou não vem. Restringir valor em Suprimentos exigiria
  uma view que reconstrói o JSON sem os campos de valor.
- **A tela de Medições é quase inteira financeira.** Para um papel sem acesso a
  valor, provavelmente a decisão certa é esconder o setor todo, não campos dele.

E há dado pessoal, que merece papel próprio: `vw_efetivo_diario_pessoas` e
`efetivo_diario_raw` (projeto Efetivo) devolvem **nome e função de colaborador**.

## 5. O que precisa ser decidido antes de implementar

1. **Como o portal entrega a identidade** — seção 2 é a recomendação; se o
   portal não puder chamar a Admin API, muda todo o desenho (ver seção 6).
2. **Quais papéis existem** e o que cada um vê. Sem essa matriz não há RLS a
   escrever.
3. **Linha, coluna, ou as duas** (seção 4).
4. **Como o painel é embutido** — `<iframe>` ou mesma página? Iframe exige
   liberar o domínio do portal em `frame-ancestors`, e o `localStorage` do
   painel passa a ser terceiro-parte, o que alguns navegadores bloqueiam.
5. **O painel continua acessível fora do portal?** Se sim, a tela de login com
   Google (já implementada) permanece como caminho alternativo. Se não, ela sai.

## 6. Alternativas, se a seção 2 não for possível

**Portal assina o próprio JWT.** Só funciona se o Supabase puder verificar a
assinatura, e o third-party auth dele aceita apenas Clerk, Firebase Auth, Auth0 e
WorkOS — um emissor PHP próprio não entra. Exigiria uma Edge Function como ponte,
validando o token do portal e lendo o banco com `service_role`. Custo: o RLS
deixa de ser o ponto de controle, e toda leitura passa a depender de código
nosso estar correto, em vez de o banco recusar por padrão.

**Sessão opaca do portal.** O painel recebe um identificador que só o PHP sabe
validar. O banco não verifica nada sozinho: cada leitura teria que passar por uma
Edge Function que consulta o portal a cada requisição. É a opção mais lenta e a
que mais concentra risco em código próprio.

## 7. O que já está pronto e continua valendo

Independente do transporte escolhido:

- `prototipo/lib/auth.js` centraliza a montagem dos headers dos 25 sítios de
  leitura. Injetar uma sessão vinda do portal é trocar a origem da sessão dentro
  desse módulo — não mexer em 25 lugares.
- As policies `mse_select_authenticated` já existem nas 22 relações, com
  predicado de domínio. Somar um predicado de papel é acrescentar condição, não
  reescrever.
- `public.mse_email_do_dominio()` isola a regra de domínio num lugar só; a de
  papel deve seguir o mesmo formato.
- A escrita anônima já está fechada nas tabelas que ninguém legítimo escrevia.
- A Edge Function `efetivo` já resolve a fronteira do segundo projeto Supabase e
  valida sessão + domínio — o padrão de ponte, se for preciso outra.
