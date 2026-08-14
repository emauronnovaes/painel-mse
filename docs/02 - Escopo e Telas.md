# Escopo e Telas

## Painel de Obra — a espinha dorsal do produto

Cada obra tem um painel com setores, navegados **lateralmente** (troca
horizontal, não menu vertical). Essa é a primeira definição concreta e firme
de escopo — o resto do produto se organiza em volta dela.

**Revisão de 2026-08-05 (mesmo dia, pedido explícito do usuário):** eram 6
setores, com Curva S e Histograma combinados num só (2 páginas, subpágina
navegada por scroll/pontos). Histograma **virou aba própria**, e entrou uma
aba nova, **Encarregados** — a config final ficou com **8 setores**:

| # | Setor | Conteúdo | Fonte de dados | Estado |
|---|---|---|---|---|
| 1 | **Curva S** | avanço físico acumulado | `curvas_s` | ✅ dado pronto |
| 2 | **Encarregados** | performance de encarregados por obra (aderência, qualidade, produtividade, colaboradores, PT) — importado de "Performance de Encarregados" do dashboard atual | `vw_dados_tv` + `cards_ativos` + `Apontamentos` + `v_indices_financeiros_diario` + `apontamento_efetivo` + `pts_emitidas` + `efetivo_diario_raw` (todas já existem) | ✅ dado pronto |
| 3 | **Histograma** | efetivo previsto×real | `vw_efetivo_*` | ✅ dado pronto |
| 4 | **Suprimentos** | itens de suprimentos em estado crítico | `suprimentos` (existe, mas falta definir "crítico") | 🔴 placeholder — "Em elaboração" |
| 5 | **OC/CO** | Ordens de Compra / Orçamentos Complementares por obra (resumo financeiro + lista individual) | `orcamentos_complementares_obra` (jsonb, via API PortalMSE + n8n) | ✅ dado pronto (2026-08-11) |
| 6 | **Desvios** | só tarefas com desvio negativo (avanço/desvio, valor absoluto), agrupado por Local × Disciplina, direto da EAP | `EAP` (folha via `edt`, sem ponderação por custo — em hold) | ✅ dado pronto |
| 7 | **Restrições** | lista de restrições por obra, priorizada por status aberto → criticidade → data | `restricoes_obra` (jsonb, sincronizada do PortalMSE) | ✅ dado pronto |
| 8 | **Medições** | curva acumulada de valor faturado por data de emissão, boletins de medição, balão de valor total + próximo faturamento (data/valor) | `nfs` + `proximos_faturamentos` (chave = código de contrato, ex. "CP029") | ✅ dado pronto |

**Decisão confirmada:** a implantação de dado real é incremental, aba por
aba, não trava o lançamento do painel. Setor 6 (Desvios) saiu do placeholder
em 2026-08-06, Setor 7 (Restrições) em 2026-08-07, Setor 8 (Medições) em
2026-08-10 e Setor 5 (OC/CO) em 2026-08-11 (ver
[[08 - Blueprint do Painel de Obra]]). Setor 4 (Suprimentos) continua em
**placeholder "Em elaboração"** — tem dado mas falta a regra de "crítico"
(decisão de 2026-08-04). Detalhe completo da aba Encarregados e do
reagrupamento em [[08 - Blueprint do Painel de Obra]].

### Termos do domínio (registrados para não perder)

- **OC/CO** = Ordem de Compra / Orçamento Complementar — **correção
  (2026-08-11, confirmado pelo usuário): são o MESMO conceito no domínio da
  MSE, não duas fontes de dado diferentes.** A suposição anterior (registro
  original desta nota) era de que existiam 2 pontas distintas — corrigida
  depois que a API `orcamentos_complementares_api` do PortalMSE se mostrou
  suficiente pra aba inteira.
### Setor Suprimentos — o que falta definir

Rótulo da aba simplificado para só **"Suprimentos"** (pedido do usuário,
2026-08-05) — o nome completo "Itens Críticos de Suprimentos" ficava comprido
na faixa de abas; o conteúdo continua sendo especificamente os itens em
estado crítico, só o texto do rótulo mudou.

Suprimentos hoje tem só 3 estados de prazo: atrasado / vence hoje / no prazo
(ver nota "Aba Suprimentos" no vault `Documents\MSE-Conhecimento`). "Crítico" é uma
classificação **nova** — não existe hoje. Perguntas a responder quando essa
aba entrar em desenvolvimento:
- Crítico é sobre **prazo** (ex.: atraso severo, não só negativo) ou sobre
  **impacto** (item que trava frente de trabalho, mesmo sem estar atrasado)?
- É calculado (regra) ou marcado manualmente por alguém?

**Ingestão de uma fonte nova em andamento (2026-08-11)**: tabela
`pedidos_suprimentos` + workflow n8n desenhados (dado bruto de pedido de
compra do ERP, via API `pedidos_usuarios_api` do PortalMSE — ver
[[07 - Modelo de Dados]] e `painel-mse\n8n\pedidos-suprimentos.README.md`).
**Não** é a mesma tabela `suprimentos` já usada no `dashboard-main` (essa é
curada manualmente). As perguntas acima sobre "crítico" continuam em
aberto — essa rodada foi só ingestão, o setor continua placeholder até
alguém decidir a regra e construir a tela.

## Padrão de URL do Painel de Obra

Consequência direta de [[03 - Padrão de URLs e Abas]] — id numérico, uma rota
por setor:

```
/obra/<id>/curva-s
/obra/<id>/desvios
/obra/<id>/suprimentos-criticos
/obra/<id>/oc-co
/obra/<id>/restricoes
/obra/<id>/medicoes
```

Setor sem dado real ainda no lançamento (4, 5) tem rota **de verdade**
desde já — só o conteúdo é o placeholder. Isso evita re-trabalho de rota
quando o dado chegar.

## Outras telas herdadas (fora do Painel de Obra)

Ainda a decidir — não fazem parte da espinha dorsal de 6 abas, são telas de
outro nível (comparativo entre obras, mapas):

| Tela                          | Decisão |
| ----------------------------- | ------- |
| Ranking de Obras              | ⬜       |
| Mapas 2D / Viewers 3D         | ⬜       |
| Grade de obras (tela inicial) | ⬜       |

## Modelo para nota de tela

Quando um setor entra em desenvolvimento de verdade (dado real, não
placeholder), criar nota `Tela - <nome>` com:

```markdown
# Tela — <nome>

## Para que serve
Que pergunta essa tela responde, para quem.

## URL
/obra/<id>/<setor>?<parâmetros>

## Dados
| Campo exibido | Fonte | Cálculo |

## Regras de cálculo
As fórmulas, literais. Incluindo os casos de borda.

## Estados
Carregando · vazio · erro · dado velho · **placeholder** (ainda sem fonte).

## Contextos de uso
Painel · embutido · TV · exportação — e o que muda em cada um.

## Decisões
O que foi decidido e descartado nesta tela, e por quê.
```

## Ver também
- [[03 - Padrão de URLs e Abas]]
- [[05 - Herança do Dashboard Atual]]
- [[07 - Modelo de Dados]]
- [[08 - Blueprint do Painel de Obra]]
