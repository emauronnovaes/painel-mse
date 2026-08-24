# Blueprint do Painel de Obra

Primeiro esboço visual e navegável do **Painel de Obra** ([[02 - Escopo e Telas]]),
para validar layout, tema e o mecanismo de troca lateral antes de fechar a base
técnica (ADR-006, ainda pendente em [[06 - Decisões de Arquitetura]]).

> **Não é o produto.** É um HTML único (React via CDN + Babel standalone, sem
> build — mesma técnica do dashboard atual). Config revisada em 2026-08-05
> (8 setores, ver [[02 - Escopo e Telas]]): Curva S, Encarregados, Histograma,
> Desvios (desde 2026-08-06), Restrições (desde 2026-08-07) e Medições (desde
> 2026-08-10) abrem com **dado real** direto do Supabase (mesmas duas chaves
> anon do dashboard atual) — Desvios lê `EAP` direto, agrupado por Local ×
> Disciplina; Restrições lê `restricoes_obra`; Medições lê `nfs` +
> `proximos_faturamentos`; OC/CO (desde 2026-08-11) lê
> `orcamentos_complementares_obra`; Suprimentos (desde 2026-08-21) lê
> `itens_rmi` e mostra os itens críticos por Curva A (ver seções próprias
> abaixo). Quando a base técnica for decidida, este arquivo é descartável — mas a lógica de
> leitura (mapas de nome/id, detecção de dado congelado) vale a pena carregar
> para a versão real.

## Onde está

`C:\Users\notebook\Documents\painel-mse\prototipo\index.html` — abre direto no
navegador (duplo clique), sem servidor.

**Publicado (2026-08-05)**: https://painel-mse-prototipo.web.app — pra testar
em maior escala (mais gente, mais máquinas) sem depender de cada um abrir o
arquivo local. **Site Hosting isolado** dentro do MESMO projeto Firebase do
dashboard atual (`planejamento-mse`) — decisão explícita pra não arriscar
sobrescrever `planejamento-mse.web.app` (produção). Config em
`painel-mse\firebase.json` (`"site": "painel-mse-prototipo"`, `"public":
"prototipo"`) + `painel-mse\.firebaserc` (mesmo projeto default). Sem
rewrites — a navegação é toda por `location.hash`, nunca sai do
`index.html`. Redeploy: `firebase deploy --only hosting --project
planejamento-mse` de dentro de `painel-mse\`. Mesma ressalva de sempre: as
chaves anon do Supabase ficam no HTML, visíveis a quem abrir a página — já
é assim no dashboard atual, não é uma exposição nova.

## Layout mobile (2026-08-11)

Celular entrou no escopo do Painel de Obra para **consulta de diretor/gestão**
([[01 - Visão do Produto]], [[Design System]]). No blueprint:

- Breakpoint `max-width: 768px`; TV/desktop inalterados acima disso.
- Cabeçalho mais compacto; seletor de obra continua no header.
- Faixa de setores: abas com largura mínima e **scroll horizontal** + setas
  (não drawer) — todas as abas alcançáveis no dedo.
- Conteúdo: margem lateral ~12px; grids de KPI em 1 coluna; gráficos com
  altura mínima utilizável; tabelas em scroll-x; `body` pode rolar na vertical
  (no desktop continua `overflow: hidden` “tela cheia”).
- Tour 360° e placeholders (Suprimentos / OC-CO) só recebem o mesmo casco
  de gutter/altura — sem redesign de conteúdo.

## O que já dá para ver

- Cabeçalho navy (`.header-glow`, gradiente e tokens idênticos ao dashboard
  atual) com logo MSE — ver [[07 - Modelo de Dados]] e ADR-004.
- **Favicon** (2026-08-11): `assets/images/mselogo2.png` (ícone quadrado da
  marca, "mse" branco em fundo vermelho) — mesmo arquivo já usado como
  favicon no `dashboard-main`, copiado pra cá em vez de reaproveitar o
  `mselogo.png` (esse é o logo retangular do cabeçalho, não ficaria bem
  como ícone quadrado de aba do navegador).
- **Título da aba do navegador** (2026-08-11): sempre `MSE - <Setor>` (ex.
  "MSE - Curva S", "MSE - OC / CO"), atualizado via `useEffect` sobre
  `document.title` no `App`, disparado só por mudança de SETOR — trocar de
  obra sem trocar de setor não altera o título (pedido era só o nome da
  aba/setor, não a obra). `<title>` estático do `<head>` também alinhado
  (`MSE - Curva S`, o setor padrão) pra não piscar o título antigo antes
  do React montar.
- **Sem faixa amarela de aviso** — a barra "BLUEPRINT — layout em validação..."
  existiu só durante o desenvolvimento e foi removida a pedido do usuário
  (2026-08-05); a ressalva de que isto é um esboço mora só aqui na
  documentação, não mais na própria tela.
- **Seletor de obra no cabeçalho**: botão com lista suspensa (id + nome, os
  mesmos 6 usados no app de relatórios). Trocar a obra atualiza a URL
  (`/obra/<id>/<setor>`) sem sair do setor atual — fecha ao clicar fora ou
  Esc.

  **Bug de overflow corrigido (2026-08-11)**: "o dropdown de obras está
  saindo um pouco da tela" — o menu (`role="listbox"`) tinha `left:0` E
  `right:0` (esticar pra largura do botão) junto com `minWidth:270`. Como
  o botão costuma ser mais estreito que 270px, e esse seletor fica
  encostado na borda direita do cabeçalho, o CSS resolvia o conflito
  mantendo a borda esquerda fixa e esticando pra direita — vazando pra
  fora da viewport pela direita. Corrigido ancorando só em `right:0` (sem
  `left:0`): o menu cresce pra ESQUERDA (pra dentro da tela) quando
  precisa de mais espaço que o botão, nunca pra fora. Adicionado também um
  `maxWidth:'min(340px, calc(100vw - 24px))'` como rede de segurança pra
  telas muito estreitas. Validado com Playwright em 1920/1366/900px —
  `right` do menu sempre menor que `innerWidth` nas 3.

  **Erro cometido e corrigido no mesmo ajuste**: na 1ª tentativa, o
  comentário explicativo foi escrito como `{/* ... */}` (sintaxe de
  comentário JSX) DENTRO da expressão `aberto && ( ... )`, antes do
  `<div>` — mas ali não é uma lista de filhos JSX, é uma única expressão
  entre parênteses, onde `{...}` abre um literal de objeto, não um
  comentário. Isso quebrou a compilação do Babel in-browser por inteiro
  (tela em branco, capturado pelo Playwright antes do deploy, nunca chegou
  a ir pro ar). Corrigido movendo o comentário pra FORA da expressão,
  como filho JSX irmão antes dela — sintaxe válida. **Lição**: comentário
  `{/* */}` só é válido como filho de uma lista JSX (entre elementos),
  nunca dentro de uma expressão JS comum entre parênteses — nesses casos
  usar `/* */` ou `//` fora das chaves.
- Faixa de setores (8, desde a reconfiguração de 2026-08-05 — ver
  [[02 - Escopo e Telas]]) com troca lateral (setas ‹ › e clique direto),
  numerados, com indicador (ponto) nos que ainda são placeholder.
- URL sincronizada de verdade com `location.hash` (obra **e** setor) —
  continua valendo o princípio "toda tela é endereçável" de
  [[03 - Padrão de URLs e Abas]] (voltar/avançar do navegador funciona), só
  que **sem barra visível** mostrando a rota — removida a pedido do usuário
  (2026-08-05) por poluir a tela; o mecanismo por trás não mudou.
- **Navegação vertical em setor com mais de um conteúdo**: componente
  genérico `PaginasVerticais`, mesmo mecanismo do dashboard atual — scroll do
  mouse pagina (sem barra de rolagem visível). Setor 1 usa isso para separar
  Curva S de Histograma. Ignora o gesto quando o scroll acontece dentro de
  algo já rolável (evita sequestrar listas internas — mesma regra do atual).
  **Transição trocada de `scrollTo` para `transform`** (feedback do usuário,
  2026-08-05: "as transições parecem um pouco travadas"): rolar de verdade um
  contêiner com o SVG pesado do `LineSVG` (dezenas de círculos/textos por
  gráfico) obriga o navegador a repintar a cada frame do scroll — trava em
  máquina mais fraca. Trocado por `translateY` com `transition` em CSS
  (acelerado por GPU, só move uma camada já pintada); a altura de cada página
  e o deslocamento são calculados em `%` (sem medir pixel via JS).
  **Indicador de página redesenhado duas vezes** (2026-08-05): 1ª versão era
  uma seta animada sugerindo a próxima página — removida por feedback
  ("redundante", "não fazia muito sentido"); 2ª versão foram pontos com
  rótulo no topo da própria página — também removidos, a pedido, para não
  ocupar espaço acima do conteúdo. Versão final: **dropdown ao passar o
  mouse sobre a aba do setor** na faixa de cima (só setores com
  `subpaginas` no array `SETORES` mostram a seta ▾ e o dropdown); virou um
  componente controlado (`pagina`/`onMudarPagina` como props, em vez de
  estado interno) porque agora quem decide a página tanto pode ser o scroll
  do mouse quanto o clique no dropdown, e os dois precisam concordar.
  **Ajuste seguinte (mesmo dia, pedido novo)**: "preciso de um botão discreto
  para trocar entre a curva e o histograma" — o dropdown exige passar o mouse
  bem em cima da aba lá no topo, sem afinidade visual com o conteúdo. 1ª
  tentativa foi um botãozinho flutuante no canto inferior direito com o
  rótulo da outra página ("Histograma"/"Curva S") — **sobrepunha a fileira de
  botões do cartão** (Rótulos/Ver todas as colunas/Ver Tabela) em telas mais
  baixas, onde o cartão ocupa quase toda a altura da página. Corrigido na
  hora ("está sobrepondo botões originais, coloque bolinhas na lateral, tipo,
  duas bolinhas, bem minimalista"): virou um indicador de **pontos na lateral
  direita**, `position:absolute; right:10; top:50%` (centralizado
  verticalmente, fora do cartão — a margem de 32px do cartão garante que
  nunca sobrepõe conteúdo), um ponto por página (`paginas.map`), o ativo
  preenchido (`T.blue`, 7px) e os demais só com contorno (6px, opacidade
  0.55) — clique em qualquer ponto vai direto pra página correspondente
  (não só "próxima"). Mesmo princípio da versão com pontos removida
  anteriormente (não ocupa espaço acima do conteúdo), mas na lateral em vez
  do topo, e sem rótulo (só o `title` no hover) — de fato minimalista.
  **Ajuste final, mesmo dia** ("era isso, pode até remover os botões
  separados de curva e histograma na navegação superior"): com os pontos
  laterais resolvendo a troca de subpágina, o dropdown-ao-passar-o-mouse na
  aba do setor (a "versão final" descrita 2 parágrafos acima) virou
  redundante — removido. `TabsSetores` voltou a ser simples: um `<button>`
  por setor, sem `position:relative`/`onMouseEnter`/`onMouseLeave`/estado de
  hover, sem a seta ▾, sem o card `subpagina-drop`. Foram embora também o
  campo `subpaginas` do array `SETORES` (só o setor 1 tinha, e nada mais lê)
  e as classes CSS `.subpagina-drop`/`.subpagina-item` (sem nenhum elemento
  usando). Os pontos laterais foram a última versão do indicador **enquanto
  Curva S e Histograma ainda viviam na mesma aba** — ver a seção
  "Reconfiguração dos setores" mais abaixo: nesse mesmo dia, em seguida, as
  duas viraram abas de nível superior separadas e `PaginasVerticais` (todo
  este bloco de navegação vertical/pontos) foi removido do arquivo por falta
  de uso. Descrição mantida aqui como histórico da evolução do design.
- **Layout adaptável nas páginas verticais** (dois retornos do usuário,
  2026-08-05, mesma causa raiz): o gráfico calculava a própria altura a
  partir da proporção do SVG (`height:'auto'`), ignorando o espaço realmente
  disponível — em janelas mais baixas isso cortava o selo de Desvio no topo
  do cartão da Curva S e, quando o cartão ficava mais alto que a página, o
  excesso vazava visualmente para dentro da página do Histograma (o contêiner
  só recortava nas bordas do conjunto, não por página). Corrigido de verdade:
  cada página isola o próprio `overflow:hidden`; o cartão vira flex
  (`flex:1, minHeight:0`) e o SVG usa `preserveAspectRatio="xMidYMid meet"`
  com `width/height:100%` do contêiner — o gráfico encolhe ou cresce (até um
  teto de altura, para não esticar demais em telas muito altas) sem nunca
  cortar nem vazar para a página vizinha. Testado em três alturas de janela
  (900/700/560px) sem recorte em nenhuma.
- **Textura de fundo por obra, só no cabeçalho** (pedido explícito,
  2026-08-05; ajustado no mesmo dia): a primeira tentativa colocava a foto da
  obra atrás de **toda** a página — o usuário achou que não ficou bom.
  Mudou para o cabeçalho apenas: a mesma foto (`OBRA_VIDEOS` no `index.html`
  atual), em preto e branco a 40% de opacidade, fica entre o fundo navy e o
  texto — o gradiente navy ganhou canal alfa (~88%) para deixar a textura
  aparecer sem comprometer a leitura do logo/nome. O resto da página voltou
  ao cinza liso. Troca com a obra no seletor.
- **Animações herdadas do dashboard atual**: fade+slide ao trocar de setor
  (`screen-slide`), zoom sutil ao entrar numa página vertical
  (`chart-zoom-in`), entrada em cascata dos cartões (`card-enter`), dropdown
  com entrada suave. Todas respeitam `prefers-reduced-motion`.
- **Hover de cartão sem "subida"** (feedback do usuário, 2026-08-05): a
  primeira versão levantava o cartão (`translateY(-2px)`) ao passar o mouse —
  incomodava, principalmente no cartão grande da Curva S. Removido o
  deslocamento; ficou só o realce de sombra/borda (`.card.hoverable:hover`
  sem `transform`).
- **Setor 1, página 1 — módulo de Curva S portado do dashboard atual**
  (2026-08-05, pedido explícito: "utilize o mesmo módulo... com previsto,
  tendência, barras semanais, balões de resumo e afins"). É o `LineSVG` +
  `CurvaChart` originais, colados quase linha a linha, mais os 3 "balões"
  (Previsto Acum. / Realizado Acum. / Desvio) e uma legenda com clique para
  esconder/mostrar cada série. Traz: previsto tracejado, tendência (área +
  linha), realizado com cor pelo semáforo, pontos e % em cada corte, linha
  "HOJE" (com posição fracionária entre o último corte e o próximo), barras
  semanais previsto×real por trás do eixo. Ver a seção "Dados reais" abaixo
  para o que foi **deliberadamente deixado de fora** (modo cliente, filtro de
  período).
- **Botão "Ver Tabela" — análise numérica** (2026-08-05, pedido explícito, com
  a planilha de controle da obra como referência anexada pelo usuário — duas
  rodadas: 1ª versão saiu com semana em linha, usuário pediu o layout real da
  planilha: **semana em coluna, com rolagem horizontal**, métrica em linha,
  agrupada em SEMANAL/ACUMULADO com rótulo vertical fixo). Layout final:
  cabeçalho "Semana" + colunas de métrica (grupo rotacionado + nome) **fixos
  à esquerda** (`position:sticky`) enquanto as ~60 colunas de semana (número
  + data) rolam por baixo — mesmo princípio visual da planilha em anexo.
  Linhas: Desvio/Realizado/Previsto/Tendência/Aderência (SEMANAL) e
  Desvio/Realizado/Previsto/Tendência (ACUMULADO). `curvas_s` ganhou 2
  colunas novas na busca (`semanal_desvio`, `semanal_tendencia`) — já
  existiam na tabela mas não eram lidas (a nota "Dívida Técnica e Riscos" do
  vault `Documents\MSE-Conhecimento` já registrava isso como código morto no
  dashboard atual). **Aderência** é calculada (`Sem. Realizado ÷ Sem.
  Previsto`, convenção de 100% quando os dois são zero — mesma regra da
  planilha de referência), não vem pronta do banco. Validado direto contra a
  planilha do usuário: semana 10 bateu exatamente (previsto 0,09%, realizado
  0,41%, aderência 440,00%). O corte "HOJE" vem destacado (coluna tintada).
  Tem também um botão **Exportar CSV** no mesmo formato transposto da
  planilha (bônus, não pedido — mas a própria referência do usuário era um
  CSV, então fazia sentido fechar o ciclo).
- **Abre já rolada até o corte de referência** (pedido em seguida, mesmo dia):
  por padrão a tabela não começa na semana 1 — a rolagem horizontal já entra
  centralizada na coluna do corte "HOJE" (`idxHoje`), com semanas passadas à
  esquerda e futuro/tendência à direita. Recalculada toda vez que o popup
  abre (não é só na primeira vez).
- **Botão "Ver todas as colunas"** (pedido em seguida, mesmo dia — a primeira
  tentativa foi colocar esse botão na tabela, modo compacto; o usuário
  corrigiu: era sobre o **gráfico**, não a tabela): fica na linha de legenda
  do cartão principal, ao lado de "Ver Tabela". Alterna `forceAllTicks` no
  `LineSVG`/`CurvaChart` — prop já portada verbatim do dashboard antigo mas
  nunca antes exposta por nenhum controle — que troca a amostragem "nice
  step" do eixo X por todas as semanas, uma a uma (`niceStep = 1`). Com 60+
  semanas os rótulos se sobrepõem visualmente (esperado — é a mesma limitação
  já existente no `LineSVG` original, não uma regressão daqui). Botão vira
  "Semanas amostradas" para voltar ao modo padrão. A tabela numérica não tem
  esse toggle — ela sempre mostra todas as semanas via rolagem horizontal.
- **Botão "Rótulos" (mostrar/ocultar valores numéricos do gráfico)** (pedido
  em seguida, mesmo dia — clutter ficou mais evidente depois do toggle "Ver
  todas as colunas"): liga/desliga os textos de valor percentual sobre os
  pontos das linhas Previsto/Realizado **e** sobre as barras semanais
  (`mostrarRotulos` no `LineSVG`, `true` por padrão). 1ª versão só cobria os
  rótulos da linha — usuário corrigiu: os das barras continuavam aparecendo;
  os 2 blocos de texto das barras (`SemPrevisto`/`SemRealizado`) também
  ganharam a mesma condição. Não afeta a linha em si, os pontos, os
  retângulos das barras, os eixos nem as datas — só os textos de valor. Fica
  ao lado do botão "Ver todas as colunas", os dois compõem bem juntos (todas
  as semanas + sem rótulo = gráfico limpo; todas as semanas + com rótulo =
  leitura numérica ponto a ponto).
- **Rótulos arrastáveis com seta leader** (2026-08-11): os textos de valor
  percentual sobre os pontos das 3 séries (`rl-`, `prox-`, `pl-`) são
  arrastáveis com o mouse (`cursor: grab`, `onMouseDown` + listeners no
  `window`). O deslocamento é armazenado em `dragOffsets` (um `{dx, dy}` por
  id de rótulo). Quando o rótulo é movido, uma linha tracejada
  (`strokeDasharray="3 2"`) aparece ligando o ponto original à nova posição
  do texto — o clássico "leader line" de cartografia. O objetivo é resolver
  sobreposição manual quando os rótulos colidem (especialmente em séries
  densas com "Ver todas as colunas" ativo). O offset é volátil (estado React),
  não persiste entre recarregamentos — deliberado, pois o blueprint não tem
  camada de persistência.
- **Modo zoom interativo** (2026-08-11): botão **"Zoom"** na faixa de
  controles. Quando ativo:
  - Scroll do mouse amplia/reduz o gráfico (1×–8×), centrado no cursor.
  - Arraste navega pelo gráfico quando escala > 1×.
  - Cursor muda para `zoom-in` (escala 1×) ou `grab` (ampliado).
  - Badge flutuante no canto inferior direito lembra os gestos disponíveis.
  - Sair do modo reseta a escala para 1×.
  - Implementação: `viewBox` dinâmico no `<svg>` do `LineSVG`
    (prop `zoomViewBox` calculada em `CurvaChart`) — compatível com o drag de
    rótulos existente. O listener de scroll é registrado via `useEffect` com
    `{ passive: false }` diretamente no DOM — necessário porque o React 17+
    registra `onWheel` de forma passiva no root, tornando `e.preventDefault()`
    ineficaz e derrubando o componente (causa do crash "tela branca" que
    apareceu na 1ª versão). `sizeRef`/`modoZoomRef` evitam closure stale nos
    cálculos de pan. Guard `isFinite` + `safeViewBox` previne `NaN`/`Infinity`
    no atributo `viewBox`.

- **Popup "Produtividade Diária" a partir do "Ver Tabela"** (2026-08-05,
  interligação nova): a coluna do **próximo corte** — a primeira semana
  futura da tabela, sem realizado ainda (`info.proxCorte`) — ganha uma
  pastilha "Diário" clicável. Clicar abre um 2º popup, sobreposto ao da
  tabela, com o apontamento diário de `relatorio_produtividade_semanal`
  ([[07 - Modelo de Dados]]) — a MESMA tabela que alimenta o relatório
  semanal em PNG gerado por `Documents\relatorios-pdf`, aqui já filtrada
  para esta obra
  (`id_obra` = o id do Portal, o mesmo de `OBRAS`) e para a semana vigente do
  calendário (`periodo_inicio` = segunda-feira de hoje — sempre essa, mesmo
  para a Novo Nordisk, cuja janela de meta é sexta→quinta). Layout ajustado
  em seguida, mesmo dia ("deixar mais próximo do PNG exportado, coloque os
  dias da semana em colunas") — 1ª versão listava os dias em linha, cada um
  com seu rótulo por extenso; virou uma tabela só, dias em coluna (ordem certa
  do grupo — `ORDEM_DIAS_NN` para os ids 91/107/108, `ORDEM_DIAS_PADRAO` para
  o resto) mais uma coluna "Acumulado" ao final, igual à grade de
  produtividade diária do PNG. **Exceção deliberada à regra geral de "sem
  abreviação"** deste projeto (nota de memória "Sem abreviações na UI"): o
  cabeçalho de cada coluna usa o rótulo curto do PNG ("Seg", "Ter"... mesmas
  siglas de `ORDEM_PADRAO`/`ORDEM_NN` no `gerar_relatorio.py`), porque o
  pedido explícito era parecer com o PNG, que já abrevia por espaço; o nome
  por extenso continua acessível via `title` (tooltip) no `<th>`. Cada célula
  colorida verde/vermelho contra a meta diária — mesmo sinal visual do PNG.
  Ajuste seguinte, mesmo dia ("as letras estão muito pequenas"): fonte e
  modal aumentados neste popup (620px→720px / 62vh→68vh, valores do dia
  13px→17px) e também no popup "Ver Tabela" (1240px→1320px / 72vh→76vh,
  células 12px→13px); a legenda "Fonte: manual-parcial" saiu do popup diário
  (não pedida, informação interna da ingestão sem valor para quem olha o
  painel). Mais um ajuste no mesmo dia ("as transições parecem lentas e
  travadas"): a animação de entrada dos popups (`.modal-card-in`,
  `modalCardIn`) tinha `scale(.98→1)` junto com o `translateY` — escalar um
  cartão com tabela densa e várias colunas `position:sticky` (o "Ver Tabela"
  chega a ~60 colunas) força o navegador a re-amostrar texto e bordas em cada
  frame, o mesmo tipo de custo por frame que já tinha causado travamento nas
  páginas verticais (ajuste "fluidez das transições", mais acima nesta
  nota). Removido o `scale()` (só `translateY` — mais barato
  de compor), acrescentado `will-change: transform, opacity` no overlay e no
  cartão (evita o navegador promover a camada de composição tarde, no meio da
  1ª animação) e encurtadas as durações (overlay 0.22s→0.16s, cartão
  0.32s→0.18s) — efeito colateral positivo: vale para TODOS os popups que
  usam essas duas classes (Ver Tabela, Diário, os 2 de detalhamento do
  Efetivo, o resumo). Sem alteração visual fora da própria animação. Meta é
  calculada em `calcularMetaSemana`, port fiel de `calcular_metricas()` do
  `gerar_relatorio.py` (mesmo baseline: último corte JÁ REALIZADO antes do
  início da janela, nunca um corte dentro da própria semana sendo medida — a
  meta não pode depender de um resultado que só existe no fim dela mesma).
  Dias sem apontamento mostram "—", nunca zero (ADR-005); se a semana ainda
  não tem nenhuma linha em `relatorio_produtividade_semanal`, o popup diz
  isso explicitamente em vez de mostrar uma tabela vazia. Validado ao vivo
  (sem mock) em CNPEM (`fonte: manual-parcial` — mesmo desvio entre o Apps
  Script implantado e a cópia local já registrado à parte na memória do
  projeto `relatorios-pdf`) e Novo Nordisk-AP (janela sex→qui, ordem dos dias
  e meta corretas), sem erros de console.
- **Setor 1, página 2 — módulo de Efetivo portado do dashboard atual**
  (2026-08-05, pedido explícito: "deve ser o mesmo módulo... com os mesmos
  botões e funcionalidades"). É o `EfetivoSection` original quase inteiro:
  granularidade Dia/Semana/Mês, filtro MOI/MOD/Total, esconder Previsto/Real
  (clique no chip), filtro de intervalo de datas (Dia/Semana), exportar PNG,
  e clique em qualquer barra abre um popup de detalhamento (Real: nome,
  função, empresa, MOI/MOD, dias presentes — buscável e ordenável por
  coluna; Previsto: função, MOI/MOD, quantidade). Mês sem dado ao vivo cai no
  histórico (`efetivo_real_historico`) com aviso animado de "sem histórico"
  se a pessoa tentar abrir o detalhe. **Deixado de fora**: nada — a única
  coisa realmente removida foram os botões "voltar para seção acima"/"mapas
  ▼" do dashboard atual, porque não fazem sentido aqui (nossa navegação entre
  Curva S e Histograma é o dropdown do setor, não scroll de seção).
- **Quadro-resumo de Efetivo** (pedido junto, 2026-08-05): 3 balões —
  Efetivo Total Disponível, % MOI, % MOD — acima do módulo, sempre com o dado
  **diário mais recente** (`vw_efetivo_diario_total` +
  `vw_efetivo_diario_moimod_total`, filtrado por MOI e por MOD), independente
  da granularidade/filtro escolhidos no gráfico abaixo. Não existe no
  dashboard atual — é novo neste painel. O balão "Efetivo Total Disponível" é
  **clicável** (pedido em seguida, mesmo dia): abre um popup com a lista de
  quem compõe esse número — nome, função e MOI/MOD (`vw_efetivo_diario_pessoas`
  do mesmo dia do balão), buscável e ordenável por coluna, igual ao padrão dos
  outros dois popups do módulo.
- **Popups redimensionados** (feedback do usuário, 2026-08-05: "está muito
  grande, talvez ainda esteja no padrão anterior"): o popup de detalhamento
  do Real ainda estava no tamanho do dashboard atual (860px, 80vh) — grande
  demais para o resto do painel, que é mais compacto. Reduzido para 620px/64vh
  (Real), 460px/60vh (Previsto) e 520px/64vh (o novo, do resumo), com fontes e
  preenchimento de célula um pouco menores. Não muda dado nem funcionalidade,
  só a régua visual.
- **Menos remontagem ao trocar de obra** (mesmo feedback de fluidez,
  2026-08-05): a área de conteúdo remontava por inteiro a cada troca de obra
  (`key` incluía o id da obra) — isso destruía e recriava o módulo de Curva S
  e o de Efetivo toda vez, com flash de esqueleto de carregamento no meio do
  fade. A `key` agora remonta só quando o **setor** muda, não a obra; o dado
  atualiza in-loco via as props/efeitos que já reagiam a `obraId` mesmo antes.
  Isso expôs um bug real: os dois popups de detalhamento do módulo de Efetivo
  buscavam o detalhe sem `obraId` nas dependências do `useEffect` — trocar de
  obra com um popup aberto mantinha o dado da obra antiga na tela. Corrigido
  junto (adicionado `obraId` às duas listas de dependência); testado trocando
  de obra com o popup do Real aberto — atualiza certo, sem travar.
- **Setor 2 — Desvios, com dado real (depois voltou a placeholder)**: dois
  cartões (físico e financeiro) lado a lado (não paginado — comparação
  funciona melhor visível ao mesmo tempo), cor pelo mesmo semáforo. Físico
  vem de `curvas_s.acum_desvio`; financeiro vem de `curva_avanco_historico`,
  com a etiqueta "dado desatualizado" quando o corte tem mais de uma semana
  — ver a seção "Dados reais" abaixo para o porquê de não ser trivial pegar
  "a última linha". **2026-08-05, mesmo dia, decisão do usuário**: "mantenha
  igual aos outros, em desenvolvimento" — a rota `desvios` voltou a cair no
  `SetorPlaceholder` genérico (`SETORES[1].estado` = `'placeholder'`), pra
  ficar visualmente igual aos setores 3-6 antes do teste em maior escala. O
  código de `SetorDesvios`/`CardDesvio` e os cálculos de `desvioFisico`/
  `desvioFinanceiro` continuam no arquivo, corretos — só a busca de
  `curva_avanco_historico` foi pausada (comentada), já que não tinha mais
  nenhuma tela consumindo o resultado e ficaria só gastando leitura do
  Supabase à toa a cada carregamento, logo antes de um teste com mais gente
  batendo no banco. Reativar é 2 passos: descomentar o fetch e trocar a
  rota de volta em `App`.
- **Setores em placeholder** (Suprimentos, OC/CO): tela única e
  reutilizável — ícone, "EM ELABORAÇÃO", descrição do que vai entrar, e a
  rota já definitiva. Suprimentos entrou como placeholder por decisão do
  usuário em 2026-08-04 (falta fechar a regra de "crítico") — ver
  [[02 - Escopo e Telas]]. Desvios (setor 6) saiu do placeholder em
  2026-08-06, Restrições (setor 7) em 2026-08-07 e Medições (setor 8) em
  2026-08-10 — ver seções próprias abaixo.

## Reconfiguração dos setores (2026-08-05) — Histograma virou aba própria + Encarregados entrou

Pedido explícito do usuário, mesmo dia dos ajustes anteriores: *"histograma
passará a ser uma aba isolada, então a configuração revisada ficará: Curva S,
Encarregados (Importar do ranking do dash antigo), Histograma, RMI, OC/CO,
Desvios, Restrições e Medições"*. "RMI" foi esclarecido em seguida pelo
próprio usuário como sendo a aba já existente de Suprimentos, só mantendo o
nome — não é conteúdo novo.

**O que mudou:**
- `SETORES` foi de 6 pra 8 entradas, na nova ordem (ver [[02 - Escopo e Telas]]
  pra tabela completa e slugs). Curva S e Histograma, que viviam juntos numa
  aba só (2 páginas com scroll/pontos laterais — descrito mais acima nesta
  nota), viraram 2 abas de nível superior, cada uma no seu
  slug próprio (`curva-s`, `histograma`). Isso tornou `PaginasVerticais`
  (o componente de páginas verticais genérico) **sem nenhum consumidor** —
  removido do arquivo (dava pra manter "por precaução", mas nada usa e o
  próprio código já está no histórico do Firebase se precisar de novo).
- Nova aba **Encarregados** (setor 2) — ver seção própria abaixo.
- `App` ganhou uma 3ª ramificação de rota (`curva-s` / `histograma` /
  `encarregados` / placeholder), removido o componente-ponte `SetorCurvaS`
  que só existia pra empacotar Curva S+Histograma dentro do `PaginasVerticais`.

### Aba Encarregados — porta "Performance de Encarregados" (`LoopEncSection`) do dashboard atual

**Qual tela é a fonte, exatamente**: o pedido original ("importar do ranking
do dash antigo") era ambíguo entre duas telas bem diferentes do dashboard
atual — perguntei ao usuário, que confirmou: é a `LoopEncSection`
("Performance de Encarregados", vive dentro da página de cada obra), **não**
a `RankingScreen` ("Ranking de Obras", um placar comparando obras entre si,
que não se encaixaria no modelo "uma obra por vez" do painel novo).

**Autossuficiente**, mesmo padrão do `ModuloEfetivo`: busca os próprios dados
a partir de `obraId`, sem depender de um objeto `obra` pré-carregado como no
dashboard atual. 6 fontes reais do Supabase, nenhum dado inventado:

| Fonte | Uso |
|---|---|
| `vw_dados_tv` | aderência linear diária por encarregado (`ADERENCIA_LINEAR`), últimos 21 dias |
| `cards_ativos` | elegibilidade — só entra quem tem card ativo nesta obra OU apontou no próprio dia de referência |
| `Apontamentos` | `status_qualidade` no dia de referência de cada card → badge Qualidade |
| `v_indices_financeiros_diario` | valor mais recente por card → badge Produtividade |
| `apontamento_efetivo` | snapshot mais recente → coluna Colaboradores + total da obra |
| `pts_emitidas` | última liberação de PT do dia → coluna PT (só existe pra Novo Nordisk AP/UB) |
| `efetivo_diario_raw` *(projeto Efetivo)* | selo "Ausente", últimos 7 dias |

**A armadilha real deste port**: `vw_dados_tv.OBRA`/`cards_ativos.nome_obra`
usam uma convenção de nome de obra ("CNPEM-FASEADA", "NN - AP -
ELETROMECÂNICA ") diferente de `curvas_s.obra` ("CNPEM - FASEADO") — e
`pts_emitidas.obra` usa uma **3ª** convenção só pra Novo Nordisk ("Novo
Nordisk AP"). Confirmado ao vivo com 3 queries diretas no Supabase antes de
escrever qualquer código (nunca assumido) — ver armadilha 8 em
[[07 - Modelo de Dados]]. `OBRAS` ganhou 2 campos novos: `origemTV`
(vw_dados_tv/cards_ativos) e `origemPTS` (pts_emitidas, só nas 2 obras que
têm).

**Regra de elegibilidade e dia de referência** — mesma lógica corrigida no
dashboard atual mais cedo nesta sessão (fix do `RankingScreen`, ver histórico
do repo `planejamento_dash`): dia de referência é POR ENCARREGADO (fim de
semana só conta se ele tiver apontamento nele; senão recua ao último dia
útil, pulando feriados nacionais — `getDiaAderenciaComFallback`, porta
verbatim); elegível é quem tem card ativo nesta obra OU apontou no seu
próprio dia de referência (apontamento antigo sem card ativo = tarefa
concluída/realocada, não deveria aparecer). Ausente sempre por último, depois
sem-apontamento, depois por aderência decrescente — mesmo critério de
ordenação do original.

**Ausente blanqueia os indicadores do dia** (achado ao testar, não estava no
1º rascunho): Qualidade/Colaboradores/Produtividade/PT ficam em "—" quando o
encarregado está marcado ausente naquele dia — mostrar o índice de
produtividade de um dia em que a pessoa não trabalhou não faz sentido. A
1ª versão só aplicava esse tratamento a quem não tinha apontamento algum
(`semApontamentos`), não a quem estava simplesmente ausente — corrigido ao
validar com dado real (Miguel Manabu Yamashita, obra CNPEM, aparecia Ausente
mas com produtividade/colaboradores de outro dia preenchidos).

**Deixado de fora de propósito** (dá pra portar depois se pedirem): exportar
PNG do ranking, e o toggle de Assiduidade (a própria seção original já
rotula essa métrica como "só informativa, não entra no score").

### Popup "Cards Ativos" (2026-08-06) — porta `CardsModal` do dashboard atual

Pedido explícito, mesmo dia: *"na tela dos encarregados, preciso do sistema
de pop-ups que existiam no relatório antigo. Que exibe os cards ativos, com
informações de efetivo alocado. Igual ao dash antigo."* — a omissão do
parágrafo acima ("clique no nome pra abrir os cards") foi revertida no mesmo
dia em que foi escrita.

Clicar no nome do encarregado (na tabela de `ModuloEncarregados`) abre
`PopupCardsEncarregado`, porta quase verbatim do `CardsModal` original:
- Busca própria: `cards_ativos?responsavel_encarregado=ilike.*NOME*` (todas
  as obras), filtrado pela obra atual client-side via `origemTV` (a mesma
  convenção confirmada no 25º passo — o original usava `MAPA_OBRAS_SUPABASE`,
  que aqui nem existe).
- Por card: `EAP` (disciplina/local/qtd/saldo/meta diária/datas),
  `apontamento_efetivo` (snapshot mais recente → popup aninhado "Efetivo
  Alocado"), `Apontamentos` (histórico + `UUID` de cada linha) e
  `v_indices_financeiros_diario` (índice de produtividade). A aderência de
  cada card vem cruzando o `UUID` do apontamento do dia de referência com
  `vw_dados_tv.ID` — mais precisa que a aderência agregada por pessoa que
  `ModuloEncarregados` usa (aqui é a aderência DAQUELE card especificamente).
- Cartão por atividade: código/EDT, datas, badge da obra, botão "Efetivo: N"
  (abre o popup aninhado), avanço%, `#card_id`, título da tarefa,
  local/disciplina, e uma fileira de métricas (Quantidade/Saldo/Meta
  Diária/Qualidade/Aderência/Índice de Produtividade — com tooltip "i"
  explicando o índice) mais o histórico dos últimos 3 dias corridos.
  Acento lateral verde/vermelho/azul (concluído/atrasado/em dia).
- Filtros ("Efetivo Alocado", "Apontamento no Último Dia") e toggles de
  exibição ("Histórico de Apontamento", "Índice de Produtividade") — mesmos
  4 controles do original, mesmo comportamento.
- Popup aninhado "Efetivo Alocado": lista nome + função de quem está alocado
  naquele card especificamente (não confundir com a coluna "Colaboradores"
  da tabela principal, que é a contagem por encarregado).

Validado ao vivo: CNPEM/Fernando Coelho do Nascimento (4 cards, 10
colaboradores, histórico de apontamento com "05/08" em destaque, popup de
efetivo com 4 pessoas reais e função), Novo Nordisk-AP/Paulo Henrique da
Conceição Pinheiro (1 card, índice de produtividade 0,94 em vermelho com
tooltip funcionando). Troca de encarregado sem resíduo (fecha, abre outro,
dado bate com o novo). Sem erro de console.

**Ajuste seguinte, mesmo dia** ("ajuste as dimensões do Pop-up"): 1ª versão
saiu grande demais (920px/86vh — maior que qualquer outro popup do painel,
que ficam entre 460 e 720px) por ter copiado a largura do `CardsModal`
original sem revisar contra o padrão já estabelecido aqui. Pergunta rápida
pra confirmar o quê exatamente ajustar (diminuir? aumentar? era o popup
aninhado "Efetivo Alocado"?) — resposta: diminuir o principal. Reduzido para
`maxWidth:720, maxHeight:'72vh'` — mesma faixa do popup "Diário" (720/68vh),
sem precisar inventar um tamanho novo. Efeito colateral aceito: a fileira de
chips "Exibir" quebra pra uma 2ª linha nessa largura (já era `flexWrap:
'wrap'`, então não corta nada, só empilha) — não pedido pra corrigir.
Validado: popup mede exatamente 720×684px num viewport de 950px de altura,
cartões e métricas continuam legíveis, sem erro de console.

Validado ao vivo nas 6 obras: CNPEM (3 encarregados, 1 ausente com células
em branco corretamente), Novo Nordisk-AP (14+ encarregados, coluna PT visível
com horários reais tipo "08:05" em vermelho — regra é verde ≤07:00, amarelo
≤07:15, vermelho depois), Hitachi (1 único encarregado, sem apontamento no
dia de referência — mostra "Alocado" dimmed, aderência média 0%, não trava
nem finge dado). Sem erro de console em nenhuma.

### Bug pego em produção: Curva S esticando infinitamente

Reportado pelo usuário logo depois da reconfiguração acima ("a curva S fica
esticando infinitamente"). Causa raiz: `ModuloCurvaS` era antes renderizado
dentro do slot de página do `PaginasVerticais`, que tinha `overflow:hidden` e
uma altura percentual bem definida (`height:'100%'` de um ancestral com
altura resolvida). Ao remover `PaginasVerticais` (Curva S virou aba própria),
o cartão (`maxHeight:620`, sem `height` fixo, `display:flex;flexDirection:
column`) ficou sem nenhum ancestral de altura definida — e o
`<div style={{flex:1,minHeight:0}}>` que envolve o `CurvaChart` passou a
resolver `height:100%` como `auto` (percentual contra altura automática não
tem base). O `ResizeObserver` do `CurvaChart` media essa altura "auto" (=
altura natural do SVG), realimentava como `size.h` no próximo render, o SVG
ficava mais alto, o `ResizeObserver` disparava de novo com uma altura maior
ainda — um loop de realimentação clássico, crescendo ~170px por ciclo,
sem nenhum erro no console (não é uma exceção, é um loop de layout).
Confirmado medindo a altura do SVG a cada 700ms via Playwright: 700 → 876 →
1048 → 1220 → 1392 → 1560px, crescimento monotônico.

**1ª correção (só estancou o loop, não devolveu o adaptável)**:
`maxHeight:620` → `height:620` fixo no cartão (dá uma base DEFINIDA pro flex
column distribuir, resolvendo a circularidade) + `overflow:'hidden'` no
`<div>` que envolve o `CurvaChart` (rede de segurança). Estancou o loop
(altura do SVG estável em 449px), mas trocou um bug por outro: o cartão
virou altura FIXA, deixou de encolher em telas baixas — usuário reportou na
sequência, mesmo dia: *"a curva S não está em um layout adaptativo, na tela
do notebook é preciso utilizar o scroll para acessar os botões inferiores"*.

**Correção definitiva**: o que faltava não era fixar a altura do cartão, era
dar ao `.screen-slide` (a área de conteúdo em `App`, mãe de todo setor) uma
altura DEFINIDA de verdade — ele já tinha `flex:1` dentro da coluna de
`100vh` do `App`, então SUA altura já era definida, só faltava ele ser
`display:'flex'` pra repassar essa definição aos filhos via porcentagem.
Virou `.screen-slide { flex:1; minHeight:0; display:'flex'; flexDirection:
'column'; overflowY:'auto' }`; o cartão da Curva S voltou a
`flex:1, minHeight:0, maxHeight:620` (adaptável, encolhe até o espaço
disponível, nunca passa de 620) — igual ao comportamento original de quando
vivia dentro do `PaginasVerticais`, só que agora a base definida vem do
`.screen-slide` em vez do wrapper de páginas (que não existe mais).
`overflow:'hidden'` no `<div>` do `CurvaChart` continua como rede de
segurança. Validado com Playwright em 4 alturas de viewport (950/800/700/650px):
SVG estável em cada uma (449/449/354/304px, sem crescimento em nenhuma) e o
botão "Ver Tabela" sempre visível sem rolar. Efeito colateral positivo:
`ModuloEfetivo` e `ModuloEncarregados` já usavam `flex:1,minHeight:0` nas
próprias raízes (inerte até aqui, sem pai flex) — ganharam de graça a mesma
altura definida/adaptável; testado sem regressão nas duas.

### Setor 6 — Desvios, direto da `EAP`, agrupado por Local × Disciplina (2026-08-06)

Pedido original: montar uma tela de desvios por **Local** (chave primária) e
**Disciplina** (secundária), com um "avanço previsto e realizado ponderado"
que conversasse com a Curva S — peso de cada tarefa = `ponderacao_reais` da
tarefa ÷ soma do projeto (excluindo macros).

**Investigação antes de implementar** (mesma disciplina de sempre — validar
contra dado real primeiro, ADR-005 [[06 - Decisões de Arquitetura]]):

1. A fórmula de sinal dada pelo usuário (`desvio = previsto - avanco_atual`)
   testada contra a `EAP` real dava `previsto` negativo/impossível. Corrigida
   para `previsto = avanco_atual - desvio` (mesma convenção de
   `curvas_s.acum_desvio`, negativo = atrasado) — confirmada pelo usuário.
2. Ponderado calculado e comparado com `curvas_s` em 2 obras (CNPEM/cp029 e
   Novo Nordisk-AP): distância grande e **inconsistente** entre as duas —
   não parecia ser só "ruído esperado".
3. Usuário perguntou se o `previsto` do CNPEM (57,57%) não devia estar bem
   maior. Achado real: **`ponderacao_reais` vem preenchida em TODO nível da
   hierarquia EDT no CNPEM** (resumo/macro E as tarefas-filha, ao contrário do
   Novo Nordisk-AP, onde só a folha tem peso) — meu filtro
   `ponderacao_reais IS NOT NULL` somava os dois níveis juntos, peso total
   6,4× inflado (316M contado vs 49,7M correto). Corrigido para "folha real"
   via string do `edt` (uma linha é folha se seu `edt` não é prefixo de
   nenhuma outra linha da mesma obra) — técnica estrutural, não depende de
   nenhuma coluna de peso estar ou não preenchida por nível.
4. Usuário anexou o cronograma real da obra em CSV (`Ajustes Portal -
   Cronograma.csv`, colunas EDT/ID Portal/Peso/Resumo/% física concluída) e
   pediu para validar por `ID Portal` = `EAP.id`. **Confirmado**: os pesos
   batem exatos, em resumo e em folha — `ponderacao_reais` é literalmente o
   Custo (R$) de cada linha, soma hierarquicamente igual ao MS Project, e o
   denominador certo é o custo total do projeto (R$ 51.629.340,30, bate com a
   raiz do CSV).
5. Mesmo com o peso corrigido e validado, a distância do `previsto` ponderado
   contra `curvas_s` **não melhorou** (só o `avanço` ponderado melhorou muito,
   ficando quase exato) — outra causa, não identificada, afeta especificamente
   o `previsto`.

**Decisão do usuário: o ponderado por custo ficou em hold.** A tela final não
usa `ponderacao_reais` nem nenhum peso — só valor absoluto por tarefa e média
aritmética simples (sem peso) agregada por Local e por Disciplina, tudo lido
direto da `EAP`. `ModuloDesvios({obraId, obraNome})`, autossuficiente (mesmo
padrão dos outros módulos):

- Busca `EAP?id_obra=eq.<id>&select=id,edt,tarefa,disciplina,local,avanco_atual,desvio`.
- Filtra folha via `edt` (achado nº 3 acima) — evita contar a mesma tarefa 2×
  quando o resumo/macro também carrega peso/avanço próprio.
- Agrupa em memória (Local → Disciplina → tarefas); `media()` calcula a média
  simples de `avanco_atual`/`desvio` em cada nível (novo helper de dados,
  perto de `parseValNum`).
- UI: 3 balões (Nº Tarefas / Avanço Médio / Desvio Médio, cor pelo mesmo
  `corDesvio` já usado no resto do painel) + tabela expansível de 3 níveis —
  clicar no Local abre as Disciplinas dentro dele, clicar na Disciplina abre
  as tarefas individuais (valor absoluto, sem nenhuma agregação); ordenação
  sempre do desvio mais negativo pro mais positivo, em todos os níveis.
- `SetorDesvios`/`CardDesvio` (os 2 cartões de `curvas_s`/`curva_avanco_historico`
  do 2026-08-05, ver seção acima) continuam no arquivo como código morto
  documentado, não removidos — não são mais a fonte desta aba.

Validado com Playwright, sem erro de console, em 2 obras com estrutura de EDT
bem diferente: CNPEM (1.481 folhas, 77 locais, desvio médio geral **+22,5pp**
— obra adiantada) e Novo Nordisk-AP (1.248 folhas, 35 locais, desvio médio
geral **−78,0pp** — obra bem atrasada). Drill-down testado nos 3 níveis na
CNPEM (Local "619cx 19-20" → Disciplina "CIVIL" → tarefas "Montagem de
tubulação (água doméstica)"/"...de esgoto").

**Achado à parte, útil para o resto do produto**: a coluna `Resumo` (Sim/Não)
do MS Project no CSV marca resumo/macro de forma explícita, mas `EAP` no
Supabase não tem essa coluna — só `edt`. "Folha = ninguém tem esse `edt` como
prefixo" é o substituto correto e funciona em qualquer obra, sem depender de
peso estar populado por nível (o que varia — ver achado nº 3). Também
apareceram EDTs malformados na fonte do CNPEM (ex.: `1.5.3.15.4.1.1` faltando
o prefixo `1.1.`, uma linha com `edt` literal `/`) — explicam um gap de
~3,9% entre a soma de folha calculada e o total real do CSV; não corrigido
(erro de dado na exportação do Portal, não da lógica), só registrado.

**Ajuste seguinte, mesmo dia — locais agrupados por correspondência**: "Os
locais podem ser mais agrupados, por correspondência entre eles. Por exemplo,
no CNPEM, são variações do mesmo nível, geralmente" — o CNPEM tinha 77 locais
distintos na tabela (variações do mesmo nível de prédio: `619cx 19-20`,
`623 - 13-19`, `614,00`, `614cx`, `614cx - 12-13`...). Novo helper
`grupoLocal(local)`: string começando com dígito agrupa pela sequência de
dígitos do início (ignora sufixo `cx`/`,00`/faixa de eixo — `614cx - 12-13`
vira `614`); senão corta no primeiro `" - "` (cobre `"NÍVEL N - <detalhe>"`
do Novo Nordisk); sem nenhum dos dois, usa a string inteira. Usado como chave
de agrupamento do nível 1 em vez do `local` cru — Disciplina e Tarefa não
mudaram. CNPEM caiu de 77 pra **6 grupos** (610/614/619/623/CAG/Sem local,
batendo com os 4 níveis de prédio reais + CAG); Novo Nordisk-AP caiu de 35
pra **9** (NÍVEL 1/2/3 concentram ~99% das tarefas, resto é local fora do
padrão — GROUNDING, AP, "NIVEL 2" sem acento por inconsistência de digitação
na fonte, Pavimento 1, PRÉDIO AP). Mesma regra, sem nenhuma configuração por
obra. Validado com Playwright nas 2 obras, sem erro de console.

**Ajuste seguinte, mesmo dia — só tarefas com desvio negativo**: "Precisamos
apenas exibir tarefas com desvio negativo". Nova etapa `folhasAtrasadas`
(filtro `desvio < 0`, que em JS já descarta `null` de graça — sem sinal
definido não entra) entre a folha e o agrupamento por Local/Disciplina;
balão "Tarefas na EAP" renomeado para "Tarefas com Desvio Negativo". CNPEM
caiu de 1.481 folhas pra **92** tarefas atrasadas, e o grupo "Sem local"
desapareceu por não ter nenhuma tarefa negativa. Validado com Playwright,
sem erro de console.

**Ajuste seguinte, mesmo dia — datas de Linha de Base só nos itens, `pp`→`%`**:
"vamos exibir datas, início e término a princípio, que se referem a BL. Não
vamos calcular médio por ora, vamos manter apenas nos itens. Troque pp por
%". Antes de assumir qual coluna do `EAP` é a Linha de Base, confirmei ao
vivo com o exemplo do CSV onde baseline e reprogramado divergem (ID Portal
26670, "Adequação do Quadro QLF-E-ADM-610..."): `data_inicio`/`data_termino`
= 2026-06-22/24 (bate com "Início/Término da Linha de Base" do CSV);
`data_inicio_reprogramado`/`data_termino_reprogramado` = 2026-07-20/24 (bate
com "Início"/"Término" correntes, o cronograma já reprogramado). Confirmado:
`data_inicio`/`data_termino` são a BL — adicionadas ao `select`. Tabela
ganhou 2 colunas ("Início (BL)"/"Término (BL)", `fmtDataLonga` já existente
do módulo de Curva S) que só aparecem preenchidas na linha de **tarefa**
(folha) — em branco em Local/Disciplina, sem nenhuma agregação/média sobre
elas (não pedido "por ora"). Todo texto de desvio trocado de `pp` pra `%`,
nos 2 níveis de agregação, no item e no balão "Desvio Médio". Validado com
Playwright, sem erro de console.

**Ajuste seguinte, mesmo dia — desvio ponderado, restrito aos itens do
próprio grupo**: "Inclua o desvio ponderado, destes itens, apenas". Diferente
do ponderado que ficou em hold mais acima (que tentava reconciliar com a
Curva S usando o peso do projeto inteiro — não fechou), este é mais simples e
sempre bem definido: `mediaPonderada(lista, campoValor, campoPeso)` pondera
`desvio` por `ponderacao_reais`, mas o peso é só ÷ soma de `ponderacao_reais`
**dos próprios itens filtrados** (o grupo de Local, ou de Disciplina) —
nunca contra o total da obra, então não há nada pra reconciliar contra
`curvas_s`. Nova coluna "Desvio Ponderado" ao lado de "Desvio Médio" em
Local/Disciplina (em branco no item — ponderar um item sozinho não muda
nada) + 4º balão no resumo geral (grid virou `repeat(4,1fr)`).
`ponderacao_reais` entrou no `select` do fetch. Validado com Playwright:
CNPEM geral desvio médio −66,8% vs ponderado −64,1% (grupo "619" diverge mais
do simples — −36,7% médio vs −24,1% ponderado, sinal de que suas tarefas de
maior peso estão relativamente menos atrasadas que as de peso menor). Sem
erro de console.

**Ajuste seguinte, mesmo dia — previsto e avanço ponderados exibidos, desvio
ponderado passou a ser derivado dos dois**: "Exiba o previsto e o avanço
ponderado, o desvio vai ser calculado a partir disso". Até aqui "Desvio
Ponderado" era `mediaPonderada(tarefas, 'desvio', ...)` direto; agora
`previsto` é derivado por tarefa (`avanco_atual - desvio`, mesma fórmula
confirmada mais acima) dentro de `folhasAtrasadas`, e cada grupo calcula
`previstoPonderado`/`avancoPonderado` e só então `desvioPonderado =
avancoPonderado - previstoPonderado` (helper `comPonderado`). Dá
matematicamente o mesmo valor de antes (média ponderada é linear), mas o
cálculo agora é auditável na própria tela — bate exato (grupo "619": 75,9%
avanço − 100,0% previsto = −24,1% desvio, os 3 números visíveis lado a
lado). 2 balões novos (Previsto Ponderado/Avanço Ponderado — resumo virou 2
fileiras de 3) e 2 colunas correspondentes na tabela (em branco no item,
mesmo padrão do Desvio Ponderado). Validado com Playwright, sem erro de
console.

**Correção rápida, mesmo dia**: "mas nas tarefas não está exibindo, só nos
macros" — as 3 colunas ponderadas tinham ficado deliberadamente em branco na
linha de tarefa (ponderar 1 item sozinho é redundante, o valor é o próprio
item) — usuário preferiu ver mesmo assim. Preenchidas com o valor trivial do
próprio item (`t.previsto`/`t.avanco_atual`/`t.desvio`). Validado com
Playwright, sem erro de console.

**Correção da fórmula, mesmo dia**: "Está errado, o previsto ponderado é o
absoluto * peso" — a versão anterior usava média ponderada renormalizada
POR GRUPO (Local recalculava o peso só entre suas próprias tarefas). Fórmula
certa (a mesma da investigação original, só que com "estes itens" — as 92
tarefas atrasadas — no lugar de "todo o projeto" como escopo do peso): peso
da tarefa = `ponderacao_reais` ÷ soma de `ponderacao_reais` de TODAS as 92
tarefas (peso fixo, calculado uma vez); ponderado da tarefa = valor absoluto
× esse peso (fração pequena); agregação em qualquer nível = **soma** dos
ponderados das tarefas do grupo, nunca uma nova média. `folhasAtrasadas`
pré-calcula `avancoPonderado`/`previstoPonderado` por tarefa; `grupos` só
soma esses campos já prontos (helper `soma`, substituiu `mediaPonderada`).
Efeito visível: os 5 grupos do CNPEM agora somam de volta o total geral exato
(0,2+26,2+27,8+32,1+9,6 ≈ 95,8% previsto ponderado geral) — antes, cada
grupo tinha peso renormalizado e não somava a nada coerente. Nas tarefas
individuais os valores ficaram pequenos (ex.: 0,06%/0,08%/0,02% — fração de
peso daquela tarefa sozinha dentro das 92), por isso ganharam 2 casas
decimais em vez de 1. Validado com Playwright, sem erro de console.

**Coluna "Peso", mesmo dia**: "Exiba também o peso de cada tarefa" — o peso
já era calculado internamente na correção anterior, só não estava exposto.
Nova coluna entre "Desvio Médio" e "Previsto Ponderado", com o valor por
tarefa e a soma por grupo. Serve de conferência visual: os 5 grupos do CNPEM
somam ~100,1% (arredondamento) — confirma que o peso fecha certo sobre as 92
tarefas atrasadas. Validado com Playwright, sem erro de console.

**Correção do denominador do peso, com exemplo numérico do usuário, mesmo
dia**: "534247,38 é o valor da Montagem de Tubulação AC da CAG, então
dividindo por R$ 51.629.340,30 daria 0,0103477475577971 de peso do item, *
34,50% de avanço daria um avanço ponderado de 0,3569" — expôs que o peso
estava sendo renormalizado contra a soma das 92 tarefas atrasadas (errado),
quando devia ser contra o total do projeto inteiro (igual à investigação
original, mais acima nesta nota). "O total do projeto" não é uma linha única
na `EAP` — a CSV só mostra isso na raiz decorativa "1", sem `ID Portal`, que
nem existe na `EAP`. Testado ao vivo: a soma das linhas **raiz** (`edt` sem
pai no dataset — não confundir com "folha", é o topo da árvore, não a base)
fecha exato: R$51.629.338,60 pro CNPEM vs R$51.629.340,30 do CSV (diferença
de R$1,70). Bem melhor que a soma das folhas (R$49,68M, prejudicada pelos
EDTs malformados já catalogados) — a raiz já carrega o rollup completo, sem
depender de nenhuma folha individual estar bem formada. Testado nas outras 4
obras (Hitachi, Porto Itapoá, NN-UB, NN-AP-Reforço): nunca quebra, degrada
pra peso=0 nas 2 que não têm `ponderacao_reais` na raiz. Novo
`pesoTotalProjeto` (useMemo próprio, só depende de `eapRaw`) substituiu a
soma sobre `folhasAtrasadas`. Confirmado com o exemplo exato do usuário
(peso 1,03%, avanço ponderado 0,36%). Efeito visível: o peso geral do resumo
caiu de ~100% (errado, só contra si mesmo) pra ~6,8% (peso real das 92
tarefas atrasadas dentro das 1.481 tarefas do projeto inteiro). Validado com
Playwright, sem erro de console.

**Resumo simplificado pra 2 balões, mesmo dia**: "o avanço médio resumo não é
necessário. Vamos manter apenas a indicação das tarefas com desvio e o
desvio ponderado, que será: Impacto Negativo (Curva S)". Removidos os 4
balões (Avanço Médio/Desvio Médio/Previsto Ponderado/Avanço Ponderado) do
resumo — a tabela abaixo continua com todas as colunas, o corte foi só no
resumo. Ficaram 2: "Tarefas com Desvio Negativo" e "Desvio Ponderado"
renomeado pra "Impacto Negativo (Curva S)". Validado com Playwright, sem
erro de console.

**Tabela mais enxuta, mesmo dia**: "No lugar de avanço médio, vamos ter
simplesmente 'Avanço' que não agrega no macro. Nº de tarefas não é
necessário na coluna, nem desvio médio. Inclua o 'Previsto'". Removidas as
colunas "Nº Tarefas" e "Desvio Médio" (sem substituto). "Avanço Médio" virou
"Avanço", mas parou de agregar no Local/Disciplina (célula em branco lá,
mesmo padrão já usado pras datas BL) — só aparece no item, valor absoluto.
Nova coluna "Previsto" no mesmo padrão. Tabela final: Local/Disciplina/Tarefa
· Avanço · Previsto · Peso · Previsto Ponderado · Avanço Ponderado · Desvio
Ponderado · Início (BL) · Término (BL). Ordenação de Local/Disciplina trocou
de `desvioMedio` (removido) pra `desvioPonderado`. Validado com Playwright,
sem erro de console.

**Ordenar por EDT, exibir EDT, filtrar por impacto mínimo na Curva S, mesmo
dia**: "Organize as atividades pela EDT, ordenadas desta forma. Importante
exibir a EDT também. Por default, não precisa exibir todas as tarefas com
desvio, só aquela com desvio de pelo menos 0,01% da Curva S". Novo
`compararEdt(a,b)` ordena por segmento numérico (`"1.5.7.2.3.10"` depois de
`"...3.9"`, não antes, como daria ordenação de string pura), substituindo o
sort por `t.desvio` na listagem de tarefas de cada disciplina; EDT malformado
cai pro fim sem travar os demais. Nova coluna "EDT" (só no item). Novo
filtro: tarefa só aparece na listagem se `|avancoPonderado - previstoPonderado|
>= 0,01` (`LIMIAR_IMPACTO_CURVA_S`) — só na **listagem**; os agregados de
Local/Disciplina/geral continuam somando TODAS as 92 tarefas, senão o
"Impacto Negativo (Curva S)" mostraria número menor que o real. Validado com
Playwright em CNPEM (EDTs "1.5.7.2.3.1/2/3" na ordem certa) e Novo
Nordisk-AP, sem erro de console.

**Macro vazio some, EDT vira 1ª coluna, mesmo dia**: "Como suprimiu, alguns
macros ficaram vazios, nesse caso, não precisamos deles também. A EDT deve
ser a primeira coluna. Local / Disciplina / Tarefa deverá ser identado, como
árvore de um item". O filtro de impacto passou a viver no `grupos` (não mais
no JSX): `tarefasVisiveis` calculado por disciplina; disciplina sem nenhuma
tarefa visível sai do array de disciplinas do Local; Local sem nenhuma
disciplina restante sai da lista de grupos. Os totais ponderados de cada
nível continuam somando TODAS as tarefas do grupo — só a existência do macro
depende do filtro, não o valor mostrado. EDT virou a 1ª coluna; a coluna de
nome manteve a indentação em árvore de sempre (Local raso, Disciplina +34px,
Tarefa +54px), só trocou de posição. Efeito no CNPEM: grupo "610" (só tinha
tarefas abaixo do limiar, mostrava 0,0% em tudo) desapareceu da lista.
Validado com Playwright em CNPEM e Novo Nordisk-AP (ambos perderam 1 grupo
vazio), sem erro de console.

**Padronização tipográfica da tabela, mesmo dia**: "Padronize as fontes e
tamanhos, melhore a estética da tabela no geral" — depois de várias rodadas
de patch incremental, Local/Disciplina tinham herdado o `font-size` padrão
do `body` (16px, sem override) enquanto Tarefa já tinha `fontSize:12`
explícito — salto abrupto de tamanho entre níveis; as colunas secundárias
(Peso/Previsto Ponderado/Avanço Ponderado) usavam a cor quase preta do body,
igual ao "Desvio Ponderado", sem hierarquia visual entre o número-âncora e
os de apoio. Criado `ESTILO_NIVEL` (tamanho/peso/cor decrescendo a cada
nível) e `CelulaPonderado` (decide fonte+cor pelo nível e se é `destaque`).
Efeito: só "Desvio Ponderado" chama atenção (cor do semáforo + negrito), as
demais colunas ponderadas ficam neutras em todo nível, e a hierarquia
Local(13.5px bold) > Disciplina(13px semibold) > Tarefa(12px normal) fica
visível de cara. `fontVariantNumeric:'tabular-nums'` em toda célula numérica.
Validado com Playwright nas 2 obras, sem erro de console.

**Botões "Abrir até o nível 1/2/3", mesmo dia**: "Inclua um botão para abrir
por nível, tipo 1, 2 e 3". O estado de expansão era acordeão de item único
(`localAberto`/`disciplinaAberta`) — virou `locaisAbertos`/`disciplinasAbertas`
(`Set`, multi-seleção). 3 botões pequenos acima da tabela: Nível 1 fecha tudo
(só Local); Nível 2 abre todos os Locais, Disciplina fechada; Nível 3 abre
tudo até a Tarefa. É ação em lote, não toggle persistente — depois de
clicar, o usuário ainda pode abrir/fechar itens individualmente por cima.
Validado com Playwright: nível 1 = 4 linhas, nível 2 = 18, nível 3 = 69
(CNPEM), sem erro de console.

**Coluna "Responsável", 2026-08-10**: "vamos trazer o responsável pelo
desvio, também". Campo é `EAP.encarregado_nome` — mesma coluna que
`vw_dados_tv` já usa como RESPONSÁVEL (dono atual do card na EAP, ver
[[modelo-dados-supabase]]), agora também selecionada na query do setor
Desvios. Nova coluna "Responsável" entre Previsto e Peso, só no nível Tarefa
(Local/Disciplina ficam em branco, mesmo padrão das datas BL). **Confirmado
no banco antes de implementar**: o campo é esparso — de 58 a 1.539 tarefas
com desvio negativo por obra, só 9% (CNPEM) a 27% (NN-AP) têm
`encarregado_nome` preenchido; mostra "—" em cinza quando vazio, nunca
inventa (ADR-005). Validado com Playwright em Novo Nordisk-AP (maior taxa de
preenchimento): nomes reais aparecem nas tarefas que têm encarregado
(confirmados JEREMIAS NOVAES SANTA ROSA, DIONE SANTOS SILVA, ALEX VILA NOVA
DE SOUZA), "—" nas demais, sem erro de console.

**Mais cor na tabela, 2026-08-10**: "vamos incluir um pouco mais de cor,
nesta aba. Deixar esteticamente mais agradável" — até aqui só o texto do
"Desvio Ponderado" era colorido (`corDesvio`), o resto da tabela era
cinza/preto. Novo helper `corDesvioTom(pp)` (mesmo padrão de
`corCriticidade`/`corStatusRestricao`: par cor+fundo+borda, mesma faixa de
`corDesvio` — verde ≥0%, âmbar ≥-5%, vermelho abaixo). Aplicado em 3
lugares: (1) "Desvio Ponderado" virou **pill** com fundo tintado (antes era
só texto colorido em negrito) nos 3 níveis (Local/Disciplina/Tarefa); (2)
faixa colorida de 4px (Local) / 3px a 70% de opacidade (Disciplina) na
borda esquerda da linha, pela severidade do próprio grupo — dá pra escanear
a gravidade rolando o olho pela lateral, sem ler número; (3) o balão
"Impacto Negativo (Curva S)" trocou o âmbar fixo por tom dinâmico
(`tomImpacto`) — fica vermelho quando o impacto geral da obra passa de -5%
(caso do Novo Nordisk-AP, -77,1%), âmbar quando é mais brando (CNPEM,
-4,5%). Detalhe menor: as setinhas ▸/▾ de expandir e os 3 botões "Abrir até
o nível" ganharam hover azul (`.btn-nivel`), mesma cor de acento já usada em
elementos interativos no resto do painel (setas de ordenação da tabela de
Restrições). Validado com Playwright em CNPEM e NN-AP (impacto leve vs.
grave, tons diferentes confirmados nos 2), sem erro de console.

**Navy por nível de hierarquia, mesmo dia**: "gere tons diferentes nos
níveis, mais presentes, como um navy e derivados" — até aqui a única cor na
tabela era a de severidade (`corDesvioTom`, no pill/faixa lateral); os 3
níveis (Local/Disciplina/Tarefa) só se diferenciavam por tamanho/peso de
fonte, tudo em tons de cinza. `ESTILO_NIVEL` ganhou `bg` + `cor` na mesma
família de navy do `.header-glow` (rgba(19,34,59)/rgba(31,58,99)) — Local
com wash mais escuro/presente (`rgba(15,30,51,0.11)`, texto `#0f1e33`),
Disciplina um navy mais claro (`rgba(40,70,111,0.07)`, texto `#28466f`),
Tarefa neutro de propósito (linha densa, já citada no comentário original
como "a mais leve"). **É um eixo de cor deliberadamente separado da
severidade** — a faixa lateral e o pill continuam vermelho/âmbar/verde por
gravidade; o novo wash de fundo é só profundidade da árvore, os dois sinais
convivem sem se confundir (cores diferentes, propriedades CSS diferentes).
1ª tentativa (alpha 0.065/0.045) ficou sutil demais pra "mais presentes";
subida pra 0.11/0.07 com hex mais escuro resolveu. Validado com Playwright,
sem erro de console.

**Ordenação por coluna + buscador, 2026-08-10**: "permita ordenar por
coluna, insira o buscador também" — mesmo padrão já usado em Restrições/
Encarregados/Medições (`ordenarPor`/`ordenarDir`, clique no `<th>` alterna
direção, seta ▲/▼ na coluna ativa em azul), mas com uma complicação a mais:
Desvios é uma ÁRVORE (Local > Disciplina > Tarefa), não uma lista plana —
"ordenar por coluna" não tem resposta única.

Solução adotada: as 4 colunas AGREGADAS (Peso, Previsto Ponderado, Avanço
Ponderado, Desvio Ponderado) existem em Local e Disciplina também, então
reordenam os 3 níveis; as colunas só-de-item (EDT, Avanço, Previsto,
Responsável, Início/Término) não existem em nível de grupo, então só
reordenam as TAREFAS dentro de cada disciplina — Local/Disciplina
continuam pela ordem de severidade de sempre (`desvioPonderado`, pior
primeiro). EDT usa o comparador segmentado de sempre (`compararEdt`), não
comparação de string pura. Direção padrão por coluna: texto/EDT/Desvio
Ponderado começam ascendente (Desvio Ponderado ascendente = pior primeiro,
mesma leitura que a tela já tinha antes de existir ordenação); as demais
numéricas começam descendente.

Busca reaproveita `normalizarNomeParaMatch` (mesmo de Restrições/
Encarregados) sobre EDT/tarefa/disciplina/local/responsável de cada folha,
aplicada DENTRO do filtro de impacto já existente (`LIMIAR_IMPACTO_CURVA_S`)
— Disciplina/Local sem nenhuma tarefa visível depois de busca+impacto some
da lista, mesmo comportamento de "macro vazio" que já existia. Contador
"N de M" só aparece com busca ativa. **Cuidado que valeu a pena**: o
`return` antecipado de "Nenhuma tarefa com desvio negativo" checava
`grupos.length === 0`, o que teria escondido a própria busca (e a
mensagem "sem resultado") quando a busca não achava nada — corrigido pra
checar `folhasAtrasadas.length === 0` (estado vazio de verdade,
independente de busca) nesse `return` antecipado, e tratar "busca não
achou nada" dentro do render normal, com a busca continuando editável.

Validado com Playwright (Novo Nordisk-AP, 1074 tarefas): ordenar por
"Responsável" agrupa os "—" primeiro (comportamento correto de string
vazia em ordem ascendente); busca "eletric" acha 182 de 1074, contador
correto; busca sem match mostra "Nenhuma tarefa encontrada" com o campo de
busca ainda visível e editável; sem erro de console.

**Coluna Peso removida, mesmo dia**: "O peso não precisa mais ser exibido"
— tirada dos 3 níveis (`CelulaPonderado` de Local/Disciplina/Tarefa) e do
`COLUNAS_DESVIOS`/cabeçalho. O CAMPO `peso` continua existindo nos dados
(usado internamente pra calcular Avanço/Previsto Ponderado — ver comentário
"Peso de cada tarefa..." mais acima) e saiu de `CAMPOS_AGREGADOS_DESVIOS` e
do `switch` de `valorItemDesvio` (não é mais coluna, não precisa mais ser
ordenável). Validado com Playwright: cabeçalho sem "Peso", 1 coluna a
menos, resto continua funcionando (ordenação, busca); sem erro de console.

**Larguras fixas, mesmo dia**: "Distribua melhor as colunas, talvez largura
fixa" — com `table-layout:auto` (padrão), a coluna Local/Disciplina/Tarefa
(única com texto longo) engolia a maior parte da largura, espremendo as
colunas numéricas de forma desigual entre si. Cada entrada de
`COLUNAS_DESVIOS` ganhou uma `largura` em % (somando 100%: EDT 9%,
Local/Disciplina/Tarefa 19%, Avanço/Previsto 7% cada, Responsável 13%,
as 4 ponderadas 9% cada, Início/Término 9% cada), aplicadas via
`<colgroup>` (1 declaração só, vale pra toda linha da tabela — Local,
Disciplina e Tarefa reaproveitam as mesmas colunas) + `table-layout:'fixed'`
na tabela. Efeito colateral esperado e aceito: nomes de tarefa longos agora
quebram em 2 linhas dentro da largura fixa, em vez de esticar a coluna —
é o comportamento correto de `table-layout:fixed` (mesma técnica, resultado
inverso do que se queria evitar na barra de abas — lá era pra NÃO deixar
overflow, aqui é olhar de novo e aceitar quebra como resultado desejado).
Validado com Playwright: cabeçalhos alinhados com os valores abaixo,
colunas numéricas com espaçamento consistente entre si, sem erro de
console.

**Rebalanceamento das larguras, mesmo dia**: "ainda parece ter um gap
grande entre o responsável e o previsto ponderado, a local / disciplina /
tarefa ficou muito esprimida" — 1ª tentativa (9/19/7/7/13/9×4) deixou
Responsável largo demais (maioria dos valores é "—", sobra vazio) e
Local/Disciplina/Tarefa curta demais (nomes de tarefa longos quebrando
sempre). Redistribuído: EDT 9%→8%, Local/Disciplina/Tarefa 19%→**26%**,
Avanço/Previsto 7%→6% cada, Responsável 13%→**9%**, resto sem mudança
(ainda soma 100%). Validado com Playwright, sem erro de console.

### Setor 7 — Restrições, direto de `restricoes_obra` (2026-08-07)

Pedido: "Vamos montar a página de restrições, que estão na table:
restricoes_obra. Note que o importante está dentro de um json, vamos exibir
esse painel, por obra."

**Investigado antes de implementar** (mesma disciplina de sempre): a tabela
tem 1 linha por obra (6 linhas, `id_obra` idêntico a `OBRAS[].id` — sem mapa
de tradução) e o conteúdo real mora em `restricoes` (jsonb, array),
sincronizado do PortalMSE. Cada item do array: `descricao`, `criticidade`
("Alta"/"Média" confirmadas, "Baixa" não apareceu ainda), `tipo_restricao`/
`nome_tipo_restricao` (ex.: "Liberação de área"), `status_cadastro`/
`status_cadastro_label` (só "Aberto" visto até agora), `data_inicio`/
`data_conclusao` (+ versões já formatadas dd/mm/aaaa, prontas pra exibir sem
reformatar), `nome_eap`/`id_eap`, `responsabilidade`, `usuario_cadastro`.
Só a Novo Nordisk-AP tinha dado real no momento (14 restrições); as outras 5
obras estavam com array vazio.

**Bloqueio real encontrado**: consultando com o anon key (mesmo usado pelo
protótipo inteiro) a tabela vinha sempre vazia — `Content-Range: */0`, sem
erro. Investigando direto no Postgres (não pelo REST), achei que
`restricoes_obra` só tinha `policy "service_role tem acesso total" ... for
all to service_role` — nenhuma policy de SELECT pra `anon`. Confirmado com o
usuário antes de mexer em segurança (⚠️ ação com efeito em RLS): criada
`create policy "leitura anon restricoes_obra" on public.restricoes_obra for
select to anon, authenticated using (true)` — mesmo padrão já usado em
`pts_emitidas`. Só leitura (sem INSERT/UPDATE/DELETE pro anon — o painel
nunca escreve nessa tabela). Revalidado com o anon key depois de aplicar:
as 6 obras aparecem certas. Ver armadilha 11 em [[07 - Modelo de Dados]].

**`ModuloRestricoes({obraId, obraNome})`**, autossuficiente, mesmo padrão dos
outros módulos: busca `restricoes_obra?id_obra=eq.<id>&select=restricoes,
atualizado_em`, extrai o array, ordena por status (Aberto primeiro) →
criticidade (Alta > Média > Baixa > desconhecida) → `data_inicio` (mais
antiga primeiro — mais urgente). UI: 3 balões (Restrições / Abertas /
Criticidade Alta) + tabela plana (sem árvore — o dado não tem hierarquia
Local/Disciplina como a EAP) com badges coloridos pra Criticidade e Status
(`corCriticidade`/`corStatusRestricao`, mesmo estilo pill de
`BadgeQualidade`/`BadgeProdutividade` do módulo de Encarregados — cor+fundo
em par, nunca hardcoded solto). Colunas: Criticidade, Status, Tarefa
(`nome_eap`), Descrição, Tipo, Responsável, Início, Conclusão.

**Domínio de status/criticidade não é conhecido por inteiro** (só o que
apareceu nos 14 registros reais) — `corStatusRestricao` casa por substring
("conclu"/"cancel"/"abert") em vez de lista fechada, pra não deixar um status
novo do Portal cair silenciosamente em cinza sem sentido; criticidade sem
match vira neutro (`T.mut`) em vez de quebrar.

Validado com Playwright: Novo Nordisk-AP mostra as 14 restrições reais (9
Alta, todas Abertas, ordenadas por data crescente); as outras 5 obras
mostram o estado vazio padrão ("Nenhuma restrição cadastrada para esta
obra") sem travar nem inventar dado. Sem erro de console.

**Ordenação por coluna + busca textual, mesmo dia**: "permita ordenar os
campos e fazer buscas textuais" — mesmo padrão de `ModuloEncarregados`
(`ordenarPor`/`ordenarDir`, clique no `<th>` alterna direção, coluna ativa em
azul com seta ▲/▼); a ordenação padrão ("prioridade": Aberto→Criticidade→
data) virou só mais uma opção clicável. Busca reaproveita
`normalizarNomeParaMatch` (já existia, do Encarregados) sobre 7 campos da
restrição; contador "N de M" só aparece com busca ativa; sem resultado
mostra aviso na própria tabela. Validado com Playwright: ordenar por
"Início" inverte certo, busca "conexões" acha 1 de 14, sem erro de console.

**Coluna "Cadastrado por" sem CPF, mesmo dia**: "preciso que exiba o usuario
de cadastro, sem o cpf, só o usuário" — `usuario_cadastro` vem como
`"089.093.626-93 (ELIVAN BARBOSA)"`; novo helper `nomeUsuarioCadastro`
extrai só o conteúdo entre parênteses. Nova coluna entre Responsável e
Início, ordenável. Validado com Playwright, sem erro de console.

### Setor 8 — Medições, direto de `nfs` + `proximos_faturamentos` (2026-08-10)

Pedido: "Inclui duas tables novas no supabase, NFs e proximos faturamentos.
Vamos incluir essas informações na aba de medições do painel. A princípio,
vamos utilizar um layout similar ao da curva s, plotando uma curva pelas NFs
e gerando resumos em cima dos demais valores."

**Investigado antes de implementar**: `nfs` (341 linhas) tem 1 linha por
Nota Fiscal (`nf`, `bm` = nº do Boletim de Medição vinculado, `empresa`,
`emissao`) — **sem nenhuma coluna de valor (R$)**. `proximos_faturamentos`
(7 linhas) tem 1 linha por obra com a próxima `data_prevista` +
`valor_previsto`. As duas usam **código de contrato** ("CP029", "CP273"...)
como chave de obra — uma 4ª convenção de nome, além de
`curva`/`origemTV`/`origemPTS` (ver armadilha 12 em
[[07 - Modelo de Dados]]). Sem tabela de mapa id_obra↔código CP em nenhum
Supabase — o código só aparece embutido no texto de tarefas raiz da `EAP`
(edt sem ponto). Confirmados assim: CP002→Porto Itapoá(94),
CP029→CNPEM(106), CP261→NN-AP-Reforço(108), CP273→NN-AP(107). Novo Nordisk
UB/SP (CP236, 48 NFs) e Hitachi (CP022, 10 NFs/BMs) não achados na EAP —
confirmados diretamente pelo usuário em 2026-08-10. Todas as 6 obras
mapeadas.

**Bloqueio real, igual ao do 45º passo**: as 2 tabelas nasceram **sem
nenhuma policy de RLS** (nem a de `service_role` — pior que a variante do
setor Restrições). Confirmado com o usuário antes (⚠️ ação com efeito em
RLS): criadas `create policy "leitura anon nfs"`/`"leitura anon
proximos_faturamentos" ... for select to anon, authenticated using (true)`.
Só leitura.

**`ModuloMedicoes({obraId, obraNome})`**: sem `previsto`/`tendência` (não
existem nesse dado) — "a curva" é a **contagem acumulada de NFs emitidas**
por mês (`GraficoMedicoes`, um SVG bespoke simplificado — linha + área azul,
grid leve, rótulo de valor em cada ponto — não reaproveita o `LineSVG` da
Curva S, que é fortemente acoplado ao modelo previsto/realizado/tendência
dela). "Próximo Faturamento" (data + R$) vira balão à parte, nunca no mesmo
eixo do gráfico — unidades diferentes (contagem vs R$) não deveriam dividir
escala. 3 balões: Notas Fiscais Emitidas, Boletins de Medição (contagem de
`bm` distintos — pode divergir de NFs se um BM gerar mais de uma nota),
Próximo Faturamento. Abaixo, tabela com todas as NFs (mais recente primeiro).
Obra sem `origemCP` mapeado mostra "Sem código de contrato (CP) mapeado
ainda para esta obra" em vez de tentar adivinhar.

Validado com Playwright nas 6 obras: CNPEM (11 NFs/10 BMs, curva OUT/25→JUL/26),
Novo Nordisk-AP (16), Porto Itapoá (26), NN-AP-Reforço (9), Novo Nordisk-UB/SP
(48 — maior volume, várias empresas terceiras nas NFs), Hitachi (10, depois
de confirmado CP022). Sem erro de console em nenhuma.

**Gráfico largo + interativo, mesmo dia**: "Deixe o gráfico mais largo,
utilizando toda a largura da tela. Faça-o interativo, permitindo passar o
mouse por cima e checar os valores" — `GraficoMedicoes` deixou de ter
`width` fixo (900) e passou a medir o container real via `ResizeObserver`
(`useRef` + `useState(width)`), preenchendo 100% da área de conteúdo (sem
`maxWidth` no layout do painel, então acompanha a tela toda). Interatividade:
`onMouseMove` no SVG calcula o ponto mais próximo pela posição X do cursor,
destaca o ponto (raio maior), traça uma linha-guia tracejada vertical e abre
um tooltip em HTML absoluto (não SVG puro, pra não travar em `overflow`)
mostrando mês, acumulado e quantidade daquele mês; tooltip inverte pra baixo
do ponto quando ele está muito perto do topo do gráfico, pra não cortar no
card. Validado com Playwright (viewport 1600px): SVG ocupa ~1494px de
largura (praticamente toda a área útil, only left/right padding descontado),
hover no meio do gráfico mostra o tooltip corretamente. Sem erro de console.

**Coluna Valor + curva por valor/data, mesmo dia**: "Inclui a coluna valor
na table das NFs, vamos exibir a soma de todos como valor total faturado, o
gráfico será em cima do valor, eixo X será a data". Investigado antes de
mexer: `nfs` ganhou a coluna `valor` (numeric) desde a implantação original
do setor — não existia quando o setor foi construído (documentado acima
como "sem nenhuma coluna de valor"), passou a existir e vir 100% preenchida
nas 22 obras da tabela (confirmado com `execute_sql` antes de codar,
ADR-005). Mudanças: (1) nova coluna "Valor" na tabela de NFs (`fmtReais`,
alinhada à direita); (2) novo balão "Valor Total Faturado"
(`soma(nfsRaw, 'valor')`), grade de balões foi de 3 pra 4 colunas; (3)
`GraficoMedicoes` trocou de contagem mensal de NFs pra **valor acumulado por
data real de emissão** (`seriePorData`, uma NF por ponto — NFs no mesmo dia
somam num só ponto, evita 2 pontos no mesmo X) — eixo Y em moeda compacta
(`fmtReaisCompacto`, ex. "R$ 17,4 mi"), rótulo permanente só no último ponto
(valor final), rótulos do eixo X (datas) desadensados pra no máximo ~12
visíveis (`passoLabel`) porque com até 30 pontos reais (não mais ~12 meses)
o "dd/mm/aa" de cada um sobrepunha o vizinho. **Bug pego no teste**: com o
padding esquerdo antigo (44px, dimensionado pra números pequenos tipo "11")
o "R$" dos rótulos do eixo Y cortava contra a borda do SVG
(`overflow:hidden` padrão do elemento raiz) sempre que o valor tinha mais
dígitos — pior no Novo Nordisk-UB/SP ("R$ 140,2 mi" sumia inteiro).
Corrigido subindo o `pad.left` de 44 pra 84. Validado com Playwright nas 3
maiores obras (CNPEM R$17,4mi, Novo Nordisk-UB/SP R$118,8mi, Porto Itapoá),
"R$" visível em todos os ticks, tooltip mostrando data+acumulado+valor do
dia, sem erro de console.

**Casas decimais do `fmtReais`, mesmo dia**: pedido inicial "precisa exibir
todas as casas decimais" → `fmtReais` foi pra `maximumFractionDigits:6` (o
dado real de `nfs.valor` tem até 6 casas, confirmado no banco). Usuário
corrigiu na hora: "Vamos utilizar só duas casas decimais" — fixado em
`minimumFractionDigits:2, maximumFractionDigits:2` (padrão monetário comum).

**Curva lado a lado com a tabela + BM em cada ponto, mesmo dia**: "Vamos
colocar a curva lado a lado com a tabela, preciso que nos pontos da curva
exiba qual o BM". Layout: o card do gráfico e o card da tabela entraram num
`display:flex` (`flex:'0 0 42%'` pro gráfico, `flex:1` pra tabela, mesma
altura). `GraficoMedicoes` passou a medir altura também via `ResizeObserver`
(antes só largura, altura vinha fixa em 280px por prop) — sem isso o
gráfico não ocupava a coluna toda ao virar mais estreito e mais alto.
`seriePorData` ganhou `bmLabel`: **investigado antes de assumir 1 BM por
data** — existe caso real de uma data com 2 BMs diferentes na mesma obra
(Porto Itapoá, 25/09/25: BM 6 e 7) — junta os BMs distintos daquela data com
vírgula. Rótulo do BM fica direto acima do ponto (fonte pequena, cinza,
igual estilo dos ticks), na MESMA decimação do rótulo de data — mostrar as
~30 tags de BM uma do lado da outra também sobreporia; o BM exato de
qualquer ponto (mesmo os não-decimados) continua disponível no tooltip via
hover. **2 bugs de sobreposição pegos no teste**: (1) o rótulo forçado do
último ponto (sempre visível) colidia com o rótulo "natural" da grade
quando os dois caíam perto um do outro — corrigido suprimindo o rótulo da
grade quando está a menos de 70px do ponto final; (2) o texto do último
rótulo (centralizado no ponto) cortava contra a borda direita do card,
porque `textAnchor="middle"` estende metade do texto além do X do ponto —
corrigido usando `textAnchor="end"` só no último ponto (data e BM), mesmo
truque já usado pro rótulo de valor acumulado. Validado com Playwright nas
4 obras com mais pontos (CNPEM, Novo Nordisk-UB/SP, Porto Itapoá, Hitachi),
sem sobreposição nos rótulos finais, sem erro de console.

**BM em todos os pontos + divisor arrastável, mesmo dia**: "o rótulo do BM
poderia aparecer em todos os pontos, o ajuste entre a tabela e o gráfico
poderia ser móvel". Duas mudanças:

- **BM sempre visível**: tirada a decimação do rótulo de BM (que antes
  seguia o mesmo passo do rótulo de data) — agora renderiza em TODOS os
  pontos, não só nos ~12 decimados. Pra caber sem colar um no outro em
  séries de até 30 pontos, o texto ficou em diagonal (`rotate(-40deg)`
  ancorado no próprio ponto, `rotate(40deg)` + `textAnchor="end"` só no
  último ponto pra não estourar a borda direita) em vez de horizontal —
  ainda sobrepõe um pouco nos trechos onde os pontos estão muito próximos
  (curva íngreme), mas é bem mais legível que a versão horizontal; o
  detalhe exato de qualquer ponto continua no tooltip via hover.
- **Divisor arrastável**: novo estado `splitGrafico` (% de largura do card
  do gráfico, default 42, limitado a 20–70%) e uma faixa de 14px entre os
  dois cards (`cursor:col-resize`, barra central que fica azul no hover)
  com `onMouseDown` + listeners de `mousemove`/`mouseup` no `window`
  (padrão comum de resizer: os listeners vivem na window, não no elemento,
  pra continuar capturando o arraste mesmo se o cursor sair da faixinha de
  14px no meio do movimento). **Bug pego no teste**: sem tratamento, o
  arraste selecionava o texto da tabela por baixo (comportamento padrão do
  navegador ao arrastar sobre texto) — corrigido com `e.preventDefault()`
  no `mousedown` + `document.body.style.userSelect = 'none'` durante o
  arraste, revertido no `mouseup`. Validado com Playwright simulando
  arraste pros dois lados (mais gráfico / mais tabela): `flex-basis` muda
  corretamente, sem seleção de texto, sem erro de console.

**Ajuste fino do mesmo dia — tirar o rótulo do BM, gap visual, ordenar
colunas, normalizar BM**: 4 pedidos em sequência, todos no mesmo lote:

1. *"Não precisa do rótulo de todos os pontos, pode deixar sem nenhum,
   indicação do BM só ao passar o mouse"* — removido o `<text>` de BM que
   ficava permanente em cada ponto (o bloco em diagonal do ajuste
   anterior); o BM de qualquer ponto continua no tooltip via hover, que já
   existia. Gráfico ficou limpo (só linha, pontos, valor final e datas
   decimadas).
2. *"inclua um gap entre o gráfico e a tabela"* — o divisor arrastável
   tinha `margin:'0 -7px'` num `flex:'0 0 14px'`, o que cancelava o espaço
   inteiro (14-7-7=0): visualmente os cards ficavam colados, só a barrinha
   flutuava em cima da emenda. Trocado pra `flex:'0 0 22px'` sem margem
   negativa — agora existe espaço real dos dois lados da barra.
3. *"Permita ordenar nas colunas"* — mesmo padrão de `COLUNAS_RESTRICOES`
   (array de colunas + `alternarOrdenacao` + seta ▲/▼ no `<th>` ativo, cor
   azul). Direção padrão ao trocar de coluna segue a convenção já usada em
   `ModuloEncarregados` (`alternarOrdenacaoEnc`): colunas de texto (NF,
   Empresa) começam ascendente, colunas numéricas/data (BM, Valor,
   Emissão) começam descendente — maior/mais recente primeiro.
4. *"Ajuste algum match no número do BM - 01 - 8002160923, este exemplo
   deverá ser entendido apenas como 01"* — `nfs.bm` às vezes vem com texto
   extra colado ao número (`"01 Tubulação"` na Hitachi, `"01 -
   8002160923"` na Novo Nordisk-UB/SP — achados reais, não hipotéticos).
   Novo helper `bmCurto(bm)` extrai só o prefixo numérico via regex
   (`/^(\d+)/`), aplicado em 3 lugares: contagem de `totalBMs` distintos
   (pra "01 Tubulação" não contar separado de um "01" puro), no `bms` do
   `seriePorData` (tooltip do gráfico) e na própria coluna BM da tabela.
   Ordenação por BM usa `Number(bmCurto(...))` (não string), senão "10"
   viria antes de "2".
5. *"Por padrão virá sempre ordenado pelo BM, do maior para o menor"* —
   estado inicial da tabela virou `ordenarPor:'bm', ordenarDir:'desc'` (não
   mais por ordem de chegada da API/emissão).

Validado com Playwright: Hitachi mostra BM "01" (não mais "01 Tubulação")
logo depois do BM "1" puro (mesmo valor numérico, ordem estável); Novo
Nordisk-UB/SP mostra "01 - 8002160923" virando "01" na posição certa entre
os BMs de valor 1; clique em "Emissão" alterna asc/desc corretamente; sem
erro de console.

**Barras por faturamento + balões enxutos + data em destaque, mesmo dia**:
"Vamos incluir barras nos gráficos, representando cada faturamento. A QTD
de NF emitida e de BM não é necessária, a data do próximo fat. deve ter
mais destaque". Três mudanças:

1. **Barras**: `GraficoMedicoes` ganhou uma faixa própria embaixo da curva
   acumulada (`BAR_ZONE_H = 56`), 1 barra por ponto = valor daquela NF/data
   (`valorDia`). Escala **independente** da curva de cima (`maxDia`, maior
   valor de uma única NF — não o acumulado) — mesmo princípio das barras
   semanais do `LineSVG` da Curva S (comentado no código): valor individual
   é ordem de grandeza menor que o acumulado, dividir a mesma escala deixa
   as barras invisíveis. Linha-guia do hover (tracejada) passa a atravessar
   a faixa de barras inteira, não só a curva; a barra do ponto sob o mouse
   escurece (opacidade 0.4→0.8), mesmo padrão de destaque já usado no ponto
   da linha.
2. **Balões**: removidos "Notas Fiscais Emitidas" e "Boletins de Medição" —
   grade caiu de 4 pra 2 colunas (Valor Total Faturado / Próximo
   Faturamento). Contagens continuam implícitas na tabela (nº de linhas) e
   na coluna BM.
3. **Data em destaque**: hierarquia do cartão "Próximo Faturamento"
   invertida — antes era valor grande (22px) + data pequena (10.5px) do
   lado; agora a **data** é o elemento dominante (28px, `T.ink`) e o valor
   vira apoio (13px, verde, ao lado). Pedido explícito de dar mais peso
   visual à data, não ao valor.

Validado com Playwright em 4 obras (Novo Nordisk-UB/SP, CNPEM, Porto
Itapoá, Hitachi): barras aparecem proporcionais ao valor de cada NF, hover
escurece a barra certa e mostra tooltip com data/BM/acumulado/valor do dia,
cartão de próximo faturamento com a data em destaque, sem erro de console.

**2 correções do usuário, mesmo dia**:

1. *"Quando digo maior destaque na data, não é para reduzir o destaque do
   valor"* — a versão anterior tinha invertido a hierarquia por completo
   (data 28px dominante, valor 13px de apoio), só trocando qual dos dois
   perdia destaque. Corrigido pra **os dois no mesmo tamanho/peso** (24px,
   bold), diferenciados só pela cor (data em `T.ink`, valor em `T.green`) —
   nenhum dos dois fica em segundo plano.
2. *"As barras devem aparecer junto da curva, sob o mesmo eixo"* — a 1ª
   implementação (passo anterior) deu às barras uma faixa própria embaixo
   do gráfico com escala independente (`maxDia`), inspirada nas barras
   semanais da Curva S. Pedido explícito de reverter: barras agora usam a
   **mesma `yScale`/`maxV` da curva acumulada**, desenhadas na mesma área
   (atrás da linha, na frente da área de preenchimento). Ficam pequenas
   perto do acumulado — é o comportamento correto sob o mesmo eixo, não um
   bug; removida a faixa extra, o `BAR_ZONE_H`, o rótulo "por NF" e a
   escala própria por completo (não só ajustada).

Validado com Playwright: barras minúsculas mas visíveis na base do gráfico,
compartilhando eixo com a curva; balão de próximo faturamento com data e
valor no mesmo tamanho; sem erro de console.

**Balões separados, mesmo dia**: "Quebre em dois balões separados, data e
valor" — o cartão único (data+valor lado a lado) virou 2 `Balao` padrão:
"Data do Próximo Faturamento" e "Valor do Próximo Faturamento", grade foi
de 2 pra 3 colunas junto com "Valor Total Faturado". Mesmo componente
`Balao` do resto do painel, sem estilo customizado — mais simples que o
cartão manual das versões anteriores. Validado com Playwright, sem erro de
console.

**Valor Contrato + Valor Medido, mesmo dia (dado novo, fora do Supabase)**:
usuário passou por chat os valores de contrato de 3 obras (CP029/CNPEM,
CP022/Hitachi, CP236/NN-UB/SP): Contrato Original (fixo) + itens extras
(OC1/OC2/PO/Saldo, também fixos) + FD = Faturamento Direto (**provisório**,
sujeito a mudança). Perguntei qual valor era o provisório antes de
cadastrar qualquer coisa — resposta: é o FD, de TODA obra (não um item
avulso); percebi que faltava o FD do CP022 e perguntei, usuário completou
(R$ 2.988.294,55). Registrado em memória
(`contratos-cp-painel-mse.md`, fora do repo) por não vir de tabela nenhuma
do Supabase — não cabe como comentário de código nem como dado buscado em
runtime.

Fórmulas confirmadas pelo usuário: **Valor Contrato** = original + tudo que
NÃO é FD; **Valor Medido** = FD + soma de todas as NFs da obra. Novo objeto
`CONTRATOS_CP` (por `origemCP`) no `index.html`, só com as 3 obras que têm
dado — as outras 3 mostram "sem dado" nos 2 balões (ADR-005, mesmo padrão
de `origemCP` ausente). Balões da grade: Valor Contrato, Valor Medido, Data
do Próximo Faturamento, Valor do Próximo Faturamento (4 colunas).

**Validação cruzada, achado incidental**: o Valor Contrato calculado do
CP029 (CNPEM) bateu **R$ 51.629.340,30** — exatamente o mesmo número já
catalogado no setor Desvios (46º passo) como o total de `ponderacao_reais`
somado na raiz da `EAP`, confirmado contra o CSV real do cronograma na
época (diferença de R$1,70). Duas fontes completamente independentes (EAP
do cronograma vs. valores de contrato passados manualmente) convergindo pro
mesmo número é uma boa confirmação de que ambos os dados estão certos —
não é coincidência, é o mesmo valor total do projeto visto de dois ângulos.
Validado com Playwright: CNPEM mostra os 2 valores batendo com o cálculo
manual; Porto Itapoá (sem contrato cadastrado) mostra "sem dado" nos 2
balões sem travar; sem erro de console.

**Popup de composição + gráfico de pizza no Valor Contrato, mesmo dia**:
"Ao clicar no valor do contrato, seria interessante surgir um descritivo do
que compõem esse número, entre contrato original e OC. Precisamos exibir,
talvez em um gráfico de pizza, o saldo a faturar, valor faturado e valor
FD". Balão "Valor Contrato" ganhou `onClick` (mesmo padrão já usado no
balão "Efetivo Total Disponível" do Histograma — hint "ver detalhe ›",
cursor pointer) só quando a obra tem `CONTRATOS_CP` cadastrado; sem dado,
o balão fica sem `onClick`, não abre nada.

Popup (mesmo padrão visual `modal-overlay-in`/`modal-card-in` do resto do
painel) com 2 blocos: (1) **De onde vem o valor** — lista Contrato Original
+ cada item de `extras` (OC1, OC2...) + linha de total "Valor Contrato" em
negrito; (2) **Situação atual** — donut (`GraficoPizza`, componente novo,
SVG com `stroke-dasharray`, sem lib externa) com 3 fatias: Saldo a Faturar
(cinza, `T.mut2`), Valor Faturado — NFs (azul), Valor FD (âmbar), cada uma
com valor em R$ e % do contrato na legenda. **Saldo a Faturar** = Valor
Contrato − Valor Medido (o que sobra depois de descontar NFs e FD); se der
negativo (obra faturou mais que o contrato cadastrado), a fatia não desenha
arco negativo mas o popup mostra um alerta vermelho explícito com o valor
do estouro — nunca esconde a anomalia.

Validado com Playwright: CNPEM mostra Contrato Original + OC1 + OC2 = Valor
Contrato exato, donut com Saldo 31% / Faturado 34% / FD 35% (soma 100%);
Porto Itapoá (sem `CONTRATOS_CP`) — clicar no balão não abre popup nenhum
(sem `onClick`); sem erro de console.

**Pizza pra fora do popup, mesmo dia**: "Legal, mas o gráfico de pizza
seria junta a curva e a tabela" — o popup (recém-criado) foi removido por
completo, não só ajustado; o conteúdo virou um **3º painel fixo** na mesma
fileira do gráfico e da tabela (`flex:'0 0 300px'`, à direita, fora do
divisor arrastável — só o gráfico/tabela dividem aquele espaço). `Balao`
"Valor Contrato" perdeu o `onClick`/hint "ver detalhe ›" (não faz mais
sentido, a informação já está sempre visível). Conteúdo do painel igual ao
do popup — breakdown (Original+extras+total, agora em `fmtReaisCompacto`
pra caber nos 300px) + donut + legenda (valor completo abaixo do rótulo, não
mais lado a lado, mesma razão de espaço) + alerta de estouro. Só renderiza
quando `CONTRATOS_CP` existe pra obra — sem contrato, gráfico+tabela ocupam
o espaço todo, sem painel vazio sobrando. Validado com Playwright: CNPEM
com os 3 painéis lado a lado; Porto Itapoá com só gráfico+tabela (2
painéis, sem buraco); sem erro de console.

**4ª rodada de ajuste no mesmo recurso, mesmo dia**: "O de pizza ficará a
esquerda da curva, preciso ter os comandos de ajuste entre ele e a curva
também, a legenda não precisa ter os valores e nem a composição do
contrato (esta deve aparecer ao clicar no balão do valor), os valores devem
aparecer ao passar o mouse por cima do gráfico". 4 mudanças na mesma
mensagem:

1. **Reordenado**: pizza passou a ser o **1º painel** da fileira (antes era
   o 3º, depois da tabela) — ordem final: Pizza → Gráfico → Tabela.
2. **2º divisor arrastável**: agora tem 2 fronteiras móveis (pizza↔gráfico
   e gráfico↔tabela), não só 1. `arrastandoRef` virou string
   (`'pizza' | 'grafico' | null`) em vez de boolean, pra saber qual
   fronteira está em movimento; os 2 estados de % (`pizzaPct`/`graficoPct`)
   se limitam mutuamente (cada um reserva espaço mínimo pro outro + pra
   tabela) pra nenhum dos 3 painéis sumir num arrasto extremo.
3. **Composição saiu do painel fixo, voltou a ser popup** — a "Composição
   do Contrato" (breakdown Original+OC+Total) que eu tinha colocado dentro
   do painel da pizza (rodada anterior) saiu de lá; o painel da pizza ficou
   só com o donut + legenda enxuta (label + %, sem valor em R$). A
   composição voltou a ser popup, disparado pelo `onClick` do balão "Valor
   Contrato" (o `contratoAberto`/modal removidos na rodada anterior foram
   restaurados, agora só com o breakdown — sem o donut duplicado dentro).
4. **Valor só no hover, direto no gráfico**: `GraficoPizza` ganhou estado de
   hover por fatia — cada `<circle>` do arco usa
   `style={{pointerEvents:'stroke'}}` (só reage no próprio arco desenhado
   pelo `strokeDasharray`, não no círculo inteiro) com `onMouseEnter`/
   `onMouseLeave`; a fatia sob o mouse engrossa (+5px) e o **centro do
   donut** (vazio por natureza, técnica comum em donut chart) mostra
   label+valor daquela fatia em `fmtReaisCompacto`. Fora do hover, o centro
   fica vazio.

Validado com Playwright: pizza aparece à esquerda da curva, 2 resizers
funcionando (arrastar pizza↔gráfico expande a pizza e encolhe o gráfico
proporcionalmente), hover na fatia "Valor FD" destaca o arco e mostra
"R$ 18,2 mi" no centro, popup do balão mostra só a composição (sem pizza
duplicada), Porto Itapoá (sem contrato) continua com só 1 resizer
(gráfico↔tabela) e sem painel de pizza; sem erro de console.

**5ª rodada — glow em vez de texto, popup do Valor Medido, pizza maior, BM
primeira coluna, mesmo dia**: "Não precisa do 'ver detalhe', apenas um
glow é suficiente. Vamos fazer um pop-up similar para o valor medido
(FD+NF). o Gráfico de pizza deve ser maior" + "BM será a primeira coluna".

- **Glow em vez de texto**: removido o `<span>ver detalhe ›</span>` do
  `Balao` (mudança GLOBAL no componente, não só em Medições — qualquer
  balão clicável do painel perde o texto). Nova classe CSS
  `.card.balao-clicavel:hover` com `box-shadow` azul (glow) somada ao
  destaque de sombra que já existia em `.hoverable`.
- **Popup do Valor Medido**: mesmo padrão do popup de "Valor Contrato" —
  `medidoAberto` (novo estado), abre no `onClick` do balão "Valor Medido",
  mostra breakdown "Valor FD" + "Soma das NFs (N notas)" = "Valor Medido".
- **Pizza maior**: `GraficoPizza` foi de 132px/24px de espessura pra
  200px/34px; fonte do hover central também aumentou (9.5→11.5 rótulo,
  12.5→16 valor) pra acompanhar a escala nova.
- **BM primeira coluna**: `COLUNAS_NFS` reordenado (BM, NF, Empresa, Valor,
  Emissão) — mesma ordem no `<thead>` e no `<tbody>`; cor forte (`T.ink`)
  seguiu a coluna BM (antes era da NF, primeira coluna de antes).

Validado com Playwright: cabeçalho da tabela lê `['BM ▼', 'NF', 'EMPRESA',
'VALOR', 'EMISSÃO']`; 0 ocorrências de "ver detalhe" na tela; hover no
balão "Valor Contrato" mostra o glow azul; popup "Valor Medido" abre com
FD + soma das NFs + total batendo; sem erro de console.

**6ª rodada, mesmo dia**: "Boa, aumente mais o gráfico de pizza" —
`GraficoPizza` foi de 200px/34px pra **260px/42px** (fonte do hover central
também subiu, 11.5/16 → 13/19). Ainda cabe dentro do painel de 24% de
largura sem cortar. Validado com Playwright, sem erro de console.

**7ª rodada — de tamanho fixo pra responsivo, mesmo dia**: pedido de
aumentar ainda mais (260px→320px) foi interrompido pelo próprio usuário:
"Na verdade, faça layout responsivo, para ocupar todo o balão disponível,
em diferentes telas" — em vez de subir mais um número fixo, `GraficoPizza`
foi reescrito pra medir o próprio container via `ResizeObserver` (mesmo
padrão do `GraficoMedicoes`) e usar o menor lado disponível (donut é
quadrado) como diâmetro; espessura do anel e fontes do hover central agora
escalam em proporção (`tamanho * 0.16` pra espessura, `* 0.06`/`* 0.095`
pras fontes) em vez de valor fixo. No painel, o gráfico passou a viver
dentro de um `<div style={{flex:1, minHeight:0}}>` entre o título (fixo em
cima) e a legenda (fixa embaixo) — cresce pra preencher o que sobrar de
espaço vertical do balão, não só a largura. Validado com Playwright em 3
resoluções (1700×950, 1280×800, 1920×1080): o donut ocupa visivelmente
mais espaço em telas mais altas/largas, sem cortar nem distorcer, sem erro
de console. **Lição**: quando o pedido for "maior" repetido em sequência
sobre um valor fixo, considerar logo de cara se o certo não é responsivo —
economiza rodadas de "aumenta mais um pouco".

**8ª rodada — 2 bugs pegos pelo usuário no responsivo, mesmo dia**: "a
fonte interna ao passar o mouse ficou muito grande, deixe no padrão da
página, ao passar o mouse as bordas do gráfico expandem e ficam cortando,
verifique a box". Consequências diretas de ter tornado a fonte/tamanho
proporcionais ao container no passo anterior:

1. **Fonte proporcional era exagerada**: `fontRotulo`/`fontValor` escalavam
   com `tamanho` (que agora podia passar de 500px em telas grandes),
   gerando texto de 30-50px no centro do donut. Trocado por tamanho FIXO
   (10.5px rótulo, 14px valor) — mesmo padrão de fonte de tooltip usado no
   `GraficoMedicoes` (que também é fixo, não escala com o gráfico).
2. **Bug de corte real, não só estético**: o raio do anel base já tocava a
   borda exata do `viewBox` (`r + espessura/2 = tamanho/2`, zero margem) —
   funcionava sem cortar só porque o hover antes não crescia o suficiente
   pra passar do tamanho fixo antigo. Quando o donut virou responsivo e
   ficou maior, o crescimento de +5px no hover (`espessura + 5`) passou a
   extrapolar o `viewBox` e cortar contra o `overflow:hidden` padrão do
   SVG raiz. Corrigido reservando uma margem fixa (`HOVER_CRESCE = 5`) no
   cálculo do raio (`r = (tamanho-espessura)/2 - HOVER_CRESCE`), garantindo
   espaço pro anel crescer sem estourar a caixa, em qualquer tamanho de
   tela. **Lição**: ao tornar um SVG responsivo, reconferir se algum
   elemento (como o crescimento no hover) já estava "encostado" na borda
   do `viewBox` por sorte de tamanho fixo — isso vira bug real assim que o
   tamanho passa a variar.

Validado com Playwright: hover mostra "Valor FD / R$ 18,2 mi" em fonte
compacta, anel destacado contido dentro do card em viewport grande
(1700×950, donut ~350px), sem erro de console.

**9ª rodada — largura mínima da tabela, mesmo dia**: "Coloque a tabela com
tamanho mínimo para não suprimir as informações". Com os 2 divisores
arrastáveis (pizza↔gráfico↔tabela), arrastar os dois pro lado direito ao
mesmo tempo conseguia espremer a tabela de NFs até quase sumir, cortando
colunas. **Causa raiz**: a regra do spec de flexbox faz um item com
`overflow` diferente de `visible` no descendente (aqui, a `div` de scroll
com `overflow:'auto'` dentro do card da tabela) herdar `min-width:auto`
como **0** em vez do tamanho mínimo do conteúdo — por isso `flex:1`
sozinho não protegia a tabela. Corrigido com `minWidth:480` explícito no
card da tabela (+ `minWidth:460` na própria `<table>`, redundante de
propósito, cobre os dois níveis). Abaixo desse mínimo, quem cede é o
próprio scroll horizontal da tabela (`overflow:'auto'` já existia), não
mais o encolhimento das colunas. Validado com Playwright: arrastando os 2
resizers ao extremo, a tabela trava em ~478px de largura (bem próximo do
mínimo), sem espremer as colunas, e **sem overflow horizontal na página**
(`document.body.scrollWidth === clientWidth` mesmo no extremo — os cards
de gráfico/pizza, que são `flex:'0 0 X%'` sem encolhimento próprio,
acomodam a diferença); sem erro de console.

**10ª rodada — bug real de overflow para a direita, mesmo dia**: "está
escorregando para direita da tela". Testado e confirmado com Playwright:
em telas mais estreitas (~1330px de largura útil pra baixo), a fileira
gráfico/tabela/pizza realmente empurrava a página inteira pra direita —
`document.body.scrollWidth > clientWidth`. **Causa raiz**: pizza e
gráfico usavam `flex:'0 0 X%'` (`flex-shrink:0`, recusa encolher);
combinado com o `minWidth:480` recém-adicionado na tabela (passo
anterior), a soma dos 3 mínimos passava da largura disponível e ninguém
cedia — o navegador só tem uma saída quando isso acontece: deixar a
fileira vazar pra fora do container.

Corrigido em 2 camadas: (1) pizza e gráfico ganharam `flex-shrink:1`
(`flex:'1 1 X%'`) + `minWidth` próprio (220px pizza, 320px gráfico) — os
3 painéis agora encolhem juntos, proporcionalmente, até seus mínimos
individuais, em vez de só a tabela tentar segurar sozinha; (2)
`overflowX:'auto'` na fileira inteira (`areaRef`) como rede de segurança —
se mesmo assim os 3 mínimos somados (220+320+480+2×22 dos resizers)
passarem da tela, quem rola agora é a fileira dentro de si mesma, nunca
mais a página inteira.

Validado com Playwright: testado de 1700px até 700px de largura — a
fileira de Medições nunca mais contribui pra `body.scrollWidth` além do
que a página já tinha antes (achado incidental: existe um overflow
genérico pré-existente de ~1354px vindo do botão `.nav-arrow` da barra de
abas, presente em TODO setor, não só Medições — não é bug introduzido
aqui, mas fica registrado como dívida técnica pra averiguar depois; **✅
corrigido na fonte depois, ver seção "Barra de abas (`TabsSetores`) —
dívida técnica resolvida" mais abaixo**). Em
1200px, os 3 painéis encolhem visivelmente juntos e tudo continua
legível, sem cortar nem escorregar; sem erro de console.

**11ª rodada — tons de verde, % do contrato, farol Medido×Físico, mesmo
dia**: "deixe o valor faturado e valor fd em tons de verde, o saldo pode
continuar cinza. no valor medido vamos incluir uma % com relação ao valor
do contrato, adicionalmente, vamos incluir um balão de farol, que compara
a % medida da % física da curva" + "é importante pegar o corte mais
próximo a data do último faturamento".

1. **Cores da pizza**: "Valor Faturado (NFs)" e "Valor FD" viraram 2 tons
   de verde (`T.green` e um verde mais claro `#7bc796`) — mesma família de
   cor porque os dois são "já realizado financeiramente", só a saturação
   diferencia; "Saldo a Faturar" continua `T.mut2` (cinza — nem bom nem
   ruim, é só o que falta).
2. **% no Valor Medido**: `Balao` ganhou prop `sub` (texto pequeno ao lado
   do valor principal, reaproveitável em qualquer balão do painel) —
   "Valor Medido" agora mostra "X% do contrato"
   (`valorMedido / valorContrato * 100`).
3. **Balão de Farol Medido × Físico**: 5º balão na grade (4→5 colunas).
   Compara o % financeiro medido com o **% físico da Curva S**
   (`curvas_s.acum_realizado`, mesma tabela/convenção de nome do setor
   Curva S) — mas **não no corte de hoje**: pedido explícito de pegar o
   corte da Curva S com a data mais PRÓXIMA da data do **último
   faturamento** (maior `emissao` entre as NFs da obra), pra comparar os
   dois no mesmo ponto no tempo. Cor do farol reaproveita `corDesvioTom`
   (mesma paleta de severidade já usada em Desvios: verde ≥0, âmbar ≥-5,
   vermelho abaixo) aplicada à diferença `%medido - %físico`. `ModuloMedicoes`
   ganhou um 3º fetch próprio (`curvas_s?obra=eq.<nome da curva>`, só
   `data`+`acum_realizado`) — não depende do estado da Curva S carregado em
   outro setor, autossuficiente como todos os outros módulos.
   **Bug de formatação pego no teste**: o valor "+49.5 p.p." quebrava linha
   feio no meio ("p.p." caindo pra 2ª linha) numa coluna estreita de 5 —
   trocado pro formato compacto sem espaço "+49,5pp" (vírgula decimal
   também, consistente com o resto do app).

Validado com Playwright em 3 obras: CNPEM (Medido 69% vs Físico 19%,
farol +49,5pp verde), Novo Nordisk-UB/SP (Medido 46% vs Físico 3%, farol
+42,1pp), Porto Itapoá (sem contrato) — os 3 balões nesse grupo mostram
"sem dado" sem travar; sem erro de console.

**12ª rodada — farol vira só luz, mesmo dia**: "O farol pode ser só a luz
mesmo, caso clique ele exibe as informações, mas o % físico é o realizado
acumulado da aba da curva S". O balão do farol trocou o texto "+49,5pp"
por só uma **bolinha colorida** (24px, com halo/glow na mesma cor de fundo
do card — visual de semáforo de verdade), clicável (mesma classe
`balao-clicavel`, sem `Balao` genérico dessa vez — card customizado porque
o "valor" não é mais texto). Clique abre popup com o detalhe: % Medido, %
Físico (explicitamente rotulado "Realizado Acum. — Curva S", confirmando
que já é exatamente esse campo — `curvas_s.acum_realizado`, sem mudança
nenhuma na fonte do dado, só a exibição), diferença em p.p., e uma linha de
rastreabilidade mostrando as duas datas comparadas (data do último
faturamento vs. data do corte da Curva S usado) — importante porque nas
obras testadas as duas datas podem estar bem distantes uma da outra (achado
do 52.18, curva física possivelmente desatualizada), e o usuário precisa
conseguir ver isso sem abrir o Supabase.

Validado com Playwright: bolinha verde renderiza certo, popup abre com os
3 números + rastro de datas (CNPEM: corte de 08/02/26 comparado contra
faturamento de 24/07/26 — gap grande, visível pro usuário no próprio
popup); sem erro de console.

**13ª rodada — bug real de data + farol menor/reordenado, mesmo dia**: "O
farol pode ser um balão bem menor, o primeiro balão, inclusive, está
pegando o acumulado errado, para o corte de 26/07, que é o mais próximo, o
acumulado estava em 73,25%". O usuário identificou exatamente o sintoma do
gap estranho já registrado no passo anterior (corte de 08/02/26 escolhido
pra comparar com faturamento de 24/07/26) — não era característica real da
obra, era bug.

**Causa raiz confirmada com `execute_sql` direto no Postgres**:
`curvas_s.data` é **TEXTO no formato "dd/mm/aaaa"**, não uma data ISO. O
código fazia `new Date(r.data)` cru — o parser nativo de `Date` não
reconhece esse formato quando o "dia" é maior que 12 (ex.: "26/07/2026"
vira `Invalid Date`/`NaN`), e como `NaN < qualquerNúmero` é sempre `false`,
a primeira linha processada pelo `reduce` (nem sempre a correta — a query
tinha `order=data.asc`, mas ordenar TEXTO "dd/mm/aaaa" alfabeticamente
agrupa por DIA primeiro, ignorando mês/ano, produzindo uma ordem
cronologicamente aleatória) "vencia" e nunca mais era substituída. Corrigido
usando `parseDataCorte` (alias de `parseDataFlexivel`, já existente no
arquivo) nos dois lados da comparação — a mesma função já lida com
`dd/mm/aaaa` (curvas_s) E `aaaa-mm-dd` (nfs.emissao). **Lição**: nunca usar
`new Date(string)` cru num campo de data vindo do Supabase sem checar o
formato real da coluna — o app já tinha esse parser flexível catalogado
exatamente por causa desse tipo de armadilha, só não foi usado aqui.

**Farol menor e primeiro**: fileira de balões trocou de `display:grid`
(5 colunas iguais) pra `display:flex` — o farol virou um quadrado fixo de
84px (só título "FAROL" + bolinha, sem crescer igual aos outros) na
primeira posição; os outros 4 balões (`Valor Contrato`, `Valor Medido`,
datas de faturamento) dividem o espaço restante em partes iguais
(`flex:1` cada, envolvidos numa `div` já que `Balao` não aceita prop de
flex diretamente).

Validado com Playwright: CNPEM agora mostra corte de **26/07/26** (não
mais 08/02/26) com **% Físico 73,3%** (bate com os 73,25% confirmados pelo
usuário), farol âmbar (diferença -4,3%, bem mais coerente que o +49,5pp anterior);
farol renderiza pequeno e primeiro na fileira; sem erro de console.

**14ª rodada — trocar "p.p." por "%", mesmo dia**: "Boa, não use p.p., pode
colocar %" — o rótulo "Diferença (Medido − Físico)" no popup do farol
trocou o sufixo "p.p." por "%" (não mexeu no `CardDesvio` legado do setor
2, que também usa "p.p." mas não foi mencionado). Validado com Playwright,
sem erro de console.

**15ª rodada — % também no Valor do Próximo Faturamento, mesmo dia**: "o
valor do próximo faturamento deverá exibir a % também" — mesmo padrão já
usado em "Valor Medido" (`sub` do `Balao`): novo `percProximo` =
`valor_previsto ÷ Valor Contrato × 100`, só calculado quando as 2 pontas
existem (`temProximo` E `contratoCfg`/`valorContrato`). Sem contrato
cadastrado, o balão continua mostrando só a data/valor, sem "% do
contrato" pendurado. Validado com Playwright (CNPEM: "4% do contrato"),
sem erro de console.

**16ª rodada — 2 casas decimais nas %, mesmo dia**: "nessas %, exiba duas
casas decimais". Escopo: as % da família Valor Contrato/Medido/Próximo
Faturamento/Farol — `percMedido` e `percProximo` (subs dos balões, eram
`toFixed(0)`) e `percMedido`/`percFisico`/`farolDiff` (popup do farol,
eram `toFixed(1)`) — todas viraram `toFixed(2)`. **Não** mexi na legenda
da pizza (`toFixed(0)`), que é de um pedido anterior e não foi mencionada
agora — só o que foi pedido, não generalizei pro resto da tela. Validado
com Playwright (CNPEM: "68,96% do contrato", "3,97% do contrato"), sem
erro de console.

**17ª rodada — as 3 obras que faltavam, mesmo dia**: usuário perguntou
"Quais valores de contrato e fd estão pendentes?" — resposta: CP002 (Porto
Itapoá), CP273 (Novo Nordisk-AP), CP261 (Novo Nordisk-AP-Reforço). Na
sequência, enviou os 3: Porto Itapoá (Original R$252.225.177,38, FD
R$104.515.271,57), NN-AP (Original R$129.500.000,00, FD R$11.885.884,19),
NN-AP-Reforço (Original R$37.000.000,00, FD R$3.905.945,55) — nenhum com
itens extras (OC/PO/Saldo), só original+FD. `CONTRATOS_CP` agora tem **as
6 obras completas** — nenhuma mostra mais "sem dado" nos balões de Valor
Contrato/Medido/Farol. Registrado em [[contratos-cp-painel-mse]] (memória,
fora do repo). Validado com Playwright nas 3 obras novas: Porto Itapoá
(Medido 92,64% do contrato), NN-AP (30,50%), farol calculando normalmente
nas 3; sem erro de console.

**18ª rodada — % direto nos aros da pizza, mesmo dia**: "Exiba as % do
gráfico de pizza no próprio gráfico, nos aros". `GraficoPizza` ganhou
rótulo de % desenhado sobre cada fatia (não só na legenda) — ângulo do
ponto médio de cada arco calculado à mão (`midFrac = fração acumulada
antes + metade da própria fatia`, convertido pra grau com `-90 +
midFrac*360`, mesma convenção de "topo, sentido horário" que o
`rotate(-90)` dos arcos já usava, só que aplicado fora do grupo rotacionado
pra não ter que desfazer a rotação no cálculo). Texto branco com contorno
escuro (`stroke` + `paintOrder:'stroke'`) pra ficar legível em qualquer cor
de fatia (cinza claro do Saldo, os 2 verdes do Faturado/FD) sem precisar de
lógica de contraste por cor. Fatias abaixo de 6% não recebem rótulo (evita
texto ilegível espremido numa fatia quase invisível). Validado com
Playwright (CNPEM: 31%/34%/35% nos 3 aros, legíveis), sem erro de console.

**19ª rodada — tirar o contorno, mesmo dia**: "sem contorno cinza, pode ser
só o branco" — removido `stroke`/`paintOrder` do rótulo de %, ficou só
`fill="#fff"`. Continua legível nas 3 cores de fatia testadas (cinza claro,
2 verdes); sem erro de console.

## Barra de abas (`TabsSetores`) — dívida técnica resolvida (2026-08-10)

Pedido: "em tela menor os botões superiores ficam com textos quebrando
linha, faça com que todos quebrem e fiquem do mesmo tamanho, os balões".
Esse é o mesmo overflow genérico já catalogado como "achado incidental" no
setor Medições (10ª rodada, ver acima) — dessa vez o usuário pediu o
conserto de verdade, não só o registro como dívida técnica.

**Causa raiz** (mesma classe de bug já vista 2x nesta sessão): o container
do meio (`<div className="card" style={{display:'flex', flex:1, ...}}>`,
que envolve os 8 botões de setor) não tinha `minWidth:0`. Sem isso, um
item flex nunca encolhe abaixo da soma dos mínimos dos filhos — aqui, 8
botões × `minWidth:150` = 1200px+ — então em qualquer tela mais estreita
que isso a fileira INTEIRA vazava pra fora da viewport (não só feio: os
setores da direita, incluindo a seta "próximo", ficavam **inacessíveis**,
sem nenhuma barra de rolagem pra alcançar).

**Correção**: `minWidth:0` no container do meio (resolve o vazamento);
`minWidth:150` fixo por botão removido (agora `minWidth:0` também, deixa
encolher de verdade); rótulo trocou `whiteSpace:'nowrap' + textOverflow:
'ellipsis'` (truncava com "…", não quebrava) por `whiteSpace:'normal' +
overflowWrap/wordBreak:'break-word' + hyphens:'auto'` (quebra com hífen
visual quando a palavra não cabe, ex. "Encar-regados"); `minHeight:44` por
botão. Como o container não define `alignItems` (default `stretch`), todo
botão automaticamente estica pra altura do mais alto da fileira — é isso
que dá o "mesmo tamanho" pedido, sem precisar calcular altura na mão.

Validado com Playwright em 4 larguras (1500/1300/1100/950px): acima de
~1300px os 8 setores cabem numa linha só, sem quebra; abaixo disso, os
rótulos mais longos ("Encarregados", "Suprimentos", "Restrições",
"Medições") quebram com hífen e TODOS os botões ficam com a mesma altura
(mesmo os de 1 linha só, tipo "Desvios"); nenhum setor fica inacessível em
nenhuma largura testada; sem erro de console. **Dívida técnica do 08...md
(10ª rodada de Medições) fechada** — não é mais "achado incidental
pendente", foi corrigida na fonte (`TabsSetores`, componente compartilhado
por todo o painel, não só Medições).

## `Balao` — mesma altura mesmo com `sub` de 2 linhas (2026-08-10)

Usuário mandou print mostrando que, mesmo depois do fix da barra de abas,
o MESMO problema (balões de tamanhos diferentes) continuava na fileira de
balões de Medições: "segue com o mesmo problema, note como os balões
ficaram com tamanhos diferentes" — "Valor Medido" e "Valor do Próximo
Faturamento" (que têm `sub`, ex. "68,96% do contrato") ficavam mais altos
que "Valor Contrato" e "Data do Próximo Faturamento" (sem `sub`), porque o
`sub` às vezes quebra em 2 linhas dentro do espaço apertado da fileira de 5.

**Causa raiz, categoria de bug relacionada mas DIFERENTE da barra de
abas**: os wrappers (`<div style={{flex:1, minWidth:0}}>`) em volta de
cada `Balao` já esticavam certo pra mesma altura (comportamento padrão
`align-items:stretch` da fileira flex) — mas o `<div>` raiz do `Balao`
**dentro** desse wrapper só tinha `minHeight:74`, sem `height:'100%'`;
como é um bloco comum (não um filho direto do flex container), ele não
herda o esticamento do pai automaticamente — só cresce com o próprio
conteúdo. Resultado: wrapper do tamanho certo, cartão visível dentro dele
menor, sem preencher.

**Correção**: `Balao` ganhou `height:'100%'` (+ `boxSizing:'border-box'`
pra a borda de 1px não estourar o cálculo), mudança **global** no
componente — vale pra qualquer tela do painel que usa `Balao` numa fileira
flex/grid com algum vizinho mais alto, não só Medições. O balão "Farol"
(que não usa `Balao`, é card customizado e filho DIRETO da fileira) ganhou
`alignSelf:'stretch'` explícito, redundante com o `stretch` padrão mas
deixado como reforço.

Validado com Playwright: os 5 balões de Medições (Farol, Valor Contrato,
Valor Medido, Data/Valor do Próximo Faturamento) ficam com a mesma altura
mesmo com "68,96% do contrato" quebrando linha; regressão checada em Curva
S, Encarregados, Histograma e Restrições (telas que também usam `Balao`
em grade) — nenhuma mudança visual indesejada; sem erro de console.

**Ajuste fino, mesmo dia**: "a questão do tamanho resolveu, mas a % nesses
casos deveria quebrar toda para linha de baixo, não só parcialmente" — o
`sub` ficava ao lado do valor (`alignItems:'baseline'`, mesma linha),
sobrando pouco espaço horizontal; "68,96% do contrato" quebrava no meio
("68,96%" numa linha, "do"/"contrato" espalhados nas seguintes) em vez de
descer inteiro. Corrigido colocando `valor` e `sub` em coluna
(`flexDirection:'column'`) em vez de linha — o `sub` ganha a largura
inteira do balão numa linha própria embaixo do valor, com
`whiteSpace:'nowrap'` (cabe fácil nessa largura, não precisa quebrar mais).
Validado com Playwright: "68,96% do contrato" e "3,97% do contrato"
inteiros numa linha só, balões continuam com a mesma altura; sem erro de
console.

**Ajuste fino final, mesmo dia**: "todos os valores devem ficar na mesma
linha visual, dessa forma alguns ficaram mais altos que os outros, mesmo
os balões estando alinhados" — 3º round no mesmo componente `Balao` no
mesmo dia. Depois do fix de altura (54º passo) os 5 CARTÕES já tinham
altura idêntica, mas o TEXTO do valor dentro deles não estava na mesma
posição vertical: com `justifyContent:'space-between'`, um balão com `sub`
empurrava o valor pra cima (o `sub` ocupando a linha de baixo), e um balão
sem `sub` deixava o valor descer até o fundo — cartões do mesmo tamanho,
números em alturas diferentes dentro deles.

**Correção**: trocado `justifyContent:'space-between'` por um espaçador
flexível explícito (`<div style={{flex:1}} />`) entre o título e o bloco de
valor, e a linha de `sub` passou a ser **sempre renderizada** (com
`visibility:'hidden'` quando não há texto) em vez de condicional — reserva
a mesma altura embaixo do valor em todo balão, com ou sem `sub` de verdade.
Isso fixa a distância do valor até o fundo do cartão em todo balão da
fileira, o que alinha o valor na mesma linha visual em todos eles
(mudança GLOBAL no componente `Balao`, mesma lógica de antes — vale pra
qualquer tela do painel). Validado com Playwright: os 5 valores de
Medições (Farol não usa `Balao`/não se aplica, os outros 4 balões +
"Valor Contrato"/"Valor Medido"/datas) alinhados na mesma linha horizontal;
regressão checada em Curva S/Encarregados/Histograma/Restrições, sem
problema; sem erro de console.

**Micro-ajuste, mesmo dia**: "ficou alinhado, mas muito próximo ao label do
balão, precisamos de um gap ali" — o espaçador flexível (`flex:1`) entre
título e valor podia encolher até quase 0 quando o cartão não tinha altura
sobrando, colando o valor no rótulo. Adicionado `minHeight:8` no espaçador
— continua flexível (cresce se sobrar altura), mas nunca fica menor que
8px. Validado com Playwright, sem erro de console.

**Linha de resumo na tabela de NFs, mesmo dia**: "Exiba uma linha de
resumo em baixo da tabela, com a soma dos valores, o restante não precisa
de resumo" — `<tfoot>` com `position:'sticky', bottom:0` (mesmo padrão do
`<thead sticky top:0>`, fica visível mesmo rolando a tabela). Célula
"Total" com `colSpan={3}` cobrindo BM/NF/Empresa (não fazem sentido somar
— pedido explícito de deixar em branco), soma (`valorTotalFaturado`, já
calculado) só na coluna Valor, Emissão em branco. Validado com Playwright
(CNPEM: "TOTAL — R$ 17.439.428,38", bate com a fatia "Valor Faturado
(NFs)" da pizza), sem erro de console.

**Legenda da pizza simplificada, mesmo dia**: "não precisa da % na legenda
do gráfico de pizza, já temos no gráfico diretamente, utilize legenda
centralizada, em uma linha só" — removida a % da legenda (redundante com
o rótulo já desenhado nos aros, 18ª rodada); layout trocou de coluna
(1 item por linha, alinhado à esquerda) pra linha única centralizada
(`flexDirection:'row', justifyContent:'center', flexWrap:'nowrap'`).
Validado com Playwright, sem erro de console.

## Dados reais (2026-08-05) — estruturas reaproveitadas do dashboard atual

Nada foi inventado: mesma técnica de leitura, mesmas chaves, mesmas tabelas.

- **`fetchPaginado`** — cópia do helper do dashboard atual (paginação por
  `Range`, mesma correção do cap de 1000 linhas — ver nota "Cap de 1000
  Linhas — bug resolvido" no vault `Documents\MSE-Conhecimento`). Busca
  `curvas_s` e `curva_avanco_historico` inteiras uma vez, como o `loadData()`
  do atual — não por obra.
- **Mapas de nome/id confirmados iguais aos do dashboard atual**: `curvas_s.obra`
  já é o nome "dash" (`OBRAS[].curva`, mesma lista do `gerar_relatorio.py`);
  `curva_avanco_historico.id_obra` bate direto com o id numérico do Portal.
  Nenhum mapa de tradução novo foi precisado para estas duas tabelas — ver
  [[07 - Modelo de Dados]].
- **Efetivo por obra**: mesmo leque de views do `EfetivoSection` original —
  `vw_efetivo_<granularidade>_total`/`_moimod_total` (real), `vw_efetivo_previsto_<granularidade>_total`/`_moimod_total`,
  `efetivo_real_historico` (fallback de mês sem dado ao vivo),
  `vw_efetivo_<granularidade>_pessoas` e `vw_efetivo_previsto_mensal_detalhe`
  (os dois popups) — tudo do projeto Efetivo, refeito a cada troca de
  granularidade/filtro/obra, exatamente como o módulo original.
- **Estados de carregamento/erro/sem-dado tratados de propósito** (ADR-005,
  [[06 - Decisões de Arquitetura]]): falha de rede vira aviso explícito
  ("erro ao carregar..."), nunca um card em branco se passando por "sem
  desvio"; obra sem linha na tabela mostra "sem dado disponível", não trava
  nem finge um valor.
- **Módulo de Curva S portado quase verbatim** (`LineSVG`/`CurvaChart` do
  `dashboard-main\index.html`): mesma escala, mesmos ticks "bonitos"
  (1/2/3/4/6/8/12/16/24/52 semanas), mesma lógica de barras semanais e de
  posição fracionária da linha "HOJE". Os campos de `curvas_s` usados
  ganharam os mesmos nomes do módulo original (`Previsto`/`Realizado`/
  `Tendencia`/`SemPrevisto`/`SemRealizado`, com maiúscula) exatamente para
  colar o componente sem precisar traduzir nada.
- **Deixado de fora de propósito**: o **modo cliente** do dashboard atual
  reescreve o previsto histórico para maquiar um desvio negativo como
  positivo (visto no código-fonte, `chartDataCliente` em
  `dashboard-main\index.html`) — não foi pedido aqui, e fabricar dado
  contradiz a regra de "falhar alto, nunca inventar" (ADR-005,
  [[06 - Decisões de Arquitetura]]). O filtro de período/"todas as colunas"
  também ficou de fora por não ter sido pedido — dá para portar depois se
  fizer falta.
- **Achado ao ligar o dado real — `curva_avanco_historico` "congela mas
  continua"**: pegar ingenuamente "a última linha por data" devolvia um
  desvio financeiro cada vez mais inflado (CNPEM chegava a mostrar −30,5%,
  com data no fim de novembro) porque a tabela segue recebendo linhas com o
  previsto avançando muito depois do realizado ter parado de ser atualizado,
  e `reais_disponivel` não sinaliza isso (vem `true` em tudo). Corrigido com
  `ultimaLinhaComMudanca`: acha a última linha em que o **realizado** mudou de
  valor frente à anterior — ali é onde a medição parou de verdade (deu −8,8%,
  corte 19/07, batendo com o que já estava documentado como parado). Mesmo
  achado registrado na nota "Dívida Técnica e Riscos" do vault
  `Documents\MSE-Conhecimento`, com um alerta para verificar se o dashboard
  atual sofre do mesmo problema no toggle "Portal".

## Decisões que este esboço já fixa (informais, mas valem para a versão real)

- **Troca lateral não substitui acesso direto** — a faixa de abas permite os
  dois: setas para navegação sequencial e clique direto em qualquer setor.
- **Indicador visual de placeholder na própria faixa de abas** (ponto discreto
  ao lado do rótulo), não só dentro da tela — a pessoa sabe antes de clicar.
- **Setor sem dado real ainda mostra a rota real**, nunca "em breve" sem URL.
- **Navegação vertical é um componente genérico**, não algo específico do
  setor 1 — qualquer setor futuro com mais de um bloco de conteúdo reaproveita
  `PaginasVerticais` em vez de inventar de novo (mesmo princípio de
  [[04 - Reuso de Telas]]).
- **Nem todo conteúdo múltiplo vira página vertical** — Desvios (setor 2) tem
  2 blocos mas fica lado a lado, porque a leitura útil ali é comparar os dois
  ao mesmo tempo. Paginação é para conteúdo que compete pelo mesmo espaço, não
  regra automática para "mais de um card".
- Paleta e tipografia usadas são as do `Design System.md` — nenhum valor novo
  foi inventado para este esboço.

## Medições — pizza suprimida, farol recentrado, saldo no popup (2026-08-11)

Pedido único com 3 partes:

- **Pizza "Situação do Contrato" suprimida por ora** — gate
  `MOSTRAR_PIZZA_MEDICOES` (const, hoje `false`) na condição que já existia
  (`contratoCfg && ...`). Código do `GraficoPizza`, legenda e resizer
  continuam intactos no arquivo — reativar é só trocar a constante pra
  `true`, não precisa reescrever nada.
- **Farol recentrado com os valores** — o balão "Farol" usava
  `justifyContent:'space-between'` com só 2 filhos (rótulo, bolinha), o que
  colava a bolinha no fundo do cartão. Os outros balões (`Balao`) têm a
  linha de valor numa posição diferente: espaçador flexível + bloco de
  valor + linha de `sub` sempre reservada (15px + 2px de margem) abaixo.
  Farol ganhou a MESMA estrutura (espaçador antes da bolinha + reserva de
  15px/2px depois dela) pra a bolinha cair na mesma altura visual da linha
  de valor dos vizinhos — mesmo padrão já catalogado no 54.2/54.3, agora
  aplicado a um card que não usa o componente `Balao` (é customizado, só
  reaproveitou a técnica).
- **Saldo a Faturar no popup do Valor Medido** — como a pizza (única tela
  que mostrava esse número) foi suprimida, o valor `saldoAFaturar` (Contrato
  − Medido, já calculado, não é novo) ganhou uma linha própria no popup que
  abre ao clicar em "Valor Medido", separada por linha tracejada da soma
  FD+NFs=Total. Mesmo aviso "Faturado + FD já ultrapassa o contrato" que
  existia só na pizza foi replicado aqui (cai no cenário raro de saldo
  negativo) — sem essa réplica, suprimir a pizza teria feito esse alerta
  desaparecer de todo o painel.

Validado com Playwright: pizza não renderiza mais (0 SVGs), bolinha do
farol alinhada com o texto grande dos balões vizinhos, popup mostra Saldo
a Faturar corretamente, sem erro de console.

## Setor 5 — OC/CO sai do placeholder (2026-08-11)

"Ordem de compra e orçamento complementar é o mesmo, monte o setor com os
dados da table" — correção de escopo (não são 2 fontes, é 1 só, ver
[[02 - Escopo e Telas]]) + implementação direta em cima de
`orcamentos_complementares_obra` (criada no mesmo dia, ver
[[07 - Modelo de Dados]]).

`ModuloOcCo` segue o mesmo esqueleto de `ModuloRestricoes` (1 fetch por
`id_obra=eq.`, busca+ordenação client-side, sem paginação):

- **2 fileiras de balões**: Total de OCs/Aprovado/Saldo (`kpi-row cols-3`,
  os 3 números mais importantes) + Em Elaboração/Em Análise/Crédito/Débito
  (`kpi-row-flex`, 4 colunas). Todos vêm prontos do `resumo.data` da API
  (nenhum cálculo local) — "sem dado" explícito se o campo faltar.
- **Tabela de OCs individuais**: Nº/Descrição/Status/Valor Final/
  Responsável/Execução, ordenável (padrão `alternarOrdenacao`/
  `COLUNAS_OC` igual Restrições/NFs), busca por texto
  (`normalizarNomeParaMatch`, mesmos campos-alvo). Status colorido por
  substring (`corStatusOc`, mesmo padrão de `corStatusRestricao` — domínio
  de status não é fechado, casa por trecho pra não deixar status novo cair
  em cinza por engano).
- **Popup de detalhe ao clicar na linha** (não existia em Restrições, mas
  já era padrão em Medições/Valor Contrato) — mostra os ~15 campos que não
  cabem na tabela (datas, valores separados material/serviço/FD, interesse
  no contrato original, observação livre, quem cadastrou).
- **Guard de data fabricada**: `data_inicio`/`validade_oc`/`data_revisao`
  vêm como `"0000-00-00"` quando vazios (não é ISO nulo) — sem tratamento,
  o parser de data do app (`parseDataFlexivel`) não gera `NaN` pra essa
  string (quirk do `new Date()` com ano 2 dígitos trata "00" como 1900),
  então mostraria uma data de 1899 fabricada em vez de "—". `fmtDataOc`
  filtra esse padrão antes de formatar.

**Bug de formatação pego no teste (Playwright), não no código**: balão
"Crédito" pode vir NEGATIVO de verdade (obra com Novo Nordisk UB/SP tem
Crédito = -R$ 19.692.303,38) — `fmtReais` cru produz `"-R$ 19.692.303,38"`,
e o navegador às vezes quebra linha logo depois do "-" isolado, feio.
Corrigido com formato contábil pra negativo (`(R$ 19.692.303,38)`,
parênteses em vez de sinal), aplicado nos 5 balões monetários do resumo.

Validado com Playwright em 2 obras (CNPEM/106, 8 OCs; Novo Nordisk UB/SP/91,
81 OCs) — ordenação, busca, popup e volume maior todos ok, sem erro de
console.

### Filtros clicáveis por Status e Execução (2026-08-11, mesmo dia)

"deixe mais interativa, filtros apertando nos botões e coisas do tipo" —
2 fileiras de chips clicáveis (toggle) abaixo da busca: **Status** (domínio
aberto, ex. APROVADO/CANCELADA/EM ANÁLISE (CLIENTE)/STAND-BY/REPROVADO) e
**Execução** (EXECUTADO/EM EXECUÇÃO/NÃO EXECUTADO). Cada chip mostra o
valor + contagem.

- **Regra de combinação**: chips do MESMO grupo somam (OU — "CANCELADA" +
  "APROVADO" mostra as duas categorias juntas); grupos DIFERENTES
  restringem (E — Status + Execução juntos mostra só a interseção);
  busca de texto entra como mais um E por cima de tudo. Validado: 21
  (CANCELADA) + 40 (APROVADO) = 61 quando os dois ativos; cai pra 3 ao
  adicionar o chip "EXECUTADO" por cima (interseção real, não união).
- **Contagem em cascata**: o número em cada chip reflete a busca + os
  filtros JÁ ativos nos OUTROS grupos (não o total fixo da obra) — evita
  "cliquei e sumiu tudo sem explicação". Ex.: "NÃO EXECUTADO" mostra 74
  sem filtro nenhum, mas recalcula pra 56 assim que um filtro de Status é
  aplicado.
- Domínio de Status/Execução não é tratado como lista fechada — os chips
  são gerados a partir dos valores que realmente aparecem nos dados da
  obra (`Map` de contagem + `Array.sort` por frequência), mesmo raciocínio
  de `corStatusRestricao`/`corStatusOc` (substring match pra cor, nunca
  esconde categoria desconhecida).
- Célula "Execução" da tabela ganhou a mesma cor dos chips
  (`corExecucaoOc`), pra reforçar visualmente a categoria sem precisar
  abrir o popup.
- "Limpar filtros" só aparece quando algum chip está ativo.

Validado com Playwright (obra 91, 81 OCs): toggle liga/desliga, OU dentro
do grupo, E entre grupos, combinação com busca de texto, contagem em
cascata recalculando, popup de detalhe continua abrindo ao clicar na
linha — tudo confirmado, sem erro de console.

**Revertido no mesmo dia** ("tire a linha de filtros") — usuário decidiu
tirar as 2 fileiras de chips por completo (confirmado via pergunta: as
duas, não só uma). Removido código todo: estado (`statusAtivos`/
`execAtivos`), toggles, `statusContagens`/`execContagens`,
`filtradasStatus`/`filtradasFinal` (`ocsOrdenadas` voltou a ler direto de
`filtradas`, só busca de texto), botão "Limpar filtros", e o componente
`FiltroChip` (ficou sem nenhum uso, removido em vez de deixado morto no
arquivo). `corExecucaoOc` continua em uso (colore a célula "Execução" da
tabela) — não foi removido. Setor volta ao mesmo padrão de
Restrições/Medições (busca simples + tabela ordenável).

### Filtro por status volta, sem fileira de chips (2026-08-11, ainda mesmo dia)

"ao clicar no botão do status, poderia filtrar pelo status
correspondente" — versão mais enxuta do filtro removido acima: sem fileira
extra nenhuma, o próprio badge de status já visível em cada linha da
tabela virou o controle. Clicar filtra por aquele status (toggle — clicar
de novo limpa); botão "Status: X ✕" aparece ao lado da busca pra limpar
também por ali. Badge ativo ganha `boxShadow` na cor do status (anel).

- `BadgePill` ganhou `onClick`/`ativo` opcionais, mantendo 100%
  retrocompatível com os outros 2 usos existentes (Restrições) que não
  passam esses props.
- Clique no badge usa `e.stopPropagation()` — sem isso, o clique
  "vazaria" pro `onClick` da `<tr>` (abre popup de detalhe), já que o
  badge está DENTRO da linha clicável.
- Só 1 status ativo por vez (mais simples que o sistema de facetas
  múltiplas removido antes) — combina em E com a busca de texto.

Validado com Playwright (obra 91): filtra 81→40 ao clicar "APROVADO",
`boxShadow` do badge confirma anel ativo, toggle limpa, botão "✕" limpa,
clique em outra célula da mesma linha ainda abre o popup normal (prova que
o stopPropagation não vazou pro resto da linha).

### Saldo/Crédito/Débito saem da fileira, entram no popup do "Aprovado" (2026-08-11, mesmo dia)

Usuário perguntou "qual a diferença do aprovado e do saldo?" — resposta
exigiu conferir os dados reais das 7 obras (`execute_sql`), não só ler a
doc da API (que não define a fórmula): **Saldo = Débito + Crédito, sempre
exato** (confirmado nas 7 obras). **Aprovado não é a mesma coisa** — só
coincide com Saldo quando Crédito é zero; divergiu em 4 das 7 obras
(diferenças de R$ 97 mil a R$ 333 mil), sem uma fórmula simples que
explicasse a diferença a partir dos outros campos. Resposta dada ao
usuário deixou claro que a fórmula exata é do lado do PortalMSE, não
inventei uma (ADR-005).

Depois disso, pedido: "suprimir o saldo, crédito e débito, o crédito e
débito aparecerão dentro do cartão de aprovado". Fileira principal caiu
de "Total/Aprovado/Saldo" (`cols-3`) + "Elaboração/Análise/Crédito/Débito"
(`kpi-row-flex`, 4) pra só 2 fileiras `cols-2`: Total/Aprovado e
Elaboração/Análise. "Aprovado" ganhou `onClick` (só quando `resumo` existe)
abrindo popup com Débito/Crédito + Aprovado em negrito.

**Cuidado deliberado no popup**: os popups de "Valor Contrato"/"Valor
Medido" (Medições) terminam com uma linha de total que É a soma exata dos
itens acima. Aqui NÃO — Débito+Crédito bate com Saldo (suprimido), não com
Aprovado, então listar os dois acima de "Aprovado" em negrito sem
qualificação teria implicado visualmente uma soma que os dados não
confirmam. Adicionada legenda explícita ("Débito e Crédito vêm prontos da
API... não são necessariamente a composição exata do valor Aprovado") pra
não repetir com o usuário o mesmo mal-entendido que motivou a pergunta
original.

Validado com Playwright (obra 91 — Crédito negativo real, formato
parênteses correto no popup): balões certos, popup abre/fecha, filtros e
tabela continuam funcionando, sem erro de console.

**Ajuste final, mesmo dia**: "coloque tudo em uma fileira" — as 2 fileiras
`cols-2` (Total/Aprovado, Elaboração/Análise) viraram 1 fileira só. Não
existia `cols-4` no CSS (só `cols-2`/`cols-3`) — adicionada, mesmo padrão
(`grid-template-columns: repeat(4,1fr)`, com fallback pra 1 coluna em
`max-width:768px` igual às outras `cols-N`). Validado em 1600px (fileira
única, mesma altura) e 700px (empilha em 1 coluna, sem overflow).

## Setor 2 (Encarregados) — exportar PNG do ranking (2026-08-11)

"Precisamos trazer o mecanismo de gerar png, do dash-main, para a tela dos
encarregados deste dash" — portado do `dashboard-main`
(`exportarPNG` da seção Performance de Encarregados), aplicado no app
PRINCIPAL do painel-mse (`prototipo\index.html`, não o `combinado`, já
retirado do ar).

- Desenho em `<canvas>` (2x de escala pra nitidez), não é print de tela —
  título "MSE ENGENHARIA · PERFORMANCE DE ENCARREGADOS" + nome da obra,
  "Dia de referência" + método de ordenação atual em destaque, colunas
  Qualidade/Colaboradores/Índice de Produtividade/Aderência ao Avanço
  Planejado/Última Liberação de PT (essa última só se a obra tiver
  `origemPTS`) com badges coloridos, legenda do índice de produtividade,
  1 linha por encarregado seguindo a ORDENAÇÃO ATUAL da tela (clicou pra
  ordenar por outra coluna, o PNG sai na mesma ordem).
- **Paleta adaptada**: cores/limiares batem com os badges já usados NA
  TELA do painel-mse (`T.green`/`T.amber`/`T.red`/`T.blue`), não com a
  paleta original do dashboard-main (levemente diferente, ex.
  `#197a45` vs `#1f9d57`) — consistência com o resto do painel-mse, não
  com a origem do código copiado.
- Botão "Baixar PNG ↓" ao lado do texto "Referência: dd/mm/aaaa" no topo
  da tela; desabilitado se não houver linhas pra exportar.
- Nome do arquivo: `aderencia_<obra>_<data-referência>.png`.

Validado com Playwright em 3 obras (com PT, com PT diferente, sem PT) —
download disparado com nome certo, PNGs de 148KB a 973KB (proporcional ao
nº de encarregados), inspeção visual confirmou layout íntegro e cores
corretas, sem quebrar com/sem a coluna de PT.

**Bug de Qualidade replicado do combinado (mesmo dia, "bugou o status
qualidade de novo")**: os 2 fixes já validados no painel combinado
(`emLotes` trocado de `fetch` cru pra `fetchPaginado` — cap de 1000 linhas
do PostgREST; e preferir, entre as linhas do mesmo card/dia, a que tem
`status_qualidade` preenchido em vez da primeira do array) foram aplicados
aqui no app PRINCIPAL — mesma causa, mesmo código, só que agora no arquivo
que fica no ar de verdade. Also corrigido o fetch de `Apontamentos` do
popup "Cards Ativos" (mesma paginação + mesma preferência de linha),
já que usa a mesma tabela pro mesmo problema em escopo menor (só os cards
de 1 encarregado). Validado: obra 91 foi de 100% "Pendente Qualidade" pra
maioria "BOM" (só 2 de 29 continuam pendentes de verdade), popup e
exportação PNG seguem funcionando, outras obras sem regressão.

### Popup "Cards Ativos" — métricas e filtros em linha única (2026-08-11)

"o índice de produtividade deve aparecer na mesma linha que as outras
informações, os filtros também, linha única, se precisar de espaço,
aumente o cartão do pop-up" — 2 fileiras que usavam `flexWrap:'wrap'`
(quebravam pra 2ª linha quando não cabia tudo) viraram `flexWrap:'nowrap'`
+ `overflowX:'auto'` como rede de segurança (rola em vez de quebrar ou
cortar, se mesmo assim não couber):

- Fileira "Filtrar"/"Exibir" no topo do popup.
- Fileira de métricas dentro de cada cartão (Quantidade/Saldo/Meta/
  Qualidade/Aderência/Índice de Produtividade).

Além disso, `CardMetric` ganhou `whiteSpace:'nowrap'`+`flexShrink:0` no
rótulo/valor/container (sem isso, um rótulo longo tipo "ÍNDICE DE
PRODUTIVIDADE" quebraria em 2 linhas sozinho mesmo com a fileira em
nowrap). Popup principal (`PopupCardsEncarregado`) foi de `maxWidth:720`
pra `maxWidth:960` — pedido explícito de aumentar o cartão em vez de só
depender do scroll.

Validado com Playwright: em 1400px de viewport o popup mede exatamente
960px, ambas as fileiras ficam numa linha só; em 700px (tela estreita) o
popup encolhe mas as fileiras passam a rolar horizontalmente
(`scrollWidth > clientWidth`, confirmado), sem quebrar linha nem cortar
texto.

## Setor 9, provisório — Tour 360° (2026-08-11)

Pedido: exibir um tour 360° do Constructin
(`https://visi.constructin.com.br/#/tour/...`) dentro do painel. Marcado como
**provisório** desde o início (a pessoa pode remover se não vingar) — 9º
setor (`slug: tour-360`), `estado: 'pronto'` mas fora do padrão dos outros 8
por depender de um serviço externo, não do Supabase.

- Verificação prévia (headers HTTP do domínio): sem `X-Frame-Options` nem
  `Content-Security-Policy` no HTML servido — permite embutir em `<iframe>`
  a princípio.
- `OBRA_TOUR_360` mapeia **id da obra → URL do tour**; só CNPEM - Faseado
  (id 106) tem link cadastrado por ora. Outras obras caem num estado
  "Tour 360° indisponível" (mesmo padrão visual do `SetorPlaceholder`), não
  em iframe quebrado.
- `ModuloTour360` é só o `<iframe>` ocupando 100% do card — sem lógica de
  dados, sem fetch.

**Bug real exposto por essa mudança (corrigido)**: `parseHash()` usava
regex `[a-z-]+` pro slug da URL — não aceitava dígito. Como o slug novo é
`tour-360`, abrir o link direto ou dar F5 na aba cortava o match em
`tour-` e o app caía silenciosamente pra Curva S (a barra de endereço era
reescrita, escondendo o erro). Clicar na aba pela UI funcionava normal (não
passa pelo parse de hash inicial). Corrigido pra `[a-z0-9-]+`. Lição: um
slug com número expôs uma checagem antiga feita pra um conjunto de slugs
que nunca tinham dígito — vale reconferir esse tipo de regex "fechado
demais" sempre que um slug novo fugir do padrão anterior.

**Pendência resolvida (2026-08-11)**: teste automatizado (Playwright,
navegador headless) tinha recebido 403 do CloudFront ("Request blocked") ao
carregar o conteúdo dentro do iframe. Usuário confirmou em navegador real
que o tour carrega normal — o 403 era bloqueio específico de tráfego
headless/sandbox (bot detection do lado do Constructin), não uma restrição
real a embed cross-origin. Recurso considerado funcional.

### Volta do seletor de obra + "modo cliente" na Curva S (2026-08-11, mesmo dia)

"Podemos incluir as demais obras e o botão seletor, mas é necessário que
as curvas sejam no 'modo cliente' do dashboard main. Esses dados que
montamos agora serão referentes ao CNPEM - Faseado." — reestruturação
grande: as 4 abas deixaram de ter obra fixa própria (Curva S/Tour 360°
presos ao CNPEM, Encarregados/Histograma presos a NN-UB/SP) e passaram a
seguir uma obra COMPARTILHADA, selecionável pelo `Header`+`SeletorObra`
originais do app principal (reaproveitados sem alteração) — as 6 obras
completas, igual ao painel-mse de verdade. Obra padrão ao abrir: CNPEM -
Faseado (id 106), lida como a referência dos ajustes visuais já montados
(Histograma com previsto reduzido).

### Bug do popup "Produtividade Diária" não caindo no corte certo da NN (2026-08-14)

"O diário das NN não está caindo no corte correto, o diário mais recente
deve sempre exibir sobre o seu corte correspondente" — bug real no app
PRINCIPAL (`prototipo/index.html`, não o combinado), na Curva S → "Ver
Tabela" → pastilha "Diário" no próximo corte. Duas causas independentes,
as duas na comparação com "hoje":

1. **`proxCorte` pulava o corte de hoje** — `infoCurva` (useMemo) achava o
   "próximo corte" com `dt > hoje`, onde `hoje` tinha hora fixada em
   23:59:59 e `dt` (data do corte, vinda de `curvas_s.data`) é sempre meia-
   noite. Num corte cuja data É hoje mas ainda não foi realizado (comum na
   NN, que fecha na quinta — confirmado ao vivo em produção no dia
   2026-08-13, quinta-feira: a pastilha "Diário" aparecia na semana de
   20/08 em vez da de 13/08, que é a que estava de fato em andamento),
   `dt > hoje` dava falso e o corte de hoje era pulado, empurrando a
   pastilha pra semana seguinte. Corrigido comparando com `hojeInicio`
   (00:00 de hoje) em vez de `hoje` (23:59): `dt >= hojeInicio`.
2. **Janela do popup calculada a partir de `new Date()`, não do corte
   clicado** — o `useEffect` que busca `relatorio_produtividade_semanal` e
   o bloco que monta o rótulo "Semana de dd/mm a dd/mm" recalculavam a
   janela do zero a partir da data real de hoje (`segundaDaSemana(new
   Date())` ± 3 dias pra NN). Como a semana da NN é sexta→quinta e não
   bate com a semana-calendário (segunda→domingo), esse recálculo dava
   errado exatamente nos dias em que a semana NN já virou mas a semana-
   calendário ainda não (sexta, sábado, domingo) — confirmado ao vivo: o
   mesmo teste repetido um dia depois (2026-08-14, sexta) mostrou a virada
   correta pra semana de 20/08 só depois da correção abaixo. Corrigido
   fazendo a janela (busca no Supabase + rótulo exibido) derivar sempre de
   `info.proxCorte.data` — a data do corte que JÁ está marcado com a
   pastilha — em vez de recalcular "hoje" de novo por conta própria.
   `janelaFim = parseDataCorte(info.proxCorte.data); janelaInicio =
   addDias(janelaFim, -6)` cobre os dois grupos (NN sexta→quinta e padrão
   segunda→domingo) com a mesma fórmula, porque a data do corte já é
   sempre o último dia da janela de 7 dias do grupo.

Lição: qualquer trecho que precise saber "qual semana está em andamento"
deve derivar isso de UM lugar só (aqui, `info.proxCorte`, que já vem do
dado real do Supabase) — recalcular "hoje" de novo em outro ponto do
componente (mesmo com fórmula aparentemente equivalente) cria uma segunda
fonte de verdade que diverge da primeira sempre que o dia da semana não
bate 1:1 entre os dois grupos de obra. Mesmo padrão do bug de Previsto do
combinado (ver seção acima "Volta do seletor de obra + 'modo cliente'" e
as anteriores sobre o ajuste visual do Histograma) — usar sempre a fonte
já resolvida, não reconstruir em paralelo. Validado ao vivo com Playwright contra produção nos dias
13 e 14/08 (a virada de dia durante a investigação, por acaso, serviu de
confirmação extra do segundo bug). Deploy feito
`firebase deploy --only hosting --project planejamento-mse`.

**Fora do escopo desta correção** (mencionar se o problema persistir): o
processo que ALIMENTA `relatorio_produtividade_semanal` dia a dia (fora
deste repo, provavelmente n8n — ver [[10 - Log do Auto]] ou perguntar ao
usuário) pode ter o mesmo tipo de problema no lado da ESCRITA — se ele
também ancorar a chave `periodo_inicio` em "segunda da semana-calendário
de hoje" sem o ajuste sexta→quinta da NN, o valor de sexta/sábado pode
estar sendo gravado (ou sobrescrito) na linha da semana errada antes mesmo
de chegar ao front. Não foi possível confirmar nem corrigir esse lado
nesta sessão (sem acesso ao workflow do n8n); só o app painel-mse foi
alterado.

### Histórico de semanas anteriores no popup "Produtividade Diária" (2026-08-14, mesmo dia)

"não mostra o histórico das semanas anteriores, se tivermos dados para
exibir, seria interessante" — pedido logo depois da correção acima.
Antes o popup só buscava a linha exata da semana atual (`eq.<chave>`);
trocado por uma busca de até 8 semanas (`HISTORICO_SEMANAS_DIARIO`),
`periodo_inicio=lte.<chave atual>&order=periodo_inicio.desc&limit=8`, e
uma 2ª tabela nova abaixo da de sempre, "Histórico — semanas anteriores",
uma linha por semana (intervalo de datas + valor por dia + Acumulado).
Cada linha de histórico recalcula sua PRÓPRIA janela a partir do
`periodo_inicio` dela (mesma fórmula do corte atual: `ehNN ? +3 : +6`
dias pro fim, `-6` dias pro início) — não dá pra usar `info.proxCorte`
aqui porque cada linha é uma semana diferente da que está com a pastilha.

A mensagem "Nenhum apontamento ainda nesta semana" deixou de ser
excludente — antes ela SUBSTITUÍA a tabela; agora aparece sozinha (semana
atual sem dado) mas o histórico continua aparecendo embaixo se existir
(caso real visto no teste: Novo Nordisk - AP tinha acabado de virar de
semana e ainda não tinha nada lançado na atual, mas tinha 4 semanas de
histórico — as duas coisas juntas fazem sentido).

Testado com Playwright local (não só produção desta vez) pra NN (4
semanas de histórico, ordem de dias Sex→Qui) e Hitachi (3 semanas, ordem
Seg→Sáb), sem erro de console, espaçamento de 7 dias entre linhas
conferido nos dois casos. Deploy:
`firebase deploy --only hosting --project planejamento-mse`.

### Correção do formato do histórico: popup por semana, não histórico agregado (2026-08-14, mesmo dia)

"as semanas anteriores devem ser exibidas num pop-up da sua semana
específica, não no pop-up da próxima" — o formato acima (2ª tabela de
histórico dentro do popup da semana em andamento) não era o que fazia
sentido; revertido. Agora QUALQUER coluna já fechada (índice <= idxHoje,
com Realizado) da tabela "Ver Tabela" também é clicável — cursor pointer
+ tooltip "Ver produtividade diária desta semana" — mas sem a pastilha
visível "Diário" (essa continua exclusiva da semana em andamento, pra não
poluir a tabela). Clicar em qualquer coluna (fechada ou em andamento)
abre o MESMO popup, mas escopado pra aquela semana específica:

- Estado trocou de `diarioAberto` (boolean) pra `diarioCorte` (guarda a
  linha/corte clicado, ou `null`) — o popup lê a janela de
  `diarioCorte.data` em vez de `info.proxCorte.data` fixo.
- Título mostra "· Parcial" só quando `diarioCorte.semana ===
  info.proxCorte.semana` (é a semana ainda em andamento); pra semanas já
  fechadas o popup mostra só "Produtividade Diária", sem "Parcial", e a
  mensagem de "nenhum apontamento" perde o "ainda" (uma semana fechada sem
  produtividade lançada não é "ainda", é uma lacuna).
- Removida a 2ª tabela de "Histórico" e o fetch com `limit`/`order` —
  voltou a ser 1 fetch por corte clicado (`eq.<periodo_inicio>`), só que
  agora QUALQUER corte pode disparar esse fetch, não só o próximo.

Testado com Playwright local: pastilha da semana em andamento continua
igual (popup com "Parcial"); coluna fechada 3 semanas antes abre popup
correto sem "Parcial" com os valores certos; coluna futura (bem à frente,
sem Previsto/Realizado) não é clicável. NN e Hitachi, sem erro de
console. Deploy: `firebase deploy --only hosting --project
planejamento-mse`.

### Múltiplas Curvas S para NN - AP (2026-08-14, mesmo dia)

"no NN AP temos mais de uma curva, a ideia é criar botões na parte de
baixo para navegar entre elas" — NN - AP tem 3 curvas na MESMA planilha
(`1tfFKVIo6aPjRa89_uknnNiNPx6DqlGV_bbijNNLGbkw`), cada uma numa aba: a já
sincronizada "PPU + C.O." (consolidada, aba `CURVA S - AVANÇO
FISICO_REV01 - PPU + C.O`) e duas novas — "PPU" (aba `2. CURVA S -
AVANÇO FISICO_REV01 PPU`) e "C.O." (aba `CURVA S - AVANÇO FISICO_REV01 -
C.O EM ANDAMENTO`).

- `OBRAS[107]` ganhou um campo `curvas: [{chave, label}, ...]` — a chave
  "NOVO NORDISK - AP" (padrão, inalterada) mais "NOVO NORDISK - AP -
  PPU" e "NOVO NORDISK - AP - C.O." novas. Outras obras não têm esse
  campo (`undefined`), então continuam se comportando exatamente como
  antes — `curva` (singular) ainda é a chave usada nelas.
- Estado novo em `App`: `curvaEscolhida` (reseta pra `null`/padrão
  sempre que `obraId` muda) + `curvaChaveAtual` derivado (`curvaEscolhida
  || obraAtual.curvas?.[0]?.chave || obraAtual.curva`) — é essa chave
  derivada, não mais `obraAtual.curva` direto, que filtra `curvasRaw` em
  `linhasCurva`.
- `ModuloCurvaS` ganhou 3 props novas (`curvas`, `curvaAtual`,
  `onTrocarCurva`) e um seletor de botões — só renderiza se
  `curvas.length > 1`. Colocado logo abaixo da barra de ferramentas
  (Rótulos/Zoom/Ver Tabela), acima dos popups.
- **Bug pego no teste, corrigido antes do deploy**: o guard de "sem
  dados" (`if (!linhas || linhas.length < 2) return <CartaoEstado ...>`)
  cortava o componente inteiro ANTES de chegar no seletor de curva — como
  PPU/C.O. ainda não tinham nenhuma linha no Supabase, clicar nesses
  botões prendia o usuário na tela de "sem dados" sem nenhum controle
  visível pra voltar (só trocando de obra e voltando). Corrigido
  calculando `seletorCurva` (a JSX dos botões) ANTES dos early-returns e
  reaproveitando essa mesma variável nos dois lugares (guard de "sem
  dados" e no corpo normal do componente) — assim os botões continuam
  visíveis e clicáveis em qualquer estado da tela.
- **Fora do escopo do index.html**: o `.gs` que sincroniza `curvas_s`
  (Apps Script vinculado à planilha `SPREADSHEET_ID`
  `10tN3Giua_VOplL1BfO7e7jFYc4XiJjb0ionkAwekPNM`, sem cópia local neste
  repo) precisa de 2 linhas novas em `OBRAS_CURVAS` (mesmo `id` de
  planilha da NN-AP, abas diferentes, chaves `nome` = "NOVO NORDISK - AP
  - PPU" e "NOVO NORDISK - AP - C.O." — têm que bater com o front). Sem
  acesso direto a esse script nesta sessão (nem MCP nem cópia local); o
  usuário precisa colar a mudança manualmente e rodar
  `sincronizarCurvasSupabase` pra popular as 2 chaves novas. Até isso
  rodar, os botões "PPU" e "C.O." mostram "Sem dados de curva para esta
  obra" — comportamento esperado, testado e confirmado (não é bug).

Testado com Playwright local: 3 botões aparecem só em NN-AP, "PPU +
C.O." ativo por padrão com dado real, PPU/C.O. mostram "sem dados" mas
com os botões ainda visíveis/clicáveis (volta pra "PPU + C.O." sem
precisar trocar de obra), reset ao trocar de obra e voltar, sem
regressão nas demais obras, sem erro de console. Deploy: `firebase
deploy --only hosting --project planejamento-mse`.

### Botões de curva movidos pra dentro da barra de ferramentas (2026-08-14, mesmo dia)

"Coloque os botões do lado dos outros" — o seletor de curva (que tinha
ficado numa linha própria abaixo da toolbar) foi movido pra DENTRO do
mesmo `toolbar-wrap` que "Rótulos"/"Zoom"/"Ver todas as
colunas"/"Ver Tabela", com um separador vertical antes do label "Curva"
(mesmo padrão visual do separador que já existia entre os grupos da
legenda). `seletorCurva` virou um Fragment (`<>...</>`) em vez de um
`<div>` próprio, pra herdar o `display:flex` do container pai — no
early-return de "sem dados" (que não tem a toolbar ao redor) precisou
envolver `{seletorCurva}` num `<div className="toolbar-wrap">` avulso
pra não quebrar o layout ali.

Testado com Playwright local: botões na mesma linha em telas largas
(≥1500px); em ~1280px "PPU"/"C.O." quebram pra 2ª linha por
`flex-wrap` normal (comportamento responsivo esperado, não é bug —
registrar caso vire reclamação depois). Cliques continuam funcionando
(inclusive alternando entre as 3 curvas), sem erro de console, sem
regressão em Hitachi. Nesse mesmo teste, PPU e C.O. já vieram com DADO
REAL — sinal de que o usuário já colou o snippet no `.gs` e rodou
`sincronizarCurvasSupabase` entre a mensagem anterior e esta. Deploy:
`firebase deploy --only hosting --project planejamento-mse`.

**Modo cliente na Curva S** — portado do `dashboard-main`
(`CurvaLegendChart`, bloco "MODO CLIENTE: escala o Previsto histórico para
coincidir com o Realizado no corte atual e redistribui o saldo restante
linearmente até o fim"). Função `aplicarModoCliente` copiada quase
literal: se o realizado no corte de "hoje" estiver ATRÁS do previsto,
subtrai uma correção triangular do previsto (cresce de 0 até um pico no
índice de "hoje", depois decresce de volta a 0 no fim da série) — o
previsto encosta perto do realizado no ponto atual, com um pequeno ruído
determinístico (0,3%–3,8%) pra não ficar com desvio exatamente zero (mais
"real"). Se a obra já estiver em dia/adiantada, a função não faz nada
(`realHoje >= prevHoje` → retorna os dados originais sem tocar).

Diferente do dashboard-main (onde é atrás de senha, toggle opcional),
aqui fica **sempre ativo** — a tela inteira já é o modelo/apresentação
com dado fictício (mesmo raciocínio do ADR-005 já registrado: só cabe
aqui porque não existe uma versão "sem maquiagem" da mesma tela por perto
pra confundir alguém).

Validado: (1) Playwright confirmou troca de obra funcionando nas 6 opções,
as 4 abas seguindo a obra selecionada (Encarregados/Histograma/Tour 360°
agora variam com a obra, não fixos em NN-UB/SP), app principal
(`index.html`) continua com os mesmos números de sempre pra CNPEM (prova
de isolamento); (2) como nenhuma das 6 obras reais está atrasada hoje, o
teste em navegador não exercitou o branch de correção — validado à parte
com um teste isolado da função pura (`node`, dado sintético atrasado):
previsto no ponto "hoje" caiu de 0,500 pra 0,364 (perto do realizado
0,400), desvio virou levemente positivo (+0,036) em vez de -0,10, e a
correção zera nas duas pontas da série (não distorce o formato geral da
curva).

### Correção: obra CNPEM continua mostrando o conjunto UB/SP (mesmo dia)

"Mas desfez o conjunto que criamos, dos encarregados do UB/SP no CNPEM -
Faseado, histograma também" — mal-entendido meu na reestruturação
anterior: interpretei "esses dados... serão referentes ao CNPEM" como
"CNPEM vira só mais uma obra normal no seletor", quando na verdade o
pedido era manter a combinação original (Encarregados/Histograma com dado
de Novo Nordisk - UB/SP, rotulado como CNPEM) e só ADICIONAR as outras 5
obras como opções extras, cada uma com seus próprios dados reais.

Corrigido com um mapa de redirecionamento
(`OBRA_DOADORA_ENCARREGADOS_HISTOGRAMA = { 106: 91 }`): quando a obra
selecionada é CNPEM (id 106), `ModuloEncarregados`/`ModuloEfetivo` buscam
dado de UB/SP (id 91) mas recebem `obraNome` da obra SELECIONADA (CNPEM) —
a tela mostra "CNPEM - Faseado" com os números de UB/SP por baixo. Pra
qualquer outra obra (inclusive UB/SP escolhida diretamente no seletor),
não há redirecionamento — mostra dado próprio normal. Curva S e Tour 360°
não têm esse redirecionamento (sempre a obra selecionada de verdade).

Validado com Playwright: Encarregados/Histograma com CNPEM selecionado
batem exatamente (comparação JSON) com os mesmos dados de UB/SP
selecionada diretamente, só o rótulo muda; Hitachi (obra sem
redirecionamento) mostra dado próprio, diferente dos dois; Curva S de
CNPEM mostra a curva de CNPEM (não a de UB/SP) em qualquer caso.

### Coluna Produtividade removida + bug real de truncamento na Qualidade (2026-08-11, mesmo dia)

"Retire a coluna da produtividade" — removida por completo do
`ModuloEncarregados` no `combinado/index.html` (coluna, badge, fetch de
`v_indices_financeiros_diario`, estado, sort case — nada ficou morto no
arquivo).

Na sequência: "Não está puxando a qualidade, verificar" — investigação
achou **2 problemas em cascata**, ambos existentes desde antes (código
idêntico ao app principal, não introduzidos por mudança recente):

1. `rows.find(...)` pegava a primeira linha de `Apontamentos` que batesse
   a data de referência, mesmo que fosse uma linha com `status_qualidade`
   nulo — descartando uma linha do MESMO dia, mesmo card, com status
   preenchido (achado real: um card pode ter mais de 1 linha de
   `Apontamentos` no mesmo dia). Corrigido pra preferir qualquer linha do
   dia com status preenchido.
2. **Causa raiz de verdade**: o helper `emLotes` usava `fetch` cru (com
   `limit=50000` na query, que o PostgREST ignora) em vez de
   `fetchPaginado` — o mesmo "Cap de 1000 linhas Supabase" já catalogado
   na memória do projeto, só que nunca corrigido NESTE ponto específico do
   código. Cada lote de 200 `card_id` busca meses de `Apontamentos` (1
   linha por card por dia) — facilmente passa de 1000 linhas, cortando os
   dias mais recentes silenciosamente. Era por isso que o dia de
   referência (ontem/dia útil anterior) nunca aparecia nos dados, mesmo
   com a linha certa existindo no banco.

**Isso afeta também o app principal** (`prototipo\index.html`) — código
idêntico, não exclusivo do painel combinado. Usuário avisado; correção lá
depende de confirmação (é dado real de produção, mudança de maior peso).

Validado com Playwright + `execute_sql` direto no Supabase (comparação
com dado real): 27 de 29 encarregados passaram a mostrar "BOM" real
(antes, 100% "Pendente Qualidade").

### Painel Combinado suprimido do ar (2026-08-11, mesmo dia, depois de usado)

"Podemos suprimir este módulo extra, já foi utilizado. Vamos manter só o
regular" — a apresentação/demo que motivou o painel combinado terminou.
Tirado do ar (não apagado): `firebase.json` (raiz do projeto, não dentro
de `prototipo/`) ganhou `"combinado/**"` no array `ignore` da hosting —
esse padrão é relativo ao `public` (`prototipo/`), então cobre
`prototipo/combinado/**`. Próximo deploy já reflete: caiu de 10 pra 9
arquivos publicados, e `firebase deploy` remove do site ao vivo qualquer
arquivo que não bate mais no conjunto publicado (não é só "não subir
arquivo novo", é sincronização completa).

Código-fonte (`prototipo/combinado/index.html`) continua no repositório,
intocado — só parou de ser servido. Reversível a qualquer momento: tirar
essa linha do `ignore` e rodar `firebase deploy` de novo. Confirmado com
`Invoke-WebRequest`: `/combinado/index.html` → 404; `/index.html`
(principal) → 200, sem impacto.

## Painel Combinado, provisório, app separado (2026-08-11)

Pedido: "vamos precisar desenvolver um outro app provisório... vamos exibir
um conjunto de informações combinadas... Curva S do CNPEM - Faseado, a
tela de Encarregados do NN-UB/SP, Histograma do NN-UB/SP e tour 360º do
CNPEM - Faseado. Tudo em um painel a parte, que não impacte no existente."

**Onde mora**: `painel-mse\prototipo\combinado\index.html` — subpasta
dentro do mesmo `public` do Firebase Hosting (`prototipo/`), então sobe
junto no mesmo `firebase deploy`, mas é um arquivo HTML totalmente
separado do principal (`prototipo\index.html`), sem nenhuma edição nele.
URL: `https://painel-mse-prototipo.web.app/combinado/`.

**Como foi feito**: cópia integral do `index.html` principal (mesmos
componentes — `Balao`, `ModuloCurvaS`, `ModuloEncarregados`,
`ModuloEfetivo`, `ModuloTour360`, helpers, tokens de tema — tudo
reaproveitado sem alteração), com os paths de imagem ajustados pra
`../assets/images/...` (a cópia vive 1 nível mais profundo). Só a
navegação de topo foi reescrita: em vez do `Header`+`SeletorObra`+
`TabsSetores` originais (troca livre de obra × 9 setores), o painel
combinado tem `HeaderCombinado` (sem seletor de obra — não faz sentido
aqui, cada aba já tem sua obra fixa) + `TabsCombinado` (4 abas fixas, sem
setas ‹ ›):

1. Curva S — CNPEM (obra 106)
2. Encarregados — NN-UB/SP (obra 91)
3. Histograma — NN-UB/SP (obra 91)
4. Tour 360° — CNPEM (obra 106)

Layout escolhido: **abas, uma tela por vez** (perguntado ao usuário —
alternativa seria grade 2×2 com tudo visível ao mesmo tempo, mas cada
vista perderia espaço/detalhe). Cada aba ocupa a tela inteira, mesmo nível
de detalhe do painel principal.

Fetch de Curva S filtrado direto na query (`obra=eq.CNPEM - FASEADO`) em
vez do padrão "busca todas as obras, filtra depois" do app principal — só
uma obra aparece em qualquer aba deste painel, não precisa buscar o resto.
Encarregados/Histograma/Tour 360° reaproveitam os módulos 100%
auto-suficientes (já buscam os próprios dados a partir de `obraId`).

Validado com Playwright: as 4 abas carregam dado real, hash/título mudam
corretamente por aba, F5 mantém a aba atual, e — checagem explícita pedida
pelo próprio requisito de isolamento — o app principal (`index.html`)
confirmado intacto e funcionando depois do deploy.

**Ajuste no mesmo dia**: "não precisa apontar como combinado ou
provisório, nem indicar de qual obra é cada página" — título do cabeçalho
voltou a "Painel de Obra" (igual ao app principal, sem "combinado"/
"provisório"); rótulos das 4 abas perderam o sufixo de obra ("Curva S —
CNPEM" → só "Curva S", etc.) — inclusive o título da aba do navegador, que
deriva do rótulo. Os `slug` internos das abas continuam com o sufixo
(`curva-s-cnpem`, `encarregados-ubsp`...) só pra manter cada URL/hash
única — isso nunca aparece na tela, é só identificador técnico.

**Fator visual no Previsto do Histograma (mesmo dia)**: pedido inicial foi
"reduzir o histograma previsto, para que fique menor que o real". Antes de
implementar, sinalizei ao usuário que isso reproduzia exatamente o "modo
cliente" do dashboard antigo — reescrever o previsto pra maquiar
desvio — que o painel-mse tinha decidido deliberadamente NÃO ter, por
violar a regra de não fabricar dado (ADR-005, ver
[[06 - Decisões de Arquitetura]]). Usuário esclareceu: é apresentação de
um **modelo com dados fictícios**, ajuste **só visual, sem influenciar
dados reais** — motivo que resolve a objeção (não é dado real de operação
sendo maquiado pra alguém tomar decisão em cima).

Implementado só no `ModuloEfetivo` **dentro de `combinado/index.html`**
(cópia independente — o `ModuloEfetivo` do app principal não foi tocado):
constante `FATOR_VISUAL_PREVISTO_EFETIVO = 0.55` aplicada na origem, onde
os `Map`s `previstoPorMes`/`previstoPorSemana` são montados — assim o
gráfico E os popups de detalhamento (total no topo + tabela por função)
mostram o mesmo número reduzido de forma consistente, em vez de um lugar
mostrar o valor real e outro o fictício. Nenhuma escrita no Supabase.

**Histórico de 3 tentativas até acertar** (todas no mesmo dia):

1. **Fator fixo sobre o previsto bruto** (`0.55`, depois `0.85`) — não
   funcionou: a razão entre previsto bruto e real varia mês a mês nesse
   dado fictício, então um fator fixo ora deixava "muito abaixo" (usuário
   reclamou), ora nem ficava abaixo do real (achado no teste com 0.85 —
   Jul/Ago ficaram ACIMA do real).
2. **Previsto = Real × 0,9**, comparando contra o histórico
   (`realHistoricoPorMes`/`realHistoricoPorMesViaSemana`) — melhor, mas
   ainda errado nos 2 meses mais recentes (Jul/Ago): a barra "Real" da
   tela prioriza dado VIVO (`periodosReal`, da view `vw_efetivo_*` atual)
   sobre o histórico, e o histórico estava desatualizado pra esses meses —
   comparar contra a fonte errada gerou proporção errada.
3. **Versão final**: o ajuste (`RATIO_VISUAL_PREVISTO_SOBRE_REAL = 0.9`) é
   aplicado no ponto onde o "Real" já foi resolvido com a MESMA prioridade
   que decide a própria barra (dado vivo > histórico) — em
   `dadosComPrevisto` (barras, qualquer granularidade) e
   `previstoExibidoPorMes` (popup "Previsto — Detalhamento", que sempre
   agrega por mês independente da granularidade do gráfico). Meses sem
   Real (futuros) mantêm o previsto bruto original, sem ajuste — não tem
   com o que comparar.

Validado com Playwright nos 8 meses com Real (Jan a Ago/26) — todos batem
`Real × 0,9` com tolerância de arredondamento, incluindo Jul/Ago (os casos
que falhavam nas 2 tentativas anteriores). Popup de detalhamento consistente
(soma da tabela = número do topo) nos 2 meses testados. Confirmado que o
app principal (`index.html#/obra/91/histograma`) continua com os valores
reais, sem nenhum ajuste — arquivo isolado, não tocado.

**Complemento no mesmo dia**: "o previsto seguinte deveria ser menor
também, volta na opção de 0,55 para o todo" — os meses FUTUROS (sem Real
ainda, caíam no fallback bruto sem ajuste nenhum) passaram a usar
`FATOR_VISUAL_PREVISTO_SEM_REAL = 0.55` (fator fixo sobre o bruto, mesma
lógica da 1ª tentativa — mas agora restrita só a esse caso, já que não há
Real pra calcular uma razão). Meses com Real continuam na lógica de 0,9×
já validada, sem mudança. Validado: 6 meses futuros (Set/26–Fev/27)
batendo exatamente 55% do valor bruto original (ex. Set/26: 700→385).

### Toggle de Assiduidade em Encarregados (2026-08-14)

"O toggle da assiduidade pode ser exibido" — resposta direta a uma
pergunta anterior ("o que não foi migrado do dash main pra esse?"), que
tinha listado o toggle de Assiduidade como a única omissão deliberada
ainda pendente no setor Encarregados (PNG e clique no nome já tinham sido
portados antes). Porta o botão "ASSIDUIDADE" da `LoopEncSection` do
dashboard atual — métrica só informativa (não entra no score de
ranking): % de dias com apontamento nos últimos 7 dias úteis.

- Cálculo idêntico ao original, portado pra dentro do `useMemo` de
  `linhas` em `ModuloEncarregados`: `diasUteisObra` (união de todos os
  encarregados, dias em que a OBRA trabalhou, excluindo fim de semana),
  `feriadosNacionais` da(s) ano(s) da janela de 7 dias, `diasBaseObra`
  (dias úteis da janela, exceto feriado em que a obra não trabalhou) e
  `totalDiasAssiduidade = max(1, diasBaseObra.size)` como denominador.
  Por encarregado: `assiduidade = (dias apontados dentro de
  diasBaseObra / totalDiasAssiduidade) × 100`.
- Toggle (`showAssiduidade`, estado local) ao lado do botão "Baixar PNG"
  — ativa/desativa: 3º cartão KPI "Assiduidade Média" (média simples
  entre os encarregados elegíveis) e a coluna "Assiduidade" na tabela,
  posicionada entre Qualidade e Colaboradores (mesma posição do
  original). Coluna ordenável como as demais.
- **Detalhe replicado de propósito, não óbvio de primeira leitura**: pra
  linhas "sem apontamento no dia de referência" (`semApontamentos`), o
  original mostra "—" na coluna de Assiduidade mesmo quando o valor
  calculado não é zero (a pessoa pode ter apontado em outros dias da
  janela, só não no dia de referência específico) — é uma
  inconsistência do próprio dashboard atual (as outras colunas, tipo
  Colaboradores, mostram o valor real mesmo nesse caso), mas replicada
  aqui por fidelidade à origem em vez de "corrigida" por conta própria —
  não foi pedido, e mudar o comportamento de uma métrica só informativa
  não parecia valer o risco de divergir do que o time já está acostumado
  a ver no dashboard atual.
- Exportar PNG do ranking **não muda** — o `exportarPNG` original nunca
  incluiu Assiduidade nas colunas desenhadas no canvas (conferido antes
  de portar), então não foi replicado ali também.

Testado com Playwright local em 2 obras (Novo Nordisk - AP e Novo
Nordisk - UB/SP): estado inicial (2 KPIs, sem coluna) → ativar (3 KPIs,
coluna aparece com valores plausíveis 0–100%) → ordenar pela coluna
(seta muda, ordem inverte) → desativar (volta ao estado inicial). Caso
de borda "—" pra linha ausente confirmado na obra 91. Sem erro de
console. Deploy: `firebase deploy --only hosting --project
planejamento-mse`.

### Botão "Portal MSE" no cabeçalho (2026-08-14)

"antes disso precisamos incluir um botão para retornar ao
portalmse.com.br" — dito logo depois de uma pergunta sobre o ganho de
migrar pro ADR-006 (ou seja, é uma tarefa que entra ANTES de qualquer
decisão de base técnica, não depende dela). Botão novo no `Header`,
canto superior direito, ao lado do `SeletorObra` — ícone de seta pra
esquerda + texto "Portal MSE", estilo consistente com o resto do
cabeçalho navy (`rgba(255,255,255,...)`, mesmo padrão do próprio botão
do seletor de obra).

- `irParaPortal()` — mesma URL e mesmo fallback do dashboard atual
  (`window.top.location.href` primeiro, pra funcionar mesmo se o painel
  algum dia for embutido num iframe do Portal; `window.location.href`
  como fallback se `window.top` não for acessível por política de
  origem cruzada). URL literal `http://portalmse.com.br/`, copiada
  verbatim do `irParaPortal` do dashboard-main — confirmado em teste que
  o domínio de fato redireciona pra `/login.php`.
- **Diferença deliberada do original**: no dashboard-main esse botão só
  aparece condicionado a `VIA_PORTAL` (`typeof window.__SSO_BOOTSTRAP !==
  'undefined'`, ou seja, só quando o dashboard é servido embutido via SSO
  do Portal) e substitui o botão de logout. O painel-mse não tem esse
  conceito de SSO/login ainda (ver [[02 - Escopo e Telas]], "Outras telas
  herdadas" — login é pendência real, não implementada) — então o botão
  aqui é incondicional, sempre visível, sem nenhuma lógica de
  autenticação por trás. Se o painel-mse ganhar SSO/embed no futuro, vale
  reconsiderar se esse botão deveria virar condicional como no original.
- **Bug pego no teste, corrigido antes do deploy**: o botão novo dividia
  a mesma linha flex do `SeletorObra` no cabeçalho — em mobile
  (≤768px), o seletor já tinha uma regra CSS antiga de `width:100%`
  (pensada pra quando ele era o único item da linha), que ignorou o novo
  vizinho e estourou a largura da tela (confirmado via
  `scrollWidth`/`clientWidth`: até 115px de overflow horizontal com o
  nome de obra mais longo). Corrigido com uma classe nova
  `.header-actions` + regra mobile que empilha os dois em coluna
  (`flex-direction:column`, cada um `width:100%`) em vez de dividir a
  mesma linha. **Lição, mesmo padrão do 78º passo (múltiplas curvas)**:
  toda vez que um elemento novo entra numa linha flex que já tinha uma
  regra `width:100%` fixa pensada pro caso de "item único", checar o
  responsivo — o problema nunca aparece no teste desktop, só testando
  a tela pequena de verdade.

Testado com Playwright local em desktop (1600×900, 3 obras incluindo a
de nome mais longo) e mobile (375×800, mesmas 3 obras, checagem de
overflow via DOM antes/depois do fix) — sem overflow, sem sobreposição,
sem erro de console, clique dispara a navegação corretamente. Deploy:
`firebase deploy --only hosting --project planejamento-mse`.

### Consolidação: repositório git vira fonte única (2026-08-14, mesmo dia)

"é possível fazer o deploy pela versão do repositório?" — até aqui, o
código vivia em DOIS lugares: `Documents\painel-mse` (sem git, onde
tudo era editado e de onde saía o `firebase deploy`) e
`Documents\Github\painel-mse` (com git, sincronizado na mão a cada
tanto). Confirmado que `firebase.json`/`.firebaserc` batem exatamente
entre os dois e que o CLI do firebase já está instalado globalmente
(`C:\node\`) — deploy funciona igual a partir do repo git. Usuário
escolheu consolidar: **este repositório git vira a fonte única** a
partir de agora (editar, commitar/pushar pra `develop` e dar deploy tudo
daqui) — resolve o anti-padrão de "duas cópias sincronizadas na mão" que
o ADR-002 já registrava como erro do dashboard antigo.

**Achado que muda uma premissa do ADR-006**: `node`/`npm` já estão
instalados globalmente nesta máquina — a restrição "máquina sem Node"
que embasava parte do custo da opção Vite+React+TypeScript não existe
mais (ver [[06 - Decisões de Arquitetura]], nota de correção no ADR-006).

Verificado com `git diff --no-index` que as pastas `prototipo/` dos dois
diretórios eram byte-idênticas antes da consolidação (as 2 mudanças
recentes — Assiduidade e Portal MSE — tinham sido portadas manualmente,
trecho a trecho, antes deste passo). Deploy de confirmação rodado direto
do repo git: 9 arquivos, resultado idêntico ao de sempre.

### Arrastar rótulo no modo zoom não deve mais mover a câmera (2026-08-14, mesmo dia)

"quando estiver no modo zoom, ao selecionar o rótulo para arrasto não
deve mexer a tela, somente o rótulo, a não ser que chegue na borda" —
bug real em `LineSVG`/`CurvaChart`: o `mousedown` no `<text>` do rótulo
"vazava" (bubbling) pro `onMouseDown` do container que trata o pan da
câmera (`CurvaChart.handleMouseDown`) — os dois aconteciam juntos sempre
que o gráfico estava ampliado (`zoom.scale > 1`).

- `LineSVG.handleDragStart` ganhou `e.stopPropagation()` — sozinho já
  resolvia o pedido central (arrastar rótulo não move mais a tela).
- **Parte 2 do pedido, o "a não ser que chegue na borda"**: implementado
  auto-pan contínuo — perto de ~36px da borda visível do gráfico
  (`containerRef`, passado de `CurvaChart` pra `LineSVG`), um loop de
  `requestAnimationFrame` desloca sozinho o `ox`/`oy` do viewBox enquanto
  o cursor permanecer ali (mesmo parado, sem `mousemove` novo), até
  soltar o mouse ou sair da faixa de borda. O offset do rótulo é
  compensado no mesmo passo (`somarOffset`) pra ele continuar "grudado"
  no cursor durante o auto-pan, em vez de ficar pra trás conforme a
  câmera anda sozinha.
- **Bug relacionado, corrigido junto**: o cálculo do offset do rótulo
  usava o delta do mouse em pixels de TELA direto como deslocamento em
  espaço SVG — correto só quando `scale === 1`. Com zoom ampliado (ex.
  2x), 100px de mouse deveriam virar 50 unidades de SVG (a viewBox
  mapeia uma região menor pro mesmo tamanho de tela), mas sem a divisão
  o rótulo "fugia" do cursor, andando mais rápido que ele. Corrigido
  dividindo o delta por `zoomScale` (passado como prop, com um `ref`
  interno pra não ficar preso no valor de quando o componente montou).
  Reescrevi o cálculo do offset pra incremental (soma um delta em cima
  do valor atual, via `somarOffset`) em vez de "recalcular do zero a
  partir do ponto inicial" — necessário porque agora DUAS fontes
  (mousemove normal e o loop de auto-pan) precisam concordar sobre o
  valor "atual" do offset, não só uma.

Testado com Playwright (zoom ampliado ~7x): arrastar rótulo no meio do
gráfico não move o `viewBox` (câmera parada, só o texto se move);
arrastar até a borda e segurar parado move o `viewBox` continuamente,
parando exatamente no `mouseup`; distância cursor↔rótulo medida em 6
amostras durante o auto-pan ficou constante (~0,82px, sem acumular
atraso); sem erro de console. Deploy: `firebase deploy --only hosting
--project planejamento-mse` (a partir do repo git, ver seção anterior).

### Tela de Medições reescrita: histórico + previsão a partir de `contratos_medicao`/`boletins_medicao` (2026-08-19)

"Vamos gerar a nova tela de medições a partir destes novos dados. A ideia
central é ter duas tabelas, uma com o histórico dos faturamentos... outra
com a previsão dos próximos faturamentos" — depois de toda a importação
da planilha "Saldo a Faturar" (ver seções anteriores desta mesma data),
o setor Medições (`ModuloMedicoes`) foi reescrito por completo pra parar
de usar `nfs` + `proximos_faturamentos` + o `CONTRATOS_CP` hardcoded no
próprio `index.html`. Confirmado com o usuário antes de mexer: **troca a
tela inteira**, não só a tabela de baixo (KPIs também passam a vir do
banco real).

- **Histórico de Faturamentos** = todo `boletins_medicao` com
  `status_faturamento = 'Faturado'`. Tabela com ~14 colunas (Valor
  Medido, Valor Faturado, Data Faturamento, Desconto FD, Retenção, ISS,
  Desc. Adiantamento, Recebimento Previsto/Real, Vencimento, Data
  Recebimento, Status Recebimento), ordenável por coluna, rodapé com
  totais — muito mais detalhe que a antiga tabela de NFs (que só tinha
  BM/NF/Empresa/Valor/Emissão).
- **Previsão de Próximos Faturamentos** = tudo que NÃO está faturado
  ainda (a lista inteira, não só 1 registro como o `proximos_faturamentos`
  antigo) — BM, Período, Valor Previsto, Status, Observação (pega o "BM
  vigente" da planilha).
- **KPIs recalculados na fonte nova**: Valor Contrato =
  `contratos_medicao.valor_total` (contrato base + OCs, mesmo conceito do
  `CONTRATOS_CP.original + extras` antigo); Valor Medido = soma de
  `valor_medido` de todo o Histórico (substitui `FD fixo + soma(nfs)`).
  Farol Medido×Físico mantém a mesma lógica (corte da Curva S mais
  próximo da data do último faturamento), só trocando a fonte da data.
  "Próximo Faturamento" (2 balões) agora deriva da 1ª linha da Previsão
  com valor lançado — se nenhuma tiver valor ainda (caso comum, o "BM
  vigente" normalmente ainda não tem previsto), mostra "sem previsão" em
  vez de inventar (ADR-005).
- `CONTRATOS_CP` removido do código (não tem mais nenhum uso).
- Popups de "Valor Contrato"/"Valor Medido" adaptados — perderam a lista
  "extras" item a item (esse conceito não existe mais, `valor_ocs` é um
  número só agora, sem itemização) mas ganharam ISS%/prazo de vencimento
  no popup do Contrato, que a fonte antiga não tinha.

Testado com Playwright (obra 91, CP236 — a que tem mais dado, 35
boletins no Histórico + 1 na Previsão, bate exato com os 36 totais já
validados na sincronização): tela carrega com dado real, as 2 tabelas
aparecem corretas, ordenação por coluna funciona, os 3 popups
(Contrato/Medido/Farol) abrem sem erro, 0 erros de console. Deploy:
`firebase deploy --only hosting --project planejamento-mse`.

### Medições — topo suprimido, Tour 360° do CNPEM corrigido, colunas enxugadas (2026-08-19)

Três ajustes rápidos em cima da reescrita acima, mesmo dia:

- **KPIs + gráfico suprimidos por ora** — pedido explícito ("suprimir o
  gráfico e os botões superiores, vamos manter apenas as tabelas, por
  hora"). Gate `MOSTRAR_TOPO_MEDICOES` (const, hoje `false`), mesmo
  padrão do `MOSTRAR_PIZZA_MEDICOES` de 11/08: nada foi apagado,
  reativar é só trocar a constante pra `true`.
- **Link do Tour 360° do CNPEM - Faseado corrigido** — URL antiga
  (`.../#/tour/10971/...`) trocada por
  `https://visi.constructin.com.br/#/v?t=...&p=10971` (mesmo id de
  projeto `10971`, formato de link novo do Constructin).
- **Colunas do Histórico e da Previsão enxugadas** — a 1ª versão do
  Histórico saiu com ~14 colunas (seção anterior), longa demais pro uso
  real. A pedido explícito, ficou em 6: **BM | Período | Valor Previsto
  | Valor Medido | Desconto FD | Valor Faturado**. O resto
  (retenção/ISS/desc. adiantamento/recebimento previsto-real/vencimento/
  data e status de recebimento) continua gravado em `boletins_medicao`,
  só saiu da tela por ora — nenhuma coluna foi removida do banco.
  Previsão ganhou `COLUNAS_PREVISAO` (antes era tabela hand-coded, sem
  array): **Data de Faturamento | Status Fat. | Data do Recebimento |
  Status Rec. | Saldo Previsto Acum. | Saldo Realizado Acum.** — sem
  BM/Período de propósito (o foco vira status de pagamento/recebimento
  e saldo acumulado corrente, não a identidade do boletim; normalmente
  só existe 1 linha pendente mesmo). O **filtro de linha da Previsão não
  mudou** (confirmado com o usuário antes de mexer): continua todo
  boletim sem `status_faturamento = 'Faturado'`, só as colunas exibidas
  são outras. Ordenação padrão do Histórico trocou de
  `data_faturamento` (coluna que saiu da tela) pra `periodo_fim`.

Testado com Playwright (obra 91/CP236, 35 boletins): as 2 tabelas
mostram exatamente as colunas esperadas, na ordem certa, ordenação por
coluna funciona, 0 erros de console. Deploy:
`firebase deploy --only hosting --project planejamento-mse`.

### Medições — ordenação padrão por BM + polish visual (2026-08-19)

Usuário aprovou a ordenação por BM ("vai sempre vir ordenado pela
coluna do BM") e pediu polish geral. Perguntei antes de mexer (via
AskUserQuestion) se BM devia virar ordenação FIXA (sem clique) ou só o
padrão inicial mantendo clique nas colunas — usuário escolheu manter
clicável, só trocando o padrão.

- **Ordenação padrão do Histórico**: trocada de `periodo_fim` desc pra
  `bm_label` asc. `DIRECAO_INICIAL_HIST` novo — cada coluna nasce com a
  direção mais útil ao primeiro clique (BM/Período crescente, colunas
  de valor decrescente, maior primeiro), corrigindo um bug latente onde
  os dois ramos do `alternarOrdenacaoHist` caíam sempre em `'desc'`.
- **Polish visual nas 2 tabelas**: zebra stripe (linhas pares
  `#f7f8fa`), hover azul sutil (`rgba(37,99,235,0.06)`, classe CSS
  `.tabela-medicoes`), cabeçalho/rodapé com fundo `#fafbfc` e borda
  2px (era 1px), padding de célula maior (9-10px/14px, era 7-9px/12px),
  colunas BM e Valor Faturado em negrito pra dar hierarquia ao extrato.

Testado com Playwright (obra 91/CP236): BM ▲ ativo por padrão no
carregamento, zebra/hover visíveis em screenshot, clique em "Valor
Faturado" ordena decrescente (maior primeiro), 0 erros de console.
Deploy: `firebase deploy --only hosting --project planejamento-mse`.

**Correção no mesmo dia**: usuário apontou "tem que vir ordenado do
maior para o menor" — o padrão inicial (asc) estava invertido do que
fazia sentido pra um extrato (mais recente primeiro). Trocado pra
`bm_label` **desc** (e `periodo_fim` também nasce desc no 1º clique,
mesmo critério das colunas de valor). Testado: carga inicial mostra BM
33→1, header com ▼ ativo, 0 erros de console.

### Medições — Previsão ganha Período e Valor Previsto de volta (2026-08-19)

Pedido explícito, "por hora" (sinaliza que pode mudar de novo): a
tabela de Previsão volta a mostrar **Período** e **Valor Previsto**,
direto de `boletins_medicao` (mesma leitura do Histórico —
`fmtPeriodo`/`valor_previsto`). BM continua fora. Ordem final das 8
colunas: Período | Valor Previsto | Data de Faturamento | Status Fat. |
Data do Recebimento | Status Rec. | Saldo Previsto Acum. | Saldo
Realizado Acum.

Testado com Playwright (obra 91/CP236): 8 colunas na ordem certa,
Período/Valor Previsto com valores sensatos, Histórico inalterado, 0
erros de console. Deploy:
`firebase deploy --only hosting --project planejamento-mse`.

### Medições — Período/Valor Previsto alinhados entre as 2 tabelas (2026-08-19)

Pedido explícito: "faça com que as colunas iguais fiquem alinhadas
entre as duas tables". Período e Valor Previsto aparecem nas duas
tabelas (Histórico e Previsão) — passaram a usar a MESMA largura fixa
em px (`<colgroup>` + `tableLayout:'fixed'`), então caem exatamente na
mesma posição horizontal quando as tabelas ficam empilhadas. Previsão
ganhou uma coluna fantasma sem rótulo no lugar do BM (que só existe no
Histórico), só pra reservar o mesmo espaço.

**Bug pego no meio do caminho**: com `table-layout:fixed`, se a soma
das larguras das colunas for menor que a largura real do container
(`width:100%`), o navegador estica TODAS as colunas proporcionalmente
pra preencher — isso quebrava o alinhamento porque o Histórico (menos
colunas, soma menor) esticava e a Previsão (mais colunas, soma maior,
já forçava scroll horizontal) não. Corrigido com uma coluna-filler sem
`width` no fim do Histórico — absorve a sobra, as colunas com largura
fixa não são mais esticadas. De quebra, "Data de Faturamento"/"Data do
Recebimento" estavam sendo cortadas (130px insuficiente pro rótulo) —
subiu pra 160px.

Testado com Playwright (obra 91/CP236, viewport 1440×900): Período e
Valor Previsto com `left`/`width` idênticos entre as 2 tabelas
(`getBoundingClientRect`), sem clipping nos cabeçalhos de data, 0
erros de console. Deploy:
`firebase deploy --only hosting --project planejamento-mse`.

### Medições — Histórico volta a ser auto, Previsão acompanha (2026-08-19)

Correção do passo acima: forçar largura fixa em px deixou o Histórico
espremido (valores grandes de moeda ficavam apertados). Pedido
explícito: "a de cima deveria seguir como estava, a de baixo deveria,
em caso de similaridade, acompanhar a de cima".

- **Histórico** volta ao layout automático — sem `colgroup`/
  `tableLayout:fixed`, largura por conteúdo, como era antes de toda
  essa história de alinhamento.
- **Previsão** mede ao vivo as colunas BM/Período/Valor Previsto já
  renderizadas no Histórico (`refLarguraHist` + `ResizeObserver` no
  wrapper do Histórico) e replica esses px nas suas próprias colunas
  Período/Valor Previsto/spacer via `largurasHist` (estado). Reage a
  resize de janela e a qualquer mudança de layout do Histórico — é
  sempre a tabela de baixo que segue a de cima, nunca o contrário.

Testado com Playwright (obra 91/CP236): "R$ 17.535.256,45" (Valor
Faturado) sem quebra/corte, Período e Valor Previsto com `left`/`width`
batendo a <1px entre as 2 tabelas, 0 erros de console. Deploy:
`firebase deploy --only hosting --project planejamento-mse`.

### Medições — live tiles, resumo na Previsão, gráfico Previsto × Medido (2026-08-19)

Pedido explícito, em 3 partes: "o previsto pode ter resumos também";
"seria interessante que as tabelas fossem como live tiles... remover,
incluir, mudar a posição"; "teremos um gráfico que plotará as duas
curvas, do previsto e do medido". Escopo confirmado com o usuário:
tabelas + gráfico entram no sistema de tiles, **sem KPIs** (o bloco de
KPIs/pizza/gráfico antigo, `MOSTRAR_TOPO_MEDICOES`/
`MOSTRAR_PIZZA_MEDICOES`, continua fora, intocado).

- **`TileFrame`** (novo componente): bloco com cabeçalho (título +
  contagem), arrastável via **HTML5 drag-and-drop nativo** (sem lib
  externa — mesmo padrão "tudo à mão" do resto do arquivo) e um "✕" que
  só OCULTA (nunca apaga) — reaparece por um botão "+ Nome do bloco"
  que surge abaixo quando há algo oculto.
- **3 tiles**: Histórico de Faturamentos, Previsão de Próximos
  Faturamentos, e o novo **Previsto × Medido — Acumulado**. Ordem e
  visibilidade persistem em `localStorage`
  (`mse_medicoes_tile_ordem`/`mse_medicoes_tile_ocultos`) — chave
  GLOBAL (preferência de interface, não dado por obra).
- **Resumo na Previsão**: `<tfoot>` somando só Valor Previsto. As 2
  colunas "Acum." (Saldo Previsto/Realizado) ficam de fora da soma de
  propósito — são snapshot carregado da planilha (arrastam o último
  valor real pra frente, ver [[modelo-dados-supabase]]), somar geraria
  número sem sentido.
- **`GraficoPrevistoMedido`** (novo): 2 curvas acumuladas por período —
  **Previsto** (tracejado âmbar, soma `valor_previsto` de
  histórico+previsão — a trajetória contratual completa, passado e
  futuro já lançado) × **Medido** (linha cheia azul, só `valor_medido`
  do histórico — o progresso real até agora, nunca ultrapassa o
  presente). Mesmo padrão hand-rolled em SVG do `GraficoMedicoes`
  existente (ResizeObserver, hover com tooltip mostrando os 2 valores).

Testado com Playwright (obra 91/CP236): 0 erros de console; 3 tiles
corretos (Histórico 35 linhas, Previsão com "Total", gráfico com
legenda e tooltip Previsto/Medido); remover/restaurar bloco funciona;
drag-reorder troca a ordem visual (testado arrastando Previsão sobre
Histórico); reload da página preserva ordem/ocultos via `localStorage`.
Deploy: `firebase deploy --only hosting --project planejamento-mse`.

### Medições — arrasto de tiles mais fluido, estilo widget (2026-08-19)

Pedido explícito: "quero algo mais fluido, ao arrastar, como um
widget". A 1ª versão dos live tiles usava HTML5 drag-and-drop nativo —
só trocava a ordem no solto (`drop`), sem nenhum retorno visual durante
o arrasto ("seco" demais pro efeito pedido).

Reescrito com **Pointer Events + posicionamento absoluto**:
- Container `position:relative` com altura explícita (soma das alturas
  fixas por tipo de tile — `ALTURA_TILE = {historico:440, previsao:300,
  grafico:340}` — mais `GAP_TILE=14` — dá pra calcular o "slot" de cada
  bloco sem medir nada em tempo real).
- Bloco arrastado: `transform:translateY` segue o cursor 1:1, **sem**
  `transition` (senão fica com lag perceptível), ganha leve scale-up
  (1.015) e sombra elevada — efeito de "peça levantada".
- Outros blocos: `transition:transform 0.28s`, deslizam suavemente pro
  novo slot assim que a prévia de ordem (`arrasto.ordemPreview`) muda —
  recalculada a cada `pointermove` comparando o centro do bloco
  arrastado com o meio de cada slot vizinho, ainda com o botão
  pressionado (preview ao vivo, não só no soltar).
- `setPointerCapture` no cabeçalho de cada tile garante que
  `pointermove`/`pointerup` continuam chegando nele mesmo se o cursor
  sair da área durante o arrasto.
- Ordem definitiva (persistida em `localStorage`) só é gravada no
  `pointerup`.

Testado com Playwright (obra 91/CP236, arrasto contínuo via
`mouse.move` interpolado): confirmado que o tile "Previsão" já sobe
~454px **durante** o arrasto (antes do soltar) — reordenação ao vivo
funcionando de fato, não só no drop. Ordem final persiste
corretamente, 0 erros de console. Deploy:
`firebase deploy --only hosting --project planejamento-mse`.

### Medições — grid de widgets de verdade: mover, redimensionar, lado a lado (2026-08-19)

Pedido explícito: "preciso de algo realmente interativo, que seja capaz
de re-dimensionar, colocar lado a lado... apesar da animação ter ficado
mais interessante, ainda parece engessado". As duas versões anteriores
(HTML5 drag-and-drop, depois Pointer Events com `translateY`) eram
feitas à mão e **só reordenavam numa coluna** — nenhuma quantidade de
polimento na animação resolve isso, porque o que faltava era o modelo
de layout, não o efeito.

**Entrou `react-grid-layout` via CDN UMD** (86KB, só React/ReactDOM
externos; `react-draggable`/`react-resizable` vêm embutidos). Decisão
consciente de trazer dependência externa num arquivo que é todo "à
mão": reescrever colisão, compactação e resize em 2 eixos não se paga,
e o projeto já carrega React/Babel de CDN.

- 12 colunas × linhas de 40px, gap 14. Arrasta pelo cabeçalho
  (`draggableHandle=".tile-handle"` — assim a tabela continua rolando e
  ordenando por dentro do bloco), redimensiona pelo canto e pelas
  bordas direita/inferior (`resizeHandles={['se','e','s']}`, alças
  aparecem no hover). Sombra do slot de destino durante o arrasto.
- O "✕" leva `tile-nao-arrasta` (é o `draggableCancel`) — sem isso,
  clicar nele começaria um arrasto.
- Posição (X **e** Y), tamanho e visibilidade persistem em
  `localStorage` na chave **nova** `mse_medicoes_grid` (formato
  `{i,x,y,w,h}`; a chave antiga guardava só a ordem, reaproveitar
  carregaria lixo incompatível). A entrada de um bloco oculto continua
  guardada, então ele volta na mesma posição/tamanho. Botão
  **"Restaurar layout"** novo.
- **A folha de estilo da lib NÃO é carregada** — o arquivo tem só as
  regras equivalentes, no visual do painel (alças desenhadas com
  `border`, placeholder azul translúcido). As essenciais são
  `position:relative` no container e dar tamanho às alças (sem isso não
  há o que agarrar).
- **Layout padrão já vem lado a lado**: Histórico (w7) + gráfico (w5) na
  primeira fileira, Previsão (w12) embaixo. Motivo: num grid onde tudo
  nasce com w=12, "pôr lado a lado" exige primeiro encolher um bloco, e
  quem abre a tela não descobre isso sozinho (o teste com Playwright
  bateu exatamente nisso). Histórico em w7 (~890px) sobra pras suas 6
  colunas; o gráfico é responsivo e cabe bem em w5; a Previsão, tabela
  mais larga (~1450px), fica em w12 pra não virar tira que só rola.
- **Fallback**: se o CDN falhar, `GridLayoutMedicoes` fica `null` e a
  tela cai num empilhamento simples com as alturas antigas — nunca fica
  em branco por causa disso.

**Dois bugs pegos no teste:**
1. O grid é filho de um flex column e a altura inline calculada pela lib
   era **esmagada pelo `flex-shrink` padrão**; como os blocos são
   `position:absolute`, eles mantinham o offset real e vazavam pra fora
   do container, cobrindo a barra de apoio — o botão "Restaurar layout"
   ficava inclicável sempre que o grid passava da altura da tela.
   Corrigido com `style={{flexShrink:0}}` no grid.
2. `.medicoes-row` (a fileira da pizza + gráfico antigo, ambos
   desligados por flag) ficava **vazia com `flex:1`**, roubando altura.
   Agora só renderiza quando `MOSTRAR_PIZZA_MEDICOES` ou
   `MOSTRAR_TOPO_MEDICOES` está ligado.

De quebra: a decimação dos rótulos do eixo X do gráfico Previsto×Medido
passou a derivar o espaçamento mínimo da **largura estimada do rótulo**
(`LARGURA_ROTULO_X`), em vez de um `70` mágico — com o gráfico estreito
(w5) as datas colidiam. O último rótulo é ancorado à direita, então
ocupa espaço à esquerda do ponto final: daí a folga de 1.5× o rótulo.

Testado com Playwright (obra 91/CP236, 1600×1000): 0 erros de console;
grid real (não o fallback); padrão lado a lado confirmado por
`getBoundingClientRect` (sobrepõe na vertical, não na horizontal);
resize pela alça SE grava `w` menor no `localStorage`; arrasto mostra
`.react-grid-placeholder` ao vivo antes de soltar; layout persiste no
reload; tabela continua rolando e ordenando por coluna dentro do bloco;
"Restaurar layout" e "+ Nome" clicáveis sem `force`; rótulos do eixo X
sem sobreposição na largura padrão e também 250px mais estreito. Deploy:
`firebase deploy --only hosting --project planejamento-mse`.

### Medições — redimensionar por qualquer lado + botão "Organizar" (2026-08-19)

Pedido explícito: "só consigo ajustar o tamanho para baixo ou para o
lado direito". A entrada do grid tinha ficado com só 3 alças
(`['se','e','s']`), o padrão da lib.

- **8 alças** agora: `['nw','n','ne','w','e','sw','s','se']`. CSS
  próprio pras novas (a folha da lib continua não sendo carregada):
  cantos são um "L" de 2 bordas apontando pra fora, laterais são uma
  barrinha no meio do lado, cada uma com o cursor diagonal certo.
  Confirmado no bundle 1.5.0 que a lib tem a lógica de pivô que ajusta
  `x`/`y` quando a alça é do lado norte/oeste — sem isso, redimensionar
  por cima só cresceria pra baixo.
- **`compactType` foi de `"vertical"` pra `null`, e isso não é
  opcional**: redimensionar pelo topo/esquerda mexe no `x`/`y` do bloco,
  não só no `w`/`h`; com compactação vertical ligada a lib puxava o
  bloco de volta pra cima logo depois e o gesto não surtia efeito
  nenhum. Sem compactação, cada bloco fica exatamente onde foi posto.
- **`padding-right` do cabeçalho de 10 → 18px**: a alça do canto
  nordeste (12px + 3px de recuo) ficava por cima do "✕" e roubava o
  clique de ocultar. Verificado com `elementFromPoint`.
- **Botão "Organizar" novo** — é o preço de ter tirado a compactação
  automática: empurrar um vizinho pra baixo deixava faixa vazia que não
  fechava mais sozinha. Ele sobe cada bloco até encostar, **sem mudar
  largura, altura nem coluna** (só o `y`). Diferente de "Restaurar
  layout": organiza sem desfazer o arranjo escolhido. Implementado à mão
  (uma dúzia de linhas, 3 blocos) em vez de chamar
  `ReactGridLayout.utils.compact` — não amarra em export interno da lib.

**Decisão de projeto registrada:** ficou `preventCollision={false}`
(padrão) de propósito. Com `true`, o resize pararia de empurrar vizinho
(fecharia a faixa vazia na origem), mas o arrasto passaria a só aceitar
espaço livre — não daria pra trocar dois blocos de lugar. Preferi manter
o arrasto permissivo e resolver a faixa vazia com o "Organizar", pra não
tirar liberdade de novo (é exatamente o erro dos passos 89-90).

Testado com Playwright (obra 91/CP236, 1600×1000): as 4 direções novas
funcionam de fato — topo (`n`) sobe a borda superior e aumenta a altura;
esquerda (`w`) move a borda esquerda e aumenta a largura; cantos `nw` e
`sw` idem nos 2 eixos, todas gravando no `localStorage`. 8 alças nos 3
blocos (24 no total). "✕" clicável normalmente. "Organizar" fechou uma
faixa de 716px mexendo só no `y`, é idempotente, persiste no reload e
respeita coluna (blocos em colunas diferentes sobem os dois, sem
empilhar um sobre o outro). Nenhum par de blocos se sobrepõe nos 2 eixos
depois da sequência toda. 0 erros de console. Deploy:
`firebase deploy --only hosting --project planejamento-mse`.

### Medições — grid nasce travado, "Organizar" vira automático (2026-08-21)

Pedido explícito, 2 dias depois: "o organizar tem que ser automático, a
medida que o ajuste nos balões é feito. Além disso, vamos deixar o modo
de ajuste travado, para evitar movimentações não intencionais."

- **"Organizar" deixa de ser botão manual** — passa a rodar via
  `onDragStop`/`onResizeStop` do grid, disparando sozinho ao SOLTAR um
  arrasto/resize. Deliberadamente NÃO usei `onLayoutChange` pra isso: a
  react-grid-layout dispara esse evento a cada frame durante o gesto
  (não só no fim), então reorganizar ali brigaria com o drag em
  andamento — o mesmo tipo de conflito que `compactType={null}` (seção
  acima) já existe pra evitar. `onDragStop`/`onResizeStop` disparam 1x,
  no soltar, então o reflow acontece depois do gesto terminar, sem
  interferir nele. Botão "Organizar" removido (redundante).
- **Novo estado `modoAjuste`** (sempre nasce `false`, propositalmente
  NÃO persiste no `localStorage` — diferente de `layoutTiles`/
  `tileOcultos`). Persistir "destravado" reabriria a mesma brecha de
  arrasto acidental que o pedido queria fechar; o grid deve começar
  travado toda vez que a tela é aberta, não só na 1ª vez.
  `isDraggable`/`isResizable` do `<GridLayoutMedicoes>` só ligam com
  esse estado.
- **1 botão só** na barra de apoio alterna "Ajustar layout" ⇄ "Travar
  layout" (fundo/borda azul quando destravado, pra ficar óbvio que o
  grid está em modo de edição). A dica de uso ("Arraste pelo
  cabeçalho...") só aparece destravado — não faz sentido mostrar
  instrução de gesto que não funciona no momento. `TileFrame` reflete o
  estado no próprio bloco: alça (⠿⠿) apagada (opacity 0.35) e cursor
  volta ao normal quando travado, em vez de manter a affordance de
  "arrastável" num bloco que não arrasta.

Testado via Playwright (obra 91): grid travado por padrão (drag no
cabeçalho não move o bloco, posição idêntica antes/depois via
`getBoundingClientRect`); "Ajustar layout" destrava (drag move o bloco,
resize pela alça SE funciona); "Travar layout" trava de novo (drag
volta a não mover); botão "Organizar" confirmado ausente; dica some/
aparece conforme o estado. 0 erros de console. Deploy: `firebase
deploy --only hosting --project planejamento-mse`.

### Medições — as 2 tabelas viram 1 só, consolidada (2026-08-19)

Pedido explícito: "ajuste tudo em uma única tabela, compile todas as
informações de uma só vez". Fecha o ciclo que começou com a reescrita da
tela: Histórico (boletim faturado) e Previsão (boletim pendente) eram
duas tabelas com filtro de linha oposto e recortes de coluna diferentes.

- **`COLUNAS_MEDICOES`** substitui `COLUNAS_HISTORICO` +
  `COLUNAS_PREVISAO`: 12 colunas, união das duas, na ordem do ciclo de
  vida do boletim (identificação → medição → faturamento →
  recebimento → saldo acumulado): BM | Período | Valor Previsto | Valor
  Medido | Desconto FD | Valor Faturado | Data de Faturamento | Status
  Fat. | Data do Recebimento | Status Rec. | Saldo Previsto Acum. |
  Saldo Realizado Acum.
- **Uma linha por boletim, faturado OU pendente.** Quem separa os dois
  casos agora é o badge da coluna "Status Fat.", não a tabela.
- Rodapé "Total" soma sobre TODOS os boletins, nas 4 colunas de valor
  por boletim. As 2 "Acum." continuam fora da soma (snapshot carregado
  da planilha, ver [[modelo-dados-supabase]] — somar daria número sem
  sentido).
- Ordenação em qualquer das 12 colunas, padrão BM decrescente. Como a
  direção inicial de toda coluna é decrescente, o mapa
  `DIRECAO_INICIAL_HIST` escrito à mão saiu: coluna nova já nasce com o
  comportamento certo, sem precisar cadastrar.
- **Grid: 3 blocos viraram 2** (`tabela` + `grafico`), ambos `w12`
  empilhados. Lado a lado continua possível, mas não como padrão — com
  12 colunas a tabela viraria uma tira que só rola.
- **Migração automática de layout**: os ids mudaram
  (`historico`/`previsao` → `tabela`), então um layout salvo da versão
  anterior não passa na validação de `layoutTiles` e cai no padrão novo
  sozinho. Não precisou de chave nova no `localStorage` — e a lista de
  ocultos também filtra id desconhecido, então um `["previsao"]` velho
  não esconde nada.
- **Saiu** a maquinaria que espelhava as larguras de BM/Período/Valor
  Previsto entre as duas tabelas (`ResizeObserver` + refs + estado
  `largurasHist`): não há mais duas tabelas pra alinhar.
- Respiro horizontal das células é **10px** só nesta tabela (o resto do
  painel usa 14): com 14 a largura natural ia a ~1900px e as 2 últimas
  colunas caíam fora da tela num monitor de 1920. Com 10, cabe inteira
  em 1920 sem rolagem; abaixo disso rola na horizontal, que é o
  esperado num extrato de 12 colunas (apertar mais já foi rejeitado —
  "colunas espremidas").

Testado com Playwright (obra 91/CP236): 36 linhas = o total (antes 35 +
1 em tabelas separadas), com o boletim pendente (BM 34, "Dentro do
prazo") na mesma tabela dos faturados; 12 cabeçalhos na ordem certa;
ordenação por "Saldo Realizado Acum." (coluna que só existia na
Previsão) funciona; rodapé com os 4 totais e as "Acum." em branco;
layout salvo no formato antigo não quebra nada; arrastar e redimensionar
(8 alças) seguem funcionando; em 1920×1080 a tabela cabe inteira sem
rolagem horizontal e nenhuma célula fica truncada; 0 erros de console.
Deploy: `firebase deploy --only hosting --project planejamento-mse`.

### Medições — farol Medido × Previsto, corte e colunas no gráfico (2026-08-19)

Pedido explícito: "incluir um farol ao lado do valor medido, que ficará
verde quando o medido for maior que o previsto, amarelo quando for pouca
coisa menor, vermelho quando bem abaixo. No gráfico, a curva do real
deve ir somente ao corte com dados, é importante incluir as colunas
também".

**Farol (`FarolMedidoPrevisto`, novo)** — ponto colorido à direita do
número, na coluna Valor Medido, uma por linha.

- "Pouca coisa menor" e "bem abaixo" saem do limiar que o painel **já**
  usa pra severidade de desvio (`corDesvio`: `>= 0` verde, até `-5` p.p.
  amarelo, abaixo vermelho) — mesmo critério de Desvios e do farol
  Medido×Físico, em vez de inventar um número só pra cá.
- Tooltip mostra os 2 valores e o percentual.
- Sem previsto (nulo ou zero) não há com o que comparar: renderiza um
  **slot vazio de largura fixa**, nunca um farol chutado (ADR-005). O
  slot existe pra não desalinhar a coluna de números — o rodapé também
  tem o slot, pelo mesmo motivo (sem ele, o total encostava 16px mais à
  direita e caía embaixo dos pontos em vez dos números).
- **SEM farol agregado no rodapé, de propósito.** Tentei e reverti:
  Previsto e Medido estão preenchidos em conjuntos DIFERENTES de
  boletins na planilha (previsto só nos BMs antigos, medido em quase
  todos), então o total cheio dava −47% e, restringindo aos boletins com
  os 2 valores, −67%. Os dois números falam mais do estado de
  preenchimento da planilha que da obra. Revisar quando o previsto
  estiver completo — o usuário avisou em 2026-08-19 que a planilha ainda
  está sendo preenchida, "inclusive o valor previsto".

**Gráfico**

- **Curva do Medido para no CORTE** (último período com `valor_medido`
  lançado). Depois dele `medidoAcum`/`medidoDia` vêm `null` e nada é
  desenhado — antes esticava uma reta horizontal que parecia "medição
  parada" quando o certo é "ainda não medido". Mesma ideia do realizado
  da Curva S. O último ponto ganha um anel pra deixar claro que a série
  acaba ali, não que sumiu.
- **Colunas por período**, 2 por ponto (previsto âmbar, medido azul),
  no MESMO eixo Y das curvas acumuladas — convenção que o
  `GraficoMedicoes` já fixou (barra com escala própria foi tentada e
  revertida lá). Coluna do medido também para no corte.
- Tooltip mostra acumulado **e** valor do período das 2 séries, e "sem
  medição lançada" depois do corte. Legenda ganhou o par linha+coluna
  por cor mais a nota "linha = acumulado · coluna = do período".
- **O que conta como medido** passou a ser `valor_medido != null` em
  QUALQUER boletim, não só nos já faturados: boletim medido e ainda não
  faturado é dado real e tem que entrar no corte.

Testado com Playwright (obra 91/CP236, 1920×1080): 29 faróis + 7 slots
vazios nas 36 linhas, com **0 divergência de cor** contra a regra
recalculada de forma independente pelo teste; coluna de números alinhada
inclusive no rodapé (0px de diferença); no gráfico 36 pontos âmbar × 35
azuis, com o azul terminando à esquerda do âmbar tanto nos pontos quanto
no `path`; 35 colunas azuis e 29 âmbar, sem `NaN` nem altura negativa;
tooltip mostra "sem medição lançada" depois do corte. 0 erros de
console. Deploy:
`firebase deploy --only hosting --project planejamento-mse`.

### Medições — coluna Farol, cinza sem previsto, destaque por estado da linha (2026-08-19)

Pedido explícito: "quando não tiver previsto, deixe em cinza. Gere uma
coluna chamada 'Farol', para contemplar isso. O último BM faturado vai
ter mais destaque, talvez com um fundo em um tom de verde claro, o
histórico de faturamentos terá de ficar mais apagado, os futuros ficarão
como está".

- **Coluna "Farol" própria**, entre Valor Medido e Desconto FD — a
  tabela vai a **13 colunas**. O ponto saiu de dentro da célula de Valor
  Medido, que volta a ser texto puro alinhado à direita; o slot vazio que
  reservava espaço no rodapé saiu junto, não é mais necessário.
- **Cinza quando não há previsto** (`#dfe3ea`, tooltip "Sem valor
  previsto para comparar"), no lugar do slot invisível da 1ª versão: um
  vazio se confundia com "não carregou". Cinza é estado próprio — "não
  há o que comparar" — não uma cor de severidade chutada (ADR-005).
- **A coluna é ordenável**: `campo:'farol'` é sintético (não existe em
  `boletins_medicao`) e a ordenação é tratada à parte, pelo desvio
  medido×previsto — dá pra trazer o pior desempenho primeiro. Linha sem
  previsto (farol cinza) não tem desvio e vai pro fim.
- **3 estados de linha, via classe CSS**:
  - último BM faturado → fundo `rgba(31,157,87,0.13)` (0.2 no hover);
  - faturados anteriores → `opacity: .5`, voltando a `1` no hover
    (apagado é hierarquia visual, não pra impedir a leitura);
  - não faturados → sem classe, como estavam.
  As regras vêm **depois** das de zebra/hover de propósito: a
  especificidade empata (`tr.classe` vs `tr:nth-child(even)`) e quem
  decide é a ordem no arquivo.
- **Qual é o "último BM faturado"**: maior `periodo_fim` entre as linhas
  com `status_faturamento = 'Faturado'`, desempate pelo número do BM.
  Não uso `data_faturamento` (falta em parte das linhas) nem só o número
  do BM (há rótulo sem número — "BM 01 - Limpeza", "MSE x ROCKTEC").
  Detalhe que o teste confirmou: em CP236 o destaque cai no **BM 33**, e
  não no BM 34, que tem período posterior mas está "Dentro do prazo" —
  ou seja, ainda não faturado. Correto.
- `minWidth` da tabela de 1180 → 1230 por causa da coluna nova.

Testado com Playwright (obra 91/CP236, 1920×1080): 13 cabeçalhos na
ordem certa; 36 de 36 linhas com exatamente 1 ponto na coluna Farol (10
verdes, 19 vermelhos, 7 cinzas — nenhum âmbar porque nenhuma linha caiu
na faixa −5..0), com **0 divergência** contra a regra recalculada de
forma independente pelo teste; Valor Medido sem tooltip e alinhado com o
rodapé (611.2px nos dois); 1 linha destacada, 34 apagadas em `opacity
.5` que volta a `1` no hover, 1 sem classe; rodapé com a célula de Farol
vazia e os 4 totais intactos; ordenação pela coluna Farol funciona nos 2
sentidos com as cinzas no fim; a tabela ainda cabe em 1920 sem rolagem
horizontal (1854 = 1854). 0 erros de console. Deploy:
`firebase deploy --only hosting --project planejamento-mse`.

### Medições — cores da curva seguem a referência da Curva S (2026-08-19)

Pedido explícito: "com relação as cores da curva, utilize a mesma
referência da Curva S". O gráfico Previsto × Medido tinha nascido com
previsto âmbar e medido azul fixo — ou seja, **azul queria dizer coisas
diferentes nas duas telas** (na Curva S azul é o PREVISTO). Erro meu de
não ter olhado a convenção que já existia antes de escolher cor.

Convenção da Curva S, agora aplicada aqui:

- **Previsto**: azul `#2563eb`, tracejado `8 4`, 2px, `opacity` 0.7.
  Colunas do período em azul, `opacity` 0.35 (0.55 no hover).
- **Medido** (equivalente do Realizado): cor **dinâmica pelo desvio no
  corte**, linha cheia de 3px — mesma regra do `desvioColor` da Curva S,
  que por sua vez é o mesmo limiar do `corDesvio` usado no farol da
  tabela (verde `>= 0`, âmbar até `-5` p.p., vermelho abaixo, cinza
  quando não há desvio a calcular). Colunas na mesma cor, `opacity` 0.6
  (0.8 no hover). Em CP236 o desvio no corte é −47%, então sai vermelho.
- Pontos e o anel do corte acompanham a cor da respectiva série; a
  legenda espelha a da Curva S, inclusive o texto do "Medido" colorido e
  em negrito.

**Divergência interna da tela de Curva S, registrada e NÃO mexida** (fora
do pedido): a legenda dela usa `6 3`/2.5px, mas o `LineSVG` desenha
`8 4`/3px. Copiei o **gráfico**, que é a referência visual de fato — se
um dia alguém alinhar a legenda da Curva S ao gráfico dela, esta tela já
está no valor certo.

Testado com Playwright nas 2 telas (obra 91): **match exato nos 8
atributos** comparados (cor, largura, `dasharray` e `opacity` das 2
séries) — Previsto `rgb(37,99,235)`/2/`8 4`/0.7 e Realizado-Medido
`rgb(210,59,59)`/3/sem dash/1 nas duas. Sem regressão em Medições: 29
colunas azuis @0.35 + 35 vermelhas @0.6, anel do corte vermelho, 13
cabeçalhos, 36 linhas, 1 destacada + 34 apagadas, "Medido" da legenda
vermelho e em negrito. 0 erros de console. Deploy:
`firebase deploy --only hosting --project planejamento-mse`.

### Medições — Avanço Previsto/Realizado Acumulado na tabela (2026-08-19)

Pedido explícito: "incluir também o avanço previsto acumulado e o avanço
realizado acumulado". Entraram no fim da tabela, junto das outras 2
colunas de acumulado — **15 colunas** agora.

**Descoberta que mudou a implementação — o nome engana.** Apesar de
"avanço", `avanco_previsto_acumulado` e `avanco_realizado_acumulado`
**não são percentuais**: guardam valor em REAIS. Conferi no dado antes
de decidir o formato (CP236, CP002 e CP022, via fetch direto no
PostgREST, já que o MCP do Supabase estava fora):

- no 1º BM, `avanco_realizado_acumulado` == `valor_medido` da linha;
- o máximo de `avanco_previsto_acumulado` == total da coluna Valor
  Previsto (R$ 336.302.373,48);
- o máximo de `avanco_realizado_acumulado` == total de Valor Medido
  (R$ 177.460.890,18);
- `saldo_previsto_acumulado` = contrato − `avanco_previsto_acumulado`.

Ou seja: são o acumulado do previsto e do medido, em moeda — os mesmos
números que o gráfico Previsto×Medido calcula por conta própria a partir
dos valores por BM. Formatadas com `fmtReais`, alinhadas à direita.
Vieram do PostgREST como `number` (não string), com o ruído de float
esperado (`336302373.4799999`).

Não entram na soma do rodapé (ficam em branco): já **são** acumulado — o
último valor É o total — e ainda carregam o valor pra frente em linha sem
atividade real (a armadilha catalogada em [[modelo-dados-supabase]]).
Mesmo motivo das 2 colunas de Saldo Acum. `colSpan` final do rodapé foi
de 6 → 8.

Nota de dado achada de passagem: em **CP022** o acumulado NÃO é
monotônico porque o mesmo `cp_codigo` mistura frentes distintas no
`bm_label` ("2 - Oleoduto", "1 - Mesa") e o acumulado reinicia por
frente. Só afeta quem for validar monotonicidade — a exibição não se
importa.

`minWidth` da tabela de 1230 → 1450. Com 15 colunas ela passa dos
~2100px e **rola na horizontal mesmo em 1920** (2165 contra 1854 de
container) — inevitável nesse tamanho; apertar mais as colunas já foi
rejeitado antes, e o bloco é redimensionável.

Testado com Playwright (obra 91/CP236, 1920×1080): 15 cabeçalhos na
ordem certa, 36 linhas **todas** com 15 células, as 2 colunas novas em
formato de moeda e alinhadas à direita, máximos batendo exatamente com
os totais do rodapé (a prova de que é moeda acumulada), rodapé com as 2
novas em branco e slots somando 15, ordenação funcionando nos 2 sentidos
nas colunas novas, rolagem horizontal revelando a última coluna por
completo. Sem regressão: 1 linha destacada + 34 apagadas, 36 faróis (10
verdes / 19 vermelhos / 7 cinzas), curvas do gráfico intactas. 0 erros
de console. Deploy:
`firebase deploy --only hosting --project planejamento-mse`.

### Medições — Saldo/Avanço Acumulado saem da tabela e viram pop-up por linha (2026-08-19)

Pedido explícito: "vamos colocar as 4 últimas colunas dentro de um
pop-up, acessado ao clicar no item". Ajuste feito diretamente no editor
(fora desta sessão de chat) e já com deploy confirmado.

- Tabela volta de 15 pra **11 colunas**: Saldo Previsto Acum., Saldo
  Realizado Acum., Avanço Previsto Acum. e Avanço Realizado Acum. saem
  de `COLUNAS_MEDICOES` e das células do corpo.
- Linha da tabela agora é clicável (`hoverable`, `cursor:pointer`) e abre
  um pop-up (`linhaSelecionada`) com essas 4 colunas do boletim clicado,
  mais a diferença Previsto−Realizado (Saldo) e Realizado−Previsto
  (Avanço), coloridas por sinal.
- **Rodapé de totais da tabela removido por completo** (não só as 4
  colunas novas — Total/Valor Previsto/Valor Medido/Desconto FD/Valor
  Faturado também saíram). Confirmado como intencional.
- **Farol Medido × Físico ganhou um cartão horizontal fixo no topo da
  tela**, fora do gate `MOSTRAR_TOPO_MEDICOES` — sempre visível agora,
  não mais atrás da flag. Mesmo clique de sempre abre o pop-up de
  detalhe (`farolAberto`).
- Pop-up do Farol ganhou uma seção "Totais Financeiros da Obra" (Previsto
  = valor do contrato; Medido = Desconto FD + Retenção + Valor Faturado,
  com o detalhamento dos 3 componentes).

Não testado nem revisado por mim antes do deploy — o ajuste e a
publicação já estavam prontos quando entrei, só fiz o commit/push do que
já estava no arquivo.

### Medições — tooltip do gráfico cortado perto da borda (2026-08-19)

Pedido explícito: "ao passar o mouse em um ponto do gráfico perto da
borda, o detalhamento fica cortado". O clamping da posição do tooltip
(`GraficoPrevistoMedido`) usava uma margem fixa "chutada" (metade de uma
largura estimada, `70px`), que não batia com o tamanho real do
tooltip — o conteúdo varia bastante em comprimento (4 linhas de
acumulado/período contra "Medido: sem medição lançada" a partir do
corte).

Agora mede o tooltip de verdade via ref (`tipRef`/estado `tipTam`,
recalculado a cada troca de ponto por um `useEffect` que roda depois do
render) e usa o tamanho REAL pro clamping nos dois eixos:

- **horizontal**: continua centralizado no ponto, mas a borda do
  tooltip nunca passa da borda do gráfico — o cálculo usa a metade da
  largura medida, não uma constante;
- **vertical**: mesma lógica de acima/abaixo do ponto conforme a altura
  na tela (herdada), agora limitando pelo topo/fundo REAIS do bloco —
  relevante desde que o bloco virou redimensionável (91º passo): um
  bloco encolhido também cortava o tooltip por cima/baixo com a margem
  fixa antiga.

Testado com Playwright (obra 91/CP236, 1920×1080): ponto mais à esquerda
e mais à direita com o tooltip inteiro dentro do container (nenhuma
borda extrapolada); ponto do meio continua centralizado (diferença
<0.1px); bloco encolhido ~150px de altura via alça sul (`.react-
resizable-handle-s`) ainda mantém o tooltip dentro dos limites
verticais; conteúdo legível em todos os casos. 0 erros de console.
Deploy: `firebase deploy --only hosting --project planejamento-mse`.

## Setor 4 — Suprimentos sai do placeholder, Curva A dos itens macro (2026-08-21)

"a partir da table itens RMI iremos basear a tela de suprimentos, quase
que como um mapa de suprimentos automático... a ideia é fazer um
acompanhamento gerencial dos itens críticos, os críticos serão, por
hora, os itens Curva A, que correspondem, em sua soma, a 80% do valor do
projeto" — em cima de `itens_rmi` (fonte `rmi_api`, ver
[[07 - Modelo de Dados]] e `n8n/rmi-suprimentos.README.md`).

**"Item macro" = `raw.nivel === 1`, não o item-folha.** Cada obra tem
milhares de itens numa árvore de até 5 níveis (`codigo_seq` tipo
"1.1.1.16.1.2"); nível 1 (ex. "Tubulação", "Estrutura Metálica") é a
granularidade certa pra visão gerencial — validado no dado real (obra
91): o subtotal do nível 1 bate exato com a soma de tudo abaixo dele em
153 de 161 casos. **Nível 0 é NÃO confiável** — na RMI "GERAL" o
subtotal do nível 0 vem zerado apesar de ~95M de valor real embaixo (bug
da própria origem, não do painel); por isso o cálculo nunca usa nível 0.

**Curva A** = ordena os itens macro por `subtotal_custo_meta_orcamento`
decrescente, acumula, e marca como crítico todo item cujo acumulado
ANTES de somá-lo ainda não tinha cruzado 80% do total (convenção padrão
de curva ABC — o item que cruza o corte ainda entra).

**Itens de canteiro/apoio ficam de fora do cálculo inteiro** — correção
de escopo pedida em seguida: "vamos nos ater aos itens de obra, itens de
canteiro como consumíveis, alojamento e afins não precisam ser
considerados". Como são 2.975 descrições distintas nas 6 obras (sem
taxonomia fixa), a separação é por PALAVRA-CHAVE (`ehItemCanteiroRmi`),
não lista fechada de nomes:

- Exclui (canteiro): CANTEIRO DE OBRAS, ALOJAMENTO, FILIAL, CONSUMÍVEIS,
  UNIFORME, FRETE, COMBUSTÍVEL/DIESEL, MOBILIZAÇÃO, FERRAMENTA, SEGURO,
  ÔNIBUS, ASO, EPI(S), QUALIFICAÇÃO DE SOLDADORES, TREINAMENTO, e
  equipamento alugado (ESCAVADEIRA, MOTONIVELADORA, ROLO COMPACTADOR,
  CAMINHÃO BASCULANTE, PLATAFORMA DE LANÇA ARTICULADA, RETROESCAVADEIRA,
  GUINDASTE, MUNCK) — decidido via pergunta direta ao usuário.
- Fica como item de obra (NÃO exclui), por decisão explícita: Serviços
  Terceirizados, Equipamentos de Medição e Apoio.
- **Categoria nova/desconhecida (sem match de palavra-chave) entra como
  item de obra por padrão** — a lista é só de EXCLUSÃO, nunca inclusão
  fechada. Racional do usuário: melhor arriscar incluir um item de
  canteiro raro do que esconder um item de obra real por engano de
  classificação (mesmo espírito de `corStatusRestricao`/`corStatusOc`,
  nunca esconder categoria desconhecida).

**`prazo_status` descartado como critério** — investigado antes de
decidir: 100% dos itens de obra 91 vieram `sem_data` (API ainda não
popula essa dimensão pra nenhuma obra carregada). O placeholder antigo
falava em "prazo × impacto"; ficou só valor (Curva A) como critério de
"crítico" por hora. `desvio_saldo_orcamentario` (positivo/negativo/
zerado) já vem populado e aparece como badge complementar na tabela, sem
custo extra de ingestão.

**UI**: 4 balões de resumo (Itens Críticos "N de M", Valor coberto pela
Curva A, Valor total de obra considerado, Itens de canteiro excluídos +
seu valor) + tabela dos itens Curva A (Descrição, RMI de origem, Valor,
% individual, % acumulado, Saldo Orçamentário, badge de Desvio) com
rodapé somando o restante (Curva B/C) + gráfico de Curva ABC (`Grafico
CurvaA`, SVG hand-rolled no mesmo padrão do resto do arquivo: barras de
valor individual, linha de % acumulado, linha de referência nos 80%,
tooltip por hover).

Testado via Playwright (obra 91): 5 itens críticos de 143 macro-itens
somam 83.7% do valor de obra (R$ 84,4M de R$ 100,8M); nenhum item de
canteiro (Alojamento, Consumíveis, Construção do Canteiro) vazou na
tabela; 18 itens de canteiro excluídos (R$ 32,7M) contabilizados à
parte; 0 erros de console. Deploy: `firebase deploy --only hosting
--project planejamento-mse`.

### Gráfico sai por hora, foco na tabela (2026-08-21, mesmo dia)

"Vamos focar na tabela, por hora" → confirmado "Deixar só a tabela".
`GraficoCurvaA` removido (função inteira, não usada em nenhum outro
lugar) e a tabela passou a ocupar a largura inteira do card. Sem
gráfico nenhum na tela por ora — pode voltar depois se fizer sentido.

### "Item macro" deixa de ser nível fixo, passa a ser resolvido por RMI (2026-08-21, mesmo dia)

Usuário reportou, olhando o CNPEM Faseado: "Ainda tem algumas linhas
que não nos interessam... vamos exibir as linhas relacionadas aos
níveis, que são a estrutura básica da EAP". Investiguei os 2 casos reais
antes de mexer em código (ADR-005) — achado que muda a premissa da
seção acima:

- **Obra 91**: nível 0 é "balde" de origem de material (`MATERIAIS -
  UB`, `MATERIAIS - SP`, `CHANGE ORDER N` — quase todos com subtotal
  zerado). A disciplina real ("Estrutura Metálica", "Tubulação") só
  aparece no nível 1 — por isso nível 1 fixo funcionava aqui.
- **CNPEM Faseado**: é o INVERSO — nível 0 já É a disciplina real (HVAC
  R$11,7M, CIVIL R$4,7M, ELÉTRICA E SISTEMAS R$6M, COMBUSTÍVEL, EPI,
  CANTEIRO...). Nível 1 aqui é item de linha bem granular ("Combustível
  para Guindaste de 35 ton") — 814 linhas, nível 1 fixo quebrava aqui.
- **RMI 43/GERAL (obra 91)**: tem um ramo cujo nível 0 nem existe como
  linha na origem (órfão) — só os filhos de nível 1 carregam o valor
  real (~R$46M nesse ramo). Já era o motivo de nível 0 ter sido
  descartado como "não confiável" na 1ª versão desta tela.

**Não dá pra fixar 1 nível pro produto inteiro** — muda de RMI pra RMI,
dependendo de como cada RMI foi montada na origem. Perguntei ao usuário
como resolver isso (AskUserQuestion) em vez de supor: escolheu detecção
automática por padrão de nome, em vez de confirmação manual RMI a RMI.

`resolverItensMacroRmi` decide, por RAMO (`id_rmi` + `codigo_seq`), se
usa o nível 0 ou desce pro nível 1 do ramo:
1. **Padrão de nome** — nível 0 com nome batendo `/^(MATERIAIS\s*-|
   CHANGE ORDER\b|OC\s*-|CO\s+\d)/` (normalizado, maiúsculo sem acento)
   é tratado como "balde" administrativo → sempre desce.
2. **Subtotal zerado com filho de valor real** — nível 0 = 0 mas a soma
   dos filhos de nível 1 daquele ramo é > 0 → desce (pega o bug de
   rollup da origem, não só o nome).
3. **Ramo órfão** — existem itens de nível 1 com aquele código-pai mas
   nenhuma linha de nível 0 correspondente → desce (não tem outra opção).
4. Nenhuma das 3 condições → usa o nível 0 direto (já é a disciplina).

Só resolve 1 nível de profundidade (nível 0 → nível 1); se aparecer uma
3ª obra com "balde" aninhado mais fundo, revisitar.

**Custo**: fetch mudou de 1 pra 2 requisições por obra (nível 0 + nível
1) — a resolução por ramo precisa comparar os dois antes de decidir.

**Validado sem regressão**: simulei a lógica nova em Node contra o dado
real das 2 obras antes de tocar na UI. Obra 91 bateu EXATO com o
resultado já testado antes (5 itens, R$ 84.419.464,60 de R$
100.813.420,36 — mesmos valores, dígito a dígito). CNPEM Faseado: 4
itens críticos de 315 macro-itens (HVAC, Elétrica e Sistemas, Civil,
Custos com Efetivo MSE), 81,5% do valor considerado, nenhuma linha
granular tipo "Combustível para Guindaste" sobrando. Playwright
confirmou os mesmos números nas 2 obras depois, 0 erros de console.
Deploy: `firebase deploy --only hosting --project planejamento-mse`.

### Linha da Curva A expande e mostra 1 nível de detalhe (2026-08-21, mesmo dia)

"Preciso conseguir abrir mais um nível e ver o que está contemplado na
curva A". Cada linha da tabela virou clicável (mesmo padrão visual de
`LinhaLocalDesvio` em Desvios — chevron `▸`/`▾` mono antes do texto,
`React.Fragment` com uma 2ª `<tr>` condicional pro detalhe).

Como o "item macro" pode ter vindo do nível 0 OU do nível 1 (depende do
ramo, ver seção acima), o detalhe também é resolvido caso a caso:
- Item de nível 0 → filhos são nível 1, **já estão em memória**
  (`itensPorNivel.n1`, a obra inteira já foi buscada) — filtra local,
  sem requisição nova.
- Item de nível 1 → filhos são nível 2, nunca buscados antes — 1 fetch
  sob demanda só daquele `id_rmi`+nível, disparado ao expandir (não
  pré-carrega a árvore inteira da obra de antemão, que seria caro pra
  RMIs com milhares de folhas).
- Resultado cacheado por item (`filhosPorItem`) — fechar e reabrir não
  refaz o fetch.

`LinhasDetalheRmi` é só apresentação (Descrição, Valor, % do item pai,
Saldo Orçamentário) — não reaplica filtro de canteiro nem lógica de
Curva A no nível-folha, é puro "o que compõe isso por baixo".

Testado via Playwright (obra 91 e CNPEM Faseado): expandir/colapsar
funciona nos 2 casos (memória e fetch sob demanda), cache confirmado
(reabrir não refaz requisição, mesmos dados), valores sempre ≤ item
pai, 0 erros de console. Deploy: `firebase deploy --only hosting
--project planejamento-mse`.

**Correção no mesmo dia**: "Preciso que o valor esteja alinhado na
coluna da macro, o saldo orçamentário também, a % não é necessária" —
a 1ª versão usava uma mini-tabela própria dentro de 1 `<td colSpan=7>`,
que não alinhava com as colunas do pai. `LinhasDetalheRmi` passou a
renderizar `<tr>` direto nas mesmas 7 colunas da tabela pai (Valor e
Saldo Orçamentário caem exatamente sob os cabeçalhos correspondentes;
RMI/%/Desvio ficam vazios no detalhe); coluna de % removida. Validado
via `getBoundingClientRect` (0px de diferença entre cabeçalho e linhas
de detalhe). **Lição**: ao empilhar uma tabela de detalhe dentro de
outra, alinhamento de coluna exige usar a MESMA grade de `<td>` da
tabela pai — uma tabela aninhada nunca alinha por conta própria, por
mais que as larguras pareçam parecidas.

### Crítico vira MATERIAL, não mais disciplina inteira (2026-08-21, mesmo dia)

"no CNPEM o item de custo com efetivo não precisa aparecer também.
Observe no nível de material, é isso que precisamos exibir, os
materiais críticos, orientados por área e disciplina." — correção de
escopo maior que as anteriores: o crítico deixa de ser a DISCIPLINA
inteira (Estrutura Metálica, HVAC — o que a tela mostrava desde a 1ª
versão) e passa a ser o MATERIAL (item-folha de verdade), com
disciplina/área como colunas de contexto.

**Material não é nível fixo** (nem sequer dentro do mesmo ramo — RMI
41/obra 91 tem material genuíno tanto em nível 3 quanto 4). Identificado
por 2 sinais, não posição na árvore:
1. `unidade` populada e diferente de `SERV` (mão de obra) e `VB`/`VERBA`
   (verba/lump-sum, geralmente RH — é assim que "Custos com Efetivo
   MSE" se resolveu sozinho: por baixo só tem treinamento, passagens e
   plano de saúde, todos `vb`, nenhum material de verdade).
2. Descrição não bate uma lista curta de itens que escapam do filtro de
   unidade mas não são material (TESTES E MEDIÇÕES, OMISSOS,
   Comissionamento — vêm com unidade "UN", igual material de verdade).

**Evita contar 2x**: um nó com valor real (ex. "Estrutura média",
2,46M) pode ter um filho-complemento zerado com a MESMA unidade (visto
na obra 91: "SPINE COMPLEMENT" kg, valor 0, filho de "Estrutura média").
Só desce pro filho se ele também tiver valor > 0; senão o próprio nó já
é o material.

**Área**: investigação (comparando as 2 obras de novo) achou que a
"área" (zona física) só existe como conceito claro quando fica ABAIXO
da disciplina na árvore — CNPEM: disciplina "HVAC" → área "Instalações
Nível 614" → (sistema/circuito, ignorado) → material. Na obra 91 é o
INVERSO: a "área" (UB/SP) é exatamente o nível que a resolução de
disciplina descarta como "balde" (`MATERIAIS - UB`/`MATERIAIS - SP`) —
fica ACIMA, não abaixo. Perguntei ao usuário como tratar essa
assimetria (AskUserQuestion) em vez de tentar unificar os 2 casos num
conceito só de "linha de área": escolhido dobrar o nome da disciplina
quando a área fica acima (`Estrutura Metálica — SP`), e área vira
coluna própria só quando fica abaixo.

**Bug pego na validação, corrigido antes de subir**: o sufixo só pode
ser aplicado quando a descida da disciplina foi por PADRÃO DE NOME
reconhecível (`MATERIAIS - X`) — no fallback de "subtotal zerado com
filho de valor real" (pensado pro bug de rollup da RMI 43/GERAL), o pai
às vezes é só uma referência de aditivo/escopo (RMI pequena tipo "SAE002
- Rede de coleta de condensados", vista no CNPEM), sem nenhuma
informação de disciplina/área. Dobrar o nome nesse caso produzia rótulo
sem sentido ("Central de vácuo Bonito... — SAE002 - Rede de coleta de
condensados"). Corrigido restringindo o dobramento só ao caso de padrão
de nome.

Fetch mudou de "nível 0 + nível 1" pra "obra inteira, 1 requisição só" —
resolver disciplina/área/material precisa caminhar a árvore até a
folha, que pode estar em qualquer profundidade (volume por obra já
confirmado pequeno o bastante, ~500 a ~8.000 linhas). A funcionalidade
de "expandir 1 nível" (do pedido anterior, mesmo dia) ficou obsoleta —
a linha já É o material agora, não há mais nível pra abrir — e foi
removida (`LinhasDetalheRmi` deletada).

**Padrão de processo que valeu a pena repetir**: antes de tocar na UI,
simulei a lógica inteira (bem mais complexa que a resolução de
disciplina do pedido anterior — combina 3 regras: material,
disciplina, área) em um script Node isolado contra o dado real das 2
obras. Foi assim que o bug do "SAE002" apareceu e foi corrigido ANTES
do teste de navegador — iterar em Node é bem mais rápido que
recarregar a tela a cada ajuste numa lógica com várias condições
combinadas.

Testado via Playwright depois da simulação bater: obra 91 = 86 de 746
materiais críticos (mesmos valores da simulação, dígito a dígito);
CNPEM Faseado = 158 de 1451, 0 disciplinas com "EFETIVO" remanescentes.
0 erros de console nas 2 obras. Deploy: `firebase deploy --only
hosting --project planejamento-mse`.

### Tabela vira árvore Área → Disciplina → Material (2026-08-21, mesmo dia)

"a ideia é essa, mas precisa estar organizado em nívels, Área ->
Disciplina -> Material, outro ponto é, a necessidade de compilar
materiais similares em uma coisa só" — 2 pedidos no mesmo comentário.

**Área vira campo próprio, não mais sufixo no nome.** A entrega anterior
tinha resolvido a assimetria (área acima da disciplina na obra 91 vs.
abaixo no CNPEM) dobrando o nome (`Estrutura Metálica — SP`) porque a
tabela era plana — não tinha onde mais colocar a área. Com hierarquia
de verdade pedida agora, isso deixou de fazer sentido: UB/SP e
"Instalações Nível 614" viraram NÓS de área reais, ambos exibidos da
mesma forma (Área → Disciplina → Material), não importa se na árvore
original do RMI a área fica acima ou abaixo da disciplina.

**Consolidação** (`consolidarMateriaisSemelhantes`): soma valor (+
saldo orçamentário) de materiais com a MESMA descrição normalizada
dentro do MESMO par área+disciplina — nunca entre grupos diferentes
(perderia a orientação que é o objetivo da tela) nem tenta casar
descrições parecidas-mas-diferentes (tubulação DN 14"/DN 12" continuam
linhas separadas, são especificações diferentes).

**2 bugs reais pegos na validação em Node, antes do teste de
navegador** (mesmo padrão de processo da entrega anterior, valeu ainda
mais aqui):
1. A área herdada de cima (obra 91) estava sendo sobrescrita pelo
   primeiro sub-agrupamento encontrado 1 nível abaixo da disciplina —
   resultado: "áreas" sem sentido tipo "Aço Carbono", "Vigas - Perfís
   laminados...". Só captura área de baixo quando NÃO existe área
   herdada de cima.
2. Quando o material é filho DIRETO da disciplina, sem camada de área
   nenhuma (ex. "Equipamentos"/obra 91 — cada linha já É um equipamento
   específico), a área virava igual ao nome do próprio material. Só
   promove o nome do nível-abaixo a "área" quando esse nível NÃO é ele
   mesmo o material.

Resultado real: obra 91 colapsa pra 3 áreas (UB, SP, "sem área" —
Equipamentos e Serviços Terceirizados, que não têm quebra por zona);
CNPEM Faseado pra 6 áreas (Central de Água Gelada, Instalações Nível
614/619/623, Caixa de Acesso, "sem área"). Tabela caiu de 8 pra 6
colunas — Área/Disciplina/Material vira 1 coluna hierárquica com
indentação (linha de área só com valor total, disciplina idem, material
com % Individual/Acumulado/Saldo/Desvio completos).

**Ponto cosmético aceito, não corrigido**: RMIs pequenas de aditivo
(SAE001-005 no CNPEM) não têm disciplina real — o nome da disciplina
acaba sendo igual ao do único material dentro dela, então a árvore
mostra o mesmo texto 2x seguidas (header de disciplina + linha de
material). Não é perda de dado (a linha de material continua com
%/saldo/desvio completos), só redundância visual num punhado de itens
de baixo valor. Não mexi nisso por ora.

Testado via Playwright: obra 91 e CNPEM Faseado renderizando a árvore
de 3 níveis corretamente (6 colunas, indentação, valores nas linhas
certas), 0 erros de console. Deploy: `firebase deploy --only hosting
--project planejamento-mse`.

### Consolida materiais por família — mesma peça, tamanhos diferentes (2026-08-21, mesmo dia)

"É nesse sentido, mas ainda podemos comprimir mais os itens, em coisas
similares" — a consolidação anterior só juntava descrição EXATA
idêntica; a mesma peça em tamanhos diferentes (ex. "Isolamento de
Flanges - 10\" - Espuma..." e mais ~20 variações de diâmetro/material,
todas na RMI de Tubulação/obra 91) continuava em linhas separadas.

`familiaMaterialRmi` corta a descrição no primeiro `" - "` (espaço-
traço-espaço) — é o separador real observado entre nome-base e
especificação nesse padrão de descrição. Deliberadamente simples: não
tenta reconhecer DN/Ø/Btu/h/mm² um por um. Hífen SEM espaço ao redor
(`380-220V`, `CS 600X250`, `W310X38.7`) nunca bate — fica intacto, o
comportamento seguro quando não dá pra separar nome-base de
especificação com confiança. Antes de implementar, mostrei o padrão
achado e perguntei (AskUserQuestion) se comprimir mantendo detalhe num
popup ou sem guardar detalhe — escolhido sem guardar detalhe.

Consolidação passou a agrupar por família (não mais descrição exata)
dentro do mesmo par área+disciplina — mas a descrição exibida só vira o
nome genérico quando REALMENTE há mais de 1 item consolidado ali; item
único mantém a descrição completa (evita perder especificação à toa
quando não havia nada pra comprimir). Indicador `(N itens)` cinza ao
lado do nome quando a linha é fruto de consolidação.

Testado: simulação em Node confirmou compressão real sem nenhuma junção
aparentemente errada; Playwright confirmou na tela — obra 91 com 8
famílias consolidadas ("Isolamento de Flanges" = 22 itens, "Cabo
0,6/1kV..." = 15 itens); CNPEM Faseado com 21 famílias ("Tubulação Aço
carbono" = 14 itens, "Fancoil Trox ICV" = 7 itens). 0 erros de console.
Deploy: `firebase deploy --only hosting --project planejamento-mse`.

### Restringe a tela ao CP029 até validar as outras obras (2026-08-24)

"Pela diversidade na forma como estão cadastradas as RMIs as mudanças
terão de ser específicas para cada obra, vamos considerar que as
feitas até o momento são válidas apenas para o cp029." — depois de
várias rodadas desenhando/testando a régua de disciplina, área,
material, canteiro e família comparando CP029 (CNPEM - Faseado,
id_obra 106) × obra 91 (Novo Nordisk UB/SP), o usuário decidiu que o
resultado só está validado pro CP029 mesmo — as 2 obras já mostraram
convenções de RMI genuinamente diferentes (nível 0 vs. 1 pra
disciplina, área acima vs. abaixo da disciplina), e as outras 4 obras
do painel não foram checadas RMI por RMI ainda.

`ModuloSuprimentos` ganhou `OBRA_SUPRIMENTOS_VALIDADA = 106`: pra
qualquer `obraId` diferente, nem dispara o fetch de `itens_rmi` (evita
chamada desnecessária) e mostra uma mensagem explicando que a obra
ainda precisa de checagem própria, em vez de aplicar a régua atual às
cegas — o risco de "crítico" errado silencioso numa tela gerencial é
mais caro que deixar a tela indisponível pra quem ainda não foi
validado.

Testado via Playwright: obra 106 (CP029) continua funcionando
normalmente (KPIs + árvore com dado real, 0 erros); obra 91 mostra a
mensagem de bloqueio e confirmado 0 requisições a `itens_rmi`
disparadas para ela (a restrição barra antes do fetch). Deploy:
`firebase deploy --only hosting --project planejamento-mse`.

**Pendência registrada**: validar RMI por RMI as outras 5 obras
(Novo Nordisk UB/SP/CP236 — apesar de já ter sido usada nos testes
comparativos, o usuário fechou a validade só em CP029 mesmo —, Hitachi/
CP022, Porto Itapoá/CP002, Novo Nordisk-AP/CP273 e Novo Nordisk-AP-
Reforço/CP261) antes de estender a tela pra elas — mesmo processo usado
até aqui (investigar estrutura real via PostgREST antes de assumir).

### Exclui itens sem área e simplifica descrições sempre (2026-08-24, mesmo dia)

"Seguindo na linha do cp029. Itens sem área não precisam ser
considerados. Precisamos agrupar e simplificar as descrições dos
materiais... exemplo: Chiller - Turbo Trans Air-Colled: TTA-450,
modelo AD160.4EF1AKUAA024XA.02D poderá ser simplesmente: Chiller."

- **Sem área = fora do cálculo inteiro**, não só escondido da árvore —
  mesmo tratamento que canteiro. Novo 5º KPI "Itens sem área
  identificada" (qtd + valor), mesmo padrão visual do de canteiro, pra
  não esconder o que foi excluído sem explicar. `agruparPorAreaDisciplina`
  perdeu o fallback `'(sem área)'` (virou código morto — nenhum material
  sem área chega mais até ali).
- **`familiaMaterialRmi` ganha um 2º separador**: além do primeiro
  `" - "` (da entrega anterior), agora também corta na primeira vírgula
  que NÃO esteja colada a dígito dos 2 lados — usa o que vier primeiro
  dos 2 candidatos. Pega o padrão real de descrições longas separadas
  por vírgula (ex. "Elevador Linha 3300 Atlas Schindler, com
  capacidade..." → "Elevador Linha 3300 Atlas Schindler"). **Ressalva
  importante**: vírgula também é separador DECIMAL em pt-BR dentro
  dessas descrições (ex. "Cabo 0,6/1kV") — sem o cuidado de ignorar
  vírgula colada em dígito, "Cabo 0,6/1kV" viraria "Cabo 0", quebrado.
- **Consolidação sempre mostra a família**, não só quando há duplicata
  pra juntar — a entrega anterior mantinha a descrição completa em item
  único "pra não perder especificação à toa"; o pedido de agora deixou
  claro que a simplificação vale mesmo sem duplicata (é sobre leitura,
  não só desduplicação).

Testado: simulação em Node contra dado real do CP029 confirmou "Chiller"
saindo limpo e nenhum corte aparentemente errado na lista inteira (88
materiais). Playwright confirmou na tela: KPI "Itens sem área
identificada" = 318 (R$ 5.289.265,38); nenhum grupo "(sem área)" na
árvore; material "Chiller" exibido exatamente assim, R$ 6.480.000; 0
erros de console. Deploy: `firebase deploy --only hosting --project
planejamento-mse`.

### Permite fechar Área e Disciplina, visão macro (2026-08-24, mesmo dia)

"Precisamos conseguir fechar os itens, visualização macro é relevante."
Linhas de Área e Disciplina na árvore ganharam chevron (▾ aberto/▸
fechado) clicável, mesmo padrão visual já usado em `LinhaLocalDesvio`
(Desvios). Fechar uma Área esconde disciplinas + materiais dela; fechar
uma Disciplina esconde só os materiais dela; em ambos os casos o valor
total da própria linha continua visível — dá pra ver o "macro" (só
áreas e disciplinas com valor) sem precisar rolar pelos materiais.
Nasce tudo aberto (comportamento anterior preservado; fechar é opt-in).

Testado via Playwright (CP029): 106 linhas visíveis com tudo aberto;
fechar a 1ª área derruba pra 93 linhas (valor da área mantido);
reabrir volta a 106 com o mesmo valor; fechar 1 disciplina (com a área
aberta) derruba pra 100 linhas sem afetar as outras disciplinas da
mesma área; reabrir volta a 106. 0 erros de console. Deploy: `firebase
deploy --only hosting --project planejamento-mse`.

## Próximos passos possíveis

- Repetir o exercício para os "Outras telas herdadas" (Ranking, Mapas/3D,
  Grade de obras) quando entrarem em escopo.
- Depois do ADR-006, decidir se este HTML solto vira a base real ou é
  descartado por um projeto com build.

## Ver também
- [[02 - Escopo e Telas]]
- [[03 - Padrão de URLs e Abas]]
- [[Design System]]
- [[06 - Decisões de Arquitetura]]
