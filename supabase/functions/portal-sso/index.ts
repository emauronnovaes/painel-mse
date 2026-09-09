// Edge Function `portal-sso` — entrada pelo Portal MSE (ver docs/15, seção 1d).
//
// PROBLEMA QUE ELA RESOLVE: o painel é servido dentro do portal, que já
// autenticou a pessoa, mas o portal não pode simplesmente DIZER quem é o
// usuário. Sem um JWT do Supabase o painel lê como `anon`, que é isento das
// policies do financeiro — quem tem recorte de uma obra veria todas. Ver a
// medição em docs/15, seção 1d.
//
// COMO RESOLVE: recebe o MESMO token HMAC que o portal já emite para o
// `planejamento_dash` (nenhum código novo do lado PHP para gerar), valida a
// assinatura aqui, e emite uma SESSÃO REAL do Supabase com a `service_role`.
// Devolve `{ access_token, refresh_token }` para o PHP injetar como
// `window.__MSE_PORTAL` no HTML servido.
//
// POR QUE NÃO O `app.py` DO planejamento_dash: aquele valida igual, mas termina
// injetando só a identidade (`__SSO_BOOTSTRAP.user`) — o usuário fica sem token
// Supabase, e é exatamente o que não serve aqui. Esta função troca a validação
// por uma sessão de verdade.
//
// O QUE ELA NÃO FAZ: não decide permissão. Quem vê o quê continua sendo
// `acesso_total` + RLS. Ela só transforma "o portal garante que é fulano" em
// "o Supabase reconhece fulano".

const AUTH = `${Deno.env.get("SUPABASE_URL")}/auth/v1`;
const REST = `${Deno.env.get("SUPABASE_URL")}/rest/v1`;

// Teto de validade aceito, independente do que o token pedir. Um portal
// comprometido (ou um bug) que emitisse `exp` daqui a um ano não conseguiria
// criar um passe permanente.
const TTL_MAXIMO_SEGUNDOS = 120;

// Idade a partir da qual um nonce consumido pode sumir da tabela. Tem que ser
// MAIOR que TTL_MAXIMO_SEGUNDOS, senão a limpeza abriria justamente a janela de
// replay que o nonce existe pra fechar.
const NONCE_RETENCAO_SEGUNDOS = 600;

const NONCE_VALIDO = /^[a-z0-9-]{8,128}$/;
const ORIGENS = new Set(["mse", "cliente"]);
const PERFIS = new Set(["MSE", "CLIENTE", "MASTER"]);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Falha alto e legível (ADR-005). `detalhe` vai para o log da função, NUNCA
// para o corpo: distinguir "assinatura inválida" de "nonce já usado" para quem
// chama é entregar um oráculo para quem estiver tentando forjar token.
function erro(status: number, publico: string, detalhe?: string) {
  if (detalhe) console.error(`[portal-sso] ${publico} :: ${detalhe}`);
  return new Response(JSON.stringify({ erro: publico }), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function base64urlParaBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// `crypto.subtle.verify` em vez de comparar strings: a comparação é feita em
// tempo constante pela própria WebCrypto. Comparar HMAC com `===` vaza, pelo
// tempo de resposta, quantos bytes iniciais bateram.
async function assinaturaConfere(
  segredo: string,
  payloadB64: string,
  assinaturaB64: string,
): Promise<boolean> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  try {
    return await crypto.subtle.verify(
      "HMAC",
      chave,
      base64urlParaBytes(assinaturaB64),
      new TextEncoder().encode(payloadB64),
    );
  } catch (_) {
    return false; // assinatura malformada não é exceção, é token inválido
  }
}

function texto(payload: Record<string, unknown>, campo: string, max: number, obrigatorio = true): string | null {
  const v = payload[campo];
  if (typeof v !== "string") return obrigatorio ? null : "";
  const t = v.trim();
  if (obrigatorio && !t) return null;
  if (new TextEncoder().encode(t).length > max) return null;
  return t;
}

type Identidade = { email: string; nome: string; origem: string; perfil: string; nonce: string };

async function validarToken(token: string, segredo: string): Promise<Identidade | string> {
  if (!token || token.length > 8192) return "token malformado (tamanho)";
  const partes = token.split(".");
  if (partes.length !== 2) return "token malformado (partes)";
  const [payloadB64, assinaturaB64] = partes;

  if (!(await assinaturaConfere(segredo, payloadB64, assinaturaB64))) return "assinatura invalida";

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64urlParaBytes(payloadB64)));
  } catch (_) {
    return "payload nao e JSON";
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return "payload nao e objeto";

  const iat = payload.iat, exp = payload.exp;
  if (!Number.isInteger(iat) || !Number.isInteger(exp)) return "iat/exp ausentes ou nao inteiros";
  const agora = Math.floor(Date.now() / 1000);
  // `iat > agora + 5` tolera relógio adiantado do portal em alguns segundos, e
  // recusa token emitido no futuro. O teto de TTL é o que impede passe longo.
  if ((iat as number) > agora + 5) return "token emitido no futuro";
  if ((exp as number) <= agora) return "token expirado";
  if ((exp as number) <= (iat as number)) return "exp anterior a iat";
  if ((exp as number) - (iat as number) > TTL_MAXIMO_SEGUNDOS) return "TTL acima do teto";

  const email = texto(payload, "email", 254)?.toLowerCase() ?? null;
  if (
    !email || email.split("@").length !== 2 ||
    email.startsWith("@") || email.endsWith("@") || /\s/.test(email)
  ) return "email invalido";

  const origem = texto(payload, "origem", 16)?.toLowerCase() ?? null;
  if (!origem || !ORIGENS.has(origem)) return "origem invalida";

  const perfil = texto(payload, "perfil", 16)?.toUpperCase() ?? null;
  if (!perfil || !PERFIS.has(perfil)) return "perfil invalido";

  const nonce = texto(payload, "nonce", 128)?.toLowerCase() ?? null;
  if (!nonce || !NONCE_VALIDO.test(nonce)) return "nonce invalido";

  const nome = texto(payload, "nome", 150, false) || email.split("@")[0];
  return { email, nome, origem, perfil, nonce };
}

// Consome o nonce. O INSERT conflitante É a detecção de replay — não há
// SELECT-antes-de-INSERT, que teria corrida entre duas requisições simultâneas
// carregando o mesmo token.
async function consumirNonce(nonce: string, service: string): Promise<boolean> {
  const h = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };

  // Limpeza oportunista, no mesmo espírito do `app.py`: sem cron, sem job.
  // Falhar aqui não impede o login — é higiene, não segurança.
  const corte = new Date(Date.now() - NONCE_RETENCAO_SEGUNDOS * 1000).toISOString();
  fetch(`${REST}/sso_nonce?criado_em=lt.${corte}`, { method: "DELETE", headers: h })
    .catch((e) => console.error("[portal-sso] limpeza de nonce falhou", e));

  const r = await fetch(`${REST}/sso_nonce`, {
    method: "POST",
    headers: { ...h, Prefer: "return=minimal" },
    body: JSON.stringify({ nonce }),
  });
  return r.ok; // 409 (unique_violation) = já usado
}

// Emite a sessão. Dois passos porque o GoTrue não tem "crie uma sessão para
// este e-mail": `generate_link` devolve um `hashed_token` de uso único, e
// `verify` o troca por access/refresh. É o mesmo par que o supabase-js usa por
// baixo de `admin.generateLink` + `verifyOtp`.
async function emitirSessao(email: string, nome: string, service: string, anon: string) {
  const hService = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" };

  const gerar = async () =>
    fetch(`${AUTH}/admin/generate_link`, {
      method: "POST",
      headers: hService,
      body: JSON.stringify({ type: "magiclink", email }),
    });

  let r = await gerar();

  // Primeiro acesso de alguém que existe no portal mas nunca entrou no painel:
  // `magiclink` exige usuário existente. Cria e repete — `email_confirm: true`
  // porque a confirmação já foi feita pelo portal, não há e-mail a enviar.
  if (!r.ok) {
    const criar = await fetch(`${AUTH}/admin/users`, {
      method: "POST",
      headers: hService,
      body: JSON.stringify({ email, email_confirm: true, user_metadata: { full_name: nome } }),
    });
    if (!criar.ok) return { erro: `admin/users ${criar.status}: ${await criar.text()}` };
    r = await gerar();
  }
  if (!r.ok) return { erro: `generate_link ${r.status}: ${await r.text()}` };

  const link = await r.json();
  const hashed = link?.hashed_token ?? link?.properties?.hashed_token;
  if (!hashed) return { erro: "generate_link sem hashed_token" };

  // `verify` roda com a ANON key de propósito: é o mesmo caminho de um login
  // normal, então a sessão sai com as claims de sempre (`role: authenticated`).
  // Usar a service_role aqui produziria um token com privilégio de serviço.
  const v = await fetch(`${AUTH}/verify`, {
    method: "POST",
    headers: { apikey: anon, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", token_hash: hashed }),
  });
  if (!v.ok) return { erro: `verify ${v.status}: ${await v.text()}` };

  const s = await v.json();
  if (!s?.access_token || !s?.refresh_token) return { erro: "verify sem tokens" };
  return { sessao: s };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return erro(405, "Use POST.");

  const segredo = Deno.env.get("PORTAL_SSO_SECRET");
  // Injetadas pela plataforma, não são secrets a configurar — ao contrário da
  // `efetivo`, que precisa da chave de OUTRO projeto. Aqui é o mesmo projeto.
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  // Segredo curto seria o elo fraco de tudo isto — mesma exigência do
  // `load_sso_config` do planejamento_dash.
  if (!segredo || segredo.length < 32) return erro(500, "Funcao mal configurada.", "PORTAL_SSO_SECRET ausente ou < 32 chars");
  if (!service || !anon) return erro(500, "Funcao mal configurada.", "SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY ausentes");

  let corpo: { token?: string };
  try {
    corpo = await req.json();
  } catch (_) {
    return erro(400, "Corpo invalido.");
  }
  const token = (corpo?.token ?? "").trim();
  if (!token) return erro(400, "Informe `token`.");

  const id = await validarToken(token, segredo);
  // Mensagem pública ÚNICA para toda recusa de token, de propósito: ver o
  // comentário de `erro()`.
  if (typeof id === "string") return erro(401, "Acesso pelo portal nao validado.", id);

  if (!(await consumirNonce(id.nonce, service))) {
    return erro(401, "Acesso pelo portal nao validado.", `nonce ja usado: ${id.nonce}`);
  }

  const out = await emitirSessao(id.email, id.nome, service, anon);
  if ("erro" in out) return erro(502, "Nao foi possivel emitir a sessao.", out.erro);

  return new Response(
    JSON.stringify({
      access_token: out.sessao.access_token,
      refresh_token: out.sessao.refresh_token,
      expires_in: out.sessao.expires_in,
      email: id.email,
    }),
    { headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } },
  );
});
