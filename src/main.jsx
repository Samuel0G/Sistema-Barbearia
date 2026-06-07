import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const APPOINTMENTS_KEY = 'barber_agenda_appointments';
const SERVICES_KEY = 'barber_agenda_services';
const SERVICES_VERSION_KEY = 'barber_agenda_services_version';
const CURRENT_SERVICES_VERSION = '2';
const BUSINESS_NAME = 'Samuka Barbearia';
const SLOT_STEP_MINUTES = 40;
const today = toDateInputValue(new Date());

const DEFAULT_SERVICES = [
  { id: 'corte', name: 'Corte Masculino', price: 'R$ 35', durationMinutes: 40, bufferMinutes: 10 },
  { id: 'barba', name: 'Barba na Navalha', price: 'R$ 30', durationMinutes: 20, bufferMinutes: 10 },
  { id: 'combo', name: 'Corte + Barba', price: 'R$ 60', durationMinutes: 80, bufferMinutes: 10 },
  { id: 'combo-completo', name: 'Corte + Barba + Sobrancelha', price: 'R$ 70', durationMinutes: 100, bufferMinutes: 10 },
  { id: 'sobrancelha', name: 'Sobrancelha', price: 'R$ 15', durationMinutes: 20, bufferMinutes: 10 },
];

const BARBERS = ['Barbeiro A', 'Barbeiro B'];

function loadAppointments() {
  try {
    return JSON.parse(localStorage.getItem(APPOINTMENTS_KEY)) ?? [];
  } catch {
    return [];
  }
}

function loadServices() {
  try {
    const stored = JSON.parse(localStorage.getItem(SERVICES_KEY));
    if (!Array.isArray(stored) || !stored.length) return DEFAULT_SERVICES;
    const version = localStorage.getItem(SERVICES_VERSION_KEY);
    const merged = DEFAULT_SERVICES.map((service) => ({ ...service, ...stored.find((item) => item.id === service.id) }));
    const migrated = merged.map((service) =>
      version !== CURRENT_SERVICES_VERSION && service.id === 'barba' && service.durationMinutes === 40
        ? { ...service, durationMinutes: 20 }
        : service,
    );

    if (version !== CURRENT_SERVICES_VERSION) {
      localStorage.setItem(SERVICES_KEY, JSON.stringify(migrated));
      localStorage.setItem(SERVICES_VERSION_KEY, CURRENT_SERVICES_VERSION);
    }

    return migrated;
  } catch {
    return DEFAULT_SERVICES;
  }
}

function saveAppointments(appointments) {
  localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(appointments));
}

function saveServices(services) {
  localStorage.setItem(SERVICES_KEY, JSON.stringify(services));
  localStorage.setItem(SERVICES_VERSION_KEY, CURRENT_SERVICES_VERSION);
}

function App() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(
    () => localStorage.getItem('barber_admin_session') === 'active',
  );
  const [appointments, setAppointments] = useState(loadAppointments);
  const [services, setServices] = useState(loadServices);

  useEffect(() => {
    if (window.location.pathname === '/') {
      window.history.replaceState({}, '', '/agendar');
      setPath('/agendar');
    }

    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    saveAppointments(appointments);
  }, [appointments]);

  useEffect(() => {
    saveServices(services);
  }, [services]);

  useEffect(() => {
    const reloadLocalData = () => {
      setAppointments(loadAppointments());
      setServices(loadServices());
    };

    const handleStorageChange = (event) => {
      if (event.key === APPOINTMENTS_KEY || event.key === SERVICES_KEY) {
        reloadLocalData();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', reloadLocalData);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', reloadLocalData);
    };
  }, []);

  const loginAdmin = (username, password) => {
    if (username === 'admin' && password === '1234') {
      localStorage.setItem('barber_admin_session', 'active');
      setIsAdminLoggedIn(true);
      return true;
    }

    return false;
  };

  const logoutAdmin = () => {
    localStorage.removeItem('barber_admin_session');
    setIsAdminLoggedIn(false);
  };

  const createAppointment = (payload) => {
    const normalized = normalizeScheduleItem(payload, services);
    const validation = validateScheduleItem(normalized, appointments, services);

    if (!validation.ok) return validation;

    const appointment = {
      id: crypto.randomUUID(),
      status: normalized.type === 'block' ? 'bloqueado' : 'agendado',
      createdAt: new Date().toISOString(),
      ...normalized,
    };

    setAppointments((current) => [...current, appointment]);
    return { ok: true, appointment };
  };

  const updateStatus = (id, status) => {
    setAppointments((current) =>
      current.map((appointment) =>
        appointment.id === id ? { ...appointment, status } : appointment,
      ),
    );
  };

  const deleteAppointment = (id) => {
    setAppointments((current) => current.filter((appointment) => appointment.id !== id));
  };

  const updateService = (serviceId, patch) => {
    setServices((current) =>
      current.map((service) =>
        service.id === serviceId
          ? {
              ...service,
              ...patch,
            }
          : service,
      ),
    );
  };

  if (path === '/admin') {
    return (
      <main className="app-shell">
        <AppHeader
          action={isAdminLoggedIn ? <button className="ghost-button" onClick={logoutAdmin} type="button">Sair</button> : null}
        />

        {isAdminLoggedIn ? (
          <BarberDashboard
            appointments={appointments}
            onCreate={createAppointment}
            onDelete={deleteAppointment}
            onServiceChange={updateService}
            onStatusChange={updateStatus}
            services={services}
          />
        ) : (
          <AdminLogin onLogin={loginAdmin} />
        )}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <AppHeader />
      <BookingPage appointments={appointments} onCreate={createAppointment} services={services} />
    </main>
  );
}

function AppHeader({ action = null }) {
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">S</div>
        <div>
          <strong>{BUSINESS_NAME}</strong>
        </div>
      </div>
      {action}
    </header>
  );
}

function AdminLogin({ onLogin }) {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [error, setError] = useState('');

  const submitLogin = (event) => {
    event.preventDefault();
    const ok = onLogin(credentials.username.trim(), credentials.password);

    if (!ok) {
      setError('Usuario ou senha invalidos.');
    }
  };

  return (
    <section className="login-screen">
      <form className="login-card" onSubmit={submitLogin}>
        <div>
          <span className="eyebrow">Login</span>
          <h1>Entrar no painel</h1>
        </div>

        <label>
          Usuario
          <input
            value={credentials.username}
            onChange={(event) => {
              setError('');
              setCredentials((current) => ({ ...current, username: event.target.value }));
            }}
            placeholder="admin"
          />
        </label>

        <label>
          Senha
          <input
            type="password"
            value={credentials.password}
            onChange={(event) => {
              setError('');
              setCredentials((current) => ({ ...current, password: event.target.value }));
            }}
            placeholder="1234"
          />
        </label>

        <button className="primary-button" type="submit">Entrar</button>
        {error && <p className="feedback error">{error}</p>}
      </form>
    </section>
  );
}

function BookingPage({ appointments, onCreate, services }) {
  const now = useNowMinute();
  const [form, setForm] = useState({
    serviceId: services[0]?.id ?? DEFAULT_SERVICES[0].id,
    barber: BARBERS[0],
    date: today,
    time: '',
    customerName: '',
  });
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const appointmentConfirmed = Boolean(confirmation);

  const selectedService = services.find((service) => service.id === form.serviceId) ?? services[0];
  const blockMinutes = getServiceBlockMinutes(selectedService);
  const timeUntilAppointment = getTimeUntilAppointment(form.date, form.time, now);
  const selectedTimePassed = isAppointmentInPast(form.date, form.time, now);
  const availableTimes = useMemo(
    () => getAvailableTimes(appointments, form.date, form.barber, blockMinutes, { includePast: false, services }),
    [appointments, blockMinutes, form.date, form.barber],
  );

  useEffect(() => {
    if (!availableTimes.includes(form.time)) {
      setForm((current) => ({ ...current, time: availableTimes[0] ?? '' }));
    }
  }, [availableTimes, form.time]);

  useEffect(() => {
    if (!services.some((service) => service.id === form.serviceId)) {
      setForm((current) => ({ ...current, serviceId: services[0]?.id ?? DEFAULT_SERVICES[0].id }));
    }
  }, [form.serviceId, services]);

  const updateField = (field, value) => {
    setError('');
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitAppointment = (event) => {
    event.preventDefault();

    if (appointmentConfirmed) return;

    if (!form.customerName.trim() || !form.time) {
      setError('Informe seu nome e escolha um horario.');
      return;
    }

    if (isAppointmentInPast(form.date, form.time)) {
      setError('Esse horario ja passou. Escolha outro horario.');
      return;
    }

    const result = onCreate({
      customerName: form.customerName.trim(),
      serviceId: selectedService.id,
      service: selectedService.name,
      barber: form.barber,
      date: form.date,
      time: form.time,
      durationMinutes: selectedService.durationMinutes,
      bufferMinutes: selectedService.bufferMinutes,
      type: 'appointment',
    });

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setConfirmation(
      `${result.appointment.customerName}: ${formatDate(result.appointment.date)} as ${result.appointment.time} com ${result.appointment.barber}. ${getTimeUntilAppointment(result.appointment.date, result.appointment.time)}`,
    );
  };

  const startNewAppointment = () => {
    setConfirmation('');
    setError('');
    setForm((current) => ({ ...current, time: '', customerName: '' }));
  };

  return (
    <section className="booking-app">
      <div className="booking-header">
        <div>
          <span className="eyebrow">Agendamento online</span>
          <h1>Marque seu horario</h1>
          <p>{getBusinessLabel(form.date)}</p>
        </div>
        <div className="quick-summary">
          <span>{blockMinutes} min reservados</span>
          <strong>{selectedService.price}</strong>
        </div>
      </div>

      <form className="booking-card" onSubmit={submitAppointment}>
        <section className="step-section">
          <h2>Servico</h2>
          <div className="service-options">
            {services.map((service) => (
              <button
                className={form.serviceId === service.id ? 'service-option selected' : 'service-option'}
                key={service.id}
                onClick={() => updateField('serviceId', service.id)}
                type="button"
              >
                <strong>{service.name}</strong>
                <span>{service.price} - {service.durationMinutes} min + {service.bufferMinutes} min</span>
              </button>
            ))}
          </div>
        </section>

        <section className="step-section">
          <h2>Barbeiro</h2>
          <div className="barber-options">
            {BARBERS.map((barber) => (
              <button
                className={form.barber === barber ? 'barber-option selected' : 'barber-option'}
                key={barber}
                onClick={() => updateField('barber', barber)}
                type="button"
              >
                {barber}
              </button>
            ))}
          </div>
        </section>

        <section className="step-section split">
          <div>
            <h2>Data</h2>
            <input
              type="date"
              min={today}
              value={form.date}
              onChange={(event) => updateField('date', event.target.value)}
            />
          </div>

          <div>
            <h2>Horario</h2>
            <div className="time-chip-grid">
              {availableTimes.length ? (
                availableTimes.map((time) => (
                  <button
                    className={form.time === time ? 'time-chip selected' : 'time-chip'}
                    key={time}
                    onClick={() => updateField('time', time)}
                    type="button"
                  >
                    {time}
                  </button>
                ))
              ) : (
                <p className="closed-message">Sem horarios disponiveis.</p>
              )}
            </div>
          </div>
        </section>

        <section className="step-section">
          <h2>Nome</h2>
          <input
            value={form.customerName}
            onChange={(event) => updateField('customerName', event.target.value)}
            placeholder="Digite seu nome"
          />
        </section>

        <div className="appointment-summary">
          <span className="summary-label">Resumo</span>
          <dl>
            <div>
              <dt>Servico</dt>
              <dd>{selectedService.name}</dd>
            </div>
            <div>
              <dt>Barbeiro</dt>
              <dd>{form.barber}</dd>
            </div>
            <div>
              <dt>Data</dt>
              <dd>{formatDate(form.date)}</dd>
            </div>
            <div>
              <dt>Horario</dt>
              <dd>{form.time || 'Selecione'}</dd>
            </div>
            <div>
              <dt>Reserva</dt>
              <dd>{blockMinutes} min</dd>
            </div>
          </dl>
          {form.time && <p className="time-until">{timeUntilAppointment}</p>}
          <button
            className="primary-button"
            disabled={!availableTimes.length || selectedTimePassed || appointmentConfirmed}
            type="submit"
          >
            Confirmar
          </button>
        </div>

        {error && <p className="feedback error">{error}</p>}
        {confirmation && (
          <div className="feedback success confirmation-box">
            <p>{confirmation}</p>
            <button onClick={startNewAppointment} type="button">Novo agendamento</button>
          </div>
        )}
      </form>
    </section>
  );
}

function BarberDashboard({ appointments, onCreate, onDelete, onServiceChange, onStatusChange, services }) {
  const now = useNowMinute();
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedBarber, setSelectedBarber] = useState(BARBERS[0]);
  const [manual, setManual] = useState({
    customerName: '',
    serviceId: services[0]?.id ?? DEFAULT_SERVICES[0].id,
    barber: BARBERS[0],
    time: '',
    durationMinutes: services[0]?.durationMinutes ?? 40,
    bufferMinutes: services[0]?.bufferMinutes ?? 10,
  });
  const [block, setBlock] = useState({
    time: '',
    durationMinutes: 40,
    reason: 'Bloqueio manual',
  });
  const [manualError, setManualError] = useState('');
  const [blockError, setBlockError] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');

  const manualBlockMinutes = Number(manual.durationMinutes) + Number(manual.bufferMinutes);
  const dayAppointments = useMemo(
    () =>
      appointments
        .filter(
          (appointment) =>
            appointment.date === selectedDate &&
            (appointment.barber ?? BARBERS[0]) === selectedBarber,
        )
        .sort((a, b) => a.time.localeCompare(b.time)),
    [appointments, selectedDate, selectedBarber],
  );

  const availableTimes = useMemo(
    () => getAvailableTimes(appointments, selectedDate, selectedBarber, manualBlockMinutes, { includePast: true, services }),
    [appointments, manualBlockMinutes, selectedDate, selectedBarber],
  );

  const availableBlockTimes = useMemo(
    () => getAvailableTimes(appointments, selectedDate, selectedBarber, Number(block.durationMinutes), { includePast: true, services }),
    [appointments, block.durationMinutes, selectedDate, selectedBarber],
  );

  const completedCount = dayAppointments.filter(
    (appointment) => appointment.status === 'concluido',
  ).length;

  const historyItems = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    if (!query) return [];

    return appointments
      .filter((appointment) => appointment.type !== 'block')
      .filter((appointment) => appointment.customerName?.toLowerCase().includes(query))
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
      .slice(0, 8);
  }, [appointments, historyQuery]);

  useEffect(() => {
    setManual((current) => ({ ...current, barber: selectedBarber }));
  }, [selectedBarber]);

  useEffect(() => {
    const service = services.find((item) => item.id === manual.serviceId) ?? services[0];
    if (!service) return;

    setManual((current) => ({
      ...current,
      durationMinutes: service.durationMinutes,
      bufferMinutes: service.bufferMinutes,
    }));
  }, [manual.serviceId, services]);

  useEffect(() => {
    if (!availableTimes.includes(manual.time)) {
      setManual((current) => ({ ...current, time: availableTimes[0] ?? '' }));
    }
  }, [availableTimes, manual.time]);

  useEffect(() => {
    if (!availableBlockTimes.includes(block.time)) {
      setBlock((current) => ({ ...current, time: availableBlockTimes[0] ?? '' }));
    }
  }, [availableBlockTimes, block.time]);

  const addManualAppointment = (event) => {
    event.preventDefault();
    setManualError('');

    const service = services.find((item) => item.id === manual.serviceId) ?? services[0];

    if (!manual.customerName.trim() || !manual.time) {
      setManualError('Informe nome e um horario livre.');
      return;
    }

    const result = onCreate({
      customerName: manual.customerName.trim(),
      serviceId: service.id,
      service: service.name,
      barber: manual.barber,
      date: selectedDate,
      time: manual.time,
      durationMinutes: Number(manual.durationMinutes),
      bufferMinutes: Number(manual.bufferMinutes),
      type: 'appointment',
    });

    if (!result.ok) {
      setManualError(result.message);
      return;
    }

    setManual((current) => ({ ...current, customerName: '', time: '' }));
  };

  const addManualBlock = (event) => {
    event.preventDefault();
    setBlockError('');

    if (!block.time || Number(block.durationMinutes) <= 0) {
      setBlockError('Informe um horario e uma duracao valida.');
      return;
    }

    const result = onCreate({
      customerName: block.reason.trim() || 'Bloqueio manual',
      serviceId: 'block',
      service: block.reason.trim() || 'Bloqueio manual',
      barber: selectedBarber,
      date: selectedDate,
      time: block.time,
      durationMinutes: Number(block.durationMinutes),
      bufferMinutes: 0,
      type: 'block',
    });

    if (!result.ok) {
      setBlockError(result.message);
      return;
    }

    setBlock((current) => ({ ...current, time: '', reason: 'Bloqueio manual' }));
  };

  return (
    <section className="agenda-screen">
      <div className="agenda-heading">
        <div>
          <span className="eyebrow">Agenda do barbeiro</span>
          <h1>{formatDate(selectedDate)}</h1>
          <p>{selectedBarber} - {dayAppointments.length} itens na agenda</p>
        </div>
        <label>
          Data
          <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        </label>
        <label>
          Barbeiro
          <select value={selectedBarber} onChange={(event) => setSelectedBarber(event.target.value)}>
            {BARBERS.map((barber) => (
              <option key={barber}>{barber}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="admin-stats">
        <article>
          <span>Agendamentos do dia</span>
          <strong>{dayAppointments.filter((item) => item.type !== 'block').length}</strong>
        </article>
        <article>
          <span>Horarios livres</span>
          <strong>{availableTimes.length}</strong>
        </article>
        <article>
          <span>Concluidos</span>
          <strong>{completedCount}</strong>
        </article>
      </div>

      <ServiceSettings services={services} onServiceChange={onServiceChange} />

      <div className="agenda-layout">
        <div className="timeline">
          {dayAppointments.length ? (
            dayAppointments.map((appointment) => (
              <article className={appointment.type === 'block' ? 'timeline-card blocked-card' : 'timeline-card'} key={appointment.id}>
                <div className="client-avatar">
                  <span>{appointment.type === 'block' ? 'B' : appointment.customerName[0]}</span>
                </div>
                <div className="timeline-info">
                  <span className="time-label">
                    {appointment.time} - {minutesToTime(timeToMinutes(appointment.time) + getAppointmentBlockMinutes(appointment, services))}
                  </span>
                  <h3>{appointment.customerName}</h3>
                  <p>{appointment.service} - {appointment.barber ?? BARBERS[0]}</p>
                  <small>{appointment.type === 'block' ? `${appointment.durationMinutes} min bloqueados` : getTimeUntilAppointment(appointment.date, appointment.time, now)}</small>
                </div>
                <span className={`status ${appointment.status}`}>{statusLabel(appointment.status)}</span>
                <div className="timeline-actions">
                  {appointment.type !== 'block' && (
                    <>
                      <button onClick={() => onStatusChange(appointment.id, 'concluido')} type="button">
                        Concluir
                      </button>
                      <button onClick={() => onStatusChange(appointment.id, 'cancelado')} type="button">
                        Cancelar
                      </button>
                    </>
                  )}
                  <button
                    className="delete-button"
                    onClick={() => onDelete(appointment.id)}
                    title="Excluir agendamento"
                    type="button"
                  >
                    Excluir
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-agenda">
              <h2>Nenhum horario reservado</h2>
              <p>A agenda esta livre para novos atendimentos.</p>
            </div>
          )}
        </div>

        <div className="admin-side">
          <form className="manual-booking" onSubmit={addManualAppointment}>
            <h2>Adicionar horario</h2>

            <label>
              Cliente
              <input
                value={manual.customerName}
                onChange={(event) => setManual((current) => ({ ...current, customerName: event.target.value }))}
                placeholder="Nome do cliente"
              />
            </label>

            <label>
              Servico
              <select
                value={manual.serviceId}
                onChange={(event) => setManual((current) => ({ ...current, serviceId: event.target.value }))}
              >
                {services.map((service) => (
                  <option key={service.id} value={service.id}>{service.name}</option>
                ))}
              </select>
            </label>

            <label>
              Barbeiro
              <select
                value={manual.barber}
                onChange={(event) => {
                  setSelectedBarber(event.target.value);
                  setManual((current) => ({ ...current, barber: event.target.value }));
                }}
              >
                {BARBERS.map((barber) => (
                  <option key={barber}>{barber}</option>
                ))}
              </select>
            </label>

            <div className="inline-fields">
              <label>
                Duracao
                <input
                  min="1"
                  type="number"
                  value={manual.durationMinutes}
                  onChange={(event) => setManual((current) => ({ ...current, durationMinutes: event.target.value }))}
                />
              </label>
              <label>
                Margem
                <input
                  min="0"
                  type="number"
                  value={manual.bufferMinutes}
                  onChange={(event) => setManual((current) => ({ ...current, bufferMinutes: event.target.value }))}
                />
              </label>
            </div>

            <label>
              Horario
              <select
                value={manual.time}
                onChange={(event) => setManual((current) => ({ ...current, time: event.target.value }))}
              >
                {availableTimes.length ? (
                  availableTimes.map((availableTime) => <option key={availableTime}>{availableTime}</option>)
                ) : (
                  <option value="">Sem horarios</option>
                )}
              </select>
            </label>

            <button className="secondary-button" disabled={!availableTimes.length} type="submit">
              Adicionar manualmente
            </button>

            {manualError && <p className="feedback error">{manualError}</p>}
          </form>

          <form className="manual-booking" onSubmit={addManualBlock}>
            <h2>Bloquear horario</h2>

            <label>
              Motivo
              <input
                value={block.reason}
                onChange={(event) => setBlock((current) => ({ ...current, reason: event.target.value }))}
                placeholder="Almoco, manutencao..."
              />
            </label>

            <div className="inline-fields">
              <label>
                Horario
                <select
                  value={block.time}
                  onChange={(event) => setBlock((current) => ({ ...current, time: event.target.value }))}
                >
                  {availableBlockTimes.length ? (
                    availableBlockTimes.map((availableTime) => <option key={availableTime}>{availableTime}</option>)
                  ) : (
                    <option value="">Sem horarios</option>
                  )}
                </select>
              </label>
              <label>
                Minutos
                <input
                  min="1"
                  type="number"
                  value={block.durationMinutes}
                  onChange={(event) => setBlock((current) => ({ ...current, durationMinutes: event.target.value }))}
                />
              </label>
            </div>

            <button className="secondary-button" disabled={!availableBlockTimes.length} type="submit">
              Bloquear
            </button>

            {blockError && <p className="feedback error">{blockError}</p>}
          </form>

          <section className="manual-booking">
            <h2>Historico por cliente</h2>
            <input
              value={historyQuery}
              onChange={(event) => setHistoryQuery(event.target.value)}
              placeholder="Buscar cliente"
            />
            <div className="history-list">
              {historyItems.length ? (
                historyItems.map((item) => (
                  <article key={item.id}>
                    <strong>{item.customerName}</strong>
                    <span>{formatDate(item.date)} - {item.time} - {item.service}</span>
                    <small>{statusLabel(item.status)}</small>
                  </article>
                ))
              ) : (
                <p>Digite um nome para ver o historico.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function ServiceSettings({ services, onServiceChange }) {
  return (
    <section className="service-settings">
      <div>
        <span className="eyebrow">Servicos</span>
        <h2>Duracao e margem</h2>
      </div>
      <div className="service-settings-grid">
        {services.map((service) => (
          <article key={service.id}>
            <strong>{service.name}</strong>
            <span>{service.price}</span>
            <div className="inline-fields">
              <label>
                Duracao
                <input
                  min="1"
                  type="number"
                  value={service.durationMinutes}
                  onChange={(event) => onServiceChange(service.id, { durationMinutes: Number(event.target.value) })}
                />
              </label>
              <label>
                Margem
                <input
                  min="0"
                  type="number"
                  value={service.bufferMinutes}
                  onChange={(event) => onServiceChange(service.id, { bufferMinutes: Number(event.target.value) })}
                />
              </label>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function getAvailableTimes(appointments, date, barber = BARBERS[0], durationMinutes = SLOT_STEP_MINUTES, options = {}) {
  return getBusinessTimes(date).filter((time) => {
    if (!options.includePast && isAppointmentInPast(date, time)) return false;
    if (timeToMinutes(time) + Number(durationMinutes) > getBusinessCloseMinutes(date)) return false;
    return !hasScheduleConflict(
      appointments,
      {
        date,
        time,
        barber,
        durationMinutes,
        bufferMinutes: 0,
      },
      options.services ?? DEFAULT_SERVICES,
    );
  });
}

function validateScheduleItem(item, appointments, services) {
  const businessTimes = getBusinessTimes(item.date);
  if (!businessTimes.length || !businessTimes.includes(item.time)) {
    return { ok: false, message: 'A barbearia nao atende nesse dia ou horario.' };
  }

  const start = timeToMinutes(item.time);
  const end = start + getAppointmentBlockMinutes(item, services);
  const businessEnd = getBusinessCloseMinutes(item.date);

  if (end > businessEnd) {
    return { ok: false, message: 'Esse horario nao comporta a duracao do atendimento.' };
  }

  if (hasScheduleConflict(appointments, item, services)) {
    return { ok: false, message: 'Esse horario conflita com outro item da agenda.' };
  }

  return { ok: true };
}

function hasScheduleConflict(appointments, candidate, services) {
  const candidateStart = timeToMinutes(candidate.time);
  const candidateEnd = candidateStart + getAppointmentBlockMinutes(candidate, services);

  return appointments.some((appointment) => {
    if (appointment.date !== candidate.date) return false;
    if ((appointment.barber ?? BARBERS[0]) !== candidate.barber) return false;
    if (appointment.status === 'cancelado') return false;
    if (candidate.id && appointment.id === candidate.id) return false;

    const appointmentStart = timeToMinutes(appointment.time);
    const appointmentEnd = appointmentStart + getAppointmentBlockMinutes(appointment, services);
    return candidateStart < appointmentEnd && candidateEnd > appointmentStart;
  });
}

function normalizeScheduleItem(payload, services) {
  const service = services.find((item) => item.id === payload.serviceId || item.name === payload.service);
  const durationMinutes = Number(payload.durationMinutes ?? service?.durationMinutes ?? SLOT_STEP_MINUTES);
  const bufferMinutes = Number(payload.bufferMinutes ?? service?.bufferMinutes ?? 0);

  return {
    type: payload.type ?? 'appointment',
    customerName: payload.customerName,
    serviceId: payload.serviceId ?? service?.id ?? 'custom',
    service: payload.service ?? service?.name ?? 'Atendimento',
    barber: payload.barber ?? BARBERS[0],
    date: payload.date,
    time: payload.time,
    durationMinutes,
    bufferMinutes,
  };
}

function getServiceBlockMinutes(service) {
  return Number(service?.durationMinutes ?? SLOT_STEP_MINUTES) + Number(service?.bufferMinutes ?? 0);
}

function getAppointmentBlockMinutes(appointment, services) {
  if (appointment.type === 'block') return Number(appointment.durationMinutes ?? SLOT_STEP_MINUTES);
  if (appointment.durationMinutes != null) {
    return Number(appointment.durationMinutes) + Number(appointment.bufferMinutes ?? 0);
  }

  const service = services.find((item) => item.id === appointment.serviceId || item.name === appointment.service);
  return getServiceBlockMinutes(service);
}

function useNowMinute() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  return now;
}

function getTimeUntilAppointment(date, time, now = new Date()) {
  if (!date || !time) return '';

  const appointmentDate = new Date(`${date}T${time}:00`);
  const differenceInMinutes = Math.floor((appointmentDate.getTime() - now.getTime()) / 60000);

  if (differenceInMinutes < 0) return 'Esse horario ja passou.';
  if (differenceInMinutes === 0) return 'Seu horario e agora.';

  const days = Math.floor(differenceInMinutes / 1440);
  const hours = Math.floor((differenceInMinutes % 1440) / 60);
  const minutes = differenceInMinutes % 60;

  if (days > 0) {
    const dayText = days === 1 ? 'Falta 1 dia' : `Faltam ${days} dias`;
    const hourText = hours > 0 ? ` e ${hours}h` : '';
    return `${dayText}${hourText} para o seu horario.`;
  }

  if (hours > 0) {
    const minuteText = minutes > 0 ? ` ${minutes}min` : '';
    return `Faltam ${hours}h${minuteText} para o seu horario.`;
  }

  return `Faltam ${minutes}min para o seu horario.`;
}

function isAppointmentInPast(date, time, now = new Date()) {
  if (!date || !time) return false;
  return new Date(`${date}T${time}:00`).getTime() < now.getTime();
}

function getBusinessTimes(date) {
  const weekday = new Date(`${date}T12:00:00`).getDay();

  if (weekday === 0) return [];
  if (weekday === 6) return buildTimes(7, 0, 18, 0);
  return buildTimes(7, 30, 19, 0);
}

function getBusinessCloseMinutes(date) {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  if (weekday === 6) return 18 * 60;
  return 19 * 60;
}

function buildTimes(startHour, startMinute, endHour, endMinute) {
  const times = [];
  const opening = startHour * 60 + startMinute;
  const closing = endHour * 60 + endMinute;

  for (let minutes = opening; minutes + SLOT_STEP_MINUTES <= closing; minutes += SLOT_STEP_MINUTES) {
    times.push(formatMinutes(minutes));
  }

  return times;
}

function getBusinessLabel(date) {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  if (weekday === 0) return 'Domingo fechado.';
  if (weekday === 6) return 'Sabado, 07:00 as 18:00.';
  return 'Segunda a sexta, 07:30 as 19:00.';
}

function formatDate(date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMinutes(totalMinutes) {
  const hour = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function timeToMinutes(time) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

function minutesToTime(totalMinutes) {
  return formatMinutes(totalMinutes);
}

function statusLabel(status) {
  const labels = {
    agendado: 'Agendado',
    bloqueado: 'Bloqueado',
    concluido: 'Concluido',
    cancelado: 'Cancelado',
  };

  return labels[status] ?? status;
}

createRoot(document.getElementById('root')).render(<App />);
