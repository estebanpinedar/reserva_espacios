const ACCESS_TOKEN_KEY = "reservationAccessToken";
const API_BASE_KEY = "reservationApiBaseUrl";

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function saveAccessToken(token) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function getApiBaseUrl() {
  return (localStorage.getItem(API_BASE_KEY) || "http://localhost:8080").replace(/\/+$/, "");
}

export async function apiRequest(path, { method = "GET", body, authenticated = false } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const token = getAccessToken();
  if (authenticated && token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(`No se pudo conectar con la API en ${getApiBaseUrl()}. Comprueba que el backend esté iniciado.`);
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    const details = payload?.fieldErrors ? Object.values(payload.fieldErrors).join(" ") : "";
    throw new Error([payload?.message || `La solicitud falló (${response.status}).`, details].filter(Boolean).join(" "));
  }
  return payload;
}
