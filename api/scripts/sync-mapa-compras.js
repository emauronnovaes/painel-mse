// Ingestão de Suprimentos — Mapa de Compras, direto da API do PortalMSE
// (`mapa_compras_api`) pro MySQL, SEM n8n — mesmo racional de sync-rmi.js
// (ver lá o achado sobre latência real da API de origem, ~20-30s por
// chamada). Token é PRÓPRIO desse serviço, diferente do de `rmi_api`
// (ver n8n/mapa-compras-suprimentos.README.md).
//
// Sincroniza 2 recursos por obra: requisições (cabeçalho) primeiro, itens
// depois — mesma ordem lógica que o front consome (cada item referencia
// uma requisição por `id_mapa_compras`).
//
// Uso:
//   node scripts/sync-mapa-compras.js          # todas as obras
//   node scripts/sync-mapa-compras.js 91       # só uma obra
import 'dotenv/config';
import { pool } from '../src/db/pool.js';
import { paginarRecurso } from './lib/paginar-portalmse.js';

const MAPA_COMPRAS_API_URL = process.env.MAPA_COMPRAS_API_URL;
const MAPA_COMPRAS_API_TOKEN = process.env.MAPA_COMPRAS_API_TOKEN;
const PER_PAGE = 200;

// Campos com coluna própria em cada tabela — o resto do item vai só em
// `raw` (rede de segurança, mesmo padrão do Supabase). `num()`/`bool()`
// defensivos: a API irmã (pedidos_usuarios_api) já mandou valor monetário
// como string mesmo a doc dizendo "número" (ver README) — não confiar que
// vem tipado certo.
function num(v) { if (v === null || v === undefined || v === '') return null; const n = Number(v); return isNaN(n) ? null : n; }
function bool(v) { if (v === null || v === undefined) return null; return v === true || v === 'true' || v === 1 || v === '1' ? 1 : 0; }
function txt(v) { return v === null || v === undefined ? null : String(v); }

const COLUNAS_REQUISICOES = [
  'id', 'id_obra', 'id_rmi', 'nome_rmi', 'requisicao', 'requisicao_tipo', 'tipo',
  'grupo', 'categoria', 'descricao', 'status_requisicao', 'status_requisicao_gravado',
  'data_cadastro', 'data_necessidade', 'requisitante', 'cronograma',
  'data_cronograma_fechado', 'id_req_original', 'solicitacao_enviada',
  'necessario_contrato', 'necessario_art', 'total_itens', 'raw',
];

function linhaRequisicao(item, idObra) {
  return [
    num(item.id), idObra, num(item.id_rmi), txt(item.nome_rmi), txt(item.requisicao),
    txt(item.requisicao_tipo), txt(item.tipo), txt(item.grupo), txt(item.categoria),
    txt(item.descricao), txt(item.status_requisicao), txt(item.status_requisicao_gravado),
    txt(item.data_cadastro), txt(item.data_necessidade), txt(item.requisitante),
    num(item.cronograma), txt(item.data_cronograma_fechado), num(item.id_req_original),
    bool(item.solicitacao_enviada), bool(item.necessario_contrato), bool(item.necessario_art),
    num(item.total_itens), JSON.stringify(item),
  ];
}

const COLUNAS_ITENS = [
  'id', 'id_obra', 'id_mapa_compras', 'codigo_seq', 'descricao', 'unidade', 'quantidade',
  'preco_referencia_bd_s1', 'subtotal_referencia_bd_s1', 'custo_meta_orcamento',
  'subtotal_custo_meta_orcamento', 'saldo_orcamentario', 'saldo_quantidade',
  'quantidade_pedida', 'total_consumido', 'tem_pedido', 'fornecedor_ref', 'projeto_ref',
  'melhor_oferta_unitario', 'melhor_oferta_subtotal', 'melhor_oferta_fornecedor', 'raw',
];

function linhaItem(item, idObra) {
  return [
    num(item.id), idObra, num(item.id_mapa_compras), txt(item.codigo_seq),
    txt(item.descricao), txt(item.unidade), num(item.quantidade),
    num(item.preco_referencia_bd_s1), num(item.subtotal_referencia_bd_s1),
    num(item.custo_meta_orcamento), num(item.subtotal_custo_meta_orcamento),
    num(item.saldo_orcamentario), num(item.saldo_quantidade), num(item.quantidade_pedida),
    num(item.total_consumido), bool(item.tem_pedido), txt(item.fornecedor_ref),
    txt(item.projeto_ref), num(item.melhor_oferta_unitario), num(item.melhor_oferta_subtotal),
    txt(item.melhor_oferta_fornecedor), JSON.stringify(item),
  ];
}

function montarSqlUpsert(tabela, colunas, linhas) {
  const placeholderLinha = `(${colunas.map(() => '?').join(', ')})`;
  const tuplas = linhas.map(() => placeholderLinha).join(', ');
  const atualiza = colunas.filter((c) => c !== 'id').map((c) => `${c} = VALUES(${c})`).join(', ');
  return {
    sql: `INSERT INTO ${tabela} (${colunas.join(', ')}) VALUES ${tuplas} ON DUPLICATE KEY UPDATE ${atualiza}`,
    valores: linhas.flat(),
  };
}

async function sincronizarRecurso({ idObra, caminho, colunas, montarLinha, tabela, nomeChaveId }) {
  const montarUrl = (page, perPage) => `${MAPA_COMPRAS_API_URL}/v1/${caminho}?obra_id=${idObra}&page=${page}&per_page=${perPage}`;
  let gravados = 0;

  const { recebidos, totalDeclarado } = await paginarRecurso({
    montarUrl,
    token: MAPA_COMPRAS_API_TOKEN,
    perPage: PER_PAGE,
    onPagina: async (dados) => {
      const validos = dados.filter((item) => item && item[nomeChaveId] != null);
      // Achado ao migrar (17/09/2026): um nome de campo errado (`id_item`
      // em vez de `id`) descartava TODOS os itens aqui, silenciosamente —
      // o log antigo mostrava "+200" (contagem de RECEBIDOS da API, não de
      // GRAVADOS no banco), mascarando 0 linhas persistidas como sucesso.
      // Agora `gravados` é contado à parte, e qualquer descarte alerta.
      if (validos.length !== dados.length) {
        console.error(`  [obra ${idObra}] AVISO (${caminho}): ${dados.length - validos.length} de ${dados.length} itens sem "${nomeChaveId}" — descartados, NÃO gravados.`);
      }
      if (validos.length) {
        const linhas = validos.map((item) => montarLinha(item, idObra));
        const { sql, valores } = montarSqlUpsert(tabela, colunas, linhas);
        await pool.query(sql, valores);
        gravados += validos.length;
      }
      console.log(`  [obra ${idObra}] ${caminho}: +${validos.length} gravados (${dados.length} recebidos)`);
    },
  });

  if (totalDeclarado != null && recebidos !== totalDeclarado) {
    console.error(`  [obra ${idObra}] AVISO (${caminho}): recebido ${recebidos}, API declarou total=${totalDeclarado}.`);
  }
  return gravados;
}

async function sincronizarObra(idObra, nomeObra) {
  const nReq = await sincronizarRecurso({
    idObra, caminho: 'requisicoes', colunas: COLUNAS_REQUISICOES,
    montarLinha: linhaRequisicao, tabela: 'sup_mapa_compras_requisicoes', nomeChaveId: 'id',
  });
  const nItens = await sincronizarRecurso({
    idObra, caminho: 'itens', colunas: COLUNAS_ITENS,
    montarLinha: linhaItem, tabela: 'sup_mapa_compras_itens', nomeChaveId: 'id',
  });
  console.log(`  [obra ${idObra}] "${nomeObra}" concluída: ${nReq} requisições, ${nItens} itens.`);
  return nReq + nItens;
}

async function main() {
  if (!MAPA_COMPRAS_API_URL || !MAPA_COMPRAS_API_TOKEN) {
    throw new Error('Faltam MAPA_COMPRAS_API_URL/MAPA_COMPRAS_API_TOKEN no .env.');
  }

  try {
    const filtroObra = process.argv[2] ? Number(process.argv[2]) : null;
    const [obras] = await pool.query(
      filtroObra ? 'SELECT id, nome FROM obras WHERE id = ?' : 'SELECT id, nome FROM obras',
      filtroObra ? [filtroObra] : [],
    );
    if (!obras.length) throw new Error(filtroObra ? `Obra ${filtroObra} não encontrada.` : 'Nenhuma obra cadastrada.');

    console.log(`Sincronizando Mapa de Compras para ${obras.length} obra(s)...`);
    let totalGeral = 0;
    for (const obra of obras) {
      try {
        totalGeral += await sincronizarObra(obra.id, obra.nome);
      } catch (err) {
        console.error(`  [obra ${obra.id}] FALHOU: ${err.message}`);
      }
    }
    console.log(`Concluído: ${totalGeral} linhas no total.`);
  } finally {
    await pool.end();
  }
}

await main();
