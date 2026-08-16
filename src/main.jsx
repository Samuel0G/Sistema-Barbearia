import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const DEFAULT_SETTINGS = { openingTime: '07:00', closingTime: '19:00', windowMinutes: 60, lunchEnabled: false, lunchStart: '12:00', lunchEnd: '13:00', closedWindows: {}, reopenedLunchWindows: {} };
const BARBERS = ['Barbeiro A', 'Barbeiro B'];
const today = toDateInputValue(new Date());

const DEFAULT_SERVICES = [
  { id: 'corte', name: 'Corte Masculino', price: 'R$ 35', durationMinutes: 40, bufferMinutes: 10 },
  { id: 'barba', name: 'Barba na Navalha', price: 'R$ 30', durationMinutes: 20, bufferMinutes: 10 },
  { id: 'combo', name: 'Corte + Barba', price: 'R$ 60', durationMinutes: 80, bufferMinutes: 10 },
  { id: 'combo-completo', name: 'Corte + Barba + Sobrancelha', price: 'R$ 70', durationMinutes: 100, bufferMinutes: 10 },
  { id: 'sobrancelha', name: 'Sobrancelha', price: 'R$ 15', durationMinutes: 20, bufferMinutes: 10 },
];

const REFRESH_INTERVAL_MS = 20000;

async function apiRequest(url, options) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `Erro ${response.status}`);
  }
  return response.json();
}

function App() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => localStorage.getItem('barber_admin_session') === 'active');
  const [appointments, setAppointments] = useState([]);
  const [services, setServices] = useState(DEFAULT_SERVICES);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (window.location.pathname === '/') {
      window.history.replaceState({}, '', '/agendar');
      setPath('/agendar');
    }
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const fetchState = async () => {
    try {
      const data = await apiRequest('/api/state');
      setAppointments(data.appointments);
      setServices(data.services);
      setSettings(data.settings);
      setLoadError('');
    } catch (error) {
      setLoadError('Nao foi possivel conectar ao banco de dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, REFRESH_INTERVAL_MS);
    window.addEventListener('focus', fetchState);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', fetchState);
    };
  }, []);

  const createAppointment = async (payload) => {
    const normalized = {
      ...payload,
      windowStart: payload.windowStart ?? payload.time,
      time: payload.windowStart ?? payload.time,
      barber: payload.barber ?? BARBERS[0],
      type: payload.type ?? 'agendado',
      origin: payload.origin ?? (payload.type === 'presencial' ? 'presencial' : 'online'),
    };
    const validation = validateWindowReservation(normalized, appointments, settings);
    if (!validation.ok) return validation;

    try {
      const result = await apiRequest('/api/appointments', { method: 'POST', body: JSON.stringify(normalized) });
      if (result.ok) setAppointments((current) => [...current, result.appointment]);
      return result;
    } catch (error) {
      return { ok: false, message: 'Nao foi possivel salvar o agendamento. Tente novamente.' };
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const result = await apiRequest('/api/appointments', { method: 'PATCH', body: JSON.stringify({ id, status }) });
      if (result.ok && result.appointment) {
        setAppointments((current) => current.map((item) => (item.id === id ? result.appointment : item)));
      }
    } catch (error) {
      setLoadError('Nao foi possivel atualizar o status. Tente novamente.');
    }
  };

  const deleteAppointment = async (id) => {
    try {
      await apiRequest(`/api/appointments?id=${id}`, { method: 'DELETE' });
      setAppointments((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      setLoadError('Nao foi possivel excluir. Tente novamente.');
    }
  };

  const changeSettings = async (patch) => {
    setSettings((current) => ({ ...current, ...patch }));
    try {
      const result = await apiRequest('/api/settings', { method: 'PUT', body: JSON.stringify(patch) });
      if (result.ok) setSettings(result.settings);
    } catch (error) {
      setLoadError('Nao foi possivel salvar a configuracao. Tente novamente.');
    }
  };

  const loginAdmin = (username, password) => {
    if (username !== 'admin' || password !== '1234') return false;
    localStorage.setItem('barber_admin_session', 'active');
    setIsAdminLoggedIn(true);
    return true;
  };

  if (loading) {
    return (
      <main className="app-shell">
        <p style={{ padding: '2rem', textAlign: 'center' }}>Carregando...</p>
      </main>
    );
  }

  if (path === '/admin') {
    return (
      <main className="app-shell">
        {isAdminLoggedIn && (
          <header className="topbar">
            {loadError && <span className="feedback error">{loadError}</span>}
            <button className="logout-button" onClick={() => {
              localStorage.removeItem('barber_admin_session');
              setIsAdminLoggedIn(false);
            }} type="button">Sair</button>
          </header>
        )}
        {isAdminLoggedIn ? (
          <BarberDashboard
            appointments={appointments}
            onCreate={createAppointment}
            onDelete={deleteAppointment}
            onSettingsChange={changeSettings}
            onStatusChange={updateStatus}
            services={services}
            settings={settings}
          />
        ) : <AdminLogin onLogin={loginAdmin} />}
      </main>
    );
  }

  return (
    <main className="app-shell client-shell">
      {loadError && <p className="feedback error">{loadError}</p>}
      <BookingPage appointments={appointments} onCreate={createAppointment} services={services} settings={settings} />
    </main>
  );
}

function AdminLogin({ onLogin }) {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  return (
    <section className="login-screen">
      <form className="login-card" onSubmit={(event) => {
        event.preventDefault();
        if (!onLogin(credentials.username.trim(), credentials.password)) setError('Usuario ou senha invalidos.');
      }}>
        <div><span className="eyebrow">Login</span><h1>Entrar no painel</h1></div>
        <label>Usuario<input value={credentials.username} onChange={(event) => setCredentials({ ...credentials, username: event.target.value })} placeholder="admin" /></label>
        <label>Senha<input type="password" value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} placeholder="1234" /></label>
        <button className="primary-button" type="submit">Entrar</button>
        {error && <p className="feedback error">{error}</p>}
      </form>
    </section>
  );
}

function BookingPage({ appointments, onCreate, services, settings }) {
  const [form, setForm] = useState({
    serviceId: services[0]?.id ?? DEFAULT_SERVICES[0].id,
    barber: BARBERS[0],
    date: today,
    windowStart: '',
    customerName: '',
  });
  const [error, setError] = useState('');
  const [confirmedAppointmentId, setConfirmedAppointmentId] = useState('');
  const confirmation = Boolean(confirmedAppointmentId);
  const selectedService = services.find((service) => service.id === form.serviceId) ?? services[0];
  const windows = getWindowAvailability(appointments, form.date, form.barber, settings, false);
  const confirmedAppointment = appointments.find((item) => item.id === confirmedAppointmentId);
  const availabilityInfo = getClientAvailability(windows, form.date, settings);
  const confirmedWindowInfo = confirmedAppointment
    ? getClientWindowInfo(appointments, confirmedAppointment.date, confirmedAppointment.barber, confirmedAppointment.windowStart, settings, confirmedAppointment.id)
    : null;

  useEffect(() => {
    if (!windows.some((window) => window.start === form.windowStart && window.isOpen)) {
      setForm((current) => ({ ...current, windowStart: windows.find((window) => window.isOpen)?.start ?? '' }));
    }
  }, [appointments, form.barber, form.date, settings]);

  const updateField = (field, value) => {
    setError('');
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.customerName.trim() || !form.windowStart) {
      setError('Informe seu nome e escolha uma janela.');
      return;
    }
    const result = await onCreate({
      ...form,
      customerName: form.customerName.trim(),
      service: selectedService.name,
      type: 'agendado',
      origin: 'online',
    });
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setConfirmedAppointmentId(result.appointment.id);
  };

  return (
    <section className="booking-app">
      <div className="booking-header">
        <div><span className="eyebrow">Agendamento online</span><h1>Escolha sua janela</h1><p>Atendimento das {settings.openingTime} as {settings.closingTime}.</p></div>
        <div className="quick-summary"><span>Fila inteligente</span><strong>{selectedService.price}</strong></div>
      </div>
      {confirmedAppointment && confirmedWindowInfo ? (
        <section className="my-appointment">
          <div className="my-appointment-heading"><div><span className="eyebrow">Meu atendimento</span><h2>{confirmedAppointment.customerName}</h2></div><span className={`status ${confirmedAppointment.status}`}>{statusLabel(confirmedAppointment.status)}</span></div>
          <dl>
            <div><dt>Janela</dt><dd>{formatWindow(confirmedAppointment.windowStart, settings)}</dd></div>
            <div><dt>Origem</dt><dd>{originLabel(confirmedAppointment.origin)}</dd></div>
            <div><dt>Status</dt><dd>{statusLabel(confirmedAppointment.status)}</dd></div>
          </dl>
          <ClientQueueInfo info={confirmedWindowInfo} />
          <button onClick={() => { setConfirmedAppointmentId(''); setForm((current) => ({ ...current, customerName: '', windowStart: '' })); }} type="button">Novo agendamento</button>
        </section>
      ) : <ClientAvailability info={availabilityInfo} />}
      <form className={`booking-card ${confirmation ? 'booking-confirmed' : ''}`} onSubmit={submit}>
        <fieldset className="booking-fields" disabled={Boolean(confirmation)}>
        <section className="step-section split">
          <div><h2>Seu nome</h2><input value={form.customerName} onChange={(event) => updateField('customerName', event.target.value)} placeholder="Digite seu nome" /></div>
          <div><h2>Data</h2><input type="date" min={today} value={form.date} onChange={(event) => updateField('date', event.target.value)} /></div>
        </section>
        <section className="step-section">
          <h2>Servico</h2>
          <div className="service-options">
            {services.map((service) => (
              <button className={form.serviceId === service.id ? 'service-option selected' : 'service-option'} key={service.id} onClick={() => updateField('serviceId', service.id)} type="button">
                <strong>{service.name}</strong><span>{service.price}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="step-section">
          <h2>Barbeiro</h2>
          <div className="barber-options">
            {BARBERS.map((barber) => <button className={form.barber === barber ? 'barber-option selected' : 'barber-option'} key={barber} onClick={() => updateField('barber', barber)} type="button">{barber}</button>)}
          </div>
        </section>
        <section className="step-section">
          <h2>Janela de atendimento</h2>
          <div className="window-card-grid">
            {windows.filter((window) => window.isOpen).map((window) => (
              <button className={`window-card ${form.windowStart === window.start ? 'selected' : ''}`} key={window.start} onClick={() => updateField('windowStart', window.start)} type="button">
                <strong>{window.label}</strong>
              </button>
            ))}
          </div>
          {!windows.some((window) => window.isOpen) && <p className="closed-message">Nao ha janelas abertas para esta data e profissional.</p>}
        </section>
        {form.customerName.trim() && form.windowStart && (
          <div className="appointment-summary">
            <span className="summary-label">Resumo</span>
            <dl>
              <div><dt>Servico</dt><dd>{selectedService.name}</dd></div>
              <div><dt>Barbeiro</dt><dd>{form.barber}</dd></div>
              <div><dt>Janela</dt><dd>{formatWindow(form.windowStart, settings)}</dd></div>
            </dl>
            <button className="primary-button" disabled={Boolean(confirmation)} type="submit">Confirmar agendamento</button>
          </div>
        )}
        {error && <p className="feedback error">{error}</p>}
        </fieldset>
      </form>
    </section>
  );
}

function ClientAvailability({ info }) {
  return (
    <section className="client-live-card">
      <div className="client-live-heading">
        <div><span className="eyebrow">Disponibilidade</span><strong>Janelas de atendimento</strong></div>
      </div>
      {info.current && <div className="availability-row"><span>Janela atual</span><strong>{info.current.label}</strong></div>}
      {info.next ? <div className="availability-row"><span>Proxima janela</span><strong>{info.next.label}</strong></div> : <p className="no-availability">Nao ha novas janelas disponiveis hoje.</p>}
    </section>
  );
}

function ClientQueueInfo({ info }) {
  if (!info.position) return null;
  return (
    <div className="queue-position">
      <strong>Voce esta na posicao {info.position} da fila</strong>
      <span>{info.ahead === 1 ? 'Existe 1 cliente na sua frente' : `Existem ${info.ahead} clientes na sua frente`}</span>
    </div>
  );
}

function BarberDashboard({ appointments, onCreate, onDelete, onSettingsChange, onStatusChange, services, settings }) {
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedBarber, setSelectedBarber] = useState(BARBERS[0]);
  const [manual, setManual] = useState({ customerName: '', serviceId: services[0]?.id, barber: BARBERS[0], windowStart: '', type: 'presencial', origin: 'presencial' });
  const [manualError, setManualError] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const windows = getWindowAvailability(appointments, selectedDate, selectedBarber, settings, true);
  const allDayItems = appointments.filter((item) => item.date === selectedDate);
  const dayItems = appointments
    .filter((item) => item.date === selectedDate && (item.barber ?? BARBERS[0]) === selectedBarber)
    .sort(queueSort);
  const activeQueue = dayItems.filter((item) => ['chegou', 'aguardando', 'em_atendimento'].includes(item.status));
  const availableWindows = windows.filter((window) => window.isOpen);
  const openWindowsCount = BARBERS.reduce(
    (total, barber) => total + getWindowAvailability(appointments, selectedDate, barber, settings, true).filter((window) => window.isOpen).length,
    0,
  );
  const nextAvailable = getSuggestedWindow(windows, selectedDate, settings);
  const historyItems = appointments
    .filter((item) => historyQuery.trim() && item.customerName?.toLowerCase().includes(historyQuery.trim().toLowerCase()))
    .sort((a, b) => `${b.date} ${b.windowStart}`.localeCompare(`${a.date} ${a.windowStart}`))
    .slice(0, 8);

  useEffect(() => {
    if (!availableWindows.some((window) => window.start === manual.windowStart)) {
      setManual((current) => ({ ...current, windowStart: nextAvailable?.start ?? availableWindows[0]?.start ?? '' }));
    }
  }, [appointments, selectedBarber, selectedDate, settings]);

  useEffect(() => {
    setManual((current) => ({ ...current, barber: selectedBarber }));
  }, [selectedBarber]);

  const addManual = async (event) => {
    event.preventDefault();
    setManualError('');
    const service = services.find((item) => item.id === manual.serviceId) ?? services[0];
    if (!manual.customerName.trim() || !manual.windowStart) {
      setManualError(nextAvailable ? `Escolha uma janela. Proxima sugestao: ${nextAvailable.label}.` : 'Nao ha janelas abertas.');
      return;
    }
    const result = await onCreate({
      ...manual,
      customerName: manual.customerName.trim(),
      date: selectedDate,
      service: service.name,
    });
    if (!result.ok) {
      setManualError(result.message);
      return;
    }
    setManual((current) => ({ ...current, customerName: '', windowStart: '', origin: 'presencial' }));
  };

  return (
    <section className="agenda-screen">
      <div className="agenda-heading">
        <div><span className="eyebrow">Agenda por janelas</span><h1>{formatDate(selectedDate)}</h1><p>{selectedBarber} · {activeQueue.length} na fila agora</p></div>
        <label>Data<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
        <label>Barbeiro<select value={selectedBarber} onChange={(event) => setSelectedBarber(event.target.value)}>{BARBERS.map((barber) => <option key={barber}>{barber}</option>)}</select></label>
      </div>
      <div className="admin-stats">
        <article><span>Atendimentos do dia</span><strong>{allDayItems.length}</strong></article>
        <article><span>Aguardando</span><strong>{allDayItems.filter((item) => ['chegou', 'aguardando'].includes(item.status)).length}</strong></article>
        <article><span>Em atendimento</span><strong>{allDayItems.filter((item) => item.status === 'em_atendimento').length}</strong></article>
        <article><span>Janelas abertas</span><strong>{openWindowsCount}</strong></article>
        <article><span>Cancelamentos</span><strong>{allDayItems.filter((item) => item.status === 'cancelado').length}</strong></article>
        <article><span>Ausentes</span><strong>{allDayItems.filter((item) => item.status === 'ausente').length}</strong></article>
      </div>
      <div className="agenda-layout">
        <div className="window-list">
          {windows.map((window) => {
            const items = dayItems.filter((item) => item.windowStart === window.start);
            const activeItems = items.filter(isActiveWindowClient);
            const onlineCount = activeItems.filter((item) => item.origin === 'online').length;
            const walkInCount = activeItems.filter((item) => item.origin === 'presencial').length;
            return (
              <section className="queue-window" key={window.start}>
                <header>
                  <div><strong>{window.label}</strong><span className={`window-status ${window.isOpen ? 'open' : 'closed'}`}>{window.isOpen ? 'Aberta' : window.isLunch ? 'Almoco' : 'Fechada'}</span></div>
                  <div className="window-type-counts"><span>{onlineCount} Online</span><span>{walkInCount} Presenciais</span></div>
                  {window.isLunch && !window.isOpen && <span className="lunch-label">Fechada para almoco</span>}
                  <button className="window-toggle" onClick={() => onSettingsChange(toggleWindowStatus(settings, selectedDate, selectedBarber, window.start, window.isLunch))} type="button">
                    {window.isOpen ? 'Fechar janela' : 'Abrir janela'}
                  </button>
                </header>
                <div className="queue-items">
                  {items.length ? items.map((item) => (
                    <article className="timeline-card" key={item.id}>
                      <div className="client-avatar"><span>{item.customerName?.[0] ?? '?'}</span></div>
                      <div className="timeline-info"><h3>{item.customerName}</h3><p>{item.service}</p><small><span className={`origin-badge ${item.origin}`}>{originLabel(item.origin)}</span></small></div>
                      <span className={`status ${item.status}`}>{statusLabel(item.status)}</span>
                      <QueueActions item={item} onDelete={onDelete} onStatusChange={onStatusChange} />
                    </article>
                  )) : <p className="empty-window">Nenhum cliente nesta janela.</p>}
                </div>
              </section>
            );
          })}
        </div>
        <div className="admin-side">
          <details className="admin-drawer" open>
            <summary>Adicionar cliente</summary>
            <form className="manual-booking drawer-content" onSubmit={addManual}>
              <label>Cliente<input value={manual.customerName} onChange={(event) => setManual({ ...manual, customerName: event.target.value })} placeholder="Nome do cliente" /></label>
              <label>Servico<select value={manual.serviceId} onChange={(event) => setManual({ ...manual, serviceId: event.target.value })}>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
              <label>Barbeiro<select value={manual.barber} onChange={(event) => { setSelectedBarber(event.target.value); setManual({ ...manual, barber: event.target.value, windowStart: '' }); }}>{BARBERS.map((barber) => <option key={barber}>{barber}</option>)}</select></label>
              <label>Janela<select value={manual.windowStart} onChange={(event) => setManual({ ...manual, windowStart: event.target.value })}>{availableWindows.length ? availableWindows.map((window) => <option key={window.start} value={window.start}>{window.label}</option>) : <option value="">Sem janelas abertas</option>}</select></label>
              <label>Origem do atendimento<select value={manual.origin} onChange={(event) => setManual({ ...manual, origin: event.target.value })}><option value="presencial">Presencial</option><option value="online">Online</option></select></label>
              <button className="secondary-button" disabled={!availableWindows.length} type="submit">Adicionar encaixe</button>
              {manualError && <p className="feedback error">{manualError}</p>}
            </form>
          </details>
          <details className="admin-drawer">
            <summary>Configuracao da barbearia</summary>
            <section className="manual-booking drawer-content">
              <div className="inline-fields">
                <label>Abertura<input type="time" value={settings.openingTime} onChange={(event) => onSettingsChange({ openingTime: event.target.value })} /></label>
                <label>Fechamento<input type="time" value={settings.closingTime} onChange={(event) => onSettingsChange({ closingTime: event.target.value })} /></label>
              </div>
              <label>Tamanho da janela<select value={settings.windowMinutes} onChange={(event) => onSettingsChange({ windowMinutes: Number(event.target.value) })}><option value="30">30 minutos</option><option value="60">1 hora</option><option value="90">1h30</option><option value="120">2 horas</option></select></label>
              <label className="toggle-field"><input type="checkbox" checked={!settings.lunchEnabled} onChange={(event) => onSettingsChange({ lunchEnabled: !event.target.checked })} />Sem horario de almoco</label>
              {settings.lunchEnabled && <div className="inline-fields">
                <label>Inicio do almoco<input type="time" value={settings.lunchStart} onChange={(event) => onSettingsChange({ lunchStart: event.target.value, reopenedLunchWindows: {} })} /></label>
                <label>Fim do almoco<input type="time" value={settings.lunchEnd} onChange={(event) => onSettingsChange({ lunchEnd: event.target.value, reopenedLunchWindows: {} })} /></label>
              </div>}
              <p className="settings-note">O estado aberto ou fechado e controlado em cada janela da agenda.</p>
            </section>
          </details>
          <details className="admin-drawer">
            <summary>Historico por cliente</summary>
            <section className="manual-booking drawer-content">
              <input value={historyQuery} onChange={(event) => setHistoryQuery(event.target.value)} placeholder="Buscar cliente" />
              <div className="history-list">{historyItems.length ? historyItems.map((item) => <article key={item.id}><strong>{item.customerName}</strong><span>{formatDate(item.date)} · {formatWindow(item.windowStart, settings)} · {item.service}</span><small>{statusLabel(item.status)}</small></article>) : <p>Digite um nome para ver o historico.</p>}</div>
            </section>
          </details>
        </div>
      </div>
    </section>
  );
}

function QueueActions({ item, onDelete, onStatusChange }) {
  return (
    <div className="timeline-actions">
      {item.status === 'agendado' && <button onClick={() => onStatusChange(item.id, 'chegou')} type="button">Check-in</button>}
      {item.status === 'chegou' && <button onClick={() => onStatusChange(item.id, 'aguardando')} type="button">Aguardando</button>}
      {['chegou', 'aguardando'].includes(item.status) && <button onClick={() => onStatusChange(item.id, 'em_atendimento')} type="button">Iniciar</button>}
      {item.status === 'em_atendimento' && <button onClick={() => onStatusChange(item.id, 'finalizado')} type="button">Finalizar</button>}
      {['agendado', 'chegou', 'aguardando'].includes(item.status) && <button onClick={() => onStatusChange(item.id, 'ausente')} type="button">Ausente</button>}
      {!['finalizado', 'cancelado'].includes(item.status) && <button onClick={() => onStatusChange(item.id, 'cancelado')} type="button">Cancelar</button>}
      <button className="delete-button" onClick={() => onDelete(item.id)} type="button">Excluir</button>
    </div>
  );
}

function buildWindows(settings) {
  const windows = [];
  const opening = timeToMinutes(settings.openingTime);
  const closing = timeToMinutes(settings.closingTime);
  for (let minutes = opening; minutes + settings.windowMinutes <= closing; minutes += settings.windowMinutes) {
    windows.push({ start: formatMinutes(minutes), label: `${formatMinutes(minutes)}–${formatMinutes(minutes + settings.windowMinutes)}` });
  }
  return windows;
}

function getWindowAvailability(appointments, date, barber, settings, includePast) {
  return buildWindows(settings).map((window) => {
    const passed = !includePast && isWindowInPast(date, window.start, settings);
    const key = windowKey(date, barber, window.start);
    const isLunch = isLunchWindow(window.start, settings);
    const manuallyReopened = Boolean(settings.reopenedLunchWindows?.[key]);
    const closed = Boolean(settings.closedWindows?.[key]) || (isLunch && !manuallyReopened);
    return { ...window, passed, isLunch, isOpen: !passed && !closed };
  });
}

function validateWindowReservation(item, appointments, settings) {
  if (!buildWindows(settings).some((window) => window.start === item.windowStart)) return { ok: false, message: 'Janela de atendimento invalida.' };
  const key = windowKey(item.date, item.barber, item.windowStart);
  const closedForLunch = isLunchWindow(item.windowStart, settings) && !settings.reopenedLunchWindows?.[key];
  if (settings.closedWindows?.[key] || closedForLunch) return { ok: false, message: 'Essa janela esta fechada. Escolha uma janela aberta.' };
  return { ok: true };
}

function getSuggestedWindow(windows, date, settings) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return windows.find((window) => window.isOpen && (date !== today || timeToMinutes(window.start) + settings.windowMinutes > currentMinutes))
    ?? windows.find((window) => window.isOpen);
}

function isActiveWindowClient(item) {
  return !['cancelado', 'ausente'].includes(item.status);
}

function getClientWindowInfo(appointments, date, barber, windowStart, settings, appointmentId = '') {
  const items = appointments
    .filter((item) => item.date === date && item.barber === barber && item.windowStart === windowStart)
    .filter(isActiveWindowClient);
  const queue = items.filter((item) => ['chegou', 'aguardando', 'em_atendimento'].includes(item.status)).sort(queueSort);
  const queueIndex = appointmentId ? queue.findIndex((item) => item.id === appointmentId) : -1;

  return {
    position: queueIndex >= 0 ? queueIndex + 1 : 0,
    ahead: queueIndex >= 0 ? queueIndex : 0,
  };
}

function getClientAvailability(windows, date, settings) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const current = date === today
    ? windows.find((window) => window.isOpen && timeToMinutes(window.start) <= currentMinutes && timeToMinutes(window.start) + settings.windowMinutes > currentMinutes)
    : null;
  const next = windows.find((window) => window.isOpen && (!current || window.start !== current.start) && (date !== today || timeToMinutes(window.start) > currentMinutes));
  return { current, next };
}

function windowKey(date, barber, start) {
  return `${date}|${barber}|${start}`;
}

function toggleWindowStatus(settings, date, barber, start, isLunch) {
  const key = windowKey(date, barber, start);
  const closedWindows = { ...settings.closedWindows };
  const reopenedLunchWindows = { ...settings.reopenedLunchWindows };
  const currentlyOpen = !closedWindows[key] && (!isLunch || reopenedLunchWindows[key]);

  if (currentlyOpen) {
    closedWindows[key] = true;
    delete reopenedLunchWindows[key];
  } else {
    delete closedWindows[key];
    if (isLunch) reopenedLunchWindows[key] = true;
  }

  return { closedWindows, reopenedLunchWindows };
}

function isLunchWindow(start, settings) {
  if (!settings.lunchEnabled || !settings.lunchStart || !settings.lunchEnd) return false;
  const windowStart = timeToMinutes(start);
  const windowEnd = windowStart + settings.windowMinutes;
  const lunchStart = timeToMinutes(settings.lunchStart);
  const lunchEnd = timeToMinutes(settings.lunchEnd);
  return windowStart < lunchEnd && windowEnd > lunchStart;
}

function queueSort(a, b) {
  const windowOrder = (a.windowStart ?? '').localeCompare(b.windowStart ?? '');
  if (windowOrder) return windowOrder;
  const aQueue = a.checkedInAt ?? a.createdAt ?? '';
  const bQueue = b.checkedInAt ?? b.createdAt ?? '';
  return aQueue.localeCompare(bQueue);
}

function isWindowInPast(date, start, settings) {
  const end = timeToMinutes(start) + settings.windowMinutes;
  const now = new Date();
  return date < today || (date === today && end <= now.getHours() * 60 + now.getMinutes());
}

function formatWindow(start, settings) {
  return `${start} as ${formatMinutes(timeToMinutes(start) + settings.windowMinutes)}`;
}

function statusLabel(status) {
  return {
    agendado: 'Agendado',
    chegou: 'Chegou',
    aguardando: 'Aguardando',
    em_atendimento: 'Em atendimento',
    finalizado: 'Finalizado',
    ausente: 'Ausente',
    cancelado: 'Cancelado',
  }[status] ?? status;
}

function originLabel(origin) {
  return origin === 'presencial' ? 'Presencial' : 'Online';
}

function formatDate(date) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
}

function toDateInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatMinutes(totalMinutes) {
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

function timeToMinutes(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

createRoot(document.getElementById('root')).render(<App />);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
