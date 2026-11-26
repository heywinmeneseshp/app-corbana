// Observaciones escritas en un solo bloque con puntos numerados («1. ... 2. ... 3. ...»): cada punto pasa a su propia línea.
// Respeta los saltos de línea que ya tenga el texto. Solo corta ante una numeración en secuencia (1., luego 2., luego 3.…), así
// un número suelto dentro de una frase («hojas 6 y 7. Sin embargo…», «lotes 6 y 7», «20.5») no se separa.
export function separarPuntos(texto) {
  if (!texto) return "";
  const limpio = String(texto).replace(/\r\n/g, "\n");
  // Si el texto ya empieza con «1.», el siguiente punto esperado es el 2.
  let siguiente = /^\s*1\.\s/.test(limpio) ? 2 : 1;
  return limpio
    .replace(/(\s+)(\d{1,2})\.(?=\s)/g, (completo, espacio, n) => {
      if (Number(n) !== siguiente) return completo;
      siguiente += 1;
      return `\n${n}.`;
    })
    .trim();
}

// Líneas del texto ya separado (para PDF y Word).
export const lineasObservacion = (texto) => separarPuntos(texto).split("\n").filter((l) => l.trim());

// «•» y «·» pueden ir pegados al texto («•Reforzar…»); el guion y el asterisco necesitan un espacio después («-5 °C» no es viñeta).
const VINETA = /^\s*(?:[•·]\s*|[-*–]\s+)/;
const NUMERO = /^\s*(\d{1,2})[.)]\s+/;

// Bloques para dibujar la observación con estructura:
// - «titulo»: línea corta que termina en «:» (ej. «Recomendaciones:»).
// - «vineta»: empieza con •, ·, - o * (se dibuja con sangría).
// - «numero»: empieza con «1.», «2)»… (también con sangría; `marca` es el número).
// - «parrafo»: el resto.
export function bloquesObservacion(texto) {
  return lineasObservacion(texto).map((linea) => {
    const t = linea.trim();
    if (VINETA.test(t)) return { tipo: "vineta", marca: "•", texto: t.replace(VINETA, "") };
    const num = t.match(NUMERO);
    if (num) return { tipo: "numero", marca: `${num[1]}.`, texto: t.replace(NUMERO, "") };
    if (t.endsWith(":") && t.length <= 80) return { tipo: "titulo", texto: t };
    return { tipo: "parrafo", texto: t };
  });
}
