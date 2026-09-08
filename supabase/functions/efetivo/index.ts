// Edge Function `efetivo` — ADR-007 Fase 3, passo 9 (ver docs/06 e docs/14).
//
// PROBLEMA QUE ELA RESOLVE: o painel lê de DOIS projetos Supabase. O JWT emitido
// pelo projeto `API - Portal` não vale no projeto `Efetivo` — são bases de
// autenticação distintas. Sem isso, fechar o `anon` do Efetivo exigiria um
// SEGUNDO fluxo de OAuth, com o usuário logando duas vezes.
//
// COMO RESOLVE: esta função roda NO projeto A (Portal), exige sessão de A, e lê
// o projeto B (Efetivo) com a `service_role` de B, guardada como secret. O
// front-end passa a falar só com A; o `anon` de B pode então ser revogado sem
// que o painel perca a tela de Histograma/Efetivo.
//
// O QUE ELA NÃO FAZ: não amplia acesso. As 12 relações da allow-list são
// exatamente as que o `anon` de B já lê hoje, e só por GET. A função é o
// caminho novo para o mesmo dado, não um caminho para dado novo.

const EFETIVO_URL = "https://wnldmumgjwujveeimyef.supabase.co";
const DOMINIO = "mse.com.br";

// Allow-list gerada a partir dos padroes REAIS do front-end. Ha TRES sitios que
// montam o nome da relacao dinamicamente, nao um:
//   index.html:3438  vw_efetivo_${gran}_total | _moimod_total   (real)
//   index.html:3449  vw_efetivo_previsto_mensal_total | _moimod_total
//   index.html:3460  vw_efetivo_previsto_semanal_total | _moimod_total
//   index.html:3486  vw_efetivo_${gran}_pessoas
//
// A v1 desta lista cobria so o primeiro, e o resultado foi o Histograma abrir
// com o realizado e SEM o previsto — falha parcial, que e a pior de notar. O
// conjunto abaixo foi conferido contra os logs de acesso do projeto B (quais
// relacoes o navegador de fato pede), nao contra leitura de codigo.
//
// Nao existe previsto DIARIO em B: as views de previsto sao so semanal e mensal.
const GRAN_REAL = ["diario", "semanal", "mensal"];
const GRAN_PREVISTO = ["semanal", "mensal"];
const RELACOES_PERMITIDAS = new Set<string>([
  "efetivo_diario_raw",
  "efetivo_real_historico",
  "vw_efetivo_previsto_mensal_detalhe",
  ...GRAN_REAL.flatMap((g) => [
    `vw_efetivo_${g}_total`,
    `vw_efetivo_${g}_moimod_total`,
    `vw_efetivo_${g}_pessoas`,
  ]),
  ...GRAN_PREVISTO.flatMap((g) => [
    `vw_efetivo_previsto_${g}_total`,
    `vw_efetivo_previsto_${g}_moimod_total`,
  ]),
]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, range, range-unit, prefer",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Expose-Headers": "content-range",
};

function erro(status: number, mensagem: string) {
  // Falha alto e legível (ADR-005): a camada de dados do painel distingue
  // "erro real" de "sem dado", e um corpo vazio com 200 viraria tela em branco
  // sem aviso.
  return new Response(JSON.stringify({ erro: mensagem }), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/** Lê as claims do JWT já verificado pelo gateway (`verify_jwt`). Não valida
 *  assinatura — a plataforma fez isso antes de invocar a função. Aqui só se
 *  confere o que a assinatura não diz: papel, validade e domínio. */
function claims(token: string): Record<string, unknown> | null {
  try {
    const p = token.split(".")[1];
    if (!p) return null;
    const json = atob(p.replace(/-/g, "+").replace(/_/g, "/").padEnd(
      p.length + ((4 - (p.length % 4)) % 4),
      "=",
    ));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return erro(405, "somente GET");

  // ── Autorização ────────────────────────────────────────────────────────────
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return erro(401, "sessao ausente");

  const c = claims(token);
  if (!c) return erro(401, "token ilegivel");
  if (c.role !== "authenticated") {
    // Pega o caso de alguem mandar a anon key como Bearer: ela é um JWT válido
    // e assinado, mas com role "anon".
    return erro(403, "necessario usuario autenticado, nao a anon key");
  }
  if (typeof c.exp === "number" && c.exp * 1000 < Date.now()) {
    return erro(401, "sessao expirada");
  }
  const email = String(c.email ?? "").toLowerCase();
  if (email.split("@")[1] !== DOMINIO) {
    // Mesma regra do predicado de RLS do projeto A
    // (public.mse_email_do_dominio), repetida aqui porque o RLS de A não
    // alcança uma leitura feita no projeto B.
    return erro(403, `acesso restrito a contas @${DOMINIO}`);
  }

  // ── Roteamento ─────────────────────────────────────────────────────────────
  // .../functions/v1/efetivo/<relacao>?<query>
  const url = new URL(req.url);
  const relacao = url.pathname.split("/").filter(Boolean).pop() ?? "";
  if (!RELACOES_PERMITIDAS.has(relacao)) {
    return erro(403, `relacao nao permitida: ${relacao}`);
  }

  // Só agora: quem chegou aqui já provou sessão válida, papel authenticated,
  // domínio da MSE e relação na allow-list. Checar o secret antes disso fazia a
  // função contar o estado da própria configuração para quem nem passou da
  // porta — e, de quebra, mascarava a autorização nos testes (todo caso
  // negativo virava 500 em vez do 401/403 que revelaria a regra aplicada).
  const serviceKey = Deno.env.get("EFETIVO_SERVICE_KEY");
  if (!serviceKey) {
    return erro(
      503,
      "EFETIVO_SERVICE_KEY nao configurada nesta funcao. Ver docs/14, Fase 3 passo 9.",
    );
  }

  const alvo = `${EFETIVO_URL}/rest/v1/${relacao}${url.search}`;

  // Aceita os DOIS formatos de credencial do Supabase:
  //  * `service_role` legada — é um JWT, e o padrão é mandá-la em `apikey` E em
  //    `Authorization: Bearer`.
  //  * chave secreta nova (`sb_secret_...`) — NÃO é JWT. Vai só em `apikey`;
  //    mandá-la como Bearer faz o gateway tentar validar assinatura e recusar.
  // Sem esta distinção, quem colasse a chave nova levaria 401 do projeto B — um
  // erro que parece de rede e manda investigar o lugar errado.
  const chaveNova = serviceKey.startsWith("sb_");
  const headers: Record<string, string> = chaveNova
    ? { apikey: serviceKey }
    : { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  // Repassa os headers de paginação: `fetchPaginado` do painel pagina por
  // Range/Range-Unit (index.html:692), não por limit/offset. Sem repassar,
  // toda consulta voltaria capada no default de 1000 linhas do PostgREST.
  for (const h of ["Range", "Range-Unit", "Prefer", "Accept"]) {
    const v = req.headers.get(h);
    if (v) headers[h] = v;
  }

  try {
    const resp = await fetch(alvo, { headers });
    const corpo = await resp.text();
    const fora = new Headers(CORS);
    fora.set("Content-Type", resp.headers.get("Content-Type") ?? "application/json");
    const cr = resp.headers.get("Content-Range");
    if (cr) fora.set("Content-Range", cr);
    return new Response(corpo, { status: resp.status, headers: fora });
  } catch (e) {
    return erro(502, `falha ao consultar o projeto Efetivo: ${e}`);
  }
});
