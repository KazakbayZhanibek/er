import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, List, X } from '@phosphor-icons/react';
import ContentSections from './ContentSections.jsx';
import IntakeDialog from './IntakeDialog.jsx';

const navigation = [
  ['Empleo', '#empleo'],
  ['Empresas', '#empresas'],
  ['Sobre Kompas', '#nosotros'],
  ['Contacto', '#contacto'],
];

export function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [intake, setIntake] = useState(null);
  const menuButton = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const openIntake = (type, source) => {
    setMenuOpen(false);
    setIntake({ type, source });
  };

  return (
    <>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <header className="site-header container" id="inicio">
        <a className="brand" href="#inicio" aria-label="Kompas, inicio">
          <img src="/images/kompas-wordmark.webp" alt="Kompas" width="188" height="52" />
        </a>
        <nav className="desktop-navigation" aria-label="Navegación principal">
          {navigation.map(([label, href]) => <a href={href} key={href}>{label}</a>)}
        </nav>
        <button ref={menuButton} className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>
          <span>{menuOpen ? 'Cerrar' : 'Menú'}</span>
          {menuOpen ? <X size={24} aria-hidden="true" /> : <List size={25} aria-hidden="true" />}
        </button>
        {menuOpen && <nav id="mobile-navigation" className="mobile-navigation" aria-label="Navegación móvil">
          {navigation.map(([label, href]) => <a href={href} key={href} onClick={() => setMenuOpen(false)}>{label}<ArrowUpRight size={22} aria-hidden="true" /></a>)}
          <a href="#incorporacion" onClick={() => setMenuOpen(false)}>Primeros pasos<ArrowUpRight size={22} aria-hidden="true" /></a>
        </nav>}
      </header>

      <main id="contenido">
        <section className="hero" aria-labelledby="hero-title">
          <div className="container hero-content">
            <p className="eyebrow hero-eyebrow">Empleo y selección de personal</p>
            <h1 id="hero-title"><span>Personas y oportunidades,</span><span>en la misma dirección.</span></h1>
            <div className="hero-bottom">
              <p className="hero-description">Un punto de encuentro para quienes buscan empleo<br className="desktop-break" /> y quienes necesitan incorporar personal.</p>
              <div className="hero-actions">
                <a href="#empleo" className="button button-primary">Busco empleo<ArrowRight size={27} weight="regular" aria-hidden="true" /></a>
                <a href="#empresas" className="button button-dark">Busco personal<ArrowRight size={27} weight="regular" aria-hidden="true" /></a>
              </div>
            </div>
          </div>
          <figure className="hero-image-wrap">
            <img className="hero-image" src="/images/hero-team.webp" alt="Cuatro personas conversando alrededor de una mesa en un espacio de trabajo luminoso. Imagen ilustrativa." width="2172" height="724" fetchPriority="high" />
            <figcaption className="container">El siguiente paso, juntos.</figcaption>
          </figure>
        </section>

        <ContentSections onOpenIntake={openIntake} />

        <section className="contact-section" id="contacto" aria-labelledby="contact-title">
          <div className="container contact-layout">
            <div><p className="eyebrow">Empecemos por una conversación</p><h2 id="contact-title">¿Cuál es tu<br />siguiente paso?</h2></div>
            <div className="contact-choices">
              <button onClick={() => openIntake('candidate')} className="contact-choice"><span><small>Para personas</small>Quiero encontrar empleo</span><ArrowUpRight size={31} aria-hidden="true" /></button>
              <button onClick={() => openIntake('employer')} className="contact-choice"><span><small>Para empresas</small>Quiero incorporar personal</span><ArrowUpRight size={31} aria-hidden="true" /></button>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer container">
        <div className="footer-top">
          <a className="brand" href="#inicio" aria-label="Volver al inicio de Kompas"><img src="/images/kompas-wordmark.webp" alt="Kompas" width="188" height="52" /></a>
          <p>Personas y oportunidades,<br />en la misma dirección.</p>
          <a className="footer-top-link" href="#inicio">Volver arriba<ArrowUpRight size={21} aria-hidden="true" /></a>
        </div>
        <div className="footer-bottom"><span>Kompas · España</span><span>Prototipo de diseño · Imágenes ilustrativas · Formularios de demostración</span></div>
      </footer>
      <IntakeDialog type={intake?.type ?? null} source={intake?.source} onClose={() => setIntake(null)} />
    </>
  );
}
