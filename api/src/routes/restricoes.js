import { Router } from 'express';
import { restricoesDaObra } from '../portal/hubAvancos.js';

export const restricoesRouter = Router();

// Leitura pública (mesmo nível de acesso do `anon` no Supabase hoje) — o
// domínio Restrições EAP não tem RLS por obra/e-mail, então não há controle
// de acesso a reproduzir aqui.
//
// FONTE (18/09/2026): a própria API do Hub, consultada na hora
// (`/api_avancos/v1/restricoes/{id_obra}`). Antes vinha de `rest_restricoes`,
// alimentada por fluxo n8n de hora em hora — restrição é retrato do agora, não
// série histórica, então a tabela só custava um fluxo a manter e um dado sempre
// um ciclo atrasado. Sem leitura de banco nenhuma neste caminho.
//
// Falha da origem é 502, sem cair para a tabela: o cliente já serve o último
// retrato bom por até 6h (PORTAL_CACHE_STALE_MAX_SEGUNDOS) quando o Hub oscila.
// Se nem isso existir, é falha de verdade e a tela precisa saber.
restricoesRouter.get('/', async (req, res) => {
  const idObra = Number(req.query.id_obra);
  if (!Number.isInteger(idObra)) return res.status(400).json({ erro: 'id_obra invalido.' });

  try {
    const r = await restricoesDaObra(idObra);
    return res.json({
      restricoes: r.restricoes,
      total: r.total,
      // Agora significa "quando este retrato foi buscado do Hub" (antes era
      // "quando o n8n gravou"). O front usa só para mostrar idade do dado.
      atualizado_em: new Date(Date.now() - r.buscadoHaSegundos * 1000).toISOString(),
      origem: 'hub_mse',
      cache: { do_cache: r.doCache, velho: r.velho, idade_segundos: r.buscadoHaSegundos },
    });
  } catch (err) {
    // Obra que o Hub não conhece: mesmo contrato de antes (404), que o
    // `prototipo` já trata como lista vazia — não é falha de infraestrutura.
    if (err.naoEncontrado) return res.status(404).json({ erro: 'Sem restricoes para esta obra.' });
    console.error(`[restricoes] falha ao consultar o Hub para obra ${idObra}`, err);
    return res.status(502).json({ erro: 'Falha ao consultar restricoes no Hub MSE.' });
  }
});
