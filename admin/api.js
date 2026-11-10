export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api/admin/${path}`, {
      ...options,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Comprueba la conexión e inténtalo de nuevo.');
  }
  const value = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(value.message || value.error || 'No se pudo completar la operación.');
    error.status = response.status;
    error.details = value.errors;
    throw error;
  }
  return value;
}
