import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, List, X } from '@phosphor-icons/react';
import ContentSections, { AdditionalSections, EmployerSection } from './ContentSections.jsx';
import IntakeDialog from './IntakeDialog.jsx';
import { contentAssetUrl } from './content-assets.js';
import content from './content/site.json';
import publication from './content/publication.json';

export function App() {
  const text = content.texts;
  const navigation = [
    [text.navOnboarding, '#incorporacion'],
    [text.navEmployment, '#empleo'],
    [text.navAbout, '#nosotros'],
    [text.navContact, '#contacto'],
  ];
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
        {publication.announcement.enabled && (
          <aside className="site-announcement" aria-label="Aviso">
            <div className="container">
              <p>{publication.announcement.message}</p>
              {publication.announcement.destination && publication.announcement.destination !== 'none' && (
                <a href={publication.announcement.destination}>{publication.announcement.linkLabel}</a>
              )}
            </div>
          </aside>
        )}
        <section className="hero" aria-labelledby="hero-title">
          <div className="container hero-content">
            <p className="eyebrow hero-eyebrow">{text.heroEyebrow}</p>
            <h1 id="hero-title"><span>{text.heroTitleFirst}</span><span>{text.heroTitleSecond}</span></h1>
            <div className="hero-bottom">
              <p className="hero-description">{text.heroDescription}</p>
              <div className="hero-actions">
                <a href="#empleo" className="button button-primary">{text.heroPrimaryAction}<ArrowRight size={27} weight="regular" aria-hidden="true" /></a>
                <a href="#incorporacion" className="button button-outline">{text.heroSecondaryAction}<ArrowRight size={27} weight="regular" aria-hidden="true" /></a>
              </div>
            </div>
          </div>
          <figure className="hero-image-wrap">
            <img className="hero-image" src={contentAssetUrl(content.media.heroImage)} alt={content.media.heroImageAlt} width="2172" height="724" fetchPriority="high" />
            <figcaption className="container">{text.heroCaption}</figcaption>
          </figure>
        </section>

        <ContentSections onOpenIntake={openIntake} content={content} />
        <AdditionalSections blocks={content.blocks} />

        <section className="contact-section" id="contacto" aria-labelledby="contact-title">
          <div className="container contact-layout">
            <div><p className="eyebrow">{text.contactEyebrow}</p><h2 id="contact-title">{text.contactTitleFirst}<br />{text.contactTitleSecond}</h2></div>
            <div className="contact-choices">
              <p className="contact-hours">{text.contactHours}</p>
              <p className="contact-response">{text.contactResponse}</p>
              <button onClick={() => openIntake('candidate')} className="contact-choice"><span><small>{text.contactAudience}</small>{text.contactAction}</span><ArrowUpRight size={31} aria-hidden="true" /></button>
            </div>
          </div>
        </section>
        <EmployerSection onOpenIntake={openIntake} content={content} />
      </main>

      <footer className="site-footer container">
        <div className="footer-top">
          <a className="brand" href="#inicio" aria-label="Volver al inicio de Kompas"><span className="brand-monogram" aria-hidden="true">K<span>·</span></span></a>
          <p>{text.footerTagline.split('\n').map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</p>
          <div className="footer-links">
            <a className="footer-top-link" href="#empresas">{text.footerEmployerLink}<ArrowUpRight size={21} aria-hidden="true" /></a>
            <a className="footer-top-link" href="#inicio">{text.footerBackLink}<ArrowUpRight size={21} aria-hidden="true" /></a>
          </div>
        </div>
        <div className="footer-bottom"><span>{text.footerLocation}</span><span>{text.footerNotice}</span></div>
      </footer>
      <IntakeDialog type={intake?.type ?? null} source={intake?.source} onClose={() => setIntake(null)} />
    </>
  );
}
