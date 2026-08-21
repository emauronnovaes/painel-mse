# Modelo de Dados (fontes disponíveis)

Inventário do que já existe e pode alimentar o novo painel. Herdado do
levantamento do dashboard atual — detalhamento completo no vault
`Documents\MSE-Conhecimento`, notas "Modelo de Dados Supabase" e
"Fluxo de Dados - Ingestão".

## Dois projetos Supabase

| Projeto | ID | Conteúdo |
|---|---|---|
| Principal | `gebjlhkywtnpfqjrakok` | apontamentos, EAP, curvas, suprimentos, PTs |
| Efetivo | `wnldmumgjwujveeimyef` | efetivo diário e agregações (MOI/MOD) |

## Tabelas por assunto

### Avanço físico e planejamento
- **`Apontamentos`** — 1 linha por card por dia. Guarda histórico.
- **`EAP`** — estrutura de tarefas (disciplina, local, datas, encarregado).
  `data_inicio`/`data_termino` = Linha de Base (BL); `data_inicio_reprogramado`/
  `data_termino_reprogramado` = cronograma corrente — confirmado ao vivo
  2026-08-06 contra um exemplo do CSV do Portal onde as duas divergem (ver
  [[08 - Blueprint do Painel de Obra]], setor Desvios).
- **`cards_ativos`** — retrato atual do planejamento. Não guarda histórico.
- **`vw_dados_tv`** — junção Apontamentos × EAP; é daqui que sai a aderência.
- **`curvas_s`** — curva S por obra e semana (valores em **fração 0–1**).
  `obra` já é o nome "dash" direto — confirmado ao ligar o blueprint
  ([[08 - Blueprint do Painel de Obra]]), sem mapa de tradução.
- **`curva_avanco_historico`** — curva financeira (**percentual 0–100**), chave
  `id_obra` (bate direto com o id numérico do Portal, sem mapa). ⚠️ Realizado
  parado desde 29/07/2026 — **mas a tabela continua recebendo linhas com o
  previsto avançando**, então "pegar a última linha" infla o desvio com o
  tempo. Ver armadilha 7 abaixo.

### Pessoas e segurança
- **`apontamento_efetivo`** — quem estava alocado em cada card. ⚠️ Guarda **só o
  último dia**.
- **`pts_emitidas`** — Permissões de Trabalho. `emitente` = encarregado;
  `tst_responsavel` = técnico de segurança (papéis diferentes).
- **`efetivo_diario_raw`** *(projeto efetivo)* — base bruta com payload original
  da API; MOI/MOD e presença já vêm classificados da origem.
- **`vw_efetivo_*`** *(projeto efetivo)* — 14 views de agregação.
- **`efetivo_previsto`** *(projeto efetivo)* — mão de obra PLANEJADA (histograma
  de MOI/MOD por obra), diferente de `efetivo_diario_raw`/`vw_efetivo_*` (que
  são o REALIZADO). Colunas: `obra_id`, `nome_obra` (só descritivo — a
  filtragem do painel usa `obra_id`, não esse campo), `mes` (sempre dia 01),
  `nome_funcao`, `moi_mod`, `qtd_previsto`, `granularidade` ('mes' ou
  'semana' — varia por obra, ex. CNPEM é 'mes', a maioria das outras é
  'semana'). Views `vw_efetivo_previsto_mensal_*`/`vw_efetivo_previsto_semanal_*`
  agregam por cima pra alimentar o Histograma. **Alimentação é manual** —
  não tem ingestão automática conhecida; carga feita direto via SQL a
  partir de planilha de planejamento (ver 2026-08-11 abaixo, obra
  Novo Nordisk - AP - Reforço).

### Suprimentos e outros
- **`suprimentos`** — itens, status, datas-limite.
- **`v_indices_financeiros_diario`** — índice receita/custo.
- **`view_atividades_3d`** — atividades por nível para viewer 3D.
- **`relatorio_produtividade_semanal`** — entrada manual via planilha, chave
  `id_obra` (id do Portal, mesmo de `curva_avanco_historico`) +
  `periodo_inicio` (segunda-feira do calendário, mesmo para a Novo Nordisk).
  Alimenta o relatório semanal em PNG (`Documents\relatorios-pdf`) e, desde
  2026-08-05, também o popup "Produtividade Diária" do blueprint
  ([[08 - Blueprint do Painel de Obra]]) — mesma tabela, dois consumidores.
- **`restricoes_obra`** — 1 linha por obra, `id_obra` bate direto com
  `OBRAS[].id` (sem mapa). O que importa mora dentro de `restricoes` (jsonb,
  array), sincronizado do PortalMSE — cada item tem `descricao`,
  `criticidade` (Alta/Média, "Baixa" não confirmada ainda), `tipo_restricao`/
  `nome_tipo_restricao`, `status_cadastro`/`status_cadastro_label` (só
  "Aberto" visto até agora), `data_inicio`/`data_conclusao` (+ versões já
  formatadas dd/mm/aaaa), `nome_eap`/`id_eap`, `responsabilidade`,
  `usuario_cadastro`. Alimenta o setor Restrições do blueprint desde
  2026-08-07 — ver armadilha 11 abaixo (RLS).
- **`nfs`** e **`proximos_faturamentos`** — fontes ORIGINAIS do setor
  Medições (2026-08-10), **substituídas em 2026-08-19** por
  `contratos_medicao`/`boletins_medicao` abaixo (pedido explícito: "não
  vamos utilizar os dados que já existem, vamos fazer uma nova
  importação"). Ficam registradas aqui só por histórico — `nfs` tinha 1
  linha por Nota Fiscal (`nf`/`bm`/`empresa`/`emissao`/`valor`),
  `proximos_faturamentos` tinha 1 linha por obra com a próxima
  `data_prevista`+`valor_previsto`. O painel não lê mais nenhuma das duas.
- **`contratos_medicao`** (1 linha por contrato — `cp_codigo` PK) e
  **`boletins_medicao`** (1 linha por BM/boletim de medição, chave
  `cp_codigo`+`linha_planilha`) — fonte atual do setor Medições, importada
  via Apps Script da planilha "Saldo a Faturar - Geral - Medições" (ver
  [[08 - Blueprint do Painel de Obra]] pro schema completo e o histórico
  de bugs do parser). `contratos_medicao` tem `valor_contrato`/
  `valor_ocs`/`valor_total`/`iss_fracao`/`prazo_vencimento_dias`.
  `boletins_medicao` tem o extrato completo por BM: previsto, medido,
  desconto FD, retenção, faturado, datas, status de faturamento/
  recebimento, saldos acumulados (guardados tal qual a planilha calcula,
  só pra auditoria — **não** usados pra decidir se uma linha "existe":
  essas colunas carregam o último valor conhecido pra frente via fórmula
  da planilha, mesmo em linha sem nenhuma atividade real). Chave de obra
  continua sendo o **código de contrato** ("CP029", "CP273"...) — mesma 4ª
  convenção de nome de obra de sempre, além de `curva`/`origemTV`/
  `origemPTS` — ver armadilha 12. Ingestão é upsert (não substituição em
  lote como as demais tabelas do projeto) — rodar a sincronização de novo
  atualiza linhas existentes e insere as novas, nunca apaga uma linha que
  saiu da planilha.

## Como o dado entra (importante para o novo desenho)

Nenhuma dessas tabelas é escrita pelo painel — a ingestão (majoritariamente
**n8n**) roda antes e grava. Padrão observado: **substituição em lote** (todas as
linhas com o mesmo carimbo de tempo).

Consequência para o produto: **a maioria das tabelas não guarda histórico de
versões**. Se o painel novo precisar de série histórica de algo que hoje é
substituído (ex.: alocação de pessoas por card), isso é requisito de ingestão, não
de tela — e precisa ser pedido antes.

## Armadilhas que o novo painel deve tratar de saída

Cada uma custou tempo de diagnóstico no atual:

1. **Limite de 1000 linhas por resposta**, ignorando `limit` e `Range` — dado
   desaparece sem erro. Resolvido por ADR-005 ([[06 - Decisões de Arquitetura]]).
2. **Tabela nova exige policy de leitura** — sem ela, a API responde `200` com
   lista vazia, sem erro. Sintoma: `Content-Range: */0`.
3. **Nomes de obra divergem entre tabelas** — `curvas_s` usa o nome do
   dashboard, `suprimentos` usa nomenclatura própria, `pts_emitidas` usa outra
   ainda. Exige mapa explícito por fonte (ADR-004).
4. **Escalas diferentes** — curva física em fração (0–1), financeira em
   percentual (0–100).
5. **Espaço sobrando** em nomes (obra e pessoa) — sempre normalizar antes de
   comparar.
6. **Cortes de curva podem ser reagendados** de um dia para o outro; lógica de
   "próximo corte" precisa tolerar salto de várias semanas.
7. **`curva_avanco_historico` "congela mas continua"** — quando o realizado
   para de ser atualizado, a tabela não para de crescer: `reais_previsto_acumulado`
   segue subindo a cada semana e `reais_desvio_acumulado` é recalculado contra
   esse previsto móvel. `reais_disponivel` não sinaliza isso (vem `true` mesmo
   nas linhas futuras/congeladas). Pegar "a última linha por data" devolve um
   desvio cada vez mais errado — na CNPEM, virou −30,5% contra um −8,8% real.
   Correção: achar a última linha em que o **realizado mudou de valor** frente
   à anterior — ali é onde a medição parou de verdade (função
   `ultimaLinhaComMudanca` no protótipo). Mesmo achado registrado na nota
   "Dívida Técnica e Riscos" do vault `Documents\MSE-Conhecimento` — vale
   checar se o dashboard atual sofre do mesmo problema no toggle "Portal".
8. **3 convenções de nome de obra confirmadas ao vivo** (2026-08-05, ao portar
   a aba Encarregados — [[08 - Blueprint do Painel de Obra]]): `curvas_s.obra`
   usa o nome "dash" ("CNPEM - FASEADO"); `vw_dados_tv.OBRA` **e**
   `cards_ativos.nome_obra` usam a MESMA convenção "origem" entre si
   ("CNPEM-FASEADA", "NN - AP - ELETROMECÂNICA " — duas delas com espaço
   sobrando no fim, ver armadilha 5), confirmada comparando os dois ao vivo;
   `pts_emitidas.obra` usa uma 3ª convenção só pra Novo Nordisk ("Novo Nordisk
   AP", "Novo Nordisk UB"). Sem mapa central — cada consumidor guarda sua
   própria tradução (no protótipo, `origemTV`/`origemPTS` em `OBRAS`).
9. **`EAP` não tem coluna de "é resumo/macro"** — só `edt`, e a presença de
   peso (`ponderacao_reais`) NÃO é confiável para distinguir folha de
   resumo: no Novo Nordisk-AP só a folha carrega peso, mas no CNPEM **todo
   nível da hierarquia** carrega (resumo e suas tarefas-filha têm
   `ponderacao_reais` preenchida, igual ao MS Project de origem — confirmado
   contra o CSV exportado do Portal, 2026-08-06). Filtrar por
   `ponderacao_reais IS NOT NULL` para achar "tarefas reais" conta a mesma
   tarefa 2× nessas obras (resumo + filha), inflando qualquer soma de peso em
   várias vezes. Técnica correta, estrutural: uma linha é **folha** se seu
   `edt` não é prefixo de nenhuma outra linha da mesma obra — funciona
   independente de peso estar ou não populado por nível. `ponderacao_reais`
   em si é literalmente o Custo (R$) da linha (não um peso pré-normalizado) e
   soma hierarquicamente igual ao cronograma de origem — confirmado por
   `ID Portal` = `EAP.id` contra o CSV real do CNPEM. Detalhe completo da
   investigação (incluindo a fórmula de sinal do `desvio`) em
   [[08 - Blueprint do Painel de Obra]], seção "Setor 6 — Desvios".
10. **`efetivo_diario_raw.moi_mod` tem 4 valores, não 2**: além de "MOI"/"MOD",
    a origem também manda "GESTÃO" (303 registros) e "PRODUÇÃO" (1.287
    registros) — sem normalização, qualquer view que agrupa por `moi_mod`
    cru deixa essas pessoas de fora quando o app filtra só `MOI`/`MOD` (a
    view "_total", que conta todo mundo sem olhar `moi_mod`, continuava
    certa — só o split MOI/MOD é que não fechava 100%). Achado ao aplicar o
    pedido do usuário "considerar Gestão como MOI e Produção como MOD"
    (2026-08-07): 2 das 18 views (`vw_efetivo_mensal_moimod_total` e
    `vw_efetivo_mensal_pessoas`) já tinham a normalização
    (`CASE WHEN moi_mod ~~* 'gest%' THEN 'MOI' WHEN moi_mod ~~* 'produ%'
    THEN 'MOD' ELSE moi_mod END`) — as outras 7 que usam `moi_mod`
    (diario_moimod_total/pessoas/detalhe, mensal_detalhe,
    semanal_moimod_total/pessoas/detalhe) não tinham. Replicado o mesmo CASE
    nas 7. Porto Itapoá (obra mais afetada, 1.051 registros) foi de um
    %MOI+%MOD que não fechava 100% pra 22,1%+77,9%=100,0% exato depois da
    correção. Corrigido nas VIEWS (não na tabela raw) de propósito — a raw é
    "payload original da API" e é sobrescrita em bloco a cada sync (mesmo
    padrão de substituição documentado acima), então qualquer `UPDATE`
    direto nela seria desfeito no próximo ciclo.
11. **Tabela nova só com policy de `service_role`** — variante mais estrita da
    armadilha 2: a API responde `200`/lista vazia pro `anon` (mesmo sintoma,
    `Content-Range: */0`), mas a causa aqui não é "falta policy nenhuma", é
    "só falta a de leitura pública". Aconteceu com `restricoes_obra`
    (2026-08-07, populada via API do PortalMSE só com `policy ... for all to
    service_role` — sem SELECT pra `anon`/`authenticated`). Resolvido criando
    `create policy "leitura anon restricoes_obra" on ... for select to anon,
    authenticated using (true)` — mesmo padrão de `pts_emitidas`. Vale
    verificar isso de saída em qualquer tabela nova alimentada por
    integração/n8n, antes de gastar tempo desconfiando do código do painel.
12. **4ª convenção de nome de obra: código de contrato ("CP029", "CP273"...)**
    — `nfs`/`proximos_faturamentos` (2026-08-10) usam isso como chave, não
    `curva`/`origemTV`/`origemPTS`. Achado ao ligar o setor Medições: **não
    existe tabela de mapa** id_obra↔código CP em nenhum dos 2 projetos
    Supabase — o código só aparece embutido no TEXTO de algumas tarefas raiz
    da `EAP` (`edt` sem ponto), tipo `"CP002 - PORTO ITAPOÁ - FASE..."`.
    Confirmados por esse texto: CP002→94 (Porto Itapoá), CP029→106 (CNPEM),
    CP261→108 (NN-AP-Reforço), CP273→107 (NN-AP). Hitachi→110 (CP022) e
    Novo Nordisk-UB/SP→91 (CP236) não achados na EAP — confirmados
    diretamente pelo usuário em 2026-08-10. Todas as 6 obras mapeadas.
    Mesma tabela nova (`nfs`) também nasceu **sem
    NENHUMA policy** de RLS (não só faltando a de leitura pública, como na
    armadilha 11 — aqui não tinha nem a de `service_role`) — variante mais
    básica ainda do mesmo problema; mesma correção (`create policy ... for
    select to anon, authenticated using (true)`) resolveu.

## Fontes novas necessárias (confirmado — nenhuma existe ainda)

O Painel de Obra ([[02 - Escopo e Telas]]) tem setores sem fonte de dado
hoje. Implantação incremental, com placeholder "Em elaboração" até cada uma
ficar pronta (Restrições em 2026-08-07 — `restricoes_obra` —, Medições em
2026-08-10 — `nfs`/`proximos_faturamentos` — e OC/CO em 2026-08-11 —
`orcamentos_complementares_obra`, cobre a aba inteira, "OC" e "CO" são o
mesmo conceito no domínio da MSE, correção registrada em
[[02 - Escopo e Telas]] — todas saíram desta lista):

| Setor | Precisa de | Termos do domínio |
|---|---|---|
| Suprimentos | tabela de pedidos por obra (ingestão em andamento, 2026-08-11 — ver abaixo) | fonte nova ≠ tabela `suprimentos` já existente (curada manualmente) |

Cada uma vai exigir desenho de tabela + ingestão (provavelmente n8n, mesmo
padrão do restante — ver nota "Fluxo de Dados - Ingestão" no vault
`Documents\MSE-Conhecimento`) antes de a tela sair do placeholder.

### Previsto de MOD carregado pra Novo Nordisk - AP - Reforço (2026-08-11)

Usuário colou print de uma planilha ("Histograma de Mão de Obra Direta —
MOD") com o previsto de Mar-Jul/2026 pra obra 108 (Novo Nordisk - AP -
Reforço), que até então **não tinha nenhuma linha** em `efetivo_previsto`
— Histograma dessa obra mostrava só o Real, sem previsto nenhum. Carga
manual via SQL (`execute_sql`, projeto Efetivo), 36 linhas (8 funções ×
até 5 meses cada, só os meses/funções com valor > 0 na planilha — não
replicou o padrão de outras obras de inserir linha zerada pra cada função
do catálogo, que não muda o resultado agregado).

- Todas as 8 funções (Encarregado de Metálica, Maçariqueiro, Soldador,
  Montador de Metálica, Eletricista de Força e Comando, Fire Watch,
  Encarregado Andaime, Montador de Andaime) classificadas como
  `moi_mod='MOD'` — o próprio título da planilha já dizia "Mão de Obra
  DIRETA (MOD)", não precisou inferir por função individual.
- `granularidade='mes'` (fonte é mensal) — mesmo padrão já usado por CNPEM
  (única outra obra com granularidade mensal; as demais são semanais).
- **Ano civil confirmado com o usuário antes de gravar** (a planilha só
  dizia "mês 1"..."mês 11" com rótulos Mar/Abr/Mai/Jun/Jul apontando pros
  meses 3-7, mas sem o ano) — 2026, não assumido sozinho.
- Conferido antes E depois da carga: somas por mês (21/79/79/79/79) batem
  exato com as colunas "Soma"/"Pico"/"Total" da própria planilha, e com o
  que a view `vw_efetivo_previsto_mensal_total` retornou depois. Validado
  também ao vivo na tela (gráfico + popup "Previsto — Detalhamento" de
  Abril, 8 funções, soma 79).

**Complemento no mesmo dia — lado MOI**: usuário colou a 2ª planilha
("Histograma de Mão de Obra Indireta — MOI") da mesma obra, Fev-Ago/2026,
19 funções de gestão/suporte (Diretor de Contrato, Coordenadores,
Inspetores, Sinaleiro etc.), algumas marcadas "* MO compartilhada" na
planilha (mão de obra dividida com outra frente/contrato — anotado aqui
só como contexto, não existe coluna pra isso em `efetivo_previsto`, o
número gravado é o mesmo que a planilha já mostra). Mesmo processo:
transcrição conferida contra Soma/Pico/Total ANTES de gravar (bateu
100%), carga via `execute_sql`, conferência depois (Fev=2, Mar=20,
Abr-Jul=23, Ago=3 — bate exato), e validação ao vivo no filtro
TOTAL/MOI/MOD da tela (TOTAL = MOD+MOI somados corretamente por mês,
ex. Abr = 79+23 = 102).

### Suprimentos — regra de "crítico" fechada: Curva A por item macro (2026-08-21)

Decisão de produto que faltava desde 2026-08-05 (ver seção anterior):
"os críticos serão, por hora, os itens Curva A, que correspondem, em sua
soma, a 80% do valor do projeto" — implementado só em cima de
`itens_rmi` (as outras 2 fontes de Suprimentos, `pedidos_suprimentos` e
`itens_mapa_compras`, seguem sem tela própria).

- **Grão = "item macro"** (disciplina) — não o item-folha, ~~fixado em
  `raw.nivel === 1` inicialmente~~. **Corrigido 2x no mesmo dia**: 1º
  pra resolução por RMI (nível 0 ou 1, varia por ramo — ver seção
  abaixo); depois o próprio conceito de "crítico" desceu de disciplina
  pra MATERIAL (ver "Crítico vira MATERIAL" mais abaixo) — o "item
  macro"/disciplina virou só coluna de contexto, não mais o grão da
  Curva A.
- **Curva A**: ordena os macro-itens por `subtotal_custo_meta_orcamento`
  decrescente, acumula, inclui todo item até o acumulado ANTES dele
  cruzar 80% do total.
- **Itens de canteiro/apoio excluídos do cálculo inteiro** (não entram
  nem no denominador) — pedido em seguida: "itens de canteiro como
  consumíveis, alojamento e afins não precisam ser considerados".
  Classificação por palavra-chave (não taxonomia fixa — 2.975
  descrições distintas de nível 1 nas 6 obras). Ver detalhe completo e
  lista de palavras-chave em [[08 - Blueprint do Painel de Obra]],
  seção "Setor 4 — Suprimentos sai do placeholder".
- **`prazo_status` não virou critério**: checado no dado real antes de
  decidir — 100% dos itens da obra 91 vieram `sem_data`, API ainda não
  popula essa dimensão. `desvio_saldo_orcamentario` (já populado) virou
  badge complementar na tabela, não critério de corte.
- Consulta usa filtro de expressão jsonb direto no PostgREST:
  `raw->>nivel=eq.1` (índice de expressão já existia pra
  `prazo_status`/`desvio_saldo_orcamentario`, não pra `nivel` — sem
  índice dedicado ainda, aceitável pro volume atual de ~150-900
  itens/obra depois do filtro por `id_obra`).

### "Item macro" deixa de ser nível fixo, passa a ser resolvido por RMI (2026-08-21, mesmo dia)

Usuário reportou linhas indesejadas no CNPEM Faseado — investigado antes
de mexer (ADR-005) e o achado invalida a premissa da seção acima:
`nivel === 1` fixo NÃO é universal. Comparando obra 91 × CNPEM Faseado
(106) com consulta direta no PostgREST:

- Obra 91: nível 0 é "balde" de origem de material (`MATERIAIS - UB/SP`,
  `CHANGE ORDER N`, quase todos zerados) — a disciplina real só aparece
  no nível 1. Por isso nível 1 fixo funcionava aqui.
- CNPEM Faseado: é o INVERSO — nível 0 já É a disciplina real (HVAC,
  CIVIL, ELÉTRICA E SISTEMAS, COMBUSTÍVEL...). Nível 1 é item de linha
  granular (814 linhas na obra) — nível 1 fixo quebrava aqui.
- RMI 43/GERAL (obra 91): tem ramo cujo nível 0 nem existe como linha
  na origem (órfão) — só nível 1 carrega o valor real desse ramo.

Consulta passou a buscar nível 0 E nível 1 da obra (2 requisições em
vez de 1) e resolver por RAMO (`id_rmi`+`codigo_seq`) qual usar:
desce pro nível 1 se o nome do nível 0 bater padrão de "balde"
administrativo (`MATERIAIS -`, `CHANGE ORDER`, `OC -`, `CO <número>`),
se o subtotal do nível 0 vier zerado com filho de valor real, ou se o
ramo for órfão; senão usa o nível 0 direto. Detalhe completo e código em
[[08 - Blueprint do Painel de Obra]], seção "'Item macro' deixa de ser
nível fixo". Validado sem regressão (obra 91 bateu exato com o resultado
anterior) + CNPEM Faseado com resultado sensato (4 itens críticos:
HVAC, Elétrica e Sistemas, Civil, Custos com Efetivo MSE).

### Crítico vira MATERIAL, não mais disciplina inteira (2026-08-21, mesmo dia)

Correção de escopo maior, no mesmo dia: "no CNPEM o item de custo com
efetivo não precisa aparecer também... observe no nível de material, é
isso que precisamos exibir, os materiais críticos, orientados por área
e disciplina" — o grão da Curva A desce de disciplina (resultado da
seção anterior) pro MATERIAL real (item-folha); disciplina/área viram
colunas de contexto.

- **Material não é nível fixo** — varia até dentro do mesmo ramo (RMI
  41/obra 91 tem material genuíno em nível 3 E 4). Identificado por
  `unidade` populada e ≠ `SERV`/`VB`/`VERBA`, mais uma lista curta de
  exceção por nome (TESTES, OMISSOS, COMISSIONAMENTO — vêm com unidade
  "UN" igual material de verdade, mas não são). Evita contar 2x: só
  desce pro filho se ele também tiver valor > 0 (não só a mesma
  unidade do pai).
- **"Custos com Efetivo MSE" some sozinho** — por baixo só tem
  treinamento/passagens/plano de saúde, tudo `vb`, sem regra especial.
- **Área**: pode vir de ABAIXO da disciplina na árvore (CNPEM) ou de
  CIMA (obra 91 — UB/SP é o nível que a resolução de disciplina
  descarta como balde). ~~Nesse 2º caso virava sufixo no nome da
  disciplina~~ — **corrigido horas depois** (ver "Tabela vira árvore"
  abaixo): virou campo próprio em todo material, igual nos 2 casos.
- Fetch mudou de "nível 0 + nível 1" pra obra inteira (1 requisição) —
  precisa caminhar até a folha, que pode estar em qualquer profundidade.

Detalhe completo, o bug do "SAE002" pego na validação (sufixo só se
aplica quando a descida foi por padrão de nome, não pelo fallback de
subtotal zerado) e os números de validação em
[[08 - Blueprint do Painel de Obra]], seção "Crítico vira MATERIAL".

### Tabela vira árvore Área → Disciplina → Material (2026-08-21, mesmo dia)

"precisa estar organizado em nívels, Área -> Disciplina -> Material...
a necessidade de compilar materiais similares em uma coisa só" — área
deixa de ser sufixo no nome da disciplina (só fazia sentido numa tabela
plana) e vira campo próprio em todo material, virando nó real na árvore
de exibição, não importa se fica acima ou abaixo da disciplina no RMI
original. `consolidarMateriaisSemelhantes` soma valor+saldo de materiais
com a mesma descrição normalizada dentro do MESMO par área+disciplina.

2 bugs pegos na validação em Node antes do teste de UI: (1) área
herdada de cima sendo sobrescrita pelo 1º sub-agrupamento abaixo da
disciplina; (2) quando o material é filho direto da disciplina (sem
camada de área), a área virava igual ao nome do próprio material.
Resultado real: obra 91 = 3 áreas (UB, SP, sem área); CNPEM Faseado = 6
áreas (Central de Água Gelada, Instalações Nível 614/619/623, Caixa de
Acesso, sem área). Detalhe completo em
[[08 - Blueprint do Painel de Obra]], seção "Tabela vira árvore".

### Suprimentos ganha 3ª fonte em ingestão — RMI (2026-08-20)

Tabela `itens_rmi` desenhada (SQL em `painel-mse\n8n\rmi-suprimentos.README.md`)
e workflow n8n criado (`rmi-suprimentos.workflow.json`, mesma pasta) —
ainda não aplicado no Supabase nem rodado.

Fonte: API externa `rmi_api` do PortalMSE
(`https://portalmse.com.br/microservices/rmi_api/GUIA_USUARIO.php`) —
**serviço distinto de `mapa_compras_api`**, confirmado pelo `/health` de
cada um (nomes de `service` diferentes) e por uma chave de um dar 403 no
outro. Guia bem mais completo que o de Mapa de Compras: confirma o
formato do envelope (`{page,per_page,total,data:[...]}`) e traz exemplo
de JSON de resposta real.

**Achado que muda o jogo pra regra de "crítico"** (pendente desde
2026-08-05/08-11, ver seção "Suprimentos ganha fonte nova" abaixo e
[[02 - Escopo e Telas]]): os itens da `rmi_api` já vêm com
`prazo_status` (atrasado/no_prazo/sem_data) e `desvio_saldo_orcamentario`
(positivo/negativo) **prontos da origem**, algo que nenhuma das outras 2
fontes de Suprimentos tinha por item. A API até aceita filtrar direto
por esses 2 campos via query string. Ainda não virou regra de produto
("crítico = o quê exatamente"), mas agora existe dado pronto pra decidir
em cima.

1 linha por item, chave = `id` (o próprio id numérico do item na
origem) — é a 1ª das 4 fontes de ingestão do projeto a ter um id
numérico confirmado; as outras 3 (`pedidos_suprimentos`,
`orcamentos_complementares_obra`, `itens_mapa_compras`) precisaram de
chave composta "no chute" por falta disso.

Suprimentos agora tem **3 fontes de ingestão coexistindo**
(`pedidos_suprimentos`, `itens_mapa_compras`, `itens_rmi`), cada uma com
um grão/foco diferente do mesmo processo de compra — ver tabela
comparativa no README do `rmi-suprimentos` pra quando for desenhar a
tela.

**Ajuste no workflow (2026-08-20)**: usuário testou a API e o Supabase
funcionando via Postman, mas o workflow do `rmi-suprimentos` ficava
"rodando e não retornava" no n8n — suspeita de limitação de hardware na
máquina que hospeda. Causa provável: o desenho original buscava as 6
obras primeiro e só depois processava tudo junto, exigindo manter as 6
respostas inteiras na memória ao mesmo tempo antes de gravar qualquer
coisa. Corrigido pra processar **1 obra por vez em loop** (`Split In
Batches`) — busca, transforma e grava uma obra antes de buscar a
próxima, liberando memória a cada volta.

**Schema de `itens_rmi` simplificado (2026-08-20)**: a pedido explícito
("é possível retirar esta etapa?", referindo-se à tradução campo-a-campo
no Code node), a tabela deixou de ter uma coluna por campo da API — agora
é só `id` (chave), `id_obra` (filtro) + `raw jsonb` (item inteiro), mesmo
padrão de `orcamentos_complementares_obra`. Filtro por `prazo_status`/
`desvio_saldo_orcamentario` continua possível via `raw->>campo` no
PostgREST, com índice de expressão nos dois. Ver `rmi-suprimentos.README.md`
pra detalhe completo e exemplos de consulta.

### Suprimentos ganha 2ª fonte em ingestão — Mapa de Compras (2026-08-19)

Tabela `itens_mapa_compras` desenhada (SQL em
`painel-mse\n8n\mapa-compras-suprimentos.README.md`) e workflow n8n criado
(`mapa-compras-suprimentos.workflow.json`, mesma pasta) — ainda não
aplicado no Supabase nem rodado.

Fonte: API externa `mapa_compras_api` do PortalMSE
(`https://portalmse.com.br/microservices/mapa_compras_api/GUIA_USUARIO.php`)
— itens de requisição/mapa de compra (código, descrição, quantidade,
preço de referência, custo meta de orçamento, saldo orçamentário, quanto
já foi pedido/consumido, melhor oferta). 1 linha por item (chave composta
`id_obra`+`id_mapa_compras`+`codigo_seq`, suposição a confirmar com dado
real).

**Guia da API bem mais magro que os das 2 ingestões anteriores** — sem
nenhum exemplo de JSON de resposta completo. Por isso ficaram 3 pontos em
aberto (detalhados no README do workflow, seção "Antes de importar"):
formato do envelope da resposta (`{data:[...]}` presumido, com fallback e
erro explícito se não bater), nomes exatos dos 3 campos `melhor_oferta_*`
(a doc só descreve em texto corrido, não nomeia), e a tabela de
requisições (cabeçalho do RMI) **não foi criada** — a doc não detalha os
campos de `/v1/requisicoes` o suficiente pra desenhar schema sem
fabricar dado.

Não confundir com `pedidos_suprimentos` (ingestão anterior, mesma aba
Suprimentos): são 2 fontes/grãos diferentes do mesmo ERP —
`pedidos_suprimentos` é o pedido de compra já fechado (fornecedor, valor,
prazo de entrega); `itens_mapa_compras` é o item dentro da requisição,
antes/durante a compra (orçamento, saldo, se já tem pedido). A regra de
"crítico" do setor Suprimentos provavelmente vai precisar cruzar as duas
— nenhuma tem sozinha tanto o lado do prazo quanto o lado do orçamento.

### Suprimentos ganha fonte nova em ingestão (2026-08-11)

Tabela `pedidos_suprimentos` desenhada (SQL em
`painel-mse\n8n\pedidos-suprimentos.README.md`) e workflow n8n criado
(`pedidos-suprimentos.workflow.json`, mesma pasta) — ainda não aplicado no
Supabase nem rodado (MCP do Supabase desconectou nesta sessão; aplicar
assim que reconectar). **Não confundir com a tabela `suprimentos` já
existente**, usada hoje pelo `dashboard-main` — essa é curada manualmente
pelo planejamento (item/escopo/prioridade/prazo), schema e origem
totalmente diferentes da API nova.

Fonte: API externa `pedidos_usuarios_api` do PortalMSE
(`https://portalmse.com.br/microservices/pedidos_usuarios_api/`, doc em
`GUIA_USUARIO.html` no próprio domínio) — dado bruto de pedido de compra
do ERP (36.573 registros no total, todas empresas/obras — paginação
obrigatória sem filtro). 1 linha por pedido (chave composta
`banco_s1`+`numero_pedido`, suposição a confirmar com dado real — a API
não expõe um id numérico único). A regra de "crítico" (atrasado/vence
hoje/no prazo, ver [[02 - Escopo e Telas]]) continua **sem definir** —
essa tarefa foi só a ingestão, não o front-end nem a regra de negócio.

### OC/CO — lado CO ganhou fonte (2026-08-11)

Tabela `orcamentos_complementares_obra` criada no Supabase (projeto
`gebjlhkywtnpfqjrakok`), mesmo padrão de `restricoes_obra`: 1 linha por
obra (`id_obra` único), `ocs` (jsonb, array completo das Ordens/Orçamentos
Complementares da obra), `resumo` (jsonb, totais financeiros), `total`
(contagem), `criado_em`/`atualizado_em`. RLS: leitura `anon`/`authenticated`,
escrita só `service_role` (mesma policy de `restricoes_obra`/`pts_emitidas`).

Fonte: API externa `orcamentos_complementares_api` do PortalMSE
(`https://portalmse.com.br/microservices/orcamentos_complementares_api/`,
doc em `README.n8n.html` no próprio domínio) — cobre **Orçamentos
Complementares** (aditivo de escopo, o lado "Change Order"), **não** cobre
Ordens de Compra de material/serviço (linha da tabela acima continua em
aberto). Ingestão: workflow n8n em `painel-mse\n8n\` (ver
`orcamentos-complementares.workflow.json` + `README.md` na mesma pasta).

**Carga completa confirmada (2026-08-11)**: 7 obras, 279 OCs no total
(bate exato com o `total` retornado pela API) — Hitachi 15, Porto Itapoá
49, CNPEM - Faseado 8, Novo Nordisk AP 90, Novo Nordisk AP-Reforço 6, Novo
Nordisk UB/SP 81, CNPEM - Auditório 30 (essa última fora do escopo do
painel, ver decisão abaixo). Levou 2 rodadas de bug de execução do n8n até
chegar aqui (lista fixa de obras + Code node sem modo "cada item" — ver
[[projeto-painel-mse]] 61.1/61.2). **Forma real do `resumo`**, confirmada com dado de verdade (diferente do exemplo
simplificado da doc da API): vem embrulhado no envelope padrão da API —
`{ time, obra_id, data: { aprovado, elaboracao, analise, credito, debito,
saldo, total_ocs } }` — consumo no front precisa ler `resumo.data.saldo`
(etc.), não `resumo.saldo` direto.

**Achado importante no dump completo de `/v1/orcamentos_complementares`**
(279 registros): existe uma obra `id 103, "CNPEM - AUDITÓRIO"` que **não
está** no array `OBRAS` do `prototipo/index.html` (só tem
106/110/94/107/108/91). O workflow n8n tinha uma lista fixa de 6 obras que
teria descartado essa obra em silêncio — corrigido para derivar as obras
direto dos dados recebidos (`obra_id`/`obra_nome` de cada OC), sem lista
própria (ver `painel-mse\n8n\README.md`). **Decisão de produto (2026-08-11,
confirmada pelo usuário)**: CNPEM - Auditório **não** entra como obra do
painel — é outro contrato, fora do escopo do Painel de Obra. A ingestão
continua gravando essa obra na tabela mesmo assim (não filtra na origem,
por ADR-005 — nunca descartar dado real em silêncio); quem filtra é o
FRONT-END, quando o setor OC/CO deixar de ser placeholder: mostrar só
`id_obra` que estiver no array `OBRAS` do painel, ignorando qualquer outro
id que apareça em `orcamentos_complementares_obra` (hoje só o 103, pode
aparecer outro no futuro). Campos reais confirmados são mais ricos que o
exemplo da doc da API (ver README do n8n para a lista completa) — os
campos `solicitacao`/`anexos`/`form_descricao`/`historico` do exemplo da
doc não apareceram na carga real.

Nota antiga sobre Restrições dizia que o termo "compo" precisava de
esclarecimento antes de desenvolver — não apareceu em nenhum campo de
`restricoes_obra` (ver acima) na implementação real de 2026-08-07; segue sem
uso conhecido, não bloqueou nada.

## Ver também
- [[05 - Herança do Dashboard Atual]]
- [[06 - Decisões de Arquitetura]]
