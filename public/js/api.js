// Dünner fetch-Wrapper für die eigene API.

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(method, url, body, { keepalive = false } = {}) {
  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      keepalive,
    });
  } catch {
    throw new ApiError(0, 'Keine Verbindung zum Server.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, data.error || 'Unbekannter Fehler');
  return data;
}

export const api = {
  me: () => request('GET', '/api/auth/me'),
  login: (email, password) => request('POST', '/api/auth/login', { email, password }),
  register: (name, email, password) => request('POST', '/api/auth/register', { name, email, password }),
  logout: () => request('POST', '/api/auth/logout'),
  getData: () => request('GET', '/api/data'),
  saveData: (doc, options) => request('PUT', '/api/data', doc, options),
  deleteAccount: () => request('DELETE', '/api/data'),
};
