(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MSEConfig = factory();
}(typeof self !== 'undefined' ? self : this, function () {
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
  return Object.freeze({ validarConfiguracao });
}));
