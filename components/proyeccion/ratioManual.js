// Aplica en pantalla, al instante, lo que el usuario fijó a mano y todavía no guardó (ratio y embolse por hectárea): recalcula las filas afectadas y los
// totales por semana, por mes y del año, para que la tabla y las gráficas cambien sin esperar a «Guardar y calcular». Al guardar, el servidor calcula
// lo mismo, así que los números coinciden.
const CAMPOS = ["hectareas", "hectareasEfectivas", "embolses", "embolsesBajo", "embolsesAlto", "racimos", "cajas", "cajasBajo", "cajasAlto"];
const r2 = (n) => Math.round(n * 100) / 100;
const mesDe = (fecha) => new Date(new Date(`${fecha}T00:00:00Z`).getTime() + 3 * 86400000).getUTCMonth() + 1; // mes del jueves de la semana
const hayValor = (v) => v !== undefined && v !== null && v !== "";

// Totales por semana, mes y año (mismas reglas que el servidor: las hectáreas son un nivel y se promedian).
function conTotales(resultado, filas) {
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

// Ratio (cajas por racimo) fijado a mano por finca y semana: recalcula las cajas de esas semanas.
export function aplicarRatioManual(resultado, ratioManual) {
  if (!resultado) return resultado;
  const manual = ratioManual || {};
  let cambio = false;
  const filas = resultado.filas.map((f) => {
    if (f.fuente === "real") return f; // semana con cosecha y cajas reales: su ratio no se toca
    const fijado = manual[f.fincaUuid]?.[f.semanaCodigo];
    const objetivo = hayValor(fijado) ? Number(fijado) : f.ratioManual ? f.ratioHistorico : null; // sin manual: el automático
    if (objetivo === null || !Number.isFinite(objetivo) || objetivo <= 0) return f;
    const antes = f.ratio || 0;
    if (Math.abs(objetivo - antes) < 1e-9 && Boolean(hayValor(fijado)) === Boolean(f.ratioManual)) return f;
    const escala = (v) => (antes > 0 ? Math.round((v || 0) * (objetivo / antes)) : Math.round((f.racimos || 0) * objetivo));
    cambio = true;
    return { ...f, ratio: objetivo, ratioManual: hayValor(fijado), cajas: escala(f.cajas), cajasBajo: escala(f.cajasBajo), cajasAlto: escala(f.cajasAlto) };
  });
  return cambio ? conTotales(resultado, filas) : resultado;
}

// Embolse por hectárea fijado a mano por finca y semana de embolse (puede ser una cinta de 2026 o una semana de 2027): cambia el embolse de esa semana
// y, por la cadena embolse → racimos (edades 8 a 12) → cajas, los racimos y cajas de las semanas que cosechan esa cinta.
export function aplicarEmbManual(resultado, embManual) {
  if (!resultado) return resultado;
  const manual = embManual || {};
  // Datos de cada semana de embolse por finca: hectáreas efectivas, embolse aplicado, el embolse por ha automático y si el servidor ya usó un manual.
  const info = new Map();
  for (const f of resultado.filas) info.set(`${f.fincaUuid}|${f.semanaCodigo}`, { ha: f.hectareasEfectivas, embolse: f.embolses, auto: f.embolsesPorHaAuto, flag: f.embolsesPorHaManual, editable: f.fuente !== "real" });
  for (const f of resultado.filas) {
    for (const d of f.detalleEdades || []) {
      const k = `${f.fincaUuid}|${d.semanaCodigo}`;
      if (d.semanaCodigo && !info.has(k)) info.set(k, { ha: d.hectareas, embolse: d.embolse, auto: d.embolsesPorHaAuto, flag: d.embolsesPorHaManual, editable: !d.embolseReal });
    }
  }
  // Embolse que corresponde a una semana con lo escrito ahora (null = sin cambio).
  const embolseNuevo = (fincaUuid, codigo) => {
    const it = info.get(`${fincaUuid}|${codigo}`);
    if (!it) return null;
    const m = manual[fincaUuid]?.[codigo];
    if (hayValor(m) && it.editable && it.ha > 0) return Math.round(it.ha * Number(m));
    if (it.flag && it.auto != null && it.ha > 0) return Math.round(it.ha * it.auto); // quitó el manual: vuelve al automático
    return null;
  };
  let cambio = false;
  const filas = resultado.filas.map((f) => {
    const propio = embolseNuevo(f.fincaUuid, f.semanaCodigo);
    let tocaDetalle = false;
    const detalle = (f.detalleEdades || []).map((d) => {
      if (!d.semanaCodigo) return d;
      const e2 = embolseNuevo(f.fincaUuid, d.semanaCodigo);
      if (e2 === null || e2 === d.embolse) return d;
      tocaDetalle = true;
      const racimos = d.descartado ? 0 : d.embolse > 0 ? Math.round((d.racimos * e2) / d.embolse) : Math.round(e2 * d.tasa);
      return { ...d, embolse: e2, embolsesPorHa: d.hectareas > 0 ? r2(e2 / d.hectareas) : null, racimos, embolsesPorHaManual: hayValor(manual[f.fincaUuid]?.[d.semanaCodigo]) };
    });
    const cambiaPropio = propio !== null && propio !== f.embolses;
    const marca = hayValor(manual[f.fincaUuid]?.[f.semanaCodigo]);
    if (!tocaDetalle && !cambiaPropio && marca === Boolean(f.embolsesPorHaManual)) return f;
    cambio = true;
    let nueva = { ...f, detalleEdades: detalle, embolsesPorHaManual: marca };
    if (cambiaPropio) {
      const k = f.embolses > 0 ? propio / f.embolses : 1;
      nueva = { ...nueva, embolses: propio, embolsesBajo: Math.round((f.embolsesBajo || 0) * k), embolsesAlto: Math.round((f.embolsesAlto || 0) * k), embolsesPorHa: marca ? Number(manual[f.fincaUuid][f.semanaCodigo]) : f.embolsesPorHaAuto };
    }
    if (tocaDetalle && f.fuente !== "real") {
      // Racimos de la semana = suma de lo que aporta cada cinta; las cajas siguen el mismo cambio (con el ratio vigente).
      const rac2 = detalle.reduce((t, d) => t + (d.racimos || 0), 0);
      const k = f.racimos > 0 ? rac2 / f.racimos : 1;
      nueva = { ...nueva, racimos: rac2, cajas: f.racimos > 0 ? Math.round(f.cajas * k) : Math.round(rac2 * (f.ratio || 0)), cajasBajo: Math.round((f.cajasBajo || 0) * k), cajasAlto: Math.round((f.cajasAlto || 0) * k) };
    }
    return nueva;
  });
  return cambio ? conTotales(resultado, filas) : resultado;
}

