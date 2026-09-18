// Teste das consultas diretas às APIs do Portal, SEM rede e SEM token: o
// buscador é injetado. Cobre o que o cache tem de não-óbvio — coalescência de
// chamadas simultâneas e fallback para valor velho quando a origem falha — e o
// mapeamento de cada domínio para o formato que o `prototipo` já espera.
//
//   node scripts/test-hub-avancos.mjs

process.env.AVANCOS_API_TOKEN = 'token-de-teste';
process.env.OC_API_TOKEN = 'token-de-teste-oc';
process.env.PORTAL_CACHE_TTL_SEGUNDOS = '1';
process.env.PORTAL_CACHE_STALE_MAX_SEGUNDOS = '3600';

const { buscarComCache, limparCache, _usarBuscador } = await import('../src/portal/clientePortal.js');
const { cardsAtivosDaEap, restricoesDaObra } = await import('../src/portal/hubAvancos.js');
const { ocDaObra } = await import('../src/portal/ocApi.js');

let passou = 0;
let falhou = 0;
function ok(condicao, titulo, detalhe = '') {
  if (condicao) { passou++; console.log(`  ok   ${titulo}`); }
  else { falhou++; console.log(`  FALHA ${titulo} ${detalhe}`); }
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const chamar = (url) => buscarComCache({ url, token: 'x', servico: 'teste' });

const CARDS = { data: {
  id_eap_tabela: 121, nome_eap: 'cp002 - Porto Itapoá - G2', id_obra: 94, nome_obra: 'PORTO ITAPOÁ',
  cards: [
    { card_id: 40231, edt: '1.1.4.2.9', tarefa: 'Aplicação do BGTC', resp_planejamento: 'RIVALDO', responsavel_encarregado: 'ANDERSON', supervisor_coordenador: null },
    { id: 40292, edt: '1.2.1.1.2', nome_tarefa: 'Retirada de Aterro', encarregado: 'SIDNEY', coordenador: 'ROSENELI' },
    { card_id: null, tarefa: 'sem id, deve sumir' },
  ],
} };

console.log('\n1) cache: segunda chamada não vai à origem');
limparCache();
let chamadas = 0;
_usarBuscador(async () => { chamadas++; return CARDS; });
await chamar('u1');
const segunda = await chamar('u1');
ok(chamadas === 1, `origem chamada 1x (foi ${chamadas}x)`);
ok(segunda.doCache === true, 'segunda resposta marcada como cache');

console.log('\n2) coalescência: 5 pedidos simultâneos, 1 chamada só');
limparCache();
chamadas = 0;
_usarBuscador(async () => { chamadas++; await dormir(50); return CARDS; });
const juntos = await Promise.all(Array.from({ length: 5 }, () => chamar('u2')));
ok(chamadas === 1, `origem chamada 1x para 5 pedidos (foi ${chamadas}x)`);
ok(juntos.every((r) => r.dados?.cards?.length === 3), 'todos receberam os dados');

console.log('\n3) TTL expira e a origem cai: serve o valor velho, avisando');
limparCache();
_usarBuscador(async () => CARDS);
await chamar('u3');
await dormir(1100); // TTL de 1s configurado no topo
_usarBuscador(async () => { throw new Error('ECONNRESET simulado'); });
const velho = await chamar('u3');
ok(velho.velho === true, 'resposta marcada como velha');
ok(velho.dados?.cards?.length === 3, 'dados velhos continuam utilizáveis');
ok(velho.idadeSegundos >= 1, `idade reportada (${velho.idadeSegundos}s)`);

console.log('\n4) origem cai sem nada em cache: erro sobe (rota decide o fallback)');
limparCache();
_usarBuscador(async () => { throw new Error('ECONNRESET simulado'); });
let estourou = false;
try { await chamar('u4'); } catch { estourou = true; }
ok(estourou, 'erro propagado quando não há valor anterior');

console.log('\n5) cards ativos: formato da tabela cards_ativos');
limparCache();
_usarBuscador(async () => CARDS);
const { cards } = await cardsAtivosDaEap(121);
ok(cards.length === 2, `card sem id descartado (${cards.length} de 3)`);
ok(cards[0].card_id === '40231' && typeof cards[0].card_id === 'string', 'card_id é texto, como na tabela');
ok(cards[0].id_eap_tabela === 121 && cards[0].id_obra === 94, 'ids da EAP/obra vêm do envelope');
ok(cards[1].tarefa === 'Retirada de Aterro' && cards[1].responsavel_encarregado === 'SIDNEY', 'nomes alternativos de campo aceitos');
ok(cards[0].supervisor_coordenador === null, 'ausente vira null, não string vazia');

console.log('\n6) restrições: formato que a rota já devolvia');
limparCache();
_usarBuscador(async () => ({ data: { id_obra: 91, total: 2, restricoes: [
  { id: 1, status_cadastro_label: 'Aberto' }, { id: 2, status_cadastro_label: 'Concluída' },
] } }));
const rest = await restricoesDaObra(91);
ok(Array.isArray(rest.restricoes) && rest.restricoes.length === 2, 'lista de restrições preservada');
ok(rest.total === 2, 'total vem do envelope');
ok(rest.restricoes[0].status_cadastro_label === 'Aberto', 'campos da restrição passam intactos (o front lê direto)');

console.log('\n7) restrições: obra sem nenhuma restrição não é erro');
limparCache();
_usarBuscador(async () => ({ data: { id_obra: 99, total: 0, restricoes: [] } }));
const vazia = await restricoesDaObra(99);
ok(vazia.restricoes.length === 0 && vazia.total === 0, 'lista vazia aceita');

console.log('\n8) restrições: formato irreconhecível estoura com as chaves reais');
limparCache();
_usarBuscador(async () => ({ data: { id_obra: 91, itens: [] } }));
let msg = '';
try { await restricoesDaObra(91); } catch (e) { msg = e.message; }
ok(msg.includes('itens'), `erro cita as chaves recebidas (${msg.slice(0, 60)}...)`);

console.log('\n9) OC/CO: lista + resumo, no formato que a tabela guardava');
limparCache();
const OCS_91 = [
  { id: '10', numero_oc: '61', obra_id: '91', descricao: 'MAO DE OBRA', valor_final: '109668.12', status_oc: 'APROVADO' },
  { id: '11', numero_oc: '62', obra_id: '91', descricao: 'DRENAGEM', valor_final: '2000.00', status_oc: 'EM ANALISE' },
];
const RESUMO_91 = { time: '2026-09-18T15:56:11-03:00', obra_id: 91, data: { aprovado: 12752074.98, elaboracao: 0, analise: 9121873.37, credito: -27202937.83, debito: 39955012.81, saldo: 12752074.98, total_ocs: 2 } };
// A API de OC serve os dois recursos em URLs diferentes; o buscador injetado
// imita isso, senão o teste não exercita o caminho real.
_usarBuscador(async (url) => (url.includes('/v1/resumo') ? RESUMO_91 : OCS_91));
const oc = await ocDaObra(91);
ok(oc.ocs.length === 2, `ocs mapeadas (${oc.ocs.length})`);
ok(oc.resumo?.data?.aprovado === 12752074.98, 'resumo.data preservado (e de onde o front le os totais)');
ok(oc.total === 2, 'total vem de resumo.data.total_ocs');

console.log('\n10) OC/CO: OC de OUTRA obra na resposta e descartada');
// Trava de seguranca: a mesma API devolve TODAS as obras se o filtro vier com
// o nome errado (`id_obra` em vez de `obra_id`), com HTTP 200. Como a rota e
// financeira e restrita por obra, o filtro no codigo e o que impede vazamento.
limparCache();
_usarBuscador(async (url) => (url.includes('/v1/resumo') ? RESUMO_91 : [
  ...OCS_91,
  { id: '99', numero_oc: '77', obra_id: '107', descricao: 'DE OUTRA OBRA', valor_final: '1.00' },
]));
const ocMisturada = await ocDaObra(91);
ok(ocMisturada.ocs.length === 2, `so as da obra 91 passam (${ocMisturada.ocs.length} de 3)`);
ok(ocMisturada.ocs.every((o) => o.obra_id === '91'), 'nenhuma OC de obra alheia sobrou');

console.log('\n10b) OC/CO: resumo de outra obra e ignorado, lista continua valendo');
limparCache();
_usarBuscador(async (url) => (url.includes('/v1/resumo') ? { ...RESUMO_91, obra_id: 107 } : OCS_91));
const ocResumoErrado = await ocDaObra(91);
ok(ocResumoErrado.resumo === null, 'resumo de outra obra descartado');
ok(ocResumoErrado.total === 2 && ocResumoErrado.ocs.length === 2, 'total cai para o tamanho da lista');

console.log('\n10c) OC/CO: resumo indisponivel nao derruba a lista');
limparCache();
_usarBuscador(async (url) => { if (url.includes('/v1/resumo')) throw new Error('HTTP 500 (transitorio)'); return OCS_91; });
const ocSemResumo = await ocDaObra(91);
ok(ocSemResumo.ocs.length === 2 && ocSemResumo.resumo === null, 'lista entregue mesmo sem os totais');

console.log('\n10d) 404 vira naoEncontrado (a rota decide o contrato)');
limparCache();
_usarBuscador(async () => { throw new Error('HTTP 404 em .../restricoes/999999'); });
let marcado = null;
try { await restricoesDaObra(999999); } catch (e) { marcado = e.naoEncontrado; }
ok(marcado === true, 'erro 404 marcado, sem virar stale nem 502');

console.log('\n11) chaves de cache não colidem entre serviços/obras');
limparCache();
chamadas = 0;
_usarBuscador(async () => { chamadas++; return { data: { restricoes: [] } }; });
await restricoesDaObra(91);
await restricoesDaObra(94);
ok(chamadas === 2, `obras diferentes = chamadas diferentes (foram ${chamadas})`);

console.log(`\n${passou} ok, ${falhou} falha(s)\n`);
process.exit(falhou ? 1 : 0);
