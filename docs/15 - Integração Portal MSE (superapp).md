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

## 1c. Terceiro nível — financeiro por obra

Pedido em 09/09/2026. Um nível intermediário entre "vê tudo" e "não vê
financeiro nenhum": **vê Medições e OC/CO SÓ da sua obra.**

| Nível | Como se cadastra | Obras no seletor | Medições / OC-CO |
|---|---|---|---|
| Vê tudo | linha em `acesso_total` com `obra_id` **NULL** | todas as 7 | todas |
| Por obra *(novo)* | linha em `acesso_total` com `obra_id` **preenchido** | todas as 7 | só as obras listadas |
| Restrito *(padrão)* | sem linha nenhuma | todas as 7 | nenhuma |

⚠️ **O recorte é só do financeiro.** A lista de obras do seletor continua
inteira para todo mundo — decisão explícita do usuário: *"não vai restringir o
acesso geral das obras"*. Uma versão anterior deste desenho tinha uma segunda
dimensão (`acesso_obra`, que escondia obras do seletor); foi removida por não
ter consumidor, e está no histórico do git se algum dia voltar.

A migração é **inerte** por construção: `add column obra_id` entra nulável,
então as linhas existentes de `acesso_total` ganham NULL — que é exatamente o
que elas já significavam. Ninguém ganha nem perde acesso ao aplicar.

### O bloqueio que precisou ser resolvido primeiro

**O banco não sabia o que é uma obra.** A identidade da obra aparecia em 5
formatos de coluna (`id_obra` int, `obra_id` int, `obra` texto-nome, `obra`
texto-CP, `obra` texto-CP+nome) e 4+ convenções de nome, e o único lugar que
amarrava tudo era `panel-config.js`.

Para o financeiro isso é concreto: as 5 tabelas financeiras **não têm coluna de
obra nenhuma**. Chegam lá por dois caminhos indiretos:

- `cp_codigo` (`contratos_medicao`, `boletins_medicao`) e `obra` (`nfs`,
  `proximos_faturamentos`) — tudo código de contrato, daí
  `public.obra_chaves (obra_id, tipo, chave)` com `tipo='cp'`;
- `medicao_acumulada.tarefa_id → tarefas.id_eap → EAP.id_obra` — verificado
  limpo: 14 pares `id_eap→id_obra`, zero ambiguidade, 558/558 tarefas mapeadas.

`orcamentos_complementares_obra` é a exceção boa: já tem `id_obra`.

A PK `(tipo, chave)` de `obra_chaves` é a invariante: uma chave resolve para no
máximo UMA obra. Chave ambígua falha no insert em vez de a RLS entregar dado da
obra errada.

⚠️ **Fora do mapa, e a fatia D precisa decidir:** `nfs.obra` tem 40 códigos CP e
só 6 são obras do painel (o resto é contrato de outra frente); `CP040` é a obra
103 (CNPEM - Auditório), real na base mas nunca em `OBRAS`; `CP079` idem.
`mse_cps_financeiro()` não devolve essas chaves, então só quem tem acesso
GLOBAL as vê — quem tem recorte por obra, não.

### Fatias

| | O quê | Estado |
|---|---|---|
| **A** | Mapa de obras + `acesso_total.obra_id` + funções + UI por obra | ✅ aplicada em 09/09/2026 |
| **D** | RLS por obra nas 5 tabelas financeiras + `v_indices_financeiros_diario` | ✅ aplicada e verificada em 09/09/2026 |

#### Duas armadilhas resolvidas na fatia D

**1. Policy não lê `obra_chaves`.** A expressão de uma policy roda com as
permissões de quem consulta, e o GRANT do mapa foi revogado de propósito. Uma
policy que lesse a tabela direto devolveria vazio para todo mundo — esconderia
o financeiro até de quem tem acesso. Daí `mse_cps_financeiro()`, SECURITY
DEFINER, que devolve só os CPs deste e-mail. Como é set-returning e sem
parâmetro, o `in (select ...)` vira InitPlan avaliado uma vez por consulta.

**2. O ramo `mse_acesso_total()` nas policies não é redundante.** As tabelas têm
linhas cujo contrato não é obra do painel — **325 das 461** de `nfs`, 26 de
`boletins_medicao`, 1 de `proximos_faturamentos`. Essas chaves não estão no
mapa, então filtrar só por ele faria quem tem acesso global ver **um terço** da
tabela. Para o recorte por obra o efeito é o inverso e desejado: chave não
mapeada não pertence a obra nenhuma, logo não aparece.

**3. O join da view teria multiplicado por 686 — e acabou dispensado.** O
desenho inicial recortava a view por obra via `tarefa_id → tarefas.id_eap →
EAP.id_obra`. `EAP` tem milhares de linhas por `id_eap` (é a árvore de EDT
inteira): medido, o join ingênuo devolve **4.208.015 linhas** contra as 6.135
corretas. A solução era juntar contra um `distinct` de 14 linhas — mas a
decisão de LIBERAR a view (abaixo) tirou o join do caminho de vez. Fica
registrado porque a armadilha volta em qualquer tentativa futura de recortar
`medicao_acumulada` por obra.

As fatias B e C do plano original (RLS por obra nas 22 tabelas não-financeiras)
**deixaram de existir** quando ficou decidido que o acesso geral às obras não é
restrito. É o que tirou a maior parte do risco: as convenções de nome bagunçadas
(`curvas_s.obra`, `pts_emitidas.obra`, `suprimentos.obra`) não precisam mais ser
mapeadas.

A fatia A não altera policy nenhuma — o recorte é só de UI até a D entrar. É de
propósito: dá pra cadastrar e conferir o comportamento antes de qualquer risco
de sumir dado de quem deveria ver.

### Como cadastrar

```sql
-- financeiro só numa obra (nível novo)
insert into public.acesso_total (email, obra_id, nota)
values (lower('fulano@mse.com.br'), 106, 'financeiro só CNPEM');

-- rebaixar quem tinha acesso global para uma obra só
update public.acesso_total set obra_id = 106
 where email = lower('fulano@mse.com.br');
```

### Falha fecha, sempre

`carregarAcessoObras()` assume `[]` (nenhuma obra com financeiro) quando o RPC
falha — mesma regra de `carregarAcessoTotal()`. Mostrar Medições por falha de
rede é o erro caro; a aba a menos é o barato. Coberto por
`tests/acesso-por-obra.spec.js`, "RPC fora do ar fecha o financeiro, não abre",
que também confere que o seletor **não** encolhe nesse caso.

### A view de índices é LIBERADA, não recortada

`v_indices_financeiros_diario` **não alimenta Medições nem OC/CO** — alimenta o
indicador de Produtividade do **Setor 2, Encarregados**, que não é financeiro e
nunca é escondido da barra.

Tê-la restringido em 08/09/2026, junto do resto do financeiro, criou um efeito
colateral silencioso: quem não estava em `acesso_total` abria Encarregados e via
a coluna Produtividade **vazia, sem explicação** — o modo de falha do ADR-005.

Regra do usuário (09/09/2026): *"se não alimenta a tela de medições/ocs deverá
estar liberado"*. A fatia D remove o `WHERE` de acesso da view inteiro.

⚠️ **Mas sem as colunas de dinheiro.** A versão restrita expunha `receita`,
`receita_ponderada` e `custo_incorrido` — R$ por tarefa. Liberar a view com elas
publicaria receita e custo de toda obra para qualquer sessão logada, o que é
bem mais que "liberar o indicador de produtividade".

Nenhum consumidor lê essas colunas: as três cópias do painel (`prototipo`,
`apresentacao`, `combinado`) selecionam sempre e somente
`tarefa_id,data,indice_receita_custo_incorrido`. O índice que sobra é uma
**razão** (receita÷custo), não um valor. Os valores continuam em
`medicao_acumulada`, que segue restrita.

Precisou de `drop view` + `create view`: `create or replace view` não remove
coluna. Verificado que nada depende dela.

Consequência boa de tabela: com a view livre, o join contra `EAP` deixou de ser
necessário — e com ele foi embora a armadilha das 4,2 milhões de linhas.

### Verificado em 09/09/2026

Testado ponta a ponta no `localhost:8899` com **sessão Google real** de
`vinicius.tadashi@mse.com.br`, movido temporariamente para `obra_id = 91` e
restaurado para `NULL` no fim.

| | Obra 91 (dele) | Obra 106 (CNPEM) |
|---|---|---|
| Abas | **9**, com OC/CO e Medições | **7**, numeradas 1-7 sem buraco |
| `restringirFinanceiroObra()` | `false` | `true` |

Seletor com as 7 obras, e URL direta a `#/obra/106/medicoes` mostra o cartão de
permissão nomeando a obra.

**O que prova que não é só a UI escondendo:** consultando o PostgREST direto com
o token dele, `boletins_medicao` devolve 50 no total e 50 filtrando por CP236 —
ou seja, linha de outra obra não existe para ele. Pedir `cp_codigo=eq.CP029`
devolve 0, e `orcamentos_complementares_obra?id_obra=eq.106` também.

⚠️ **Armadilha na verificação por SQL:** `set_config('request.jwt.claims', ...)`
sozinho **não testa RLS**. A conexão administrativa roda como `postgres`, que
ignora RLS por completo — a primeira rodada de conferência deu "tudo liberado"
e parecia sucesso. Precisa de `set local role authenticated` junto, dentro de
`begin/rollback`.

### ⚠️ Obra sem contrato CP: o acesso vira aba vazia

O IPEN (obra 114) **não tem código CP** em `obra_chaves` e não tem uma linha
sequer em `boletins_medicao`, `nfs` ou `orcamentos_complementares_obra`.

Dar acesso financeiro a uma obra assim produz um estado incoerente, verificado
em 09/09/2026 com `leonardo.bernardino@mse.com.br`:

| | |
|---|---|
| `mse_obras_financeiro()` | `[114]` |
| `mse_cps_financeiro()` | `NULL` — nenhum CP |
| `mse_financeiro_obra(114)` | `true` → **as abas aparecem** |
| boletins / nfs / OCs | **0 / 0 / 0** |

Ou seja: Medições e OC/CO ficam visíveis e **vazias**, que se lê como "não houve
faturamento" — o ADR-005 ao contrário. Não é causado pelo recorte: um usuário
GLOBAL vê o IPEN igualmente vazio hoje.

**Quando o IPEN ganhar contrato**, é obrigatório inserir
`(114,'cp','<código>')` em `obra_chaves`. Sem isso o acesso continua sem efeito
nas tabelas de Medições, mesmo com a linha em `acesso_total` no lugar certo.

### Fora do escopo

O **Histograma lê outro projeto Supabase** (`wnldmumgjwujveeimyef`, Efetivo),
com RLS própria, via Edge Function. Não é financeiro, e o acesso geral às obras
não é restrito — então hoje não há nada a fazer lá.

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
