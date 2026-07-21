// Cinta de color que se usa físicamente al embolsar cada racimo en la
// semana correspondiente. Debe coincidir con
// api-rest-corbana/src/utils/semanaColor.js.
export const COLORES_SEMANA = ["Azul", "Blanco", "Amarillo", "Morado", "Rojo", "Café", "Negro", "Verde"];

export function calcularColorSemana(anio, numeroSemana) {
  if (numeroSemana === 53) return "Gris";
  const esAnioImpar = anio % 2 !== 0;
  const indiceInicio = esAnioImpar ? COLORES_SEMANA.indexOf("Rojo") : COLORES_SEMANA.indexOf("Azul");
  const indice = (indiceInicio + (numeroSemana - 1)) % COLORES_SEMANA.length;
  return COLORES_SEMANA[indice];
}

export const COLOR_HEX = {
  Azul: "#2563eb",
  Blanco: "#f8fafc",
  Amarillo: "#eab308",
  Morado: "#7c3aed",
  Rojo: "#dc2626",
  Café: "#78350f",
  Negro: "#111827",
  Verde: "#16a34a",
  Gris: "#6b7280",
};

// Texto blanco o negro segun el brillo del fondo, para que el numero de
// semana se lea bien sobre cualquiera de los 9 colores.
export const COLOR_TEXT = {
  Azul: "#ffffff",
  Blanco: "#111827",
  Amarillo: "#111827",
  Morado: "#ffffff",
  Rojo: "#ffffff",
  Café: "#ffffff",
  Negro: "#ffffff",
  Verde: "#ffffff",
  Gris: "#ffffff",
};

// Un <option> nativo no puede llevar un <span> con background-color, así
// que para mostrar el punto de color dentro de la lista desplegable se usa
// un emoji de círculo del color más parecido.
export const COLOR_EMOJI = {
  Azul: "🔵",
  Blanco: "⚪",
  Amarillo: "🟡",
  Morado: "🟣",
  Rojo: "🔴",
  Café: "🟤",
  Negro: "⚫",
  Verde: "🟢",
  Gris: "⚪",
};

// Últimas `cantidad` semanas contando hacia atrás desde `semanaReferenciaUuid`
// (incluida), tomadas de una lista de semanas ya cargada en el cliente —no
// requiere ir al servidor ni calcular saldos. Cada semana devuelta incluye
// su `color` y su `edadSemanas` relativa a la semana de referencia (la
// semana de referencia misma tiene edad 1).
export function ultimasSemanasConEdad(semanas, semanaReferenciaUuid, cantidad) {
  if (!semanas || semanas.length === 0) return [];
  const referencia = semanas.find((s) => s.uuid === semanaReferenciaUuid);
  if (!referencia) return [];

  const ordenadas = [...semanas].sort((a, b) => (a.fechaInicio < b.fechaInicio ? -1 : 1));
  const idxReferencia = ordenadas.findIndex((s) => s.uuid === semanaReferenciaUuid);
  const desde = Math.max(0, idxReferencia - (cantidad - 1));

  return ordenadas
    .slice(desde, idxReferencia + 1)
    .map((s) => ({
      ...s,
      color: s.color || calcularColorSemana(s.anio, s.numeroSemana),
      edadSemanas:
        Math.round((new Date(referencia.fechaInicio) - new Date(s.fechaInicio)) / (7 * 86400000)) + 1,
    }))
    .reverse();
}

export default calcularColorSemana;
