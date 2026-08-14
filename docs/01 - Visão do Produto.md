# Visão do Produto

> 🟡 **Parcialmente definido.** A espinha dorsal (Painel de Obra) já tem forma —
> ver abaixo. O que falta é o resto: outros perfis, outros contextos.

## O núcleo já definido: Painel de Obra

Cada obra ganha um painel com **6 setores**, trocados lateralmente — ver
[[02 - Escopo e Telas]] para a lista completa e o estado de cada um.

Isso já responde parte de "que problema resolve": o dashboard atual não tem
visão de desvio financeiro lado a lado com o físico, não acompanha OC/CO, não
acompanha restrições vindas dos cards, e não tem histórico de boletins de
medição com forecast. São 4 dos 6 setores que **não existem hoje** — a resposta
concreta da pergunta abaixo, para esta parte do produto.

## Que problema resolve (resto do produto)

O núcleo acima resolve a parte "obra". Falta ainda:

- O que o novo painel precisa fazer **fora** do contexto de uma obra específica
  (comparativo, consolidado, outro domínio)?
- O que hoje é possível no dashboard atual mas **incômodo** (dá trabalho, exige
  explicar, quebra)?

## Para quem

*A definir para o produto como um todo.* Já é possível ancorar no Painel de
Obra: hoje ele serve sobretudo quem acompanha uma obra específica (linha 1 e 2
da tabela abaixo). Os demais perfis dizem respeito ao "resto do produto"
(visão fora do contexto de uma obra) e seguem em aberto.

Perfis candidatos, com necessidades bem diferentes:

| Perfil | O que provavelmente quer | Onde consome |
|---|---|---|
| Time de obra | o dia, a frente de trabalho, o que atrasou | TV no canteiro |
| Encarregado / supervisor | a própria performance, seus cards | celular (fora desta rodada) |
| Diretor de obra | Painel de Obra da obra (consulta) +, no futuro, comparativo | celular e desktop |
| Diretoria | visão consolidada da empresa | painel / apresentação |
| Cliente externo | avanço da obra dele, sem dado interno | link compartilhado |

Definir isso decide: quantos contextos de navegação, se há autorização por
perfil, e se o layout precisa funcionar em celular.

## Decisões de produto em aberto

Estas três mudam a arquitetura de forma significativa:

1. **Telas montáveis ou conjuntos fixos?**
   Para o **Painel de Obra**, já resolvido: é um conjunto **fixo** de 6 setores,
   nesta ordem, trocados lateralmente (ver [[02 - Escopo e Telas]]) — não é
   montável pelo usuário. A pergunta original segue aberta só para os
   **outros** contextos ("telas reutilizáveis em outras configurações" fora da
   obra — comparativo, consolidado):
   - *(a)* conjuntos pré-definidos e nomeados (mais simples, atende a maioria);
   - *(b)* painéis montáveis, onde alguém escolhe quais telas quer ver juntas
     (mais poderoso, bem mais complexo — exige salvar configuração, permissão,
     tela de montagem).
   O que já vale para os dois casos: a tela em si não sabe onde está montada
   (ADR-003, [[06 - Decisões de Arquitetura]]) — o que muda é só quem decide a
   composição.

2. **Celular entra no escopo?** **Sim, para o Painel de Obra** (decisão
   2026-08-11): consulta por diretor/gestão no telefone. TV e desktop seguem
   prioritários (canteiro / monitor grande); no celular o layout adapta
   (breakpoint ~768px — abas com scroll horizontal, KPIs empilhados, tabelas
   com scroll-x). Perfis além do diretor (ex. encarregado no celular) e telas
   fora do Painel de Obra continuam em aberto. Ver [[Design System]] e
   [[08 - Blueprint do Painel de Obra]].

3. **Há dado restrito por perfil?** Se sim, a autorização precisa ser no
   servidor desde o início (ADR-007). Se todo mundo pode ver tudo, simplifica
   bastante.

## Sucesso: como saberemos que valeu

*A definir.* Vale escrever aqui, em uma frase, o que precisa ser verdade em
alguns meses para o projeto ter valido a pena. Serve de critério para dizer
"não" a pedidos que fogem do objetivo.

## Ver também
- [[02 - Escopo e Telas]]
- [[04 - Reuso de Telas]]
- [[06 - Decisões de Arquitetura]]
