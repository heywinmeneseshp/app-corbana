// Imagen estática (PNG en data URL) de un mapa satelital con el recorrido de una aplicación y el perímetro de la finca, para el
// PDF del comprobante. Se arma en un canvas con las teselas satelitales de Esri (las mismas de los mapas de la app); si no cargan
// (sin internet o bloqueadas), queda el dibujo sobre fondo gris.
const TESELAS = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const TAM = 256;

const lngAX = (lng, z) => ((lng + 180) / 360) * TAM * 2 ** z;
const latAY = (lat, z) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * TAM * 2 ** z;
};

const cargarImagen = (url) =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

// `geometria`: { lineas, poligonos, puntos } en [lat, lng]; `perimetro`: [[lat, lng]] de la finca (opcional).
// `satelite: false`: solo el dibujo sobre fondo gris (se usa si las teselas no dejan leer el canvas).
export async function renderMapaRecorrido({ geometria, perimetro = null, ancho = 1600, alto = 1100, satelite = true }) {
  const todos = [...(geometria?.lineas || []).flat(), ...(geometria?.poligonos || []).flat(), ...(geometria?.puntos || []), ...(perimetro || [])];
  if (!todos.length) return null;
  const lats = todos.map((p) => p[0]);
  const lngs = todos.map((p) => p[1]);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];

  // Zoom más alto en el que todo cabe con un margen del 10 %.
  let z = 19;
  for (; z > 3; z--) {
    const w = lngAX(maxLng, z) - lngAX(minLng, z);
    const h = latAY(minLat, z) - latAY(maxLat, z);
    if (w <= ancho * 0.8 && h <= alto * 0.8) break;
  }
  const cx = (lngAX(minLng, z) + lngAX(maxLng, z)) / 2;
  const cy = (latAY(minLat, z) + latAY(maxLat, z)) / 2;
  const x0 = cx - ancho / 2;
  const y0 = cy - alto / 2;
  const aPixel = ([lat, lng]) => [lngAX(lng, z) - x0, latAY(lat, z) - y0];

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(0, 0, ancho, alto);

  // Teselas satelitales.
  const n = 2 ** z;
  const tiles = [];
  for (let tx = Math.floor(x0 / TAM); satelite && tx <= Math.floor((x0 + ancho) / TAM); tx++) {
    for (let ty = Math.floor(y0 / TAM); ty <= Math.floor((y0 + alto) / TAM); ty++) {
      if (ty < 0 || ty >= n) continue;
      const txN = ((tx % n) + n) % n;
      tiles.push(cargarImagen(TESELAS.replace("{z}", z).replace("{x}", txN).replace("{y}", ty)).then((img) => ({ img, tx, ty })));
    }
  }
  let conSatelite = false;
  for (const { img, tx, ty } of await Promise.all(tiles)) {
    if (!img) continue;
    ctx.drawImage(img, tx * TAM - x0, ty * TAM - y0, TAM, TAM);
    conSatelite = true;
  }

  const trazo = (pts, cerrar) => {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const [x, y] = aPixel(p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    if (cerrar) ctx.closePath();
  };
  // Perímetro de la finca: blanco discontinuo.
  if (perimetro?.length > 2) {
    ctx.setLineDash([14, 10]);
    ctx.lineWidth = 4;
    ctx.strokeStyle = conSatelite ? "#ffffff" : "#334155";
    trazo(perimetro, true);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Polígonos del KML (área asperjada): amarillo translúcido.
  for (const pg of geometria?.poligonos || []) {
    trazo(pg, true);
    ctx.fillStyle = "rgba(250, 204, 21, 0.30)";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#facc15";
    ctx.stroke();
  }
  // Recorrido: rojo con borde oscuro para que se vea sobre el satélite.
  for (const linea of geometria?.lineas || []) {
    trazo(linea, false);
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.stroke();
    trazo(linea, false);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ef4444";
    ctx.stroke();
  }
  for (const p of geometria?.puntos || []) {
    const [x, y] = aPixel(p);
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
  }
  if (conSatelite) {
    ctx.font = "16px Helvetica, Arial, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText("Imágenes © Esri", ancho - 140, alto - 12);
  }
  try {
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    // Si alguna tesela no permitió leer el canvas (CORS), se repite sin satélite.
    return satelite ? renderMapaRecorrido({ geometria, perimetro, ancho, alto, satelite: false }) : null;
  }
}
