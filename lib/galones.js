// Convierte una cantidad de volumen a galones (galón US = 3,785411784 L) según el símbolo o nombre de su unidad.
// Devuelve null si la unidad no es de volumen conocida (en ese caso se muestra la cantidad en su unidad original).
const LITROS_POR = {
  l: 1,
  lt: 1,
  lts: 1,
  litro: 1,
  litros: 1,
  ml: 0.001,
  mililitro: 0.001,
  mililitros: 0.001,
  cc: 0.001,
  m3: 1000,
  gal: 3.785411784,
  gl: 3.785411784,
  gln: 3.785411784,
  galon: 3.785411784,
  galón: 3.785411784,
  galones: 3.785411784,
};
const LITROS_POR_GALON = 3.785411784;

export function aGalones(cantidad, unidad) {
  if (cantidad === null || cantidad === undefined || cantidad === "") return null;
  const claves = [unidad?.simbolo, unidad?.nombre].filter(Boolean).map((t) => String(t).trim().toLowerCase().replace(/\.$/, ""));
  for (const k of claves) if (LITROS_POR[k] !== undefined) return (Number(cantidad) * LITROS_POR[k]) / LITROS_POR_GALON;
  return null;
}

// «520,9 gal» (o la cantidad en su unidad si no es de volumen).
export function textoGalones(cantidad, unidad, fmt = (n) => n.toLocaleString("es-CO", { maximumFractionDigits: 1 })) {
  if (cantidad === null || cantidad === undefined || cantidad === "") return "—";
  const g = aGalones(cantidad, unidad);
  return g === null ? `${fmt(Number(cantidad))} ${unidad?.simbolo || ""}`.trim() : `${fmt(g)} gal`;
}
