// Dominio del eje Y de una gráfica de líneas ajustado a los datos visibles:
// va del punto más bajo al más alto (con un pequeño margen y redondeado a un
// paso "bonito") en vez de arrancar siempre en 0 — así la gráfica aprovecha
// mejor el alto disponible. Se usa como `domain={dominioAjustado}` en <YAxis>:
// recharts lo llama con [min, max] de los datos que se están mostrando (por
// eso se reajusta solo al acotar el rango de semanas con el slider).
export function dominioAjustado([min, max]) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    const margen = Math.abs(min) * 0.1 || 1;
    return [min - margen, max + margen];
  }
  const rango = max - min;
  const bruto = rango / 4;
  const magnitud = 10 ** Math.floor(Math.log10(bruto));
  const norm = bruto / magnitud;
  const paso = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * magnitud;
  let bajo = Math.floor((min - rango * 0.03) / paso) * paso;
  let alto = Math.ceil((max + rango * 0.03) / paso) * paso;
  // Datos que nunca bajan de 0 (lluvia, cajas, porcentajes) no muestran eje negativo.
  if (min >= 0) bajo = Math.max(0, bajo);
  if (max <= 0) alto = Math.min(0, alto);
  // Evita decimales flotantes raros (0.30000000000000004).
  const limpiar = (n) => Number(n.toPrecision(12));
  return [limpiar(bajo), limpiar(alto)];
}

export default dominioAjustado;

// Eje Y completo (dominio + marcas parejas) a partir de los valores visibles:
// del punto más bajo al más alto, con marcas cada "paso bonito" (ej. 0, 50,
// 100, 150) en vez de las que recharts elige solo (0, 40, 80, 120, 150).
// Devuelve null si no hay valores.
export function ejeAjustado(valores) {
  const nums = (valores || []).filter((v) => v !== null && v !== undefined && Number.isFinite(Number(v))).map(Number);
  if (nums.length === 0) return null;
  const [bajo, alto] = dominioAjustado([Math.min(...nums), Math.max(...nums)]);
  const rango = alto - bajo;
  const bruto = rango / 4;
  const magnitud = 10 ** Math.floor(Math.log10(bruto));
  const norm = bruto / magnitud;
  const paso = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * magnitud;
  const ticks = [];
  for (let t = bajo; t <= alto + paso / 1000; t += paso) ticks.push(Number(t.toPrecision(12)));
  return { domain: [bajo, alto], ticks };
}
