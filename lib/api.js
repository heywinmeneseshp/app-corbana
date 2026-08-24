import { saveSession, clearSession } from "./auth";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

// El access token dura poco (15 min) a propósito, pero mientras el usuario
// esté activo la sesión nunca debería cortarse: el refresh token vive 7
// días y el backend lo renueva (rota) en cada uso, así que mientras haya
// al menos una petición cada 7 días la sesión es efectivamente infinita.
// Ahora los tokens van en cookies httpOnly (no accesibles por JS) — el
// navegador las envía con `credentials: include`. Se mantiene fallback a
// `Authorization: Bearer` para sesiones viejas/móvil.
let refreshPromise = null;

function irALogin() {
  clearSession();
  // Intenta limpiar cookies httpOnly en el backend (fire-and-forget)
  try {
    fetch(`${API_URL}/auth/logout`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
  } catch {}
  if (typeof window !== "undefined") window.location.href = "/login";
}

async function refrescarSesion() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = typeof window !== "undefined" ? localStorage.getItem("corbana_refresh_token") : null;
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(refreshToken ? { refreshToken } : {}),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "No se pudo renovar la sesión");

    saveSession(data.data);
    return data.data.accessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

const getAccessToken = () => (typeof window !== "undefined" ? localStorage.getItem("corbana_access_token") : null);

export async function apiFetch(path, options = {}) {
  const doFetch = (token) =>
    fetch(`${API_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

  let res = await doFetch(getAccessToken());

  if (res.status === 401) {
    try {
      const nuevoToken = await refrescarSesion();
      res = await doFetch(nuevoToken || getAccessToken());
    } catch {
      irALogin();
      throw new Error("Sesión expirada");
    }
    if (res.status === 401) {
      irALogin();
      throw new Error("Sesión expirada");
    }
  }

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || "Error en la petición");
  }
  return data.data;
}

// Para descargas de archivos (Excel, etc.) donde la respuesta no es JSON
// sino un blob binario — mismo refresh silencioso que apiFetch.
export async function apiFetchBlob(path) {
  const doFetch = (token) =>
    fetch(`${API_URL}${path}`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  let res = await doFetch(getAccessToken());

  if (res.status === 401) {
    try {
      const nuevoToken = await refrescarSesion();
      res = await doFetch(nuevoToken || getAccessToken());
    } catch {
      irALogin();
      throw new Error("Sesión expirada");
    }
    if (res.status === 401) {
      irALogin();
      throw new Error("Sesión expirada");
    }
  }

  if (!res.ok) {
    let msg = "Error al exportar";
    try {
      const j = await res.json();
      msg = j.message || msg;
    } catch {
      try {
        msg = await res.text();
      } catch {}
    }
    throw new Error(msg);
  }

  return res.blob();
}

// Para subir archivos (multipart/form-data): no fijar Content-Type, el
// navegador lo arma solo con el boundary correcto.
export async function apiUpload(path, file) {
  return apiUploadCampo(path, "file", file);
}

// Igual que apiUpload, pero permite elegir el nombre del campo del
// multipart (el backend a veces espera otro distinto de "file", ej. "pdf"
// para adjuntar el PDF de una visita al aviso de revisión) y un nombre de
// archivo explícito — necesario cuando `valor` es un Blob (sin `.name`
// propio, a diferencia de un File elegido en un <input>).
export async function apiUploadCampo(path, campo, valor, nombreArchivo) {
  const doUpload = (token) => {
    const formData = new FormData();
    if (nombreArchivo) formData.append(campo, valor, nombreArchivo);
    else formData.append(campo, valor);
    return fetch(`${API_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
  };

  let res = await doUpload(getAccessToken());

  if (res.status === 401) {
    try {
      const nuevoToken = await refrescarSesion();
      res = await doUpload(nuevoToken || getAccessToken());
    } catch {
      irALogin();
      throw new Error("Sesión expirada");
    }
    if (res.status === 401) {
      irALogin();
      throw new Error("Sesión expirada");
    }
  }

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || "Error al subir el archivo");
  }
  return data.data;
}

// Igual que apiUpload, pero usando XMLHttpRequest para poder reportar el
// progreso real de la subida (bytes enviados) — fetch no expone eso.
// `campos` permite mandar datos extra junto al archivo (ej. { dryRun: true }).
// `file` es opcional: al confirmar una carga con saldos negativos, el
// backend reutiliza la validación ya cacheada por progressToken y no hace
// falta volver a subir el archivo completo.
export function apiUploadConProgreso(path, file, onProgress, campos = {}) {
  const intentar = (token) =>
    new Promise((resolve, reject) => {
      const formData = new FormData();
      if (file) formData.append("file", file);
      Object.entries(campos).forEach(([key, value]) => formData.append(key, String(value)));

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_URL}${path}`);
      xhr.withCredentials = true;
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      });

      xhr.onload = () => {
        if (xhr.status === 401) {
          resolve({ necesitaRefresh: true });
          return;
        }
        let data;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          reject(new Error("Respuesta inválida del servidor"));
          return;
        }
        if (xhr.status < 200 || xhr.status >= 300 || !data.success) {
          reject(new Error(data.message || "Error al subir el archivo"));
          return;
        }
        resolve({ data: data.data });
      };

      xhr.onerror = () => reject(new Error("No se pudo conectar con el servidor"));
      xhr.send(formData);
    });

  return (async () => {
    let resultado = await intentar(getAccessToken());
    if (resultado.necesitaRefresh) {
      try {
        const nuevoToken = await refrescarSesion();
        resultado = await intentar(nuevoToken || getAccessToken());
      } catch {
        irALogin();
        throw new Error("Sesión expirada");
      }
      if (resultado.necesitaRefresh) {
        irALogin();
        throw new Error("Sesión expirada");
      }
    }
    return resultado.data;
  })();
}
