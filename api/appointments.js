import { randomUUID } from 'crypto';
import { getSql } from './_db.js';
import { DEFAULT_SETTINGS, buildWindows, isLunchWindow, mapAppointmentRow, mapSettingsRow, windowKey } from './_shared.js';

export default async function handler(req, res) {
  const sql = getSql();

  try {
    if (req.method === 'POST') {
      const payload = req.body ?? {};
      const barber = payload.barber ?? 'Barbeiro A';
      const windowStart = payload.windowStart ?? payload.time;
      const date = payload.date;

      if (!payload.customerName?.trim() || !windowStart || !date || !payload.service) {
        res.status(200).json({ ok: false, message: 'Dados incompletos para o agendamento.' });
        return;
      }

      const settingsRows = await sql`SELECT * FROM settings WHERE id = 1`;
      const settings = settingsRows[0] ? mapSettingsRow(settingsRows[0]) : DEFAULT_SETTINGS;

      const windows = buildWindows(settings);
      if (!windows.some((window) => window.start === windowStart)) {
        res.status(200).json({ ok: false, message: 'Janela de atendimento invalida.' });
        return;
      }

      const key = windowKey(date, barber, windowStart);
      const closedForLunch = isLunchWindow(windowStart, settings) && !settings.reopenedLunchWindows?.[key];
      if (settings.closedWindows?.[key] || closedForLunch) {
        res.status(200).json({ ok: false, message: 'Essa janela esta fechada. Escolha uma janela aberta.' });
        return;
      }

      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const type = payload.type ?? 'agendado';
      const origin = payload.origin ?? (type === 'presencial' ? 'presencial' : 'online');

      await sql`
        INSERT INTO appointments (id, customer_name, service, service_id, barber, date, window_start, type, origin, status, created_at)
        VALUES (${id}, ${payload.customerName.trim()}, ${payload.service}, ${payload.serviceId ?? null}, ${barber}, ${date}, ${windowStart}, ${type}, ${origin}, 'agendado', ${createdAt})
      `;

      const rows = await sql`SELECT * FROM appointments WHERE id = ${id}`;
      res.status(200).json({ ok: true, appointment: mapAppointmentRow(rows[0]) });
      return;
    }

    if (req.method === 'PATCH') {
      const { id, status } = req.body ?? {};
      if (!id || !status) {
        res.status(400).json({ error: 'id e status sao obrigatorios.' });
        return;
      }

      const now = new Date().toISOString();
      if (status === 'chegou') {
        await sql`UPDATE appointments SET status = ${status}, checked_in_at = ${now} WHERE id = ${id}`;
      } else if (status === 'em_atendimento') {
        await sql`UPDATE appointments SET status = ${status}, started_at = ${now} WHERE id = ${id}`;
      } else if (status === 'finalizado') {
        await sql`UPDATE appointments SET status = ${status}, finished_at = ${now} WHERE id = ${id}`;
      } else {
        await sql`UPDATE appointments SET status = ${status} WHERE id = ${id}`;
      }

      const rows = await sql`SELECT * FROM appointments WHERE id = ${id}`;
      res.status(200).json({ ok: true, appointment: rows[0] ? mapAppointmentRow(rows[0]) : null });
      return;
    }

    if (req.method === 'DELETE') {
      const { id } = req.query ?? {};
      if (!id) {
        res.status(400).json({ error: 'id e obrigatorio.' });
        return;
      }
      await sql`DELETE FROM appointments WHERE id = ${id}`;
      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader('Allow', 'POST, PATCH, DELETE');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
