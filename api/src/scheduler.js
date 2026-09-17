// Agendador embutido no próprio processo da API — substitui o cron/systemd
// timer externo que a Etapa 2 do plano previa originalmente. Pedido
// explícito do usuário (17/09/2026): "preciso que seja automático, só
// fazer o deploy e já está funcionando" — sem depender de alguém
// configurar cron manualmente no servidor depois do deploy.
//
// Mesmos horários que o n8n já usava pra esses 2 domínios (ver
// n8n/rmi-suprimentos.README.md e mapa-compras-suprimentos.README.md):
// Mapa de Compras 07:30, RMI 08:00 — mantém a ordem (evita as 2 rodando
// ao mesmo tempo e disputando a mesma API de origem/pool de conexão).
//
// `timezone` explícito (não confia no fuso do SO do servidor) — os
// horários combinados são horário de Brasília.
import cron from 'node-cron';
import { sincronizarRmi } from '../scripts/sync-rmi.js';
import { sincronizarMapaCompras } from '../scripts/sync-mapa-compras.js';

const TIMEZONE = 'America/Sao_Paulo';

async function rodarComLog(nome, fn) {
  console.log(`[agendador] iniciando ${nome} (${new Date().toISOString()})`);
  try {
    await fn();
    console.log(`[agendador] ${nome} concluído (${new Date().toISOString()})`);
  } catch (err) {
    // Nunca deixa uma falha de sincronização derrubar o processo da API —
    // é só mais um dia sem atualização pra esse domínio, resolve sozinho
    // no próximo agendamento (decisão do usuário, ver docs/16: aceitar
    // falha parcial em vez de insistir).
    console.error(`[agendador] ${nome} falhou`, err);
  }
}

export function iniciarAgendador() {
  cron.schedule('30 7 * * *', () => rodarComLog('sync-mapa-compras', () => sincronizarMapaCompras()), { timezone: TIMEZONE });
  cron.schedule('0 8 * * *', () => rodarComLog('sync-rmi', () => sincronizarRmi()), { timezone: TIMEZONE });
  console.log(`[agendador] ativo (${TIMEZONE}): Mapa de Compras 07:30, RMI 08:00`);
}
