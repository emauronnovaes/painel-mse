# Herança do Dashboard Atual

O dashboard atual (`dashboard-main` / `planejamento_dash`) funciona e está em
produção. O novo painel **não descarta** o que ele acertou — herda a regra de
negócio, que é o ativo mais caro de reconstruir, e evita conscientemente os
problemas conhecidos.

Documentação completa do atual: vault `Documents\MSE-Conhecimento`.

## ✅ O que aproveitar (ativo real, já validado em campo)

### Regras de negócio já mapeadas e conferidas com o time
- **Dia de referência** por encarregado (recua de ontem, fim de semana só conta
  com apontamento, pula feriado nacional). Regra sutil, já validada.
- **Aderência**: média das linhas do dia de referência; quem não apontou conta
  como 0% na média da obra.
- **Corte atual da Curva S**: último corte com data passada **e** realizado > 0
  (não é o corte mais próximo de hoje).
- **Semáforo de desvio**: verde ≥ 0, âmbar até −5 p.p., vermelho abaixo.
- **Score do ranking**: 75% aderência + 25% pontos de curva; −10 pontos por
  ponto percentual de atraso, saturado em 100.
- **Metas semanais** com fator de 15% acima do necessário.
- **Grupos com corte semanal diferente** (Novo Nordisk fecha sexta→quinta).
- **Cruzamento de nomes de pessoas** por normalização simples (sem fuzzy match).
- **Última liberação de PT**: última até 08:30, com fallback para a primeira do
  dia.

### Decisões visuais
O [[Design System]] herda o padrão "Capex Seguro" (tema claro, IBM Plex, navy só
no cabeçalho) — já aprovado e em uso nas TVs.

### Conhecimento de dados
Todo o [[07 - Modelo de Dados]] — tabelas, relações, e principalmente os
*gotchas* (nomes de obra divergentes entre tabelas, escalas 0–1 vs 0–100,
RLS obrigatório em tabela nova).

## ❌ O que NÃO repetir

Cada item aqui é um problema real que custou tempo de diagnóstico:

| Problema no atual | Como o novo evita |
|---|---|
| **Arquivo único de 6.600 linhas** — tudo junto, difícil achar e mudar | Um arquivo por componente/tela, camada de dados separada |
| **Regra de negócio dentro do JSX** — cálculo misturado com layout | Camada de cálculo isolada e testável |
| **Consulta truncada em 1000 linhas sem erro** — dado desaparecia silenciosamente | Camada de dados que **sempre** pagina e falha alto |
| **Dado velho passa por dado fresco** — tabela parada há 6 dias, nenhum aviso | Indicador de frescor por fonte; alerta quando passa do esperado |
| **Senha literal no cliente** (`1234`, `admin`) como "segurança" | Autorização no backend (RLS/servidor). Nada de trava cosmética |
| **Modo embutido improvisado** (`?locked=true` espalhando `!LOCKED_MODE` no meio do layout) | Reuso como princípio: ver [[04 - Reuso de Telas]] |
| **Match de obra por heurística de substring** (Suprimentos) | Chave/mapa explícito, sempre |
| **Convenções frágeis de texto** — nível inferido de `EAP.local` começar com número, cor do SVG definindo comportamento | Contratos explícitos; se depender de convenção, validar e avisar quando quebrar |
| **Três parsers de data** com regras diferentes convivendo | Um único utilitário de data, documentado |
| **Código morto** — loaders nunca instanciados, campos buscados e nunca usados, props mortas | Revisão: se não usa, não entra |
| **Sem build** — JSX transpilado no navegador a cada carga | Ver [[06 - Decisões de Arquitetura]] |

## ⚖️ O que reavaliar (funciona, mas merece decisão consciente)

- **Modo Cliente** (reescreve o previsto para maquiar atraso). Existe hoje e é
  usado; no produto novo, decidir se entra, e se entra, deixar explícito na tela
  que é visão comercial.
- **Duas cópias do código** (`dashboard-main` + `planejamento_dash`) sincronizadas
  por cópia manual. O novo deve ter **uma** fonte e dois destinos de deploy.
- **Curva do Portal** (financeira) — a fonte está parada desde 29/07; confirmar
  se o dado continua valendo antes de portar a tela.
- **Viewers 3D** — o modelo do Hitachi tem 178 MB. Reavaliar formato/otimização
  antes de herdar.

## Ver também
- [[06 - Decisões de Arquitetura]]
- [[07 - Modelo de Dados]]
- [[04 - Reuso de Telas]]
