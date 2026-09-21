// Sella una foto de evidencia con fecha/hora, usuario y ubicación GPS
// (mejor esfuerzo — si el navegador no tiene GPS o el usuario no da
// permiso, igual se sube la foto, solo que sin esa línea) quemados
// directamente en la imagen, como una marca de agua — así queda visible
// aunque se descargue o comparta la foto suelta. Usado por toda foto de
// evidencia de una prueba de mezcla (etapas y homogeneidad).

function obtenerUbicacion() {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 },
    );
  });
}

function cargarImagen(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

// Sella una foto — si algo falla (imagen no soportada, canvas bloqueado,
// etc.) devuelve el archivo ORIGINAL sin sello en vez de bloquear la
// subida, para que un error acá nunca impida registrar la evidencia.
export async function sellarFoto(file, { usuario } = {}) {
  try {
    const [img, ubicacion] = await Promise.all([cargarImagen(file), obtenerUbicacion()]);

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    const fecha = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "medium" });
    const lineas = [
      fecha,
      usuario ? `Usuario: ${usuario}` : null,
      ubicacion ? `GPS: ${ubicacion.lat.toFixed(6)}, ${ubicacion.lon.toFixed(6)}` : "Ubicación no disponible",
    ].filter(Boolean);

    const fontSize = Math.max(14, Math.round(canvas.width * 0.022));
    const lineHeight = fontSize * 1.4;
    const padding = fontSize * 0.6;
    const alturaBanda = lineHeight * lineas.length + padding * 2;

    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, canvas.height - alturaBanda, canvas.width, alturaBanda);

    ctx.fillStyle = "#ffffff";
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textBaseline = "top";
    lineas.forEach((linea, i) => {
      ctx.fillText(linea, padding, canvas.height - alturaBanda + padding + i * lineHeight);
    });

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return file;
    const nombre = file.name?.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${nombre}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

// Sella varios archivos en paralelo.
export async function sellarFotos(files, opts) {
  return Promise.all(files.map((file) => sellarFoto(file, opts)));
}

export default sellarFoto;
