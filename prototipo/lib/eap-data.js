(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MSEEapData = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  const CORTE = '2026-09-01', ANTES = '2026-08-31';
  const diaLocal = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fontes = {
    apontamentos: { tabela: 'Apontamentos', data: 'data_do_input', id: 'id', select: 'id,status_qualidade,data_do_input,avanco_diario,meta_diaria,UUID', order: 'data_do_input.desc,id.asc' },
    alocacoes: { tabela: 'apontamento_efetivo', data: 'data_consulta', id: 'tarefa_id', select: 'tarefa_id,funcionario_id,funcionario_nome,nome_funcao,data_consulta', order: 'data_consulta.desc,tarefa_id.asc,funcionario_id.asc' },
    aderencia: { tabela: 'vw_dados_tv', data: 'DATA', select: 'OBRA,RESPONSÁVEL,DATA,EDT,"META DO DIA","AVANÇO REGISTRADO",ADERENCIA_LINEAR', order: 'DATA.asc,ID.asc' },
  };
  function criarCliente({ apiUrl, supabaseUrl, fetchPaginado, headers }) {
    async function tarefas({ ids, obraId, eapId, edt } = {}) {
      if (ids && !ids.length) return [];
      const batches = ids ? Array.from({ length: Math.ceil(ids.length / 200) }, (_, i) => ids.slice(i * 200, i * 200 + 200)) : [null];
      const all = [];
      for (const batch of batches) {
        const q = new URLSearchParams();
        if (batch) q.set('ids', batch.join(','));
        if (obraId != null) q.set('id_obra', obraId);
        if (eapId != null) q.set('id_eap', eapId);
        if (edt != null) q.set('edt', edt);
        const rows = await fetchPaginado(`${apiUrl}/eap/tarefas?${q}`, headers());
        if (rows === null) return null;
        all.push(...rows);
      }
      return all;
    }
    async function historico(tipo, { ids, desde, ate }) {
      const spec = fontes[tipo];
      if (!spec || !/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(ate) || desde > ate) throw new Error('Consulta de historico invalida');
      if (ids && !ids.length) return [];
      const batches = ids ? Array.from({ length: Math.ceil(ids.length / 200) }, (_, i) => ids.slice(i * 200, i * 200 + 200)) : [null];
      const all = [];
      for (const batch of batches) {
        // Corte explícito por DATA, nunca fallback por erro ou lista vazia.
        // Assim um dia não aparece duas vezes e agosto continua consultável.
        if (desde < CORTE) {
          const q = new URLSearchParams({ select: spec.select, order: spec.order });
          q.append(spec.data, `gte.${desde}`); q.append(spec.data, `lte.${ate < CORTE ? ate : ANTES}`);
          if (batch) q.set(spec.id, `in.(${batch.join(',')})`);
          const rows = await fetchPaginado(`${supabaseUrl}/rest/v1/${spec.tabela}?${q}`, headers());
          if (rows === null) return null;
          all.push(...rows);
        }
        if (ate >= CORTE) {
          const q = new URLSearchParams({ desde: desde < CORTE ? CORTE : desde, ate });
          if (batch) q.set('ids', batch.join(','));
          const rows = await fetchPaginado(`${apiUrl}/eap/${tipo}?${q}`, headers());
          if (rows === null) return null;
          all.push(...rows);
        }
      }
      return all;
    }
    return { tarefas, historico };
  }
  return { criarCliente, CORTE, diaLocal };
}));
