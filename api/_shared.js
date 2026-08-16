export const BARBERS = ['Barbeiro A', 'Barbeiro B'];

export const DEFAULT_SETTINGS = {
  openingTime: '07:00',
  closingTime: '19:00',
  windowMinutes: 60,
  lunchEnabled: false,
  lunchStart: '12:00',
  lunchEnd: '13:00',
  closedWindows: {},
  reopenedLunchWindows: {},
};

export const DEFAULT_SERVICES = [
  { id: 'corte', name: 'Corte Masculino', price: 'R$ 35', durationMinutes: 40, bufferMinutes: 10 },
  { id: 'barba', name: 'Barba na Navalha', price: 'R$ 30', durationMinutes: 20, bufferMinutes: 10 },
  { id: 'combo', name: 'Corte + Barba', price: 'R$ 60', durationMinutes: 80, bufferMinutes: 10 },
  { id: 'combo-completo', name: 'Corte + Barba + Sobrancelha', price: 'R$ 70', durationMinutes: 100, bufferMinutes: 10 },
  { id: 'sobrancelha', name: 'Sobrancelha', price: 'R$ 15', durationMinutes: 20, bufferMinutes: 10 },
];

export function timeToMinutes(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function formatMinutes(totalMinutes) {
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

export function buildWindows(settings) {
  const windows = [];
  const opening = timeToMinutes(settings.openingTime);
  const closing = timeToMinutes(settings.closingTime);
  for (let minutes = opening; minutes + settings.windowMinutes <= closing; minutes += settings.windowMinutes) {
    windows.push({ start: formatMinutes(minutes), label: `${formatMinutes(minutes)}-${formatMinutes(minutes + settings.windowMinutes)}` });
  }
  return windows;
}

export function isLunchWindow(start, settings) {
  if (!settings.lunchEnabled || !settings.lunchStart || !settings.lunchEnd) return false;
  const windowStart = timeToMinutes(start);
  const windowEnd = windowStart + settings.windowMinutes;
  const lunchStart = timeToMinutes(settings.lunchStart);
  const lunchEnd = timeToMinutes(settings.lunchEnd);
  return windowStart < lunchEnd && windowEnd > lunchStart;
}

export function windowKey(date, barber, start) {
  return `${date}|${barber}|${start}`;
}

// O banco pode devolver a coluna DATE como objeto Date ou como string
// "AAAA-MM-DDT00:00:00.000Z". O app compara datas como texto simples
// "AAAA-MM-DD", entao normalizamos aqui para nao quebrar a comparacao.
function normalizeDate(value) {
  if (!value) return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export function mapAppointmentRow(row) {
  return {
    id: row.id,
    customerName: row.customer_name,
    service: row.service,
    serviceId: row.service_id,
    barber: row.barber,
    date: normalizeDate(row.date),
    windowStart: row.window_start,
    time: row.window_start,
    type: row.type,
    origin: row.origin,
    status: row.status,
    createdAt: row.created_at,
    checkedInAt: row.checked_in_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export function mapServiceRow(row) {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    durationMinutes: row.duration_minutes,
    bufferMinutes: row.buffer_minutes,
  };
}

export function mapSettingsRow(row) {
  return {
    openingTime: row.opening_time,
    closingTime: row.closing_time,
    windowMinutes: row.window_minutes,
    lunchEnabled: row.lunch_enabled,
    lunchStart: row.lunch_start,
    lunchEnd: row.lunch_end,
    closedWindows: row.closed_windows ?? {},
    reopenedLunchWindows: row.reopened_lunch_windows ?? {},
  };
}
