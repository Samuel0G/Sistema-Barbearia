import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const STORAGE_KEY = 'barber_agenda_appointments';
const BUSINESS_NAME = 'Samuka Barbearia';
const APPOINTMENT_DURATION_MINUTES = 40;
const today = toDateInputValue(new Date());

const SERVICES = [
  { id: 'corte', name: 'Corte Masculino', price: 'R$ 35', duration: '40 min' },
  { id: 'barba', name: 'Barba na Navalha', price: 'R$ 30', duration: '40 min' },
  { id: 'combo', name: 'Corte + Barba', price: 'R$ 60', duration: '80 min' },
  { id: 'combo-completo', name: 'Corte + Barba + Sobrancelha', price: 'R$ 70', duration: '100 min' },
  { id: 'sobrancelha', name: 'Sobrancelha', price: 'R$ 15', duration: '20 min' },
];
const BARBERS = ['Barbeiro A', 'Barbeiro B'];

function loadAppointments() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

function saveAppointments(appointments) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments));
}

function App() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(
    () => localStorage.getItem('barber_admin_session') === 'active',
  );
  const [appointments, setAppointments] = useState(loadAppointments);

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
    const reloadAppointments = () => {
      setAppointments(loadAppointments());
    };

    const handleStorageChange = (event) => {
      if (event.key === STORAGE_KEY) {
        reloadAppointments();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', reloadAppointments);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', reloadAppointments);
    };
  }, []);

  const navigate = (nextPath) => {
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
  };

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
    const times = getBusinessTimes(payload.date);

    if (!times.length || !times.includes(payload.time)) {
      return { ok: false, message: 'A barbearia nao atende nesse dia ou horario.' };
    }

    const hasConflict = appointments.some(
      (appointment) =>
        appointment.date === payload.date &&
        appointment.time === payload.time &&
        appointment.barber === payload.barber &&
        appointment.status !== 'cancelado',
    );

    if (hasConflict) {
      return { ok: false, message: 'Esse barbeiro ja possui agendamento nesse horario.' };
    }

    const appointment = {
      id: crypto.randomUUID(),
      status: 'agendado',
      createdAt: new Date().toISOString(),
      ...payload,
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
          onStatusChange={updateStatus}
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
      <BookingPage appointments={appointments} onCreate={createAppointment} />
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

function BookingPage({ appointments, onCreate }) {
  const now = useNowMinute();
  const [form, setForm] = useState({
    service: SERVICES[0].name,
    barber: BARBERS[0],
    date: today,
    time: '',
    customerName: '',
  });
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const appointmentConfirmed = Boolean(confirmation);

  const selectedService = SERVICES.find((service) => service.name === form.service) ?? SERVICES[0];
  const timeUntilAppointment = getTimeUntilAppointment(form.date, form.time, now);
  const selectedTimePassed = isAppointmentInPast(form.date, form.time, now);
  const availableTimes = useMemo(
    () => getAvailableTimes(appointments, form.date, form.barber),
    [appointments, form.date, form.barber],
  );

  useEffect(() => {
    if (!availableTimes.includes(form.time)) {
      setForm((current) => ({ ...current, time: availableTimes[0] ?? '' }));
    }
  }, [availableTimes, form.time]);

  const updateField = (field, value) => {
    setError('');
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitAppointment = (event) => {
    event.preventDefault();

    if (appointmentConfirmed) {
      return;
    }

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
      service: form.service,
      barber: form.barber,
      date: form.date,
      time: form.time,
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
          <span>{selectedService.duration}</span>
          <strong>{selectedService.price}</strong>
        </div>
      </div>

      <form className="booking-card" onSubmit={submitAppointment}>
        <section className="step-section">
          <h2>Servico</h2>
          <div className="service-options">
            {SERVICES.map((service) => (
              <button
                className={form.service === service.name ? 'service-option selected' : 'service-option'}
                key={service.id}
                onClick={() => updateField('service', service.name)}
                type="button"
              >
                <strong>{service.name}</strong>
                <span>{service.price} • {service.duration}</span>
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
              <dd>{form.service}</dd>
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

function BarberDashboard({ appointments, onCreate, onDelete, onStatusChange }) {
  const now = useNowMinute();
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedBarber, setSelectedBarber] = useState(BARBERS[0]);
  const [manual, setManual] = useState({
    customerName: '',
    service: SERVICES[0].name,
    barber: BARBERS[0],
    time: '',
  });
  const [manualError, setManualError] = useState('');

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
    () => getAvailableTimes(appointments, selectedDate, selectedBarber),
    [appointments, selectedDate, selectedBarber],
  );

  const completedCount = dayAppointments.filter(
    (appointment) => appointment.status === 'concluido',
  ).length;

  useEffect(() => {
    setManual((current) => ({ ...current, barber: selectedBarber }));
  }, [selectedBarber]);

  useEffect(() => {
    if (!availableTimes.includes(manual.time)) {
      setManual((current) => ({ ...current, time: availableTimes[0] ?? '' }));
    }
  }, [availableTimes, manual.time]);

  const addManualAppointment = (event) => {
    event.preventDefault();
    setManualError('');

    if (!manual.customerName.trim() || !manual.time) {
      setManualError('Informe nome e um horario livre.');
      return;
    }

    const result = onCreate({
      customerName: manual.customerName.trim(),
      service: manual.service,
      barber: manual.barber,
      date: selectedDate,
      time: manual.time,
    });

    if (!result.ok) {
      setManualError(result.message);
      return;
    }

    setManual({
      customerName: '',
      service: SERVICES[0].name,
      barber: selectedBarber,
      time: '',
    });
  };

  return (
    <section className="agenda-screen">
      <div className="agenda-heading">
        <div>
          <span className="eyebrow">Agenda do barbeiro</span>
          <h1>{formatDate(selectedDate)}</h1>
          <p>{dayAppointments.length} agendamentos • {availableTimes.length} horarios livres</p>
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
          <strong>{dayAppointments.length}</strong>
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

      <div className="agenda-layout">
        <div className="timeline">
          {dayAppointments.length ? (
            dayAppointments.map((appointment) => (
              <article className="timeline-card" key={appointment.id}>
                <div className="client-avatar">
                  <span>{appointment.customerName[0]}</span>
                </div>
                <div className="timeline-info">
                  <span className="time-label">{appointment.time}</span>
                  <h3>{appointment.customerName}</h3>
                  <p>{appointment.service} • {appointment.barber ?? 'Barbeiro A'}</p>
                  <small>{getTimeUntilAppointment(appointment.date, appointment.time, now)}</small>
                </div>
                <span className={`status ${appointment.status}`}>{statusLabel(appointment.status)}</span>
                <div className="timeline-actions">
                  <button onClick={() => onStatusChange(appointment.id, 'concluido')} type="button">
                    Concluir
                  </button>
                  <button onClick={() => onStatusChange(appointment.id, 'cancelado')} type="button">
                    Cancelar
                  </button>
                  <button
                    className="delete-button"
                    onClick={() => onDelete(appointment.id)}
                    title="Excluir agendamento"
                    type="button"
                  >
                    🗑
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
              value={manual.service}
              onChange={(event) => setManual((current) => ({ ...current, service: event.target.value }))}
            >
              {SERVICES.map((service) => (
                <option key={service.id}>{service.name}</option>
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
      </div>
    </section>
  );
}

function getAvailableTimes(appointments, date, barber = BARBERS[0]) {
  const occupied = new Set(
    appointments
      .filter(
        (appointment) =>
          appointment.date === date &&
          (appointment.barber ?? BARBERS[0]) === barber &&
          appointment.status !== 'cancelado',
      )
      .map((appointment) => appointment.time),
  );

  return getBusinessTimes(date).filter((time) => !occupied.has(time));
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

  if (differenceInMinutes < 0) {
    return 'Esse horario ja passou.';
  }

  if (differenceInMinutes === 0) {
    return 'Seu horario e agora.';
  }

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

  const appointmentDate = new Date(`${date}T${time}:00`);
  return appointmentDate.getTime() < now.getTime();
}

function getBusinessTimes(date) {
  const weekday = new Date(`${date}T12:00:00`).getDay();

  if (weekday === 0) return [];
  if (weekday === 6) return buildTimes(7, 0, 18, 0);
  return buildTimes(7, 30, 19, 0);
}

function buildTimes(startHour, startMinute, endHour, endMinute) {
  const times = [];
  const opening = startHour * 60 + startMinute;
  const closing = endHour * 60 + endMinute;

  for (
    let minutes = opening;
    minutes + APPOINTMENT_DURATION_MINUTES <= closing;
    minutes += APPOINTMENT_DURATION_MINUTES
  ) {
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

function statusLabel(status) {
  const labels = {
    agendado: 'Agendado',
    concluido: 'Concluido',
    cancelado: 'Cancelado',
  };

  return labels[status] ?? status;
}

createRoot(document.getElementById('root')).render(<App />);
