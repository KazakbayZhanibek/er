import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, LockKey, SignOut } from '@phosphor-icons/react';
import { api } from './api.js';
import ContentEditor from './ContentEditor.jsx';
import Applications from './Applications.jsx';

export default function App() {
  const [session, setSession] = useState('checking');
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState('texts');
  const [contentDirty, setContentDirty] = useState(false);
  const [applicationsDirty, setApplicationsDirty] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const dirty = contentDirty || applicationsDirty;

  const expired = useCallback(() => {
    setSession('expired');
    setSessionError('Tu sesión ha terminado. El borrador sigue abierto. Vuelve a entrar para guardar tus cambios.');
  }, []);

  const checkSession = useCallback(async () => {
    setSessionError('');
    setSession('checking');
    try {
      const value = await api('session');
      setSession(value.authenticated ? 'active' : 'anonymous');
      if (value.authenticated) setWorkspaceReady(true);
    } catch (error) {
      if (error.status === 401) setSession('anonymous');
      else { setSession('unavailable'); setSessionError(error.message); }
    }
  }, []);

  useEffect(() => { checkSession(); }, [checkSession]);
  useEffect(() => {
    if (!dirty) return undefined;
    const preventLoss = event => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', preventLoss);
    return () => window.removeEventListener('beforeunload', preventLoss);
  }, [dirty]);

  async function login(event) {
    event.preventDefault();
    setBusy(true); setSessionError('');
    try { await api('login', { method: 'POST', body: { password } }); setPassword(''); setSession('active'); setWorkspaceReady(true); }
    catch (error) { setSessionError(error.status === 401 ? 'La contraseña no es correcta.' : error.status === 429 ? 'Demasiados intentos. Espera unos minutos antes de volver a entrar.' : error.message); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setSessionError('');
    try {
      await api('logout', { method: 'POST', body: {} });
      setSession('anonymous'); setWorkspaceReady(false); setConfirmLogout(false); setContentDirty(false); setApplicationsDirty(false);
    } catch (error) { if (error.status === 401) { setSession('anonymous'); setWorkspaceReady(false); setContentDirty(false); setApplicationsDirty(false); setConfirmLogout(false); } else setSessionError(error.message); }
    finally { setBusy(false); }
  }

  if (!workspaceReady) return (
    <main className="login-shell">
      <a className="admin-brand" href="/" aria-label="Kompas, inicio"><span aria-hidden="true">K</span><span>Kompas</span></a>
      <section className="login-panel" aria-labelledby="login-title">
        <LockKey size={28} weight="light" aria-hidden="true" />
        <p className="eyebrow">ÁREA PRIVADA</p>
        <h1 id="login-title">Tu espacio<br />de gestión.</h1>
        <p className="lead">Edita el contenido del sitio y organiza las solicitudes desde un mismo lugar.</p>
        {session === 'checking' ? <p role="status" className="status">Comprobando la sesión…</p> : session === 'unavailable' ? <>
          <p role="alert" className="notice error">{sessionError}</p>
          <button className="button primary" onClick={checkSession}>Volver a intentar</button>
        </> : <form onSubmit={login}>
          <label htmlFor="admin-password">Contraseña de acceso</label>
          <input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
          {sessionError && <p className="notice error" role="alert">{sessionError}</p>}
          <button type="submit" className="button primary" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}<ArrowRight size={20} aria-hidden="true" /></button>
        </form>}
      </section>
      <p className="login-footer">Kompas · Administración del sitio</p>
    </main>
  );

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#admin-content">Saltar al contenido</a>
      <header className="admin-header">
        <a className="admin-brand" href="/" aria-label="Kompas, inicio"><span aria-hidden="true">K</span><span>Kompas <small>Gestión</small></span></a>
        <div className="header-actions">
          <a className="button quiet" href="/" target="_blank" rel="noopener">Ver sitio<ArrowUpRight size={18} aria-hidden="true" /></a>
          <button className="button quiet" disabled={busy} onClick={() => dirty ? setConfirmLogout(true) : logout()}><SignOut size={19} aria-hidden="true" /><span>Salir</span></button>
        </div>
      </header>
      <main id="admin-content">
        <div className="workspace-heading"><p className="eyebrow">ÁREA PRIVADA</p><h1>Todo en su lugar.</h1><p>Contenido claro. Nuevas oportunidades. Un sitio que avanza contigo.</p></div>
        {sessionError && <p className="notice error" role="alert">{sessionError}</p>}
        {session === 'expired' && <form className="reauth-form" onSubmit={login}><div><label htmlFor="renew-password">Contraseña de acceso</label><input id="renew-password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} /></div><button type="submit" className="button primary" disabled={busy}>{busy ? 'Entrando…' : 'Volver a entrar'}</button></form>}
        {confirmLogout && <div className="notice logout-confirm" role="alert"><p>Hay cambios sin guardar. Puedes seguir editando o descartarlos al salir.</p><div className="row-actions"><button className="button secondary" onClick={() => setConfirmLogout(false)}>Seguir editando</button><button className="button danger" onClick={logout} disabled={busy}>Descartar y salir</button></div></div>}
        <nav className="workspace-tabs" aria-label="Secciones de gestión">
          {[['texts', 'Textos'], ['blocks', 'Bloques'], ['applications', 'Solicitudes']].map(([key, label]) => <button key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>{label}{key !== 'applications' && contentDirty && <span className="dirty-dot" aria-label="Hay cambios sin guardar" />}</button>)}
        </nav>
        <section hidden={tab === 'applications'} aria-label="Editor de contenido"><ContentEditor mode={tab} onDirty={setContentDirty} onExpired={expired} /></section>
        <section hidden={tab !== 'applications'} aria-label="Gestión de solicitudes"><Applications active={tab === 'applications'} onDirty={setApplicationsDirty} onExpired={expired} /></section>
      </main>
      <footer className="admin-footer"><span>Kompas · Área privada</span><span>Los cambios guardados se aplican al sitio de este servidor.</span></footer>
    </div>
  );
}
