import { useEffect, useState } from 'react';
import { ArrowClockwise, Tray, FloppyDisk } from '@phosphor-icons/react';
import { api } from './api.js';

const statuses = { new: 'Nueva', contacted: 'Contactada', closed: 'Cerrada' };
const fields = [['email', 'Correo electrónico'], ['phone', 'Teléfono'], ['city', 'Ciudad o provincia'], ['area', 'Área de interés'], ['company', 'Empresa'], ['message', 'Carta de presentación'], ['need', 'Necesidades de personal']];

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(date);
}

export default function Applications({ active, onDirty, onExpired }) {
  const [applications, setApplications] = useState([]);
  const [intakeEnabled, setIntakeEnabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState({ status: 'new', notes: '' });
  const selected = applications.find(item => item.id === selectedId);
  const dirty = Boolean(selected && (draft.status !== selected.status || draft.notes !== (selected.notes || '')));
  const shown = applications.filter(item => filter === 'all' || item.status === filter);

  useEffect(() => { if (active && !loaded) load(); }, [active]);
  useEffect(() => { onDirty(dirty); }, [dirty, onDirty]);

  async function load() {
    setLoading(true); setError(''); setNotice('');
    try {
      const value = await api('applications');
      if (!Array.isArray(value.applications)) throw new Error('No se pudo leer la lista de solicitudes.');
      setApplications(value.applications); setIntakeEnabled(Boolean(value.intakeEnabled)); setLoaded(true);
      setSelectedId(null);
    } catch (failure) { setError(failure.message); if (failure.status === 401) onExpired(); }
    finally { setLoading(false); }
  }

  function select(item) { setSelectedId(item.id); setDraft({ status: item.status, notes: item.notes || '' }); setNotice(''); setError(''); }

  async function save(event) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const { application } = await api(`applications/${encodeURIComponent(selected.id)}`, { method: 'PATCH', body: draft });
      setApplications(previous => previous.map(item => item.id === application.id ? application : item));
      setDraft({ status: application.status, notes: application.notes || '' });
      setNotice('Solicitud actualizada.');
    } catch (failure) { setError(failure.message); if (failure.status === 401) onExpired(); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div className="editor-toolbar"><div><h2>Personas, antes que perfiles.</h2><p className="muted">Consulta cada candidatura y registra su seguimiento.</p></div><button className="button secondary" disabled={loading || saving || dirty} onClick={load}><ArrowClockwise size={18} aria-hidden="true" />{loading ? 'Actualizando…' : 'Actualizar'}</button></div>
      {error && <p className="notice error" role="alert">{error}</p>}
      {notice && <p className="notice success" role="status">{notice}</p>}
      {loading && !loaded ? <p className="status" role="status">Cargando solicitudes…</p> : !loaded ? null : <>
        {!intakeEnabled && <p className="notice intake-note">La recepción de solicitudes se conectará cuando se configure el correo.</p>}
        {applications.length === 0 ? <div className="empty-state application-empty"><Tray size={36} weight="light" aria-hidden="true" /><p className="eyebrow">BANDEJA DE SOLICITUDES</p><h3>Aquí empieza cada conversación.</h3><p>Todavía no hay solicitudes. Cuando se active la recepción, podrás consultar los datos, leer las cartas y registrar el seguimiento.</p></div> : <>
          <div className="application-filters"><label htmlFor="application-status-filter">Mostrar</label><select id="application-status-filter" disabled={dirty || saving} value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Todas las solicitudes</option>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><span>{shown.length} solicitudes</span></div>
          {dirty && <p className="notice">Guarda o descarta los cambios de esta solicitud antes de abrir otra.</p>}
          <div className="applications-layout">
            <div className="application-list" aria-label="Lista de solicitudes">{shown.length === 0 ? <p className="section-note">No hay solicitudes con este estado.</p> : shown.map(item => <button className="application-item" key={item.id} aria-pressed={selectedId === item.id} disabled={dirty || saving} onClick={() => select(item)}><span className="application-item-top"><strong>{item.fullName || 'Sin nombre'}</strong><span className={`badge badge-${item.status}`}>{statuses[item.status] || item.status}</span></span><span>{item.type === 'employer' ? 'Empresa' : 'Candidatura'}</span><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time></button>)}</div>
            <div className="application-detail">{!selected ? <p className="section-note">Selecciona una solicitud para ver sus detalles.</p> : <>
              <div className="application-detail-heading"><p className="eyebrow">{selected.type === 'employer' ? 'PARA EMPRESAS' : 'PARA PERSONAS'}</p><h3>{selected.fullName || 'Sin nombre'}</h3><p className="muted">{formatDate(selected.createdAt)} · Hora de Madrid</p></div>
              <dl className="application-data">{fields.filter(([key]) => selected[key]).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{selected[key]}</dd></div>)}</dl>
              <form onSubmit={save}><fieldset className="editor-fields" disabled={saving}><legend className="eyebrow followup-heading">SEGUIMIENTO</legend><div className="field"><label htmlFor="application-detail-status">Estado</label><select id="application-detail-status" value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="field"><label htmlFor="application-detail-notes">Notas internas</label><textarea id="application-detail-notes" rows={4} maxLength={2000} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} /><p className="field-count">{draft.notes.length} / 2000</p></div><div className="row-actions"><button className="button primary" type="submit" disabled={!dirty}><FloppyDisk size={18} aria-hidden="true" />{saving ? 'Guardando…' : 'Guardar seguimiento'}</button>{dirty && <button className="button quiet" type="button" onClick={() => select(selected)}>Descartar cambios</button>}</div></fieldset></form>
            </>}</div>
          </div>
        </>}
      </>}
    </>
  );
}
