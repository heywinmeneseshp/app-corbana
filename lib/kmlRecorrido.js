import JSZip from "jszip";

// Recorrido de una aplicación (vuelo del dron o del avión) leído de un KML o KMZ: líneas (LineString, gx:Track), polígonos y
// puntos, en [lat, lng]. Se simplifica para el mapa del PDF (los registros de vuelo traen miles de puntos).

const MAX_PUNTOS_LINEA = 1500;

const pares = (texto) =>
  String(texto || "")
    .trim()
    .split(/\s+/)
    .map((t) => t.split(",").map(Number))
    .filter(([lng, lat]) => Number.isFinite(lat) && Number.isFinite(lng))
    .map(([lng, lat]) => [lat, lng]);

// Douglas-Peucker sobre [lat, lng] (tolerancia en grados); garantiza a lo sumo `max` puntos subiendo la tolerancia.
function simplificar(puntos, max = MAX_PUNTOS_LINEA) {
  if (puntos.length <= max) return puntos;
  const dp = (pts, tol) => {
    if (pts.length < 3) return pts;
    const [a, b] = [pts[0], pts[pts.length - 1]];
    let maxD = 0;
    let idx = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i];
      const num = Math.abs((b[1] - a[1]) * (a[0] - p[0]) - (a[1] - p[1]) * (b[0] - a[0]));
      const den = Math.hypot(b[1] - a[1], b[0] - a[0]) || 1e-12;
      const d = num / den;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD <= tol) return [a, b];
    return [...dp(pts.slice(0, idx + 1), tol).slice(0, -1), ...dp(pts.slice(idx), tol)];
  };
  let tol = 0.000005;
  let res = dp(puntos, tol);
  while (res.length > max && tol < 1) {
    tol *= 2;
    res = dp(puntos, tol);
  }
  return res.map(([lat, lng]) => [Math.round(lat * 1e6) / 1e6, Math.round(lng * 1e6) / 1e6]);
}

export function parseKmlRecorrido(texto) {
  const doc = new DOMParser().parseFromString(texto, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("El archivo no es un KML válido.");
  const porNombre = (nombre) => [...doc.getElementsByTagName("*")].filter((el) => el.localName === nombre);

  const lineas = porNombre("LineString")
    .map((ls) => pares(ls.getElementsByTagName("coordinates")[0]?.textContent))
    .filter((l) => l.length > 1);
  // gx:Track: <gx:coord>lng lat alt</gx:coord>
  for (const track of porNombre("Track")) {
    const pts = [...track.getElementsByTagName("*")]
      .filter((el) => el.localName === "coord")
      .map((el) => el.textContent.trim().split(/\s+/).map(Number))
      .filter(([lng, lat]) => Number.isFinite(lat) && Number.isFinite(lng))
      .map(([lng, lat]) => [lat, lng]);
    if (pts.length > 1) lineas.push(pts);
  }
  const poligonos = porNombre("Polygon")
    .map((pg) => {
      const outer = [...pg.getElementsByTagName("*")].find((el) => el.localName === "outerBoundaryIs") || pg;
      return pares(outer.getElementsByTagName("coordinates")[0]?.textContent);
    })
    .filter((p) => p.length > 2);
  const puntos = porNombre("Point")
    .map((pt) => pares(pt.getElementsByTagName("coordinates")[0]?.textContent)[0])
    .filter(Boolean);

  if (!lineas.length && !poligonos.length && !puntos.length) throw new Error("El KML no tiene recorridos, polígonos ni puntos.");
  // Reparte el máximo de puntos entre las líneas según su tamaño.
  const totalLineas = lineas.reduce((s, l) => s + l.length, 0) || 1;
  return {
    lineas: lineas.map((l) => simplificar(l, Math.max(50, Math.round((MAX_PUNTOS_LINEA * 2 * l.length) / totalLineas)))),
    poligonos: poligonos.map((p) => simplificar(p, 600)),
    puntos: puntos.slice(0, 500),
    totalPuntosOriginales: lineas.reduce((s, l) => s + l.length, 0) + poligonos.reduce((s, p) => s + p.length, 0) + puntos.length,
  };
}

// Lee un .kml o .kmz (el KMZ es un zip con el KML adentro). Devuelve { kmlTexto, nombreKml, geometria }.
export async function leerArchivoRecorrido(file) {
  let texto;
  let nombre = file.name;
  if (/\.kmz$/i.test(file.name)) {
    const zip = await JSZip.loadAsync(file);
    const entrada = Object.values(zip.files).find((f) => !f.dir && /\.kml$/i.test(f.name));
    if (!entrada) throw new Error("El KMZ no tiene un archivo KML adentro.");
    texto = await entrada.async("string");
    nombre = file.name.replace(/\.kmz$/i, ".kml");
  } else if (/\.kml$/i.test(file.name)) {
    texto = await file.text();
  } else {
    throw new Error("El archivo debe ser .kml o .kmz.");
  }
  return { kmlTexto: texto, nombreKml: nombre, geometria: parseKmlRecorrido(texto) };
}
