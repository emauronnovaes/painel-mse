# Reuso de Telas

Requisito central do produto: **as telas poderão ser usadas dentro do domínio em
outras configurações**. Esta nota define como isso funciona sem virar remendo.

## O problema que estamos evitando

No dashboard atual isso foi resolvido depois, com um parâmetro `?locked=true` e
dezenas de condições `!LOCKED_MODE` espalhadas pelo meio do layout — cada botão
de navegação precisa lembrar de se esconder. Funciona, mas:

- é fácil esquecer uma condição ao criar algo novo;
- não há como saber, olhando a tela, em que contextos ela funciona;
- o comportamento embutido é efeito colateral, não contrato.

## Princípio: a tela não sabe onde está

Uma tela recebe **o que mostrar** e nunca decide **onde está sendo mostrada**.
Quem decide isso é o contexto que a envolve.

Concretamente, uma tela:
- recebe os dados/parâmetros de que precisa;
- desenha só o seu conteúdo;
- **não** desenha navegação (setas, abas, botão de voltar), porque navegação é
  responsabilidade do contexto;
- **não** consulta "estou embutido?" para decidir o que renderizar.

Assim a mesma tela serve, sem alteração, para os modos abaixo.

## Modos de uso previstos

| Modo | Como é usado | Quem envolve a tela |
|---|---|---|
| **Painel completo** | navegação normal, usuário explorando | casca do painel (abas, cabeçalho) |
| **Embutido** | dentro de outra página do domínio (iframe/rota) | nada — só a tela |
| **TV** | tela fixa ou rotação automática, sem interação | casca de TV (rotação, sem controles) |
| **Exportação** | imagem/PDF para enviar | renderizador de saída |

O modo é decidido **na borda** (rota/parâmetro), não dentro da tela.

## Consequência para o desenho

1. **Cabeçalho e navegação ficam fora da tela.** A tela começa no conteúdo.
2. **Tela não busca dado sozinha por conveniência.** Ela declara o que precisa;
   quem monta a página providencia. Isso evita a mesma consulta sendo feita duas
   vezes em contextos diferentes.
3. **Toda tela precisa funcionar com pouco espaço.** Se só funciona em tela
   cheia, não é reutilizável de fato.
4. **Estados de vazio, carregando e erro são parte da tela** — em contexto
   embutido não há outra camada para cobrir isso.

## A decidir

- **Como o embutido é servido:** rota dedicada, parâmetro, ou build separado?
  (No atual é parâmetro; a decidir se mantém.)
- **Autorização no embutido:** quem embute já autenticou? O SSO atual injeta
  usuário no servidor — ver se o novo mantém esse mecanismo.
- **Se telas podem ser combinadas** livremente (ex.: montar um painel com 4
  telas escolhidas) ou se as combinações são fixas e nomeadas.

Essa última pergunta é importante: "usadas em outras configurações" pode
significar *painéis montáveis* (mais poderoso, mais complexo) ou *conjuntos
pré-definidos* (mais simples, atende a maioria dos casos). Ver
[[01 - Visão do Produto]].

## Ver também
- [[03 - Padrão de URLs e Abas]]
- [[05 - Herança do Dashboard Atual]]
