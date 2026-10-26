import { useRef } from 'react';
import { ArrowRight, ArrowUpRight, Plus, Minus } from '@phosphor-icons/react';
import './content-sections.css';

const hiringPaths = [
  {
    number: '01',
    title: 'Trabaja en Kompas',
    description: 'Oportunidades de empleo con Kompas como empresa empleadora.',
    source: 'Kompas',
  },
  {
    number: '02',
    title: 'Oportunidades en otras empresas',
    description: 'Empleo en otras empresas, con condiciones que se comentan individualmente con cada candidato.',
    source: 'Otras empresas',
  },
];

const processSteps = [
  {
    number: '01',
    title: 'Tu necesidad',
    description: 'El punto de partida: entender qué necesita tu empresa y qué puesto quieres cubrir.',
  },
  {
    number: '02',
    title: 'El perfil',
    description: 'Experiencia, habilidades y contexto. Dar forma a lo que buscas en tu próximo compañero.',
  },
  {
    number: '03',
    title: 'La selección',
    description: 'Conectar la búsqueda de tu empresa con personas que puedan encajar en el puesto.',
  },
];

const videos = [
  {
    number: '01',
    title: 'Bienvenido a Kompas',
    description: 'Conoce las dos vías de empleo de Kompas y cómo aclarar tus dudas antes de empezar.',
    duration: '0:40',
    seconds: 40,
    file: 'kompas-bienvenida',
    transcript: [
      'Te damos la bienvenida a Kompas. Empezar una nueva etapa trae ilusión y también preguntas. Este vídeo te ayudará a situarte.',
      'Kompas incorpora personas a su propio equipo y selecciona candidatos para otras empresas. Si vas a trabajar en otra compañía, sus condiciones se comentan contigo de forma individual.',
      'Antes de empezar, revisa la información que has recibido y anota lo que necesites aclarar. Consulta tus dudas con la persona de contacto que te hayan indicado.',
      'En el siguiente vídeo veremos cómo prepararte para tu primer día.',
      'Kompas. El siguiente paso, juntos.',
    ],
  },
  {
    number: '02',
    title: 'Tu primer día',
    description: 'Qué confirmar antes de salir, cómo preparar la llegada y cuándo pedir orientación.',
    duration: '0:45',
    seconds: 45,
    file: 'kompas-primer-dia',
    transcript: [
      'Tu primer día empieza antes de salir de casa.',
      'Revisa la fecha y la hora de incorporación, la dirección del centro de trabajo y el nombre de tu persona de contacto.',
      'Confirma qué documentación, ropa o material necesitas llevar. Planifica el trayecto y comprueba cómo llegar.',
      'Al llegar, preséntate a la persona que te hayan indicado. Escucha las instrucciones del centro y pregunta cómo se organiza tu jornada.',
      'Antes de realizar una tarea que no conoces, pide que te expliquen cómo hacerla y qué medidas debes seguir. Anota lo importante y consulta cualquier indicación que no entiendas.',
      'Kompas. El siguiente paso, juntos.',
    ],
  },
];

export default function ContentSections({ onOpenIntake }) {
  const playerRefs = useRef([]);

  function pauseOtherVideos(currentPlayer) {
    playerRefs.current.forEach((player) => {
      if (player && player !== currentPlayer) player.pause();
    });
  }

  return (
    <>
      <section className="content-section section-employment" id="empleo" aria-labelledby="employment-title">
        <div className="container">
          <div className="section-employment-layout">
            <div className="section-introduction">
              <p className="eyebrow">PARA PERSONAS</p>
              <h2 id="employment-title">Tu camino<br />empieza contigo.</h2>
              <p className="section-lead">Hay diferentes formas de dar el siguiente paso. Encuentra la tuya.</p>
            </div>
            <div className="section-employment-paths">
              {hiringPaths.map((path) => (
                <button
                  key={path.number}
                  className="section-employment-path"
                  type="button"
                  onClick={() => onOpenIntake?.('candidate', path.source)}
                >
                  <span className="section-path-number" aria-hidden="true">{path.number}</span>
                  <span className="section-path-copy">
                    <span className="section-path-title">{path.title}</span>
                    <span className="section-path-description">{path.description}</span>
                  </span>
                  <ArrowUpRight className="section-path-arrow" size={30} weight="light" aria-hidden="true" />
                </button>
              ))}
              <p className="section-preview-note"><span>Vista previa.</span> Las vacantes se añadirán tras confirmar la información con la empresa.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="content-section section-business" id="empresas" aria-labelledby="business-title">
        <div className="container">
          <div className="section-business-heading">
            <div>
              <p className="eyebrow">PARA EMPRESAS</p>
              <h2 id="business-title">El próximo paso<br />de tu equipo.</h2>
            </div>
            <div className="section-business-intro">
              <p className="section-lead">Detrás de cada puesto hay una necesidad. Y detrás de cada candidatura, una persona.</p>
              <p>Cuéntanos qué estás buscando. Kompas conecta a empresas y candidatos a través de la selección de personal.</p>
              <button type="button" className="button section-business-cta" onClick={() => onOpenIntake?.('employer')}>
                Hablemos de tu equipo
                <ArrowUpRight size={22} weight="regular" aria-hidden="true" />
              </button>
            </div>
          </div>
          <ol className="section-process" aria-label="Etapas propuestas del proceso de selección">
            {processSteps.map((step) => (
              <li key={step.number}>
                <span className="section-process-number" aria-hidden="true">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="content-section section-about" id="nosotros" aria-labelledby="about-title">
        <div className="container section-about-layout">
          <p className="eyebrow">SOBRE KOMPAS</p>
          <div className="section-about-copy">
            <h2 id="about-title">Un punto de encuentro.<br /><span>Una dirección compartida.</span></h2>
            <div className="section-about-bottom">
              <p>Kompas incorpora personas a su propio equipo y selecciona candidatos para otras empresas. Para los puestos en otras compañías, las condiciones se comentan individualmente con cada candidato.</p>
              <a className="section-text-link" href="#contacto">Demos el siguiente paso <ArrowRight size={23} aria-hidden="true" /></a>
            </div>
          </div>
        </div>
      </section>

      <section className="content-section section-onboarding" id="incorporacion" aria-labelledby="onboarding-title">
        <div className="container">
          <div className="section-onboarding-heading">
            <div>
              <p className="eyebrow">PARA NUEVOS COMPAÑEROS</p>
              <h2 id="onboarding-title">Empezar, con claridad.</h2>
            </div>
            <p>Dos guías de bienvenida para conocer la empresa y preparar los primeros pasos.</p>
          </div>
          <div className="section-videos">
            {videos.map((video, index) => (
              <article className="section-video" key={video.number} aria-labelledby={`video-title-${video.number}`}>
                <div className="section-video-meta">
                  <span className="section-video-number">GUÍA {video.number}</span>
                  <span className="section-video-duration" aria-label={`Duración: ${video.seconds} segundos`}>{video.duration}</span>
                </div>
                <h3 className="section-video-title" id={`video-title-${video.number}`}>{video.title}</h3>
                <p className="section-video-description">{video.description}</p>
                <video
                  className="section-video-player"
                  ref={(element) => { playerRefs.current[index] = element; }}
                  controls
                  playsInline
                  preload="none"
                  poster={`/media/${video.file}-poster.webp`}
                  aria-labelledby={`video-title-${video.number}`}
                  aria-describedby={`video-language-${video.number}`}
                  onPlay={(event) => pauseOtherVideos(event.currentTarget)}
                >
                  <source src={`/media/${video.file}.mp4`} type="video/mp4" />
                  Tu navegador no puede reproducir este vídeo. <a href={`/media/${video.file}.mp4`}>Abrir el vídeo</a>.
                </video>
                <p className="section-video-language" id={`video-language-${video.number}`}>Español · Subtítulos integrados</p>
                <details className="section-video-transcript">
                  <summary className="section-video-action">
                    <span className="section-video-label-closed">Leer transcripción</span>
                    <span className="section-video-label-open">Ocultar transcripción</span>
                    <Plus className="section-video-plus" size={23} aria-hidden="true" />
                    <Minus className="section-video-minus" size={23} aria-hidden="true" />
                  </summary>
                <div className="section-video-details">
                  {video.transcript.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
                </details>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
