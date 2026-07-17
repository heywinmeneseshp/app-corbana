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

export default calcularColorSemana;
