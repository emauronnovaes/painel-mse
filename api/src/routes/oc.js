import { Router } from 'express';
import { exigirAcessoFinanceiroObra } from '../auth/financeiroSupabase.js';
import { ocDaObra } from '../portal/ocApi.js';

export const ocRouter = Router();

// OC/CO é financeiro (docs/15, "financeiro por obra", mesma restrição de
// Medições) — exige sessão válida + acesso ao id_obra pedido.
//
// ⚠️ Este guard vem ANTES de tudo e continua valendo depois da troca de fonte:
// consultar a API do Portal em vez do MySQL não muda quem pode ver o quê. A
// chamada ao Portal só acontece depois que o acesso foi verificado.
ocRouter.use(exigirAcessoFinanceiroObra);

// FONTE (18/09/2026): `orcamentos_complementares_api`, consultada na hora.
// Antes vinha de `oc_orcamentos` (snapshot por obra gravado por fluxo n8n).
// Mesmo raciocínio de Restrições — retrato do agora, sem histórico a preservar.
//
// Falha da origem é 502, sem cair para a tabela: o cliente já serve o último
// retrato bom por até 6h quando a origem oscila.
//
// Devolve ARRAY (0 ou 1 item), igual o `select=*` do Supabase devolvia e igual
// a versão anterior desta rota — o `prototipo` não muda junto.
ocRouter.get('/', async (req, res) => {
  const idObra = Number(req.query.id_obra);
  if (!Number.isInteger(idObra)) return res.status(400).json({ erro: 'id_obra invalido.' });

  try {
    const r = await ocDaObra(idObra);
    // Obra sem nenhuma OC devolve lista vazia — estado válido, era o que a rota
    // já fazia quando não havia linha na tabela.
    if (r.ocs.length === 0) return res.json([]);
    return res.json([{
      ocs: r.ocs,
      resumo: r.resumo,
      total: r.total,
      atualizado_em: new Date(Date.now() - r.idadeSegundos * 1000).toISOString(),
      origem: 'orcamentos_complementares_api',
      cache: { do_cache: r.doCache, velho: r.velho, idade_segundos: r.idadeSegundos },
    }]);
  } catch (err) {
    // Obra sem OC nenhuma / desconhecida do serviço: array vazio, igual a rota
    // já devolvia quando não havia linha na tabela.
    if (err.naoEncontrado) return res.json([]);
    console.error(`[oc] falha ao consultar a API do Portal para obra ${idObra}`, err);
    return res.status(502).json({ erro: 'Falha ao consultar orcamentos complementares.' });
  }
});
