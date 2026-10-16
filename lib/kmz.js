// Lectura de un .kmz / .kml con VARIAS fincas y lotes (a diferencia de
// lib/kml.js, que solo entiende un polígono suelto): devuelve la jerarquía
// carpeta (finca) → polígonos, para armar la vista previa de importación.
import JSZip from "jszip";

// Un .kmz es un zip con un doc.kml adentro; un .kml ya es el XML.
export async function leerTextoKml(file) {
  if (/\.kmz$/i.test(file.name)) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entrada = zip.file("doc.kml") || zip.file(/\.kml$/i)[0];
    if (!entrada) throw new Error("El .kmz no contiene ningún archivo .kml.");
    return entrada.async("string");
  }
  return file.text();
}

function hijos(el, tag) {
  return [...el.children].filter((c) => c.localName === tag);
}

function nombreDe(el) {
  return (hijos(el, "name")[0]?.textContent || "").trim();
}

// Anillo exterior del polígono como pares [lat, lng] (KML trae lon,lat,alt).
function anillo(placemark) {
  const coords = placemark.querySelector("Polygon outerBoundaryIs LinearRing coordinates");
  if (!coords) return null;
  const puntos = coords.textContent
    .trim()
    .split(/\s+/)
    .map((t) => t.split(",").map(Number))
    .filter(([lon, lat]) => Number.isFinite(lat) && Number.isFinite(lon))
    .map(([lon, lat]) => [Math.round(lat * 1e7) / 1e7, Math.round(lon * 1e7) / 1e7]);
  if (puntos.length > 1 && puntos[0][0] === puntos[puntos.length - 1][0] && puntos[0][1] === puntos[puntos.length - 1][1]) puntos.pop();
  return puntos.length >= 3 ? puntos : null;
}

const redondear = (n) => Math.round(n * 1e7) / 1e7;

function lista(coords) {
  return coords.textContent
    .trim()
    .split(/\s+/)
    .map((t) => t.split(",").map(Number))
    .filter(([lon, lat]) => Number.isFinite(lat) && Number.isFinite(lon))
    .map(([lon, lat]) => [redondear(lat), redondear(lon)]);
}

// Geometría de una marca: polígono, línea o punto (coordenadas como [lat, lng]).
function geometriaDe(pm) {
  const poli = anillo(pm);
  if (poli) return { geometria: "POLIGONO", coordenadas: poli };
  const linea = pm.querySelector("LineString coordinates");
  if (linea) {
    const pts = lista(linea);
    return pts.length >= 2 ? { geometria: "LINEA", coordenadas: pts } : null;
  }
  const punto = pm.querySelector("Point coordinates");
  if (punto) {
    const pts = lista(punto);
    return pts.length ? { geometria: "PUNTO", coordenadas: pts[0] } : null;
  }
  return null;
}

// Categoría de capa según el nombre de la subcarpeta.
export function categoriaDeCarpeta(nombre) {
  const n = normalizarNombre(nombre);
  if (/cable/.test(n)) return "VIA_CABLE";
  if (/canal|drenaje/.test(n)) return "CANAL";
  if (/parcela/.test(n)) return "PARCELA";
  if (/riego/.test(n)) return "RIEGO";
  if (/trinche/.test(n)) return "TRINCHEO";
  return "OTRO";
}

export const NOMBRES_CATEGORIA = {
  VIA_CABLE: "Vías de cable",
  CANAL: "Canales y drenajes",
  PARCELA: "Parcelas",
  RIEGO: "Riego",
  TRINCHEO: "Trincheo",
  PUNTO: "Puntos",
  OTRO: "Otros",
};

function subtipoDe(nombre) {
  const n = normalizarNombre(nombre);
  for (const k of ["primario", "secundario", "terciario", "reservorio", "madre"]) if (n.includes(k)) return k.charAt(0).toUpperCase() + k.slice(1);
  return null;
}

// → [{ carpeta, finca: [{ id, nombre, perimetro }], lotes: [{ id, nombre, perimetro }] }]
// `finca` = polígonos sueltos directamente en la carpeta de la finca (candidatos
// a perímetro de la finca); `lotes` = los de la subcarpeta "Lotes".
export function parseKmlJerarquia(texto) {
  const doc = new DOMParser().parseFromString(texto, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("El archivo no es un KML válido.");
  const raiz = doc.querySelector("Document") || doc.documentElement;
  // Si todo viene envuelto en una carpeta general (ej. "Agropecuaria La
  // Leyenda"), las fincas son sus subcarpetas.
  let contenedor = raiz;
  const sueltas = hijos(contenedor, "Folder");
  if (sueltas.length === 1 && hijos(sueltas[0], "Folder").length > 0 && hijos(sueltas[0], "Placemark").length === 0) {
    contenedor = sueltas[0];
  }
  let seq = 0;
  const poligonos = (el) =>
    hijos(el, "Placemark")
      .map((pm) => ({ id: `p${seq++}`, nombre: nombreDe(pm), perimetro: anillo(pm) }))
      .filter((p) => p.perimetro);

  // Elementos (cualquier geometría) de una carpeta, incluidas sus subcarpetas.
  const elementos = (el) =>
    [...el.querySelectorAll("Placemark")]
      .map((pm) => {
        const g = geometriaDe(pm);
        const nombre = nombreDe(pm);
        return g ? { id: `e${seq++}`, nombre, subtipo: subtipoDe(nombre), ...g } : null;
      })
      .filter(Boolean);

  return hijos(contenedor, "Folder")
    .map((carpeta) => {
      const subLotes = hijos(carpeta, "Folder").find((f) => nombreDe(f).toLowerCase() === "lotes");
      // Capas: cada subcarpeta (menos "Lotes") agrupada por categoría; los
      // puntos sueltos de la carpeta de la finca van a PUNTO.
      const porCategoria = new Map();
      const agregar = (categoria, items, origen) => {
        if (!items.length) return;
        const previo = porCategoria.get(categoria) || { categoria, carpetas: [], elementos: [] };
        if (!previo.carpetas.includes(origen)) previo.carpetas.push(origen);
        previo.elementos.push(...items);
        porCategoria.set(categoria, previo);
      };
      for (const sub of hijos(carpeta, "Folder")) {
        if (sub === subLotes) continue;
        const items = elementos(sub);
        const cat = categoriaDeCarpeta(nombreDe(sub));
        // Los puntos de una subcarpeta no son del tipo de la capa: van aparte.
        agregar(cat, items.filter((i) => i.geometria !== "PUNTO"), nombreDe(sub));
        agregar("PUNTO", items.filter((i) => i.geometria === "PUNTO"), nombreDe(sub));
      }
      const sueltosPuntos = hijos(carpeta, "Placemark")
        .map((pm) => {
          const g = geometriaDe(pm);
          return g && g.geometria === "PUNTO" ? { id: `e${seq++}`, nombre: nombreDe(pm), subtipo: null, ...g } : null;
        })
        .filter(Boolean);
      agregar("PUNTO", sueltosPuntos, nombreDe(carpeta));
      return {
        carpeta: nombreDe(carpeta),
        finca: poligonos(carpeta),
        lotes: subLotes ? poligonos(subLotes) : [],
        capas: [...porCategoria.values()],
      };
    })
    .filter((c) => c.finca.length > 0 || c.lotes.length > 0 || c.capas.length > 0);
}

export const normalizarNombre = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// "Lote 5" / "lote 05" → 5; cualquier otro nombre → null.
export function numeroDeLote(nombre) {
  const m = /^lote\s*0*(\d+)$/i.exec((nombre || "").trim());
  return m ? Number(m[1]) : null;
}
