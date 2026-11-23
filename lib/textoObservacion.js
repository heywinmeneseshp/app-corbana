// Observaciones escritas en un solo bloque con puntos numerados («1. ... 2. ... 3. ...»): cada punto pasa a su propia línea.
// Respeta los saltos de línea que ya tenga el texto. Solo corta antes de «N. » (número, punto y espacio), así no rompe
// cosas como «lotes 6 y 7» o «20.5».
export function separarPuntos(texto) {
  if (!texto) return "";
  return String(texto)
    .replace(/\r\n/g, "\n")
    .replace(/\s+(?=\d{1,2}\.\s)/g, "\n")
    .trim();
}

// Líneas del texto ya separado (para PDF y Word).
export const lineasObservacion = (texto) => separarPuntos(texto).split("\n").filter((l) => l.trim());
