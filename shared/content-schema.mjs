export const TEXT_FIELDS = [
  ['heroEyebrow', 'Portada', 'Etiqueta', 100],
  ['heroTitleFirst', 'Portada', 'Título · primera línea', 100],
  ['heroTitleSecond', 'Portada', 'Título · segunda línea', 100],
  ['heroDescription', 'Portada', 'Descripción', 350],
  ['employmentTitleFirst', 'Empleo', 'Título · primera línea', 100],
  ['employmentTitleSecond', 'Empleo', 'Título · segunda línea', 100],
  ['employmentIntro', 'Empleo', 'Presentación de la candidatura', 600],
  ['languageTitle', 'Empleo', 'Requisito · título', 100],
  ['languageDescription', 'Empleo', 'Requisito · descripción', 500],
  ['conditionsTitle', 'Empleo', 'Condiciones · título', 100],
  ['conditionsDescription', 'Empleo', 'Condiciones · descripción', 500],
  ['supportTitle', 'Empleo', 'Acompañamiento · título', 100],
  ['supportDescription', 'Empleo', 'Acompañamiento · descripción', 500],
  ['aboutTitleFirst', 'Sobre Kompas', 'Título · primera línea', 100],
  ['aboutTitleSecond', 'Sobre Kompas', 'Título · segunda línea', 100],
  ['aboutDescription', 'Sobre Kompas', 'Descripción', 1500],
  ['contactTitleFirst', 'Contacto', 'Título · primera línea', 100],
  ['contactTitleSecond', 'Contacto', 'Título · segunda línea', 100],
  ['contactHours', 'Contacto', 'Horario de atención', 180],
  ['contactResponse', 'Contacto', 'Plazo de respuesta', 350],
  ['employerTitleFirst', 'Empresas', 'Título · primera línea', 100],
  ['employerTitleSecond', 'Empresas', 'Título · segunda línea', 100],
  ['employerDescription', 'Empresas', 'Descripción', 800],
].map(([key, group, label, maxLength]) => ({ key, group, label, maxLength }));

export function validateContent(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1) return ['Formato de contenido no válido.'];
  if (!value.texts || typeof value.texts !== 'object' || Array.isArray(value.texts)) return ['Faltan los textos del sitio.'];
  for (const field of TEXT_FIELDS) {
    const text = value.texts[field.key];
    if (typeof text !== 'string' || !text.trim() || text.length > field.maxLength) errors.push(`${field.group}: ${field.label} debe contener entre 1 y ${field.maxLength} caracteres.`);
  }
  if (Object.keys(value.texts).some(key => !TEXT_FIELDS.some(field => field.key === key))) errors.push('Hay campos de texto desconocidos.');
  if (!Array.isArray(value.blocks) || value.blocks.length > 12) return [...errors, 'Se permiten hasta 12 bloques adicionales.'];
  const ids = new Set();
  for (const block of value.blocks) {
    if (!block || typeof block !== 'object') { errors.push('Bloque no válido.'); continue; }
    if (typeof block.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(block.id) || ids.has(block.id)) errors.push('Cada bloque debe tener un identificador único.');
    ids.add(block.id);
    if (typeof block.title !== 'string' || !block.title.trim() || block.title.length > 120) errors.push('El título del bloque debe contener entre 1 y 120 caracteres.');
    if (typeof block.body !== 'string' || !block.body.trim() || block.body.length > 3000) errors.push('El texto del bloque debe contener entre 1 y 3000 caracteres.');
    if (Object.keys(block).some(key => !['id', 'title', 'body'].includes(key))) errors.push('El bloque contiene campos desconocidos.');
  }
  if (Object.keys(value).some(key => !['schemaVersion', 'texts', 'blocks'].includes(key))) errors.push('El documento contiene campos desconocidos.');
  return errors;
}
