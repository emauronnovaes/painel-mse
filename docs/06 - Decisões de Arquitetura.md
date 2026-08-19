# Decisões de Arquitetura (ADR)

Registro das decisões estruturais: o que foi decidido, **por quê**, e o que foi
descartado. Serve para ninguém (inclusive nós, em três meses) precisar adivinhar
o motivo de algo estar como está.

Formato: cada decisão tem estado — ✅ decidida · ⏳ pendente · ❌ descartada.

---

## ADR-001 — Documentação dentro do projeto ✅

**Decisão:** a documentação vive em `painel-mse\docs`, versionada junto com o
código. É essa pasta que se abre como vault no Obsidian.

**Por quê:** o vault do dashboard atual (`Documents\MSE-Conhecimento`) ficou
fora do repositório. Documentação separada do código descola dele: ninguém
atualiza a nota na mesma tarefa que muda o comportamento.

**Regra que vem com a decisão:** mudança de comportamento e atualização da nota
correspondente acontecem **na mesma tarefa**. Não é etapa posterior.

---

## ADR-002 — Uma fonte de código, vários destinos de deploy ✅

**Decisão:** o projeto tem **um** diretório de código. Diferenças entre
ambientes (Firebase estático × servidor com SSO) são resolvidas em configuração
ou em runtime, nunca por cópias divergentes.

**Por quê:** hoje há duas pastas (`dashboard-main` e `planejamento_dash`)
sincronizadas por cópia manual de arquivo, com verificação de hash a cada
mudança. Funciona por disciplina, mas é um passo manual que pode ser esquecido —
e a cópia servida é a que o time de obra realmente vê.

---

## ADR-003 — Tela não conhece o contexto ✅

**Decisão:** telas recebem dados e desenham conteúdo; navegação e "modo"
(painel, embutido, TV, exportação) são responsabilidade de quem envolve a tela.

**Por quê:** requisito de produto (telas reutilizáveis em configurações
diferentes) e correção do padrão atual, onde o modo embutido é um parâmetro
global consultado em dezenas de pontos do layout.

Detalhes em [[04 - Reuso de Telas]].

---

## ADR-004 — Identificador numérico nas URLs ✅

**Decisão:** URLs usam `id_obra` (numérico), não o nome da obra.

**Por quê:** nomes de obra variam entre as fontes (acento, hífen, abreviação,
espaço sobrando) e já são causa de bug recorrente no atual — houve caso de
consulta não casar por causa de espaço no fim, e um match por substring que
falha em obra nova.

---

## ADR-005 — Camada de dados que falha alto ✅

**Decisão:** todo acesso a dado passa por uma camada única que (a) pagina
sempre, (b) trata resposta truncada como erro, não como sucesso, e (c) expõe a
data da última atualização da fonte.

**Por quê:** os dois piores incidentes do dashboard atual foram **silenciosos**:
uma consulta truncada em 1000 linhas que fazia dado recente desaparecer sem
erro, e uma tabela parada há seis dias exibida com a mesma aparência de dado
fresco. Nos dois casos o sistema "funcionava" enquanto mostrava informação
errada — o pior tipo de falha para quem toma decisão olhando a tela.

---

## ADR-006 — Base técnica ⏳ PENDENTE

**Status:** decisão adiada de propósito, para ser tomada com o escopo na mão.

**Restrição levantada originalmente (não vale mais, ver correção
abaixo):** a máquina de desenvolvimento **não tem Node/npm** (verificado
em 2026-08-05). Tem Python 3.13 e Git portátil.

**Correção (2026-08-14)**: `node`/`npm`/`firebase` CLI já estão
instalados globalmente na máquina (`C:\node\`), confirmado ao consolidar
o repositório git (`Documents\Github\painel-mse`) como fonte única do
projeto (ver [[08 - Blueprint do Painel de Obra]]). **O custo de
"instalação única do Node" da opção Vite+React+TypeScript, abaixo, já
não existe** — a restrição que motivava adiar essa parte da decisão foi
removida. Vale reconferir com o usuário se isso muda o status de
"pendente" pra "decidida".

**Opções na mesa:**

| Opção | Ganho | Custo |
|---|---|---|
| **Vite + React + TypeScript** | padrão de mercado; TypeScript pega em tempo de escrita vários bugs que hoje só aparecem em produção; build otimizado (importa para TV); um arquivo por componente | ~~instalação única do Node~~ (Node já disponível, 2026-08-14); deploy ganha etapa de build |
| **Módulos ES nativos** (sem instalar nada) | resolve o pior problema atual (arquivo único gigante); deploy idêntico ao de hoje | sem TypeScript; sem JSX ou JSX transpilado no navegador; escala pior; muitos requests |

**Inclinação técnica:** a primeira. O pedido é explicitamente "produto novo e
mais escalável" e "muito organizado" — e boa parte da dívida do dashboard atual
(campos buscados e nunca usados, props mortas, campo que não existe no select
sendo renderizado) é exatamente o que tipagem estática pega de graça.

**A decidir junto:** se o deploy continua em Firebase + `app.py` (hoje o
deploy já roda direto do repositório git, ver [[08 - Blueprint do Painel
de Obra]] — a etapa de build do Vite se encaixaria no mesmo fluxo, antes
do `firebase deploy`).

---

## ADR-007 — Autorização no servidor ⏳ PENDENTE

**Direção:** nada de trava por senha no cliente.

**Por quê:** o dashboard atual tem duas senhas literais no HTML servido
(`1234` para a curva financeira, `admin` para o modo cliente). Qualquer pessoa
com "ver código-fonte" lê as duas, e o dado protegido é baixado para o navegador
de qualquer forma. Serve para esconder botão, não para proteger informação.

**A definir:** se há dado realmente restrito no novo painel e, se houver, como
autorizar (RLS por perfil no Supabase? filtro no servidor?). Depende de
[[01 - Visão do Produto]].

## Ver também
- [[05 - Herança do Dashboard Atual]]
- [[Início]]
