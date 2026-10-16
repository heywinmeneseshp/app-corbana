import { apiFetch } from "@/lib/api";
// Utilidades mínimas para KML de un solo polígono (perímetro de finca,
// exportado desde Google Earth Pro) — no es un parser/generador KML
// completo, solo lo necesario para este caso de uso puntual.

// Extrae el primer <coordinates>...</coordinates> dentro de un <Polygon> de
// un archivo .kml y lo convierte a un array de pares [lat, lng] — KML trae
// las coordenadas como "lon,lat,alt" separadas por espacio, así que hay que
// invertir el orden (Leaflet usa [lat, lng]).
export function parseKmlPolygon(texto) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(texto, "text/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("El archivo no es un XML/KML válido.");
  }

  const polygon = doc.querySelector("Polygon");
  if (!polygon) {
    throw new Error("El archivo no tiene ningún <Polygon> — no se encontró un perímetro para importar.");
  }
  const coordsEl = polygon.querySelector("outerBoundaryIs coordinates, coordinates");
  if (!coordsEl) {
    throw new Error("El polígono no tiene coordenadas.");
  }

  const puntos = coordsEl.textContent
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((triple) => {
      const [lon, lat] = triple.split(",").map(Number);
      return [lat, lon];
    })
    .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));

  if (puntos.length < 3) {
    throw new Error("El polígono tiene muy pocos puntos válidos.");
  }
  return puntos;
}

// `finca.perimetro` a veces llega desde la API como un array real y a veces
// como el JSON todavía sin parsear (string) — depende de cómo Sequelize/
// mysql2 devuelva la columna JSON según la consulta. Se normaliza acá una
// sola vez en vez de repetir el chequeo en cada pantalla que lo usa.
// Devuelve un array de pares [lat, lng] válidos, o null si no hay nada
// usable (menos de 3 puntos, formato irreconocible, etc.).
export function normalizarPerimetro(valor) {
  let datos = valor;
  if (typeof datos === "string") {
    try {
      datos = JSON.parse(datos);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(datos)) return null;
  const puntos = datos.filter(
    (p) => Array.isArray(p) && p.length === 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])),
  );
  return puntos.length > 2 ? puntos.map(([lat, lon]) => [Number(lat), Number(lon)]) : null;
}

// Un LinearRing de KML debe terminar en su primer punto; al guardar se quita
// ese duplicado, así que hay que volver a ponerlo o el contorno queda abierto.
function cerrarAnillo(pares) {
  const a = pares[0];
  const z = pares[pares.length - 1];
  return a[0] === z[0] && a[1] === z[1] ? pares : [...pares, a];
}

// Arma un .kml mínimo (un solo Placemark con un Polygon) a partir de un
// array de pares [lat, lng] — el inverso de parseKmlPolygon, para exportar
// el perímetro guardado de una finca.
export function buildKmlFromPolygon(posiciones, nombre = "perimetro") {
  const coordenadas = cerrarAnillo(posiciones).map(([lat, lon]) => `${lon},${lat},0`).join(" ");
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${nombre}</name>
  <Placemark>
    <name>${nombre}</name>
    <Polygon>
      <tessellate>1</tessellate>
      <outerBoundaryIs>
        <LinearRing>
          <coordinates>${coordenadas}</coordinates>
        </LinearRing>
      </outerBoundaryIs>
    </Polygon>
  </Placemark>
</Document>
</kml>
`;
}

// Descarga el KML generado como archivo — mismo patrón que cualquier
// "exportar" del sistema (crea un Blob, un link temporal y lo clickea).
export function descargarKml(posiciones, nombreArchivo) {
  const kml = buildKmlFromPolygon(posiciones, nombreArchivo.replace(/\.kml$/i, ""));
  const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo.endsWith(".kml") ? nombreArchivo : `${nombreArchivo}.kml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const coords = (pares) => pares.map(([lat, lon]) => `${lon},${lat},0`).join(" ");

// Color KML (aabbggrr) por categoría; sin relleno: Google Earth pinta los
// polígonos opacos (blancos) por defecto y taparía todo lo demás.
const COLOR_KML = { FINCA: "ff00ffff", LOTE: "fff8bd38", VIA_CABLE: "ff1673f9", CANAL: "ffeb6325", PARCELA: "ff4aa316", RIEGO: "ffd4b606", TRINCHEO: "ff0e4092", OTRO: "fff755a8" };

function placemark(nombre, geometria, c, tipo) {
  const estilo =
    geometria === "PUNTO" || !COLOR_KML[tipo]
      ? ""
      : `<Style><LineStyle><color>${COLOR_KML[tipo]}</color><width>2</width></LineStyle><PolyStyle><fill>0</fill></PolyStyle></Style>`;
  let g;
  if (geometria === "PUNTO") g = `<Point><coordinates>${c[1]},${c[0]},0</coordinates></Point>`;
  else if (geometria === "LINEA") g = `<LineString><tessellate>1</tessellate><coordinates>${coords(c)}</coordinates></LineString>`;
  else g = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coords(cerrarAnillo(c))}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
  return `<Placemark><name>${esc(nombre)}</name>${estilo}${g}</Placemark>`;
}

// Nombres de carpeta que lib/kmz.js reconoce al reimportar.
const CARPETA_CAPA = { VIA_CABLE: "Cables", CANAL: "Canales", PARCELA: "Parcelas", RIEGO: "Riego", TRINCHEO: "Trincheo", PUNTO: "Puntos", OTRO: "Otros" };

// KML completo de una finca: perímetro, lotes y capas de mapa. Reimportable
// con "Importar KMZ" (misma estructura: finca → Lotes / Cables / Canales…).
export function buildKmlFinca({ nombre, perimetro, lotes, capas }) {
  const partes = [];
  if (perimetro?.length > 2) partes.push(placemark(nombre, "POLIGONO", perimetro, "FINCA"));
  const conPerim = lotes.filter((l) => l.perimetro?.length > 2);
  if (conPerim.length) {
    partes.push(`<Folder><name>Lotes</name>${conPerim.map((l) => placemark(`Lote ${l.nombre}`, "POLIGONO", l.perimetro, "LOTE")).join("")}</Folder>`);
  }
  for (const cat of Object.keys(CARPETA_CAPA)) {
    const items = capas.filter((c) => c.categoria === cat);
    if (items.length) {
      partes.push(`<Folder><name>${CARPETA_CAPA[cat]}</name>${items.map((c) => placemark(c.nombre || "", c.geometria, c.coordenadas, cat)).join("")}</Folder>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${esc(nombre)}</name>
  <Folder><name>Fincas</name><Folder><name>${esc(nombre)}</name>${partes.join("\n")}</Folder></Folder>
</Document>
</kml>
`;
}

// Descarga el KML de la finca con sus lotes y capas (consulta la API).
export async function descargarKmlFinca(finca, nombreArchivo) {
  const [lotesRes, capasRes] = await Promise.all([
    apiFetch(`/fincas/${finca.uuid}/lotes?limit=100`),
    apiFetch(`/fincas/${finca.uuid}/capas-mapa`).catch(() => ({ items: [] })),
  ]);
  const lotes = (lotesRes.items || [])
    .filter((l) => l.estado && !l.deletedAt)
    .map((l) => ({ nombre: l.nombre, perimetro: normalizarPerimetro(l.perimetro) }));
  const kml = buildKmlFinca({
    nombre: finca.nombre || finca.codigo || "finca",
    perimetro: normalizarPerimetro(finca.perimetro),
    lotes,
    capas: capasRes.items || [],
  });
  const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreArchivo}.kml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
