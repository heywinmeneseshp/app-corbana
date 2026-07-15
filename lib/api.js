export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export async function apiFetch(path, options = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("corbana_access_token") : null;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    localStorage.removeItem("corbana_access_token");
    localStorage.removeItem("corbana_refresh_token");
    window.location.href = "/login";
    throw new Error("Sesión expirada");
  }

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || "Error en la petición");
  }
  return data.data;
}
