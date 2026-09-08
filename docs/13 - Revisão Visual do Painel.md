# Revisão visual — 08/09/2026

A refatoração incremental de 04/09 permanece em espera por solicitação do
usuário. Esta rodada trata do acabamento visual do protótipo local.

## Diagnóstico e ajustes

A estrutura clara, o cabeçalho navy e os semáforos existentes formam uma boa
base. O principal problema transversal era a leitura de rótulos secundários
muito claros. Os tons compartilhados foram escurecidos para #66758a e #768397.
Esses tokens também são usados por componentes de exportação; a mudança de
contraste pode aparecer nos relatórios, embora suas geometrias não tenham sido
alteradas.

O fundo da interface ficou mais leve, as sombras dos cartões mais suaves e o
cabeçalho menos carregado pela fotografia. A aba ativa recebeu destaque discreto;
em larguras intermediárias as abas rolam em vez de comprimir seus nomes.
Controles ganharam foco de teclado visível, e a aba atual expõe aria-current.
Estados de carregamento/erro/vazio compartilhados ganharam ícone, texto legível
e anúncio via role=status. O título do documento identifica o Painel de Obra.

No celular, Portal e seletor de obra compartilham a linha. Foram corrigidos dois
transbordamentos observados antes das alterações: a barra de Performance de
Encarregados e o comparativo Medido × Físico de Medições. Seus controles agora
quebram em linhas, mantendo os dados acessíveis.

## Validação e limites

- 29 testes unitários existentes aprovados.
- Revisão local via scripts/review-visual.cjs: nove setores da obra 106 nas
  larguras 1440, 768 e 390 pixels, com captura de imagem por rota.
- Nas 27 combinações: conteúdo montado, nenhuma exceção de página e nenhum
  transbordamento horizontal da página após as correções.
- Capturas em playwright-report/visual/. A revisão usa dados remotos e espera
  curta por setor; algumas capturas mostram carregamento. Não comprova todos
  os estados carregados, todas as obras, exportações ou interações de modais.
- Nenhum deploy realizado nesta rodada.

## Pontos para aprofundamento

Gráficos densos precisam de revisão específica da legibilidade dos eixos e do
dimensionamento das fontes; o histograma merece atenção especial. Tabelas largas
continuam com rolagem horizontal, conforme o padrão do produto. A revisão completa
dos relatórios PNG/PDF e das variações por obra exige uma rodada dedicada com
dados carregados. O acabamento aplicado não equivale à conclusão dessa cobertura.
