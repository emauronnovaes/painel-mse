# Painel MSE — Documentação do Projeto

Vault de documentação do **novo painel** (produto novo, escalável, com telas
reutilizáveis em configurações diferentes dentro do domínio).

> **Esta pasta é o vault.** Abra `painel-mse\docs` no Obsidian
> ("Open folder as vault"). A documentação mora **dentro** do projeto de
> propósito — versionada junto com o código, para não se descolar dele.
> (Lição aprendida: o vault do dashboard antigo ficou fora do repositório.)

## Estado: levantamento

O projeto está na fase de **levantamento**. A base técnica ainda **não** foi
escolhida — é decisão consciente, para ser tomada com o desenho na mão. Ver
[[06 - Decisões de Arquitetura]].

## Ordem de leitura

| Nota | Para quê | Estado |
|---|---|---|
| [[01 - Visão do Produto]] | que problema resolve, para quem | 🟡 núcleo (Painel de Obra) definido, resto em aberto |
| [[02 - Escopo e Telas]] | inventário de telas e indicadores | 🟢 espinha dorsal (6 setores) confirmada |
| [[03 - Padrão de URLs e Abas]] | como navegar e endereçar cada tela | 🟢 princípios definidos |
| [[04 - Reuso de Telas]] | como a mesma tela serve em vários contextos | 🟢 princípios definidos |
| [[05 - Herança do Dashboard Atual]] | o que aproveitar e o que **não** repetir | 🟢 mapeado |
| [[06 - Decisões de Arquitetura]] | registro de decisões (ADR) | 🟢 em uso |
| [[07 - Modelo de Dados]] | fontes de dados disponíveis | 🟢 herdado |
| [[08 - Blueprint do Painel de Obra]] | esboço navegável em HTML, tema Capex Seguro | 🟢 primeira versão pronta |
| [[09 - Log do Gemini]] | histórico de alterações e comunicação do Gemini | 🟢 novo |
| [[10 - Log do Auto]] | histórico de alterações do Auto (Cursor) | 🟢 novo |
| [[Design System]] | paleta, tipografia, convenções de escrita | 🟢 herdado |

Legenda: 🟢 tem conteúdo firme · 🟡 depende de definição do time · 🔴 bloqueado

## Princípios que já orientam o projeto

Vêm da experiência com o dashboard atual (ver [[05 - Herança do Dashboard Atual]]):

1. **Tela é unidade reutilizável**, não um pedaço de uma página. Toda tela deve
   funcionar isolada, embutida e em TV — sem código duplicado.
2. **Toda tela tem URL própria.** Se não dá para mandar o link, não está pronto.
3. **Documentação junto do código**, atualizada na mesma tarefa que muda o
   comportamento.
4. **Nada de regra de negócio escondida no meio da tela.** Cálculo fica em
   camada própria, testável e documentada.
5. **Falha de dado tem que aparecer.** Dado velho ou consulta truncada não pode
   passar por dado bom (os dois já aconteceram no dashboard atual).
