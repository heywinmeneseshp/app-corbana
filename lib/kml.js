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

// Arma un .kml mínimo (un solo Placemark con un Polygon) a partir de un
// array de pares [lat, lng] — el inverso de parseKmlPolygon, para exportar
// el perímetro guardado de una finca.
export function buildKmlFromPolygon(posiciones, nombre = "perimetro") {
  const coordenadas = posiciones.map(([lat, lon]) => `${lon},${lat},0`).join(" ");
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
