import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateVideoCards } from "./validate-video-cards.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentPath = path.join(root, "src/content/site.json");
const allowedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const allowedBlockTypes = new Set(["text", "image_text", "callout", "faq", "list"]);
const allowedTargets = new Set(["#empleo", "#incorporacion", "#contacto", "#empresas"]);
const errors = [];

function fail(message) {
  errors.push(message);
}

function text(value, label, maximum = 3000, optional = false) {
  if (optional && (value === undefined || value === "")) return;
  if (typeof value !== "string" || !value.trim()) fail(`${label}: falta texto.`);
  else if (value.length > maximum) fail(`${label}: supera ${maximum} caracteres.`);
}

function image(value, label) {
  text(value, label, 300);
  if (typeof value !== "string" || !value) return;
  const normalized = value.replace(/^\/+/, "");
  if (!normalized.startsWith("images/") || normalized.includes("..") || /^(?:https?:|data:|javascript:)/i.test(normalized)) {
    fail(`${label}: la imagen debe estar dentro de public/images.`);
    return;
  }
  if (!allowedImageExtensions.has(path.extname(normalized).toLowerCase())) fail(`${label}: formato de imagen no permitido.`);
  const absolute = path.join(root, "public", normalized);
  if (!existsSync(absolute)) fail(`${label}: no existe ${normalized}.`);
}

let content;
const publication = JSON.parse(readFileSync(path.join(root, "src/content/publication.json"), "utf8"));
const { announcement, page } = publication;
text(page?.title, "Título de la pestaña", 100);
text(page?.description, "Descripción de la página", 300);
if (!announcement || typeof announcement.enabled !== "boolean") fail("Mostrar aviso: valor no válido.");
const target = announcement?.destination || "none";
if (target !== "none" && !allowedTargets.has(target)) fail("Destino del enlace: destino no permitido.");
text(announcement?.message ?? "", "Texto del aviso", 240, !announcement?.enabled);
text(announcement?.linkLabel ?? "", "Texto del enlace", 60, target === "none");
try {
  content = JSON.parse(readFileSync(contentPath, "utf8"));
} catch (error) {
  throw new Error(`No se puede leer src/content/site.json: ${error.message}`);
}

if (content.schemaVersion !== 2) fail("schemaVersion debe ser 2.");
if (!content.texts || typeof content.texts !== "object") fail("Falta el grupo texts.");
else for (const [name, value] of Object.entries(content.texts)) text(value, `texts.${name}`, name.toLowerCase().includes("description") || name.includes("Intro") || name.includes("Response") || name.includes("Tagline") ? 1600 : 220);

validateVideoCards(content.videos, { text, image, fail });

if (!content.media || typeof content.media !== "object") fail("Falta el grupo media.");
else {
  image(content.media.heroImage, "media.heroImage");
  text(content.media.heroImageAlt, "media.heroImageAlt", 300);
}

// Pages CMS removes the key when the editor deletes the last optional block.
const blocks = content.blocks ?? [];
if (!Array.isArray(blocks)) fail("blocks debe ser una lista.");
else {
  if (blocks.length > 12) fail("blocks: máximo 12 bloques.");
  const ids = new Set();
  blocks.forEach((block, index) => {
    const label = `blocks[${index}]`;
    if (!block || typeof block !== "object") return fail(`${label}: bloque no válido.`);
    if (!allowedBlockTypes.has(block.type)) fail(`${label}.type: tipo no permitido.`);
    if (typeof block.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(block.id)) fail(`${label}.id: UUID no válido.`);
    else if (ids.has(block.id)) fail(`${label}.id: identificador duplicado.`);
    else ids.add(block.id);
    if (block.enabled !== undefined && typeof block.enabled !== "boolean") fail(`${label}.enabled: debe ser verdadero o falso.`);
    text(block.eyebrow, `${label}.eyebrow`, 80, true);
    text(block.title, `${label}.title`, 180);
    text(block.body, `${label}.body`, 3000, block.type === "faq" || block.type === "list");
    if (block.type === "faq") {
      if (!Array.isArray(block.questions) || block.questions.length < 1 || block.questions.length > 12) {
        fail(`${label}.questions: se requieren entre 1 y 12 preguntas.`);
      } else {
        block.questions.forEach((entry, questionIndex) => {
          text(entry?.question, `${label}.questions[${questionIndex}].question`, 180);
          text(entry?.answer, `${label}.questions[${questionIndex}].answer`, 1600);
        });
      }
    }
    if (block.type === "list") {
      if (!["bullets", "numbered"].includes(block.listStyle)) fail(`${label}.listStyle: usa bullets o numbered.`);
      if (!Array.isArray(block.items) || block.items.length < 1 || block.items.length > 20) {
        fail(`${label}.items: se requieren entre 1 y 20 elementos.`);
      } else {
        block.items.forEach((item, itemIndex) => text(item, `${label}.items[${itemIndex}]`, 300));
      }
    }
    if (block.type === "image_text") {
      image(block.image, `${label}.image`);
      text(block.imageAlt, `${label}.imageAlt`, 300);
      if (!["left", "right"].includes(block.imageSide)) fail(`${label}.imageSide: usa left o right.`);
    }
    if (block.type === "callout") {
      text(block.buttonLabel, `${label}.buttonLabel`, 80);
      if (!allowedTargets.has(block.buttonTarget)) fail(`${label}.buttonTarget: destino no permitido.`);
    }
  });
}

const uploads = path.join(root, "public/images/uploads");
for (const entry of readdirSync(uploads, { withFileTypes: true })) {
  if (entry.name.startsWith(".")) continue;
  const absolute = path.join(uploads, entry.name);
  if (!entry.isFile()) fail(`images/uploads/${entry.name}: solo se permiten archivos.`);
  else {
    if (!allowedImageExtensions.has(path.extname(entry.name).toLowerCase())) fail(`images/uploads/${entry.name}: formato no permitido.`);
    if (statSync(absolute).size > 8 * 1024 * 1024) fail(`images/uploads/${entry.name}: supera 8 MB.`);
  }
}

if (errors.length) {
  console.error("Content validation failed:\n- " + errors.join("\n- "));
  process.exit(1);
}

console.log("Content validation passed.");
