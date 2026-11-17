import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, X } from "@phosphor-icons/react";
import { applicationSubmissionEnabled, submitApplication } from "./application-api.js";
import "./intake-dialog.css";

const emptyValues = () => ({ fullName: "", email: "", phone: "", area: "", city: "", company: "", need: "", message: "", website: "" });

const fieldDetails = {
  fullName: { label: "Nombre y apellidos", autoComplete: "name", placeholder: "Nombre y apellido" },
  email: { label: "Correo electrónico", type: "email", autoComplete: "email", placeholder: "nombre@ejemplo.es", maxLength: 254 },
  phone: { label: "Teléfono", type: "tel", autoComplete: "tel", placeholder: "Número de contacto", optional: true, maxLength: 40 },
  city: { label: "Ciudad o provincia", autoComplete: "address-level2", placeholder: "Ciudad o provincia", optional: true },
  area: { label: "Área de interés", placeholder: "Tipo de trabajo que te interesa", optional: true, wide: true },
  company: { label: "Empresa", autoComplete: "organization", placeholder: "Nombre de la empresa", wide: true },
  need: { label: "Necesidades de personal", placeholder: "Perfiles, tareas o necesidades del equipo", multiline: true, wide: true, maxLength: 1000 },
  message: { label: "Breve carta de presentación", placeholder: "Cuéntanos quién eres, tu experiencia, tu nivel de español y el tipo de trabajo que buscas.", multiline: true, wide: true, maxLength: 1000 },
};

function newRequestId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
}

export default function IntakeDialog({ type, source, onClose }) {
  const dialogRef = useRef(null);
  const formRef = useRef(null);
  const headingRef = useRef(null);
  const requestIdRef = useRef("");
  const [step, setStep] = useState("fields");
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState({});
  const [submissionError, setSubmissionError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const id = useId();
  const employer = type === "employer";
  const destination = type === "candidate"
    ? source === "Kompas" ? "Trabajar en Kompas" : source === "Otras empresas" ? "Oportunidades en otras empresas" : undefined
    : undefined;

  useEffect(() => {
    if (!type) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    setStep("fields");
    setValues(emptyValues());
    setErrors({});
    setSubmissionError("");
    setIsSubmitting(false);
    requestIdRef.current = newRequestId();
    document.body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [type]);

  useEffect(() => {
    if (!type) return;
    const frame = requestAnimationFrame(() => {
      const target = step === "fields" ? formRef.current?.querySelector("input:not([tabindex='-1'])") : headingRef.current;
      target?.focus({ preventScroll: true });
      const body = dialogRef.current?.querySelector(".intake-body");
      if (body) body.scrollTop = 0;
    });
    return () => cancelAnimationFrame(frame);
  }, [step, type]);

  function close() {
    setValues(emptyValues());
    setErrors({});
    setSubmissionError("");
    setIsSubmitting(false);
    setStep("fields");
    onClose();
  }

  function change(event) {
    const { name, value } = event.target;
    event.target.setCustomValidity("");
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: undefined }));
  }

  function review(event) {
    event.preventDefault();
    const form = formRef.current;
    const nextErrors = {};
    const trimmed = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]));
    for (const field of form.elements) if (typeof field.setCustomValidity === "function") field.setCustomValidity("");
    if (trimmed.fullName.length < 2) nextErrors.fullName = "Escribe tu nombre y apellido.";
    const emailInput = form.elements.namedItem("email");
    if (!trimmed.email || emailInput.validity.typeMismatch) nextErrors.email = "Escribe un correo electrónico válido.";
    if (employer && !trimmed.company) nextErrors.company = "Escribe el nombre de tu empresa.";
    if (employer && !trimmed.need) nextErrors.need = "Cuéntanos qué tipo de personal buscas.";
    if (!employer && !trimmed.message) nextErrors.message = "Añade una breve carta de presentación sobre ti.";
    for (const [name, message] of Object.entries(nextErrors)) form.elements.namedItem(name)?.setCustomValidity(message);
    setErrors(nextErrors);
    if (!form.reportValidity()) return;
    setValues(trimmed);
    setStep("review");
  }

  async function sendApplication() {
    if (!applicationSubmissionEnabled || isSubmitting) return;
    setSubmissionError("");
    setIsSubmitting(true);
    try {
      await submitApplication({
        idempotencyKey: requestIdRef.current,
        type,
        source: source || "",
        website: values.website,
        fields: values,
      });
      setStep("success");
    } catch (error) {
      setSubmissionError(error.status === 429
        ? "Has enviado varias solicitudes. Espera unos minutos antes de volver a intentarlo."
        : "No hemos podido enviar la solicitud. Tus datos no se han perdido; inténtalo de nuevo en unos minutos.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function backdropClick(event) {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  }

  const fields = (employer
    ? ["fullName", "email", "company", "phone", "city", "need"]
    : ["fullName", "email", "phone", "city", "area", "message"]
  ).map((name) => ({ name, ...fieldDetails[name], ...(employer && name === "email" ? { label: "Correo profesional" } : {}) }));
  const descriptionId = `${id}-description${step !== "success" ? ` ${id}-preview` : ""}${destination ? ` ${id}-destination` : ""}`;

  return (
    <dialog className="intake-dialog" ref={dialogRef} aria-labelledby={`${id}-title`} aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); close(); }} onClick={backdropClick}>
      <div className="intake-topline">
        <span className="intake-route">{employer ? "PARA EMPRESAS" : "PARA PERSONAS"}</span>
        <button type="button" className="intake-close" onClick={close} aria-label="Cerrar formulario"><X size={22} aria-hidden="true" /></button>
      </div>
      <div className="intake-body">
        <p className="intake-step">{step === "fields" ? "01 / Tus datos" : step === "review" ? "02 / Revisión" : "03 / Recibida"}</p>
        <h2 id={`${id}-title`} ref={headingRef} tabIndex={-1}>
          {step === "success" ? (employer ? "Hemos recibido tu solicitud." : "Hemos recibido tu candidatura.") : step === "review" ? "Revisa tus datos." : employer ? "Solicitud de personal" : "Solicitud de empleo"}
        </h2>
        <p className="intake-description" id={`${id}-description`}>
          {step === "success"
            ? employer ? "Gracias. Un responsable de Kompas revisará la información y se pondrá en contacto contigo." : "Gracias por enviar tu información. Nos pondremos en contacto contigo en un plazo de 24 horas."
            : step === "review" ? (applicationSubmissionEnabled ? "Comprueba la información antes de enviarla." : "Puedes volver a editar la información o cerrar esta vista previa.")
              : employer ? "Cuéntanos qué personas necesita tu empresa." : "Presenta tu candidatura para trabajar en España con una breve carta sobre ti. Es necesario saber español."}
        </p>
        {destination && <p className="intake-destination" id={`${id}-destination`}>Interés: <strong>{destination}</strong></p>}
        {step !== "success" && <div className="intake-demo-note" id={`${id}-preview`}>
          {applicationSubmissionEnabled
            ? <><strong>Envío de solicitud.</strong> Los datos se enviarán a Kompas para gestionar esta solicitud.</>
            : <><strong>Vista previa.</strong> El envío todavía no está disponible. Los datos no se envían ni se guardan.</>}
        </div>}

        {step === "fields" ? (
          <form ref={formRef} onSubmit={review} noValidate className="intake-form">
            <div className="intake-honeypot" aria-hidden="true">
              <label htmlFor={`${id}-website`}>Sitio web</label>
              <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={change} />
            </div>
            <div className="intake-fields">
              {fields.map(({ name, label, optional, wide, multiline, type: inputType, autoComplete, placeholder, maxLength }) => {
                const props = { id: `${id}-${name}`, name, value: values[name], onChange: change, required: !optional,
                  maxLength: maxLength || 160, "aria-invalid": errors[name] ? "true" : undefined,
                  "aria-describedby": errors[name] ? `${id}-${name}-error` : undefined };
                return <div className={`intake-field${wide ? " intake-field-wide" : ""}`} key={name}>
                  <label htmlFor={`${id}-${name}`}>{label}{optional && <span>Opcional</span>}</label>
                  {multiline ? <textarea {...props} rows={3} placeholder={placeholder} />
                    : <input {...props} type={inputType || "text"} autoComplete={autoComplete || "off"} placeholder={placeholder} />}
                  {errors[name] && <p className="intake-error" id={`${id}-${name}-error`}>{errors[name]}</p>}
                </div>;
              })}
            </div>
            {Object.values(errors).some(Boolean) && <p className="intake-error-summary" role="alert">Revisa los campos indicados para continuar.</p>}
            <div className="intake-actions">
              <span className="intake-required-note">Los campos sin «Opcional» son obligatorios.</span>
              <button type="submit" className="intake-action intake-action-primary">Revisar datos <ArrowRight size={20} aria-hidden="true" /></button>
            </div>
          </form>
        ) : step === "review" ? (
          <div className="intake-review">
            <dl className="intake-review-list">
              {destination && <div><dt>Destino</dt><dd>{destination}</dd></div>}
              {fields.map(({ name, label }) => <div key={name}><dt>{label}</dt><dd>{values[name] || "No indicado"}</dd></div>)}
            </dl>
            {submissionError && <p className="intake-submit-error" role="alert">{submissionError}</p>}
            <div className="intake-actions intake-review-actions">
              <button type="button" className="intake-action intake-action-secondary" onClick={() => setStep("fields")} disabled={isSubmitting}>Editar datos</button>
              {applicationSubmissionEnabled
                ? <button type="button" className="intake-action intake-action-primary" onClick={sendApplication} disabled={isSubmitting} aria-busy={isSubmitting}>{isSubmitting ? "Enviando…" : employer ? "Enviar solicitud" : "Enviar candidatura"}</button>
                : <button type="button" className="intake-action intake-action-primary" onClick={close}>Cerrar vista previa</button>}
            </div>
          </div>
        ) : (
          <div className="intake-success" role="status">
            {!employer && <p>También recibirás un correo de confirmación en <strong>{values.email}</strong>.</p>}
            <p>Horario de atención: de 9:00 a 18:00, hora de Madrid.</p>
            <div className="intake-actions"><button type="button" className="intake-action intake-action-primary" onClick={close}>Cerrar</button></div>
          </div>
        )}
      </div>
    </dialog>
  );
}
