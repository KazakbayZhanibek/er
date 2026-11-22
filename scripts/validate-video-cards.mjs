export function validateVideoCards(videos, { text, image, fail }) {
  // Older revisions have no card overrides and use the original video labels.
  if (videos == null) return;
  if (typeof videos !== "object" || Array.isArray(videos)) return fail("videos: grupo no válido.");

  for (const name of ["welcome", "firstDay"]) {
    const card = videos[name];
    if (card == null) continue;
    if (typeof card !== "object" || Array.isArray(card)) {
      fail(`videos.${name}: tarjeta no válida.`);
      continue;
    }
    text(card.title, `videos.${name}.title`, 120);
    text(card.description, `videos.${name}.description`, 400);
    if (card.poster != null && card.poster !== "") image(card.poster, `videos.${name}.poster`);
  }
}
