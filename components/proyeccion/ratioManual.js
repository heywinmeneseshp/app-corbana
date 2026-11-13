// Aplica en pantalla, al instante, los ratios (cajas por racimo) que el usuario fijó a mano y todavía no guardó: recalcula las cajas de esas
// finca-semana y los totales por semana, por mes y del año, para que la tabla y las gráficas cambien sin esperar a «Guardar y calcular».
// Al guardar, el servidor calcula lo mismo, así que los números coinciden.
const CAMPOS = ["hectareas", "hectareasEfectivas", "embolses", "embolsesBajo", "embolsesAlto", "racimos", "cajas", "cajasBajo", "cajasAlto"];
const r2 = (n) => Math.round(n * 100) / 100;
const mesDe = (fecha) => new Date(new Date(`${fecha}T00:00:00Z`).getTime() + 3 * 86400000).getUTCMonth() + 1; // mes del jueves de la semana

export function aplicarRatioManual(resultado, ratioManual) {
  if (!resultado) return resultado;
  const manual = ratioManual || {};
  let cambio = false;
  const filas = resultado.filas.map((f) => {
    if (f.fuente === "real") return f; // semana con cosecha y cajas reales: su ratio no se toca
    const fijado = manual[f.fincaUuid]?.[f.semanaCodigo];
    const objetivo = fijado !== undefined && fijado !== null && fijado !== "" ? Number(fijado) : f.ratioManual ? f.ratioHistorico : null; // sin manual: el automático
    if (objetivo === null || !Number.isFinite(objetivo) || objetivo <= 0) return f;
    const antes = f.ratio || 0;
    if (Math.abs(objetivo - antes) < 1e-9 && Boolean(fijado) === Boolean(f.ratioManual)) return f;
    const escala = (v) => (antes > 0 ? Math.round((v || 0) * (objetivo / antes)) : Math.round((f.racimos || 0) * objetivo));
    cambio = true;
    return { ...f, ratio: objetivo, ratioManual: fijado !== undefined && fijado !== null && fijado !== "", cajas: escala(f.cajas), cajasBajo: escala(f.cajasBajo), cajasAlto: escala(f.cajasAlto) };
  });
  if (!cambio) return resultado;

  // Totales por semana, mes y año (mismas reglas que el servidor: las hectáreas son un nivel y se promedian).
  const porSemana = resultado.porSemana.map((s) => {
    const rows = filas.filter((r) => r.semanaCodigo === s.semanaCodigo);
    const t = { ...s };
    for (const c of CAMPOS) t[c] = r2(rows.reduce((a, r) => a + (r[c] || 0), 0));
    return t;
  });
  const porMes = resultado.porMes.map((m) => {
    const semanasMes = porSemana.filter((s) => mesDe(s.fechaInicio) === m.mes);
    const t = { ...m };
    for (const c of CAMPOS) t[c] = r2(semanasMes.reduce((a, s) => a + s[c], 0));
    for (const c of ["hectareas", "hectareasEfectivas"]) t[c] = semanasMes.length ? r2(semanasMes.reduce((a, s) => a + s[c], 0) / semanasMes.length) : 0;
    return t;
  });
  const anual = { ...resultado.anual };
  for (const c of CAMPOS) anual[c] = r2(porSemana.reduce((a, s) => a + s[c], 0));
  anual.hectareas = porSemana.length ? r2(porSemana.reduce((a, s) => a + s.hectareas, 0) / porSemana.length) : 0;
  anual.hectareasEfectivas = porSemana.length ? r2(porSemana.reduce((a, s) => a + s.hectareasEfectivas, 0) / porSemana.length) : 0;
  const cajasPorFinca = new Map();
  for (const f of filas) cajasPorFinca.set(f.fincaUuid, (cajasPorFinca.get(f.fincaUuid) || 0) + (f.cajas || 0));
  const aprovechamiento = (resultado.aprovechamiento || []).map((a) => (cajasPorFinca.has(a.fincaUuid) ? { ...a, cajasAnuales: cajasPorFinca.get(a.fincaUuid) } : a));
  return { ...resultado, filas, porSemana, porMes, anual, aprovechamiento };
}
