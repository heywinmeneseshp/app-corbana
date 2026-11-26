// Prepara el KML de un recorrido para verlo en Google Earth (el que va en el KMZ del correo del comprobante).
// Los KML que llegan de los vuelos traen las líneas sin estilo (Google Earth las pinta blancas y de 1 px, casi invisibles sobre
// la imagen satelital) y sin punto de vista (al abrirlo no se mueve a la finca). Sin tocar los recorridos, se agrega:
// - un estilo de línea roja y gruesa (y relleno amarillo para polígonos) aplicado a todos los Placemark;
// - un LookAt centrado en el recorrido, para que Google Earth vaya directo a la finca.
const ESTILO_ID = "corbanaRecorrido";
const ESTILO = `<Style id="${ESTILO_ID}"><LineStyle><color>ff0000ff</color><width>3</width></LineStyle><PolyStyle><color>5500ffff</color></PolyStyle><IconStyle><scale>0.6</scale></IconStyle></Style>`;

function lookAtDe(texto) {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const bloque of texto.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/g)) {
    for (const par of bloque[1].trim().split(/\s+/)) {
      const [lng, lat] = par.split(",").map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }
  if (!Number.isFinite(minLat)) return "";
  const lat = (minLat + maxLat) / 2;
  const lng = (minLng + maxLng) / 2;
  // Distancia de cámara según el tamaño del recorrido (grados -> metros aprox.), entre 800 m y 60 km.
  const extension = Math.max(maxLat - minLat, (maxLng - minLng) * Math.cos((lat * Math.PI) / 180)) * 111000;
  const rango = Math.min(60000, Math.max(800, extension * 2.2));
  return `<LookAt><longitude>${lng.toFixed(6)}</longitude><latitude>${lat.toFixed(6)}</latitude><altitude>0</altitude><heading>0</heading><tilt>0</tilt><range>${Math.round(rango)}</range></LookAt>`;
}

export function prepararKmlParaEarth(texto) {
  let t = String(texto || "");
  if (!/<kml[\s>]/i.test(t)) return t;
  const lookAt = lookAtDe(t);
  // Todas las geometrías con el estilo visible (se quitan las referencias a estilos vacíos del archivo original).
  t = t.replace(/<styleUrl>[\s\S]*?<\/styleUrl>/g, "");
  // La referencia al estilo va justo antes de la geometría de cada Placemark (orden del esquema KML).
  t = t.replace(/(<Placemark(?:\s[^>]*)?>[\s\S]*?)(<(?:LineString|Polygon|Point|MultiGeometry|LinearRing|gx:Track|gx:MultiTrack)[\s>])/g, `$1<styleUrl>#${ESTILO_ID}</styleUrl>$2`);
  // El estilo compartido va en el primer Document (la norma KML solo los admite ahí); el punto de vista, en el primer
  // Document o Folder (el que abre Google Earth).
  const doc = /<Document(\s[^>]*)?>/.exec(t);
  const primero = /<(Document|Folder)(\s[^>]*)?>/.exec(t);
  if (doc) {
    const pos = doc.index + doc[0].length;
    t = `${t.slice(0, pos)}${ESTILO}${t.slice(pos)}`;
    const p1 = /<(Document|Folder)(\s[^>]*)?>/.exec(t);
    const pos1 = p1.index + p1[0].length;
    t = `${t.slice(0, pos1)}${lookAt}${t.slice(pos1)}`;
  } else if (primero) {
    t = t.replace(/(<kml[^>]*>)/, `$1<Document>${lookAt}${ESTILO}`).replace(/<\/kml>\s*$/, "</Document></kml>");
  } else {
    t = t.replace(/(<kml[^>]*>)/, `$1<Document>${lookAt}${ESTILO}`).replace(/<\/kml>\s*$/, "</Document></kml>");
  }
  return t;
}
