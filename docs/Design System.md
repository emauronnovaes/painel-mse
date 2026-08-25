# Design System

Herda o padrão **MSE "Capex Seguro"** já aprovado e em uso nas TVs do canteiro —
não vamos reabrir essa discussão sem motivo. Detalhamento completo na nota
"Design System MSE" do vault `Documents\MSE-Conhecimento`.

## O essencial

**Cores** — tema claro. Navy reservado ao cabeçalho; vermelho usado com
parcimônia (só estado realmente negativo).

| Uso | Cor |
|---|---|
| Fundo | `#e8eaee` |
| Cartão | `#fff` |
| Borda | `#e4e7ec` |
| Texto principal | `#192231` |
| Texto secundário | `#4d5868` |
| Texto apagado | `#98a1b0` |
| Previsto / informação | `#2563eb` |
| Positivo | `#1f9d57` |
| Atenção | `#d9911a` |
| Negativo | `#d23b3b` |

**Tipografia** — IBM Plex Sans (títulos, valores, corpo) e IBM Plex Mono
(rótulos em maiúsculas). Nunca Barlow.

**Semáforos consolidados** (mesma leitura em todo o produto):
- Desvio de curva: verde ≥ 0 · âmbar até −5 p.p. · vermelho abaixo
- Índice de produtividade: verde ≥ 1,00 · vermelho abaixo
- Liberação de PT: verde até 07:00 · âmbar até 07:15 · vermelho depois

## Convenções de escrita na interface

- **Sem abreviações.** "Apontamento", não "Apont."; "Código", não "Cód.".
  Motivo: as telas são lidas de longe, em TV de canteiro.
- Nomes de pessoas exibidos em maiúsculas (o cadastro de origem é inconsistente
  em caixa).
- Rótulos pequenos em maiúsculas, com espaçamento de letra.

## Comportamento responsivo (celular)

Decisão de produto (2026-08-11, [[01 - Visão do Produto]]): celular entra no
escopo do **Painel de Obra** para consulta de diretor/gestão. TV/desktop
continuam o alvo principal.

| Regra | Valor |
|---|---|
| Breakpoint | `max-width: 768px` |
| Navegação de setores | faixa de abas com **scroll horizontal** + setas (não drawer) |
| KPIs / balões | empilhados em **1 coluna** |
| Tabelas largas | wrapper com `overflow-x: auto` (sem redesign em cards nesta rodada) |
| Gráficos | altura mínima ~260–320px; página pode rolar verticalmente |
| Controles tipicamente desktop | wrap; itens como export PNG / arraste de rótulos podem ficar secundários ou ocultos |

Implementação no blueprint: classes utilitárias + `@media` em
`prototipo/index.html` (`.painel-gutter`, `.kpi-row`, `.tabs-scroll`, etc.).

## A decidir para o produto novo

- **Escala tipográfica e de espaçamento** definidas como sistema (hoje são
  valores soltos em cada componente).
- **Tokens como código** (variáveis compartilhadas) em vez de cores repetidas em
  cada lugar. No atual, a mesma cor aparece literal em dezenas de pontos.

## Ver também
- [[05 - Herança do Dashboard Atual]]
- [[06 - Decisões de Arquitetura]]
