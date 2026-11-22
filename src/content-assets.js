export function contentAssetUrl(path) {
  const normalized = String(path || "").replace(/^\/+/, "");
  return `${import.meta.env.BASE_URL}${normalized}`;
}
