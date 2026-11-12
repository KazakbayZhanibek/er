import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, List, X } from '@phosphor-icons/react';
import ContentSections, { AdditionalSections, EmployerSection } from './ContentSections.jsx';
import IntakeDialog from './IntakeDialog.jsx';
import content from './content/site.json';

const navigation = [
  ['Primeros pasos', '#incorporacion'],
  ['Empleo', '#empleo'],
  ['Sobre Kompas', '#nosotros'],
  ['Contacto', '#contacto'],
];

export function App() {
  const text = content.texts;
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
          <span className="brand-monogram" aria-hidden="true">K<span>·</span></span>
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
        </nav>}
      </header>

      <main id="contenido">
        <section className="hero" aria-labelledby="hero-title">
          <div className="container hero-content">
            <p className="eyebrow hero-eyebrow">{text.heroEyebrow}</p>
            <h1 id="hero-title"><span>{text.heroTitleFirst}</span><span>{text.heroTitleSecond}</span></h1>
            <div className="hero-bottom">
              <p className="hero-description">{text.heroDescription}</p>
              <div className="hero-actions">
                <a href="#empleo" className="button button-primary">Busco empleo<ArrowRight size={27} weight="regular" aria-hidden="true" /></a>
                <a href="#incorporacion" className="button button-outline">Ver los vídeos<ArrowRight size={27} weight="regular" aria-hidden="true" /></a>
              </div>
            </div>
          </div>
          <figure className="hero-image-wrap">
            <img className="hero-image" src={`${import.meta.env.BASE_URL}images/hero-team.webp`} alt="Cuatro personas conversando alrededor de una mesa en un espacio de trabajo luminoso. Imagen ilustrativa." width="2172" height="724" fetchPriority="high" />
            <figcaption className="container">El siguiente paso, juntos.</figcaption>
          </figure>
        </section>

        <ContentSections onOpenIntake={openIntake} content={content} />
        <AdditionalSections blocks={content.blocks} />

        <section className="contact-section" id="contacto" aria-labelledby="contact-title">
          <div className="container contact-layout">
            <div><p className="eyebrow">Empecemos por una conversación</p><h2 id="contact-title">{text.contactTitleFirst}<br />{text.contactTitleSecond}</h2></div>
            <div className="contact-choices">
              <p className="contact-hours">{text.contactHours}</p>
              <p className="contact-response">{text.contactResponse}</p>
              <button onClick={() => openIntake('candidate')} className="contact-choice"><span><small>Para personas</small>Quiero encontrar empleo</span><ArrowUpRight size={31} aria-hidden="true" /></button>
            </div>
          </div>
        </section>
        <EmployerSection onOpenIntake={openIntake} content={content} />
      </main>

      <footer className="site-footer container">
        <div className="footer-top">
          <a className="brand" href="#inicio" aria-label="Volver al inicio de Kompas"><span className="brand-monogram" aria-hidden="true">K<span>·</span></span></a>
          <p>Personas y oportunidades,<br />en la misma dirección.</p>
          <div className="footer-links">
            <a className="footer-top-link" href="#empresas">Para empresas<ArrowUpRight size={21} aria-hidden="true" /></a>
            <a className="footer-top-link" href="#inicio">Volver arriba<ArrowUpRight size={21} aria-hidden="true" /></a>
          </div>
        </div>
        <div className="footer-bottom"><span>Kompas · España</span><span>Prototipo de diseño · Imágenes ilustrativas · Formularios de demostración</span></div>
      </footer>
      <IntakeDialog type={intake?.type ?? null} source={intake?.source} onClose={() => setIntake(null)} />
    </>
  );
}
