import { getSql } from './_db.js';
import { DEFAULT_SETTINGS, mapSettingsRow } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const sql = getSql();
    const rows = await sql`SELECT * FROM settings WHERE id = 1`;
    const current = rows[0] ? mapSettingsRow(rows[0]) : DEFAULT_SETTINGS;
    const patch = req.body ?? {};
    const merged = { ...current, ...patch };

    await sql`
      INSERT INTO settings (id, opening_time, closing_time, window_minutes, lunch_enabled, lunch_start, lunch_end, closed_windows, reopened_lunch_windows)
      VALUES (1, ${merged.openingTime}, ${merged.closingTime}, ${merged.windowMinutes}, ${merged.lunchEnabled}, ${merged.lunchStart}, ${merged.lunchEnd}, ${JSON.stringify(merged.closedWindows)}, ${JSON.stringify(merged.reopenedLunchWindows)})
      ON CONFLICT (id) DO UPDATE SET
        opening_time = EXCLUDED.opening_time,
        closing_time = EXCLUDED.closing_time,
        window_minutes = EXCLUDED.window_minutes,
        lunch_enabled = EXCLUDED.lunch_enabled,
        lunch_start = EXCLUDED.lunch_start,
        lunch_end = EXCLUDED.lunch_end,
        closed_windows = EXCLUDED.closed_windows,
        reopened_lunch_windows = EXCLUDED.reopened_lunch_windows
    `;

    const updatedRows = await sql`SELECT * FROM settings WHERE id = 1`;
    res.status(200).json({ ok: true, settings: mapSettingsRow(updatedRows[0]) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
