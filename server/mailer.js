// Email delivery. Configure SMTP with environment variables (see .env.example):
//   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM
// Without SMTP_HOST the app runs in "preview" mode: the email (with its PDF) is written
// as an .eml file to data/outbox/ instead of being sent, so the flow can be demoed safely.
import nodemailer from 'nodemailer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUTBOX = process.env.MAIL_OUTBOX || join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'outbox');

export const mailConfigured = () => Boolean(process.env.SMTP_HOST);

let transport;
function getTransport() {
  if (transport) return transport;
  transport = mailConfigured()
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true' || Number(process.env.SMTP_PORT) === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      })
    : nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'windows' });
  return transport;
}

/** @returns {Promise<{mode:'smtp'|'preview', file?:string}>} */
export async function sendMail({ to, subject, html, text, attachments, replyTo }) {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || 'HERO Card <no-reply@herocard.local>';
  const info = await getTransport().sendMail({ from, to, subject, html, text, attachments, replyTo });
  if (mailConfigured()) return { mode: 'smtp' };
  mkdirSync(OUTBOX, { recursive: true });
  const file = join(OUTBOX, `${new Date().toISOString().replace(/[:.]/g, '-')}.eml`);
  writeFileSync(file, info.message);
  return { mode: 'preview', file };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function cardEmail(card, lang = 'en') {
  const es = lang === 'es';
  const subject = es
    ? `HERO Card #${card.id} – ${card.status === 'closed' ? 'Intervención cerrada' : 'Resumen'} (${card.card_date})`
    : `HERO Card #${card.id} – ${card.status === 'closed' ? 'Intervention closed' : 'Summary'} (${card.card_date})`;
  const row = (k, v) => `<tr><td style="padding:6px 0;color:#6B7A90;font-size:13px;width:150px">${esc(k)}</td><td style="padding:6px 0;color:#0E1726;font-size:14px;font-weight:600">${esc(v)}</td></tr>`;
  const pill = (n, label, bg, fg) => `<td style="padding:4px"><div style="background:${bg};color:${fg};border-radius:10px;padding:10px 0;text-align:center;font-family:Arial,sans-serif"><div style="font-size:22px;font-weight:800">${n}</div><div style="font-size:12px;font-weight:600">${label}</div></div></td>`;
  const html = `<!doctype html><html><body style="margin:0;background:#F3F5F9;font-family:Segoe UI,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F5F9;padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E3E8EF">
    <tr><td style="background:#0B2545;padding:22px 24px;border-bottom:4px solid #F2620F">
      <div style="color:#fff;font-size:22px;font-weight:800">HERO <span style="color:#F2620F">Card</span> #${card.id}</div>
      <div style="color:#C9D4E5;font-size:13px;margin-top:4px">${es ? 'Tarjeta de observación de seguridad' : 'Safety Observation Card'}</div>
    </td></tr>
    <tr><td style="padding:22px 24px">
      <p style="margin:0 0 14px;color:#3C4A5E;font-size:14px">${es
        ? `Hola ${esc(card.user_name.split(' ')[0])}, tu supervisor revisó y cerró esta tarjeta. Adjuntamos el PDF.`
        : `Hi ${esc(card.user_name.split(' ')[0])}, your supervisor reviewed and closed this card. The PDF is attached.`}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${row(es ? 'Fecha' : 'Date', `${card.card_date} ${card.card_time}`)}
        ${row(es ? 'Ubicación' : 'Location', card.location)}
        ${row(es ? 'Oficio' : 'Craft', card.craft)}
        ${row(es ? 'ID de observador' : 'Observer ID', card.observer_id)}
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0"><tr>
        ${pill(card.count_s, es ? 'Satisfactorio' : 'Satisfactory', '#E5F6EE', '#0B6B41')}
        ${pill(card.count_i, es ? 'Intervención' : 'Intervention', '#FDECEC', '#A51F1F')}
        ${pill(card.count_c, es ? 'Corregido' : 'Corrected', '#E8F0FD', '#1F51A8')}
      </tr></table>
      ${card.review_comment ? `<div style="background:#E8F0FD;border-radius:12px;padding:14px 16px">
        <div style="color:#1F51A8;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">${es ? 'Comentario del supervisor' : 'Supervisor comment'}${card.reviewer_name ? ` · ${esc(card.reviewer_name)}` : ''}</div>
        <div style="color:#0E1726;font-size:14px;margin-top:6px;white-space:pre-wrap">${esc(card.review_comment)}</div></div>` : ''}
    </td></tr>
    <tr><td style="padding:14px 24px;border-top:1px solid #E3E8EF;color:#6B7A90;font-size:12px">HERO Card Digital</td></tr>
  </table></td></tr></table></body></html>`;
  const text = `HERO Card #${card.id}\n${card.card_date} ${card.card_time} · ${card.location}\nS ${card.count_s} · I ${card.count_i} · C ${card.count_c}\n${card.review_comment ? '\n' + card.review_comment + '\n' : ''}`;
  return { subject, html, text };
}
