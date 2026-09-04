(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MSEConfig = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  const OBRAS = Object.freeze([
    { id: 106, nome: 'CNPEM - Faseado', curva: 'CNPEM - FASEADO', origemTV: 'CNPEM-FASEADA', origemCP: 'CP029' },
    { id: 110, nome: 'Hitachi', curva: 'HITACHI', origemTV: 'HITACHI', origemCP: 'CP022' },
    { id: 94, nome: 'Porto Itapoá', curva: 'PORTO', origemTV: 'PORTO ITAPOÁ', origemCP: 'CP002' },
    { id: 107, nome: 'Novo Nordisk - AP', curva: 'NOVO NORDISK - AP', origemTV: 'NN - AP - ELETROMECÂNICA', origemPTS: 'Novo Nordisk AP', origemCP: 'CP273', curvas: [
      { chave: 'NOVO NORDISK - AP - Estudo', label: 'Estudo' }, { chave: 'NOVO NORDISK - AP - PPU', label: 'PPU' },
    ] },
    { id: 108, nome: 'Novo Nordisk - AP - Reforço', curva: 'NOVO NORDISK - REFORÇO AP', origemTV: 'NN - REFORÇO EST. METÁLICAS', origemCP: 'CP261' },
    { id: 91, nome: 'Novo Nordisk - UB/SP', curva: 'NOVO NORDISK - UB SP', origemTV: 'NN - UB/SP - ELETROMECÂNICA', origemPTS: 'Novo Nordisk UB', origemCP: 'CP236', curvas: [
      { chave: 'NOVO NORDISK - UB SP - Take Off', label: 'Take-Off' }, { chave: 'NOVO NORDISK - UB SP', label: 'Original' },
    ] },
    { id: 114, nome: 'IPEN' },
  ]);

  const SETORES = Object.freeze([
    { num: 1, slug: 'curva-s', label: 'Curva S', estado: 'pronto' },
    { num: 2, slug: 'encarregados', label: 'Encarregados', estado: 'pronto' },
    { num: 3, slug: 'desvios', label: 'Desvios', estado: 'pronto' },
    { num: 4, slug: 'restricoes', label: 'Restrições', estado: 'pronto' },
    { num: 5, slug: 'histograma', label: 'Histograma', estado: 'pronto' },
    { num: 6, slug: 'suprimentos-criticos', label: 'Suprimentos', estado: 'pronto' },
    { num: 7, slug: 'oc-co', label: 'OC / CO', estado: 'pronto' },
    { num: 8, slug: 'medicoes', label: 'Medições', estado: 'pronto' },
    { num: 9, slug: 'tour-360', label: 'Tour 360°', estado: 'pronto' },
  ]);
  const OBRA_FOTOS = Object.freeze({
    106: 'assets/images/cnpem-faseado.jpg', 110: 'assets/images/hitachi.jpg',
    94: 'assets/images/porto.jpg', 107: 'assets/images/AP.jpg',
    108: 'assets/images/reforço.jpg', 91: 'assets/images/UB.jpg',
  });
  const OBRA_TOUR_360 = Object.freeze({
    106: 'https://visi.constructin.com.br/#/v?t=a3981477b7201496a8f16548e926170c6548a943548a092bf95774497ef7d47f&p=10971',
  });
  const OBRA_ORTOFOTO = Object.freeze({
    94: Object.freeze({ dzi: 'assets/ortofoto-porto/ortofoto.dzi', data: '2026-08-25' }),
  });
  const OBRAS_SUPRIMENTOS_VALIDADAS = Object.freeze(new Set([106, 110, 94, 107, 108, 91, 114]));
  const OBRAS_STATUS_MANUAL_DESATIVADO = Object.freeze(new Set([114]));
  const NIVEL_EXPORTACAO_GRAFICOS_POR_OBRA = Object.freeze({ 107: 'area', 108: 'area', 110: 'area' });
  const OBRAS_SEM_EXPORTACAO_GRAFICOS = Object.freeze(new Set([94]));
  const STATUS_MANUAL_OPCOES = Object.freeze(['Em cotação', 'Comprado Parcial', 'Comprado', 'Entregue Parcial', 'Entregue']);
  const ORDEM_STATUS_RMI = Object.freeze(['Atrasado', 'Pendente', 'Requisitado', 'Em cotação', 'Em Andamento', 'Comprado Parcial', 'Comprado', 'Entregue Parcial', 'Entregue']);
  // Configuração específica de Suprimentos externalizada por obra.
  // A migração começa pela Hitachi (id 110); as demais obras permanecem
  // no legado do protótipo até cada fatia ser validada.
  const CONFIG_SUPRIMENTOS_POR_OBRA = Object.freeze({
    110: Object.freeze({
      areaObrigatoria: false, escopoNivel0: true, rotulo: 'Escopo', curvaAObrigatoria: false,
      escoposPermitidos: ['cp281', 'cp001', 'cp006'],
      catalogoExtra: Object.freeze({
        'Isoladores': Object.freeze(['ISOL. CERAM', 'ISOLADOR CERAMICO', 'ISOLADOR EPOXI', 'ISOLADOR SUPORTE']),
        'Barramentos (AT)': Object.freeze(['TUBO AL EXTRUD', 'BARRA PERF. AL', 'BARRA CIRCULAR', 'BARRA RETANGULAR DE COBRE', 'BARRA CHATA DE ALUMINIO']),
        'Conectores e Ferragens de Linha (AT)': Object.freeze(['CONEC. SUP', 'CONEC SUP', 'CONECT. SUP', 'CONECT SUP', 'CONECT. TERM', 'CONECT TERM', 'CONEC TERMINAL', 'CONECT. EMENDA', 'CONECT EMENDA', 'CONEC. EMENDA', 'CONEC EMENDA']),
        'Controle de Acesso': Object.freeze(['LEITOR BIOMETRICO', 'FECHADURA ELETROMAGNETICA', 'SENSOR MAGNETICO', 'BOTOEIRA']),
        'Parafusos e Fixação': Object.freeze(['PARAFUSO', 'PARARAFUSO', 'CHUMBADOR', 'ARRUELA', 'PORCA QUADRADA', 'PORCA SEXTAVADA', 'PORCA SEX']),
        'Equipamentos de TI': Object.freeze(['NOTEBOOK']),
        'Estrutura e Suportação Metálica': Object.freeze(['SUPORTE', 'PERFIL U EM ACO', 'PERFIL Z', 'CHAPA EM ACO GALVANIZADO']),
        'Tubulação Aço Carbono': Object.freeze(['TUBO ACO PTO NBR', 'RED CONC PTO', 'TE 90º ACO PRETO', 'ACO PRETO A-234', 'CAP ACO CARBONO']),
        'Acoplamentos e Conexões Ranhuradas': Object.freeze(['ACOPLAMENTO RIGIDO', 'ACOPLAMENTO DE REDUCAO', 'TEE RANHURADO', 'GRAMPO U', 'CRUZETA EM ACO', 'CAP RANHURADO']),
        'Automação e Controle': Object.freeze(['CORTINA DE LUZ']),
        'Combate a Incêndio': Object.freeze(['WATER SPRAY', 'PROJETOR DE ALTA VAZAO']),
        'Cabos': Object.freeze(['COND COBRE NU', 'TERMINAL COMPRESSAO']),
        'Rede/Cabeamento Estruturado': Object.freeze(['KIT DE ANCORAGEM', 'PARA DIO']),
        'Eletrodutos e Infraestrutura Elétrica': Object.freeze(['PERF FGF', 'PARALEITO']),
      }),
    }),
    108: Object.freeze({
      rmisExcluidos: Object.freeze([262]),
      linhasExcluidas: Object.freeze([147454]),
      curvaAObrigatoria: false,
      catalogoExtra: Object.freeze({
        'Estrutura e Suportação Metálica': Object.freeze(['VIGAMENTO', 'REFORCO VIGA', 'TRELICA', 'GUSSET']),
      }),
    }),
    114: Object.freeze({
      trocarAreaDisciplina: true,
      rotuloArea: 'Detalhamento',
      escoposExcluidos: Object.freeze(['INDIRETOS', 'MAO DE OBRA']),
      curvaAObrigatoria: false,
      catalogoExtra: Object.freeze({
        'Fabricação de Equipamentos (Reservatórios/Trocadores)': Object.freeze(['FABRICACAO - RESERVATORIO', 'FABRICACAO - TROCADOR DE CALOR']),
        'Resistências Elétricas': Object.freeze(['RESISTENCIA 15 KW', 'RESISTENCIA COLEIRA DE MICA']),
        'Tubulação Inox': Object.freeze(['TUBO - AISI 316', 'TUBULACAO DE INOX']),
        'Tubulação Aço Carbono': Object.freeze(['TUBO - AISI 1020']),
        'Estrutura e Suportação Metálica': Object.freeze(['CHAPA DE APOIO', 'SAPATA', 'PERFIL C ', 'TUBO QUADRADO', 'APOIO ESTRUTURAL', 'BASE SUPORTE', 'PLACA BASE', 'CHAPA SACRIFICIO', 'CHAPA DESLIZAMENTO', 'CHAPA 77', 'ESTRUTURA SP', 'OLHAL FIXO SUPORTE', 'PINO DE MOVIMENTACAO', 'CHAPA PORTA REFRATARIO', 'BANDEJA DE RETENCAO']),
        'Suportes e Acessórios de Tubulação': Object.freeze(['LISEGA', 'GRADETEC', 'TIRANTE OLHAL', 'BRACADEIRA / BLOCO METALICO TERMOPAR', 'ABRACADEIRA ESPECIFICA', 'SUPORTE PARA PISO E PAREDE', 'SUPORTE MF', 'JUNCAO ARTICULADA', 'FIXADOR DUPLO', 'SUPORTE CAIXA DE TOMADA']),
        'Válvulas e acessórios': Object.freeze(['TEE UNIAO', 'CRUZETA | AISI', 'COTOVELO UNIAO', 'MEIA LUVA ROSCADA', 'LUVA ROSCADA', 'BUJAO', 'REDUCAO CONECNTRICA', 'JUNTA DE VEDACAO', 'JUNTA PLANA', 'JUNCAO PLANA', 'POCO DE PROTECAO', 'TUBO PILOTO', 'CONECTOR MACHO', 'FILTRO SINTERIZADO']),
        'Instrumentação': Object.freeze(['TERMOPAR', 'TRANSMISSOR DE VAZAO', 'TRANSDUTOR PROPORCIONAL', 'PRESOSTATO', 'PRESSOSTATO', 'ESPAGUETE', 'TERMO ENCOLHIVEL']),
        'Painéis': Object.freeze(['QUADRO DE MONITORAMENTO', 'QUADRO DE COMANDO']),
        'Isolamento térmico': Object.freeze(['LA DE ROCHA', 'PRODUTO REVESTIMENTO']),
        'Eletrodutos e Infraestrutura Elétrica': Object.freeze(['SEPTO DIVISOR', 'UNIAO PARA DIVISOR', 'TAMPA E PRESSAO']),
        'Parafusos e Fixação': Object.freeze(['PARAFUSO', 'PARFUSO', 'PORCA', 'ARRUELA', 'PRISIONEIRO', 'CONTRAPORCA', 'INSUMOS DE MONTAGEM']),
        'Equipamentos de TI': Object.freeze(['COMPUTADOR', 'MONITOR 22']),
        'Dispositivos Elétricos (Tomadas/Plugues)': Object.freeze(['TOMADA STECK', 'PLUG STECK', 'PLUGUE MACHO TRIANGULAR']),
        'Tubulação de Cobre': Object.freeze(['TUBULACAO DE COBRE']),
        'Cabos': Object.freeze(['TERMINAL TIPO ILHOIS']),
      }),
      catalogoPrioritario: Object.freeze(['Estrutura e Suportação Metálica', 'Válvulas e acessórios', 'Suportes e Acessórios de Tubulação']),
    }),
    107: Object.freeze({
      rmisExcluidos: Object.freeze([217]),
      usarNomeRmiComoArea: true,
      curvaAObrigatoria: false,
      descricoesExcluidas: Object.freeze(['CORTADORES DE TUBOS']),
    }),
    91: Object.freeze({
      rmisExcluidos: Object.freeze([43]),
      catalogoExtra: Object.freeze({
        'Perfis Estruturais (W/CS/VS/L)': Object.freeze([/^(W|CS|VS|L)\s*\d+[Xx]/, 'TERCAS']),
        'Estrutura e Suportação Metálica': Object.freeze(['ESTRUTURA LEVE', 'ESTRUTURA MEDIA', 'ESTRUTURA PESADA', 'ESTRUTURA EXTRA PESADA', 'STEEL DECK', 'CHUMBADOR', 'CA 50', 'TELA Q', 'CALHA METALICA', 'ASTM A 572']),
        'Concreto e Impermeabilização': Object.freeze(['POLIUREIA', 'JUNTA JEENE']),
        'Telhas e Cobertura': Object.freeze(['TELHA']),
        'Suportes de Tubulação': Object.freeze(['SUPORTE PESADO DE TUBULACAO', 'SUPORTE LEVE DE TUBULACAO']),
        'Tubulação Aço Carbono': Object.freeze(['TUBOS DE ACO CARBONO', 'TUBULACOES EM ACO CARBONO', 'TUBO EM ACO CARBONO']),
        'Tubulação Inox': Object.freeze(['TUBO ACO INOXIDAVEL']),
        'Tubulação Polipropileno': Object.freeze(['POLIPROPILENO']),
        'Tubulação PVC': Object.freeze(['PVC']),
        'Combate a Incêndio': Object.freeze(['ABRIGO PARA HIDRANTE', 'MANGUEIRAS COM COMPRIMENTO', 'STORZ']),
        'Instrumentação': Object.freeze(['ANALISADOR DE', 'TRANSMISSOR INDICADOR DE', 'ELEMENTO DE TEMPERATURA', 'MEDIDOR DE VAZAO', 'CHAVE DE SEGURANCA', 'CHAVE DE NIVEL', 'CHAVE DE FLUXO', 'PRESSAO MANOMETRICA']),
        'Válvulas e acessórios': Object.freeze(['ELIMINADOR DE AR', 'VISOR DE NIVEL', 'VISOR DE FLUXO']),
        'Cabos': Object.freeze(['PROFIBUS', 'AS-I CABLE']),
        'Retificadores e Transformadores': Object.freeze(['RETIFICADOR', 'TRANSFORMADOR AUXILIAR']),
      }),
    }),
    94: Object.freeze({
      rmisExcluidos: Object.freeze([182]),
      codigoNivel0Min: 2,
      codigoNivel0Max: 29,
      zonaCodigoMax: 24,
      curvaAObrigatoria: false,
      mapaAreaCanonica: Object.freeze({
        'PATIO G1 + PATIO G2': 'Pátio G1 + Pátio G2',
        'PATIO G1': 'Pátio G1',
        'OBRAS COMPLEMENTARES - PATIO G1': 'Pátio G1',
        'PATIO G2': 'Pátio G2',
        'OBRAS COMPLEMENTARES - PATIO G2': 'Pátio G2',
        'PATIO G2 - 60.000 M²': 'Pátio G2',
        'ACESSO AO PATIO G': 'Acesso ao Pátio G',
        'GATE ACESSO AO PATIO G': 'Acesso ao Pátio G',
        'ACESSO PATIO G': 'Acesso ao Pátio G',
        'ACESSO NOROESTE': 'Acesso Noroeste',
        'AREA DE RECUO - (MANOBRA CAMINHOES)': 'Área de Recuo (Manobra de Caminhões)',
        'GATE DE ENTRADA': 'Gate de Entrada',
        'PRE-PORTAL': 'Pré-Portal',
        'VISTORIA': 'Vistoria',
        'RELOCACOES': 'Relocações',
        'APOIO CIVIL': 'Apoio Civil',
        'OBRAS COMPLEMENTARES': 'Obras Complementares',
      }),
      catalogoDisciplinaExtra: Object.freeze({
        'Caixas e Eletrodutos': Object.freeze(['CAIXAS E ELETRODUTO', 'CAIXAS E ELETRODUTOS']),
        'Sistema de Combate a Incêndio': Object.freeze(['SISTEMA DE COMBATE A INCEND', 'SISTEMAS DE COMBATE A INCEND']),
        'Blocos e Pilares de Fundação': Object.freeze(['BLOCOS', 'BLOCO EM CONCRETO SOBRE SUBMARINOS']),
        'Caixa Hidrante': Object.freeze(['CAIXA HIDRANTE']),
        'Caixa de Passagem/Manobra': Object.freeze(['CAIXA DE PASSAGEM']),
        'Vala para Tubulação': Object.freeze(['VALA PARA PASSAGEM']),
        'Portão de Acesso': Object.freeze(['PORTAO']),
        'Piso de Contenção': Object.freeze(['PISO DE CONTENCAO']),
        'Edificação e Obras Complementares': Object.freeze(['EDIFICACAO E OBRAS COMPLEMENTARES']),
        'Sinalização': Object.freeze(['SINALIZACAO']),
        'Esgoto Sanitário': Object.freeze(['ESGOTO SANITARIO']),
        'Cancela': Object.freeze(['CANCELA']),
        'Cercamento': Object.freeze(['VIGA BALDRAME']),
      }),
    }),
  });
  function validarConfiguracao(obras, setores) {
    if (!Array.isArray(obras) || !Array.isArray(setores)) throw new Error('Configuração do painel inválida: obras e setores devem ser listas');
    const ids = obras.map(obra => obra.id);
    if (ids.some(id => !Number.isInteger(id) || id <= 0)) throw new Error('Configuração do painel inválida: toda obra precisa de id numérico positivo');
    if (new Set(ids).size !== ids.length) throw new Error('Configuração do painel inválida: IDs de obra duplicados');
    const slugs = setores.map(setor => setor.slug);
    if (slugs.some(slug => !/^[a-z0-9-]+$/.test(slug || ''))) throw new Error('Configuração do painel inválida: slug de setor inválido');
    if (new Set(slugs).size !== slugs.length) throw new Error('Configuração do painel inválida: slugs de setor duplicados');
    if (setores.some(setor => !Number.isInteger(setor.num) || !setor.label)) throw new Error('Configuração do painel inválida: setor sem número ou rótulo');
    return true;
  }
  function validarConfiguracaoSuprimentos(configuracao, obras) {
    if (!configuracao || typeof configuracao !== 'object' || Array.isArray(configuracao)) throw new Error('Configuração de Suprimentos inválida');
    const ids = new Set((obras || []).map(obra => String(obra.id)));
    for (const [id, config] of Object.entries(configuracao)) {
      if (!ids.has(String(id))) throw new Error(`Configuração de Suprimentos inválida: obra desconhecida ${id}`);
      if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error(`Configuração de Suprimentos inválida: obra ${id}`);
      for (const campo of ['escoposPermitidos', 'escoposExcluidos', 'categoriasExtras', 'catalogoExtra']) {
        if (config[campo] !== undefined && !Array.isArray(config[campo]) && typeof config[campo] !== 'object') {
          throw new Error(`Configuração de Suprimentos inválida: ${campo} da obra ${id}`);
        }
      }
      for (const campo of ['catalogoExtra', 'catalogoDisciplinaExtra']) {
        if (config[campo] !== undefined) {
          if (!config[campo] || typeof config[campo] !== 'object' || Array.isArray(config[campo])) {
            throw new Error(`Configuração de Suprimentos inválida: ${campo} da obra ${id}`);
          }
          for (const [categoria, palavras] of Object.entries(config[campo])) {
            if (!categoria || !Array.isArray(palavras) || palavras.some(palavra => typeof palavra !== 'string' && !(palavra instanceof RegExp))) {
              throw new Error(`Configuração de Suprimentos inválida: categoria ${categoria || '(sem nome)'} da obra ${id}`);
            }
          }
        }
      }
      if (config.catalogoPrioritario !== undefined && (!Array.isArray(config.catalogoPrioritario) || config.catalogoPrioritario.some(categoria => typeof categoria !== 'string'))) {
        throw new Error(`Configuração de Suprimentos inválida: catalogoPrioritario da obra ${id}`);
      }
    }
    return true;
  }
  function mesclarConfiguracaoSuprimentos(legado, externo) {
    const mesclarCatalogo = (base, adicional) => {
      const resultado = { ...(base || {}) };
      for (const [categoria, palavras] of Object.entries(adicional || {})) {
        resultado[categoria] = [...(resultado[categoria] || []), ...palavras.filter(palavra => !(resultado[categoria] || []).includes(palavra))];
      }
      return resultado;
    };
    const resultado = { ...(legado || {}) };
    for (const [obraId, regrasExternas] of Object.entries(externo || {})) {
      const regrasLegadas = resultado[obraId] || {};
      resultado[obraId] = {
        ...regrasLegadas,
        ...regrasExternas,
        catalogoExtra: mesclarCatalogo(regrasLegadas.catalogoExtra, regrasExternas.catalogoExtra),
        catalogoDisciplinaExtra: mesclarCatalogo(regrasLegadas.catalogoDisciplinaExtra, regrasExternas.catalogoDisciplinaExtra),
      };
    }
    return resultado;
  }
  return Object.freeze({ OBRAS, SETORES, OBRA_FOTOS, OBRA_TOUR_360, OBRA_ORTOFOTO, OBRAS_SUPRIMENTOS_VALIDADAS, OBRAS_STATUS_MANUAL_DESATIVADO, NIVEL_EXPORTACAO_GRAFICOS_POR_OBRA, OBRAS_SEM_EXPORTACAO_GRAFICOS, STATUS_MANUAL_OPCOES, ORDEM_STATUS_RMI, CONFIG_SUPRIMENTOS_POR_OBRA, validarConfiguracao, validarConfiguracaoSuprimentos, mesclarConfiguracaoSuprimentos });
}));
