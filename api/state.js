import { getSql } from './_db.js';
import { DEFAULT_SERVICES, DEFAULT_SETTINGS, mapAppointmentRow, mapServiceRow, mapSettingsRow } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const sql = getSql();
    const [appointmentRows, serviceRows, settingsRows] = await Promise.all([
      sql`SELECT * FROM appointments ORDER BY date, window_start, created_at`,
      sql`SELECT * FROM services ORDER BY id`,
      sql`SELECT * FROM settings WHERE id = 1`,
    ]);

    const appointments = appointmentRows.map(mapAppointmentRow);
    const services = serviceRows.length ? serviceRows.map(mapServiceRow) : DEFAULT_SERVICES;
    const settings = settingsRows[0] ? mapSettingsRow(settingsRows[0]) : DEFAULT_SETTINGS;

    res.status(200).json({ appointments, services, settings });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
