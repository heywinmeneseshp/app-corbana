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

// Para subir archivos (multipart/form-data): no fijar Content-Type, el
// navegador lo arma solo con el boundary correcto.
export async function apiUpload(path, file) {
  const token = typeof window !== "undefined" ? localStorage.getItem("corbana_access_token") : null;
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (res.status === 401) {
    localStorage.removeItem("corbana_access_token");
    localStorage.removeItem("corbana_refresh_token");
    window.location.href = "/login";
    throw new Error("Sesión expirada");
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
export function apiUploadConProgreso(path, file, onProgress, campos = {}) {
  const token = typeof window !== "undefined" ? localStorage.getItem("corbana_access_token") : null;
  const formData = new FormData();
  formData.append("file", file);
  Object.entries(campos).forEach(([key, value]) => formData.append(key, String(value)));

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}${path}`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    });

    xhr.onload = () => {
      if (xhr.status === 401) {
        localStorage.removeItem("corbana_access_token");
        localStorage.removeItem("corbana_refresh_token");
        window.location.href = "/login";
        reject(new Error("Sesión expirada"));
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
      resolve(data.data);
    };

    xhr.onerror = () => reject(new Error("No se pudo conectar con el servidor"));
    xhr.send(formData);
  });
}
