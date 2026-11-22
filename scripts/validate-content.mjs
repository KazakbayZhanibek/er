import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentPath = path.join(root, "src/content/site.json");
const allowedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const allowedBlockTypes = new Set(["text", "image_text", "callout"]);
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
try {
  content = JSON.parse(readFileSync(contentPath, "utf8"));
} catch (error) {
  throw new Error(`No se puede leer src/content/site.json: ${error.message}`);
}

if (content.schemaVersion !== 2) fail("schemaVersion debe ser 2.");
if (!content.texts || typeof content.texts !== "object") fail("Falta el grupo texts.");
else for (const [name, value] of Object.entries(content.texts)) text(value, `texts.${name}`, name.toLowerCase().includes("description") || name.includes("Intro") || name.includes("Response") || name.includes("Tagline") ? 1600 : 220);

if (!content.media || typeof content.media !== "object") fail("Falta el grupo media.");
else {
  image(content.media.heroImage, "media.heroImage");
  text(content.media.heroImageAlt, "media.heroImageAlt", 300);
}

if (!Array.isArray(content.blocks)) fail("blocks debe ser una lista.");
else {
  if (content.blocks.length > 12) fail("blocks: máximo 12 bloques.");
  const ids = new Set();
  content.blocks.forEach((block, index) => {
    const label = `blocks[${index}]`;
    if (!block || typeof block !== "object") return fail(`${label}: bloque no válido.`);
    if (!allowedBlockTypes.has(block.type)) fail(`${label}.type: tipo no permitido.`);
    if (typeof block.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(block.id)) fail(`${label}.id: UUID no válido.`);
    else if (ids.has(block.id)) fail(`${label}.id: identificador duplicado.`);
    else ids.add(block.id);
    if (block.enabled !== undefined && typeof block.enabled !== "boolean") fail(`${label}.enabled: debe ser verdadero o falso.`);
    text(block.eyebrow, `${label}.eyebrow`, 80, true);
    text(block.title, `${label}.title`, 180);
    text(block.body, `${label}.body`, 3000);
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
