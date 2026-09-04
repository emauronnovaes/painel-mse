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
  return Object.freeze({ OBRAS, SETORES, validarConfiguracao });
}));
