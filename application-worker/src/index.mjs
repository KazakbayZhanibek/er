import { candidateAcknowledgement } from "../../shared/application-messages.mjs";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const FIELD_LIMITS = { fullName: 160, email: 254, phone: 40, city: 160, area: 160, company: 160, need: 1000, message: 1000 };

function clean(value, limit = 160) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function allowedOrigins(env) {
  return new Set((env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean));
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  return allowedOrigins(env).has(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" }
    : {};
}

function jsonResponse(request, env, status, body) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...corsHeaders(request, env) } });
}

export function validateApplication(input) {
  if (!input || typeof input !== "object") return { error: "Solicitud no válida." };
  if (clean(input.website, 200)) return { spam: true };
  if (!/^[0-9a-f-]{36}$/i.test(clean(input.idempotencyKey, 40))) return { error: "Identificador de solicitud no válido." };
  if (!["candidate", "employer"].includes(input.type)) return { error: "Tipo de solicitud no válido." };

  const sourceFields = input.fields && typeof input.fields === "object" ? input.fields : {};
  const fields = Object.fromEntries(Object.entries(FIELD_LIMITS).map(([name, limit]) => [name, clean(sourceFields[name], limit)]));
  if (fields.fullName.length < 2) return { error: "El nombre es obligatorio." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return { error: "El correo electrónico no es válido." };
  if (input.type === "candidate" && !fields.message) return { error: "La carta de presentación es obligatoria." };
  if (input.type === "employer" && (!fields.company || !fields.need)) return { error: "La empresa y las necesidades de personal son obligatorias." };

  return { value: { idempotencyKey: clean(input.idempotencyKey, 40), type: input.type, source: clean(input.source, 80), fields } };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

function fieldLine(label, value) {
  return value ? `<tr><th align="left" style="padding:6px 14px 6px 0;color:#6b5a4d;font-weight:500;vertical-align:top">${escapeHtml(label)}</th><td style="padding:6px 0;white-space:pre-wrap">${escapeHtml(value)}</td></tr>` : "";
}

export function buildManagerEmail(application) {
  const { fields } = application;
  const kind = application.type === "candidate" ? "Candidatura" : "Solicitud de personal";
  const rows = [
    fieldLine("Nombre", fields.fullName), fieldLine("Correo", fields.email), fieldLine("Teléfono", fields.phone),
    fieldLine("Ciudad o provincia", fields.city), fieldLine("Interés", application.source || fields.area),
    fieldLine("Empresa", fields.company), fieldLine("Necesidad", fields.need), fieldLine("Carta", fields.message),
  ].join("");
  return {
    subject: `${kind} · ${fields.fullName}`,
    text: `${kind}\n\nNombre: ${fields.fullName}\nCorreo: ${fields.email}\nTeléfono: ${fields.phone || "No indicado"}\nCiudad: ${fields.city || "No indicada"}\nInterés: ${application.source || fields.area || "No indicado"}\nEmpresa: ${fields.company || "No indicada"}\nNecesidad: ${fields.need || "No indicada"}\nCarta: ${fields.message || "No indicada"}`,
    html: `<div style="font-family:Arial,sans-serif;color:#332923;line-height:1.55"><h1 style="font-size:24px">${escapeHtml(kind)}</h1><table>${rows}</table></div>`,
  };
}

async function sendEmail(env, payload, idempotencyKey) {
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(payload),
  });
  if (!result.ok) throw new Error(`Resend ${result.status}: ${(await result.text()).slice(0, 300)}`);
  return result.json();
}

async function deliverApplication(env, id) {
  const row = await env.APPLICATIONS.prepare("SELECT * FROM applications WHERE id = ?").bind(id).first();
  if (!row) return;
  const application = JSON.parse(row.payload_json);
  const errors = [];

  if (row.manager_status !== "sent") {
    try {
      const message = buildManagerEmail(application);
      const sent = await sendEmail(env, { from: env.APPLICATIONS_FROM_EMAIL, to: [env.APPLICATIONS_TO_EMAIL], reply_to: application.fields.email, ...message }, `application/${id}/manager`);
      await env.APPLICATIONS.prepare("UPDATE applications SET manager_status = 'sent', manager_email_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(sent.id, id).run();
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (application.type === "candidate" && row.acknowledgement_status !== "sent") {
    try {
      const sent = await sendEmail(env, { from: env.APPLICATIONS_FROM_EMAIL, to: [application.fields.email], subject: candidateAcknowledgement.subject, text: candidateAcknowledgement.text }, `application/${id}/candidate`);
      await env.APPLICATIONS.prepare("UPDATE applications SET acknowledgement_status = 'sent', acknowledgement_email_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(sent.id, id).run();
    } catch (error) {
      errors.push(error.message);
    }
  }

  await env.APPLICATIONS.prepare("UPDATE applications SET attempts = attempts + 1, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(errors.join(" | ").slice(0, 1000) || null, id).run();
}

async function acceptApplication(request, env, ctx) {
  const origin = request.headers.get("Origin") || "";
  if (!allowedOrigins(env).has(origin)) return jsonResponse(request, env, 403, { error: "Origen no permitido." });
  if (!env.RESEND_API_KEY || !env.APPLICATIONS_TO_EMAIL || !env.APPLICATIONS_FROM_EMAIL) return jsonResponse(request, env, 503, { error: "El servicio todavía no está configurado." });
  if ((Number(request.headers.get("Content-Length")) || 0) > 20_000) return jsonResponse(request, env, 413, { error: "Solicitud demasiado grande." });

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 20_000) return jsonResponse(request, env, 413, { error: "Solicitud demasiado grande." });
  const parsed = (() => {
    try {
      return JSON.parse(rawBody);
    } catch {
      return null;
    }
  })();
  const validation = validateApplication(parsed);
  if (validation.spam) return jsonResponse(request, env, 202, { accepted: true });
  if (validation.error) return jsonResponse(request, env, 400, { error: validation.error });

  const application = validation.value;
  const id = crypto.randomUUID();
  const acknowledgementStatus = application.type === "candidate" ? "pending" : "not_required";
  await env.APPLICATIONS.prepare(`INSERT OR IGNORE INTO applications
    (id, idempotency_key, type, applicant_email, payload_json, manager_status, acknowledgement_status)
    VALUES (?, ?, ?, ?, ?, 'pending', ?)`)
    .bind(id, application.idempotencyKey, application.type, application.fields.email, JSON.stringify(application), acknowledgementStatus).run();
  const stored = await env.APPLICATIONS.prepare("SELECT id FROM applications WHERE idempotency_key = ?").bind(application.idempotencyKey).first();
  ctx.waitUntil(deliverApplication(env, stored.id));
  return jsonResponse(request, env, 202, { accepted: true, applicationId: stored.id });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS" && url.pathname === "/applications") return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    if (request.method === "POST" && url.pathname === "/applications") return acceptApplication(request, env, ctx);
    if (request.method === "GET" && url.pathname === "/health") return new Response("ok", { status: 200 });
    return new Response("Not found", { status: 404 });
  },
  async scheduled(_event, env, ctx) {
    const retentionDays = Math.max(1, Math.min(365, Number(env.RETENTION_DAYS) || 30));
    const pending = await env.APPLICATIONS.prepare(`SELECT id FROM applications
      WHERE attempts < 8 AND (manager_status != 'sent' OR acknowledgement_status = 'pending')
      ORDER BY created_at ASC LIMIT 25`).all();
    ctx.waitUntil(Promise.allSettled((pending.results || []).map(({ id }) => deliverApplication(env, id))));
    ctx.waitUntil(env.APPLICATIONS.prepare("DELETE FROM applications WHERE created_at < datetime('now', ?)").bind(`-${retentionDays} days`).run());
  },
};
