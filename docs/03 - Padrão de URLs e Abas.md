# Padrão de URLs e Abas

Organização de navegação foi pedida explicitamente como requisito. Esta nota
define o padrão; a lista real de telas fica em [[02 - Escopo e Telas]].

## Princípio: toda tela é endereçável

> Se não dá para mandar o link e a pessoa cair exatamente naquela tela, com
> aquele filtro, a tela não está pronta.

Isso não é preciosismo — é o que permite:
- mandar um link direto no WhatsApp em vez de "entra no painel e clica em...";
- embutir a tela em outra página do domínio (ver [[04 - Reuso de Telas]]);
- deixar a TV apontada para uma tela fixa;
- voltar/avançar no navegador funcionando de verdade.

## Formato proposto

```
/<contexto>/<identificador>/<tela>?<parâmetros>
```

Aplicado ao **Painel de Obra** (a estrutura confirmada — ver
[[02 - Escopo e Telas]]):

```
/obra/106/curva-s                     setor 1 — Curva S
/obra/106/encarregados                setor 2 — Performance de Encarregados
/obra/106/histograma                  setor 3 — efetivo previsto×real
/obra/106/suprimentos-criticos        setor 4 — itens críticos
/obra/106/oc-co                       setor 5 — Ordens de Compra / Change Orders
/obra/106/desvios                     setor 6 — desvio físico e financeiro
/obra/106/restricoes                  setor 7 — restrições (dos cards)
/obra/106/medicoes                    setor 8 — boletins e forecast
/ranking                              comparativo entre obras
```

Revisado em 2026-08-05 (pedido explícito do usuário): eram 6 setores com
Curva S e Histograma combinados numa aba só; Histograma ganhou aba própria e
Encarregados entrou como setor novo — a especulação de `/encarregados?ordem=pt`
registrada aqui antes ("herdada, a confirmar") **virou setor real**, mas sem o
`?ordem=pt` — a ordenação da tabela é estado local (clique no cabeçalho da
coluna), não persiste na URL. Persistir ordenação/filtro na URL continua
válido como ideia pra quando a base técnica for decidida (ADR-006).

Setor sem fonte de dado ainda (OC/CO, Restrições, Medições) recebe rota
**real** desde já, mostrando "Em elaboração" — só o conteúdo é provisório, não
a URL. Isso evita ter que mudar rota (e quebrar link já compartilhado) quando o
dado chegar.

### Regras do formato

1. **Identificador estável na URL.** Usar o `id_obra` (numérico, do Portal), não
   o nome. Nome muda, tem acento, tem variação de grafia — já é fonte de bug no
   dashboard atual.
2. **Estado que importa vira parâmetro.** Ordenação, filtro de período,
   granularidade, MOI/MOD — se a pessoa escolheu e quer compartilhar, tem que
   estar na URL.
3. **Estado efêmero não vai para a URL.** Pop-up aberto, hover, scroll.
4. **URL é contrato.** Uma vez publicada (link no Portal, TV configurada,
   favorito de alguém), mudar quebra o que está no ar. Mudança de rota exige
   redirecionamento.
5. **Parâmetro ausente = padrão sensato**, nunca tela vazia ou erro.

## Abas: navegação derivada, não hard-coded

No dashboard atual, quais seções existem e sua ordem estão espalhados em vários
pontos do código (a contagem de seções aparece repetida em três lugares e já
saiu de sincronia). No novo:

**As abas de um contexto são derivadas de uma única lista declarativa** — que
diz, para cada tela: rota, rótulo, e a condição para existir (ex.: "só aparece
se a obra tiver dado de efetivo").

Consequência prática: acrescentar uma tela nova é acrescentar **uma linha** nessa
lista, e a navegação, as URLs e o índice se ajustam sozinhos.

## Ainda a definir

- Os contextos além de `obra` (empresa? diretoria? cliente? disciplina?).
- Se haverá URL por período (ex.: `/obra/106/curva-s/2026-S31`) ou só parâmetro.
- Se o painel terá página inicial única ou uma por perfil de usuário.

Depende de [[01 - Visão do Produto]] e [[02 - Escopo e Telas]].

## Ver também
- [[04 - Reuso de Telas]]
- [[06 - Decisões de Arquitetura]]
