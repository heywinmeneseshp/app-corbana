// Agregaciones puras del módulo de Precalibración.
//
// Reciben registros (hoy mock, mañana API) y devuelven todo lo que la UI
// necesita: KPIs, tabla por lote, gráficos y potencial. Sin dependencias de
// React: se pueden probar con node y reutilizar cuando llegue la API real.

import {
  ESCALERA_ACTUAL,
  FINCAS,
  FINCA_POR_ID,
  LOTE_POR_ID,
  SEMANA_POR_ID,
  SEMANA_ACTUAL_ID,
  SEMANAS,
  VALOR_POR_ID,
  getPromedioHistorico,
  getSaldoLoteCinta,
} from "./mockData.js";

// Filtros: { semanaId, fincaId, loteId, valorId, cintaId } — "" = todos.
export function filtrarRegistros(registros, filtros = {}) {
  const { semanaId = "", fincaId = "", loteId = "", valorId = "", cintaId = "" } = filtros;
  return registros.filter(
    (r) =>
      (!semanaId || r.semanaId === semanaId) &&
      (!fincaId || r.fincaId === fincaId) &&
      (!loteId || r.loteId === loteId) &&
      (!valorId || r.valorId === valorId) &&
      (!cintaId || r.cintaId === cintaId),
  );
}

// Semana de referencia para calcular el embolse: la semana elegida en el
// filtro; si no hay una puntual, la última semana con registros en la
// selección (o la última disponible).
export function getSemanaReferencia(registros, filtros = {}) {
  if (filtros.semanaId) return SEMANA_POR_ID.get(filtros.semanaId) || null;
  let ultima = null;
  for (const r of registros) {
    const s = SEMANA_POR_ID.get(r.semanaId);
    if (s && (!ultima || s.fechaInicio > ultima.fechaInicio)) ultima = s;
  }
  return ultima || SEMANAS[SEMANAS.length - 1];
}

// Semana en que se embolsó un racimo de cierta edad evaluado en la semana
// de referencia (misma convención que racimos: edad 1 = misma semana).
// Se muestra solo el número; con los datos actuales nunca cruza de año
// (evaluaciones 2026, edad máxima 12).
export function calcularEmbolse(edad, semanaRef) {
  if (!semanaRef) return "—";
  let numero = semanaRef.numero - (edad - 1);
  while (numero < 1) numero += 52;
  return `${numero}`;
}

// Cintas enriquecidas con su semana de embolse para los encabezados.
export function cintasConEmbolse(cintas, semanaRef) {
  return cintas.map((c) => ({ ...c, embolse: calcularEmbolse(c.edad, semanaRef) }));
}
// Valor predominante (moda) del conjunto filtrado, para el KPI.
function valorPredominante(registros) {
  if (registros.length === 0) return null;
  const conteo = new Map();
  for (const r of registros) conteo.set(r.valorId, (conteo.get(r.valorId) || 0) + 1);
  let mejor = null;
  let mejorN = 0;
  for (const [valorId, n] of conteo) {
    if (n > mejorN) {
      mejorN = n;
      mejor = valorId;
    }
  }
  return VALOR_POR_ID.get(mejor) || null;
}

export function kpisDe(registros, lotes) {
  const lotesEvaluados = new Set(registros.map((r) => r.loteId));
  const lotePorId = new Map(lotes.map((l) => [l.id, l]));
  let hectareas = 0;
  for (const loteId of lotesEvaluados) {
    const lote = lotePorId.get(loteId) || LOTE_POR_ID.get(loteId);
    if (lote) hectareas += lote.areaHa;
  }
  return {
    racimos: registros.length,
    lotesEvaluados: lotesEvaluados.size,
    hectareas: Math.round(hectareas * 100) / 100,
    valor: valorPredominante(registros),
  };
}

// Tabla consolidada por lote. Las columnas de cinta se derivan de `cintas`
// (dinámicas: si mañana hay 5 cintas, la tabla crece sola).
export function tablaPorLote(registros, lotes, cintas) {
  const porLote = new Map();
  for (const r of registros) {
    let fila = porLote.get(r.loteId);
    if (!fila) {
      fila = { loteId: r.loteId, porCinta: {}, total: 0 };
      porLote.set(r.loteId, fila);
    }
    fila.porCinta[r.cintaId] = (fila.porCinta[r.cintaId] || 0) + 1;
    fila.total += 1;
  }

  const lotePorId = new Map(lotes.map((l) => [l.id, l]));
  const filas = [];
  for (const [loteId, fila] of porLote) {
    const lote = lotePorId.get(loteId) || LOTE_POR_ID.get(loteId);
    if (!lote) continue;
    const finca = FINCA_POR_ID.get(lote.fincaId);
    filas.push({
      loteId,
      loteNombre: lote.nombre,
      fincaId: lote.fincaId,
      fincaNombre: finca ? finca.nombre : "—",
      areaHa: lote.areaHa,
      porCinta: fila.porCinta,
      total: fila.total,
    });
  }
  filas.sort((a, b) =>
    a.fincaNombre === b.fincaNombre
      ? Number(a.loteNombre) - Number(b.loteNombre)
      : a.fincaNombre.localeCompare(b.fincaNombre, "es"),
  );

  // Saldo actual del lote por cinta y lo que quedaría al restar los aptos.
  for (const f of filas) {
    f.saldos = {};
    f.restantes = {};
    f.totalSaldo = 0;
    f.totalRestante = 0;
    for (const cinta of cintas) {
      const saldo = getSaldoLoteCinta(f.loteId, cinta.id);
      const aptos = f.porCinta[cinta.id] || 0;
      f.saldos[cinta.id] = saldo;
      f.restantes[cinta.id] = saldo - aptos;
      f.totalSaldo += saldo;
      f.totalRestante += saldo - aptos;
    }
  }

  const totales = { porCinta: {}, saldoPorCinta: {}, restantePorCinta: {}, total: 0, totalSaldo: 0, totalRestante: 0, hectareas: 0 };
  for (const cinta of cintas) {
    totales.porCinta[cinta.id] = 0;
    totales.saldoPorCinta[cinta.id] = 0;
    totales.restantePorCinta[cinta.id] = 0;
  }
  for (const f of filas) {
    totales.total += f.total;
    totales.totalSaldo += f.totalSaldo;
    totales.totalRestante += f.totalRestante;
    totales.hectareas += f.areaHa;
    for (const cinta of cintas) {
      totales.porCinta[cinta.id] += f.porCinta[cinta.id] || 0;
      totales.saldoPorCinta[cinta.id] += f.saldos[cinta.id] || 0;
      totales.restantePorCinta[cinta.id] += f.restantes[cinta.id] || 0;
    }
  }
  totales.hectareas = Math.round(totales.hectareas * 100) / 100;

  return { filas, totales };
}

// Distribución de racimos por cinta/edad (gráfico de barras), ordenada por
// edad ascendente en el eje X. La etiqueta muestra la edad que le
// corresponde a cada cinta (si la cinta no trae embolse calculado, cae al
// nombre + S{edad}).
export function distribucionPorCinta(registros, cintas) {
  const conteo = new Map();
  for (const r of registros) conteo.set(r.cintaId, (conteo.get(r.cintaId) || 0) + 1);
  const ordenadas = [...cintas].sort((a, b) => a.edad - b.edad);
  return ordenadas.map((c) => ({
    cintaId: c.id,
    nombre: c.nombre,
    edad: c.edad,
    etiqueta: `Edad ${c.edad}`,
    racimos: conteo.get(c.id) || 0,
    color: c.color,
  }));
}

// Datos del gráfico de ratio (aptos por hectárea): línea del año actual +
// promedio histórico de la misma semana (mismo concepto que el gráfico de
// ratio de estimaciones). `fincaId` "" = agregado global.
export function datosGraficoRatio(registros, lotes, semanas, fincaId = "") {
  const lotePorId = new Map(lotes.map((l) => [l.id, l]));
  const porSemana = new Map();
  for (const r of registros) {
    let entry = porSemana.get(r.semanaId);
    if (!entry) {
      entry = { aptos: 0, lotes: new Set() };
      porSemana.set(r.semanaId, entry);
    }
    entry.aptos += 1;
    entry.lotes.add(r.loteId);
  }

  return semanas.map((s) => {
    const entry = porSemana.get(s.id);
    let ratioActual = null;
    if (entry && entry.lotes.size > 0) {
      let ha = 0;
      for (const loteId of entry.lotes) {
        const lote = lotePorId.get(loteId) || LOTE_POR_ID.get(loteId);
        if (lote) ha += lote.areaHa;
      }
      if (ha > 0) ratioActual = Math.round((entry.aptos / ha) * 100) / 100;
    }
    return {
      semanaId: s.id,
      codigo: s.codigo,
      etiqueta: s.numero,
      ratioActual,
      promedio: getPromedioHistorico(fincaId, s.numero),
    };
  });
}

// Potencial de cosecha para la semana actual: compara la escalera de
// Estimación de fincas (racimos estimados, ratio, cajas) con la
// precalibración (racimos que cumplen). Alcance: finca del filtro o todas.
// Los demás filtros no aplican (la escalera solo existe por finca+semana).
export function potencialCosecha(registros, fincaId = "") {
  const semana = SEMANA_POR_ID.get(SEMANA_ACTUAL_ID) || SEMANAS[SEMANAS.length - 1];
  const fincasAlcance = fincaId ? [fincaId] : FINCAS.map((f) => f.id);
  const racimos = registros.filter(
    (r) => r.semanaId === semana.id && fincasAlcance.includes(r.fincaId),
  ).length;

  let estimado = 0;
  let cajasEst = 0;
  for (const id of fincasAlcance) {
    const e = ESCALERA_ACTUAL[id];
    if (!e) continue;
    estimado += e.estimado;
    cajasEst += e.cajas;
  }
  const finca = fincaId ? FINCA_POR_ID.get(fincaId) : null;
  return {
    semana,
    fincaNombre: finca ? finca.nombre : "",
    estimacion: {
      racimos: estimado,
      ratio: estimado > 0 ? Math.round((cajasEst / estimado) * 1000) / 1000 : null,
      cajas: cajasEst,
    },
    precal: { racimos },
    simulado: true,
  };
}

// Detalle de un lote: info + resultados por cinta/edad + registros.
export function detalleDeLote(loteId, registros, lotes, cintas) {
  const lotePorId = new Map(lotes.map((l) => [l.id, l]));
  const lote = lotePorId.get(loteId) || LOTE_POR_ID.get(loteId);
  if (!lote) return null;
  const finca = FINCA_POR_ID.get(lote.fincaId);
  const deLote = registros.filter((r) => r.loteId === loteId);

  const resultados = cintas.map((c) => {
    const n = deLote.filter((r) => r.cintaId === c.id).length;
    const saldo = getSaldoLoteCinta(lote.id, c.id);
    return { cintaId: c.id, cinta: c.nombre, edad: c.edad, embolse: c.embolse || "—", racimos: n, saldo, restante: saldo - n, color: c.color };
  });

  return {
    lote,
    finca,
    valor: valorPredominante(deLote),
    resultados,
    total: deLote.length,
    totalSaldo: resultados.reduce((a, r) => a + r.saldo, 0),
    totalRestante: resultados.reduce((a, r) => a + r.restante, 0),
    registros: deLote,
  };
}
