"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import ModalShell from "@/components/ModalShell";

const COLOR_PROYECCION = "#16a34a";
const COLOR_PROMEDIO = "#d97706";
// Del año en curso (oscuro) a los anteriores (más claros).
const COLORES_ANIOS = ["#334155", "#8b9aab", "#b4bfcc", "#d5dbe3"];
const COLORES_EDAD = { 8: "#a855f7", 9: "#3b82f6", 10: "#16a34a", 11: "#f59e0b", 12: "#dc2626" };
const EDADES = [8, 9, 10, 11, 12];

const fmt = (n, d = 0) => (n == null ? "—" : Number(n).toLocaleString("es", { minimumFractionDigits: d, maximumFractionDigits: d }));

// Indicadores. `fila(r)` lee una fila de la proyección (semana consultada) y `real(d)` un dato real de la serie anual
// (sin `real`, la gráfica solo muestra las semanas consultadas).
export const INDICADORES = [
  { id: "cajas", titulo: "Cajas 20k", dec: 0, fila: (r) => r.cajas20kg, real: (d) => d.cajas },
  { id: "hectareas", titulo: "Hectáreas en producción", dec: 1, fila: (r) => r.hectareas, real: (d) => d.hectareas },
  { id: "edades", titulo: "Racimos por edad de cosecha", dec: 0, porEdad: true },
  { id: "aprovechamiento", titulo: "Aprovechamiento (%)", dec: 1, fila: (r) => (r.aprovechamiento != null ? r.aprovechamiento * 100 : null) },
  { id: "ratio", titulo: "Ratio (cajas por racimo)", dec: 2, fila: (r) => r.ratio, real: (d) => d.ratio },
];

// Gráficas de la proyección semanal sobre las 53 semanas del año: el año en curso real, los 3 años anteriores, su promedio y lo proyectado
// en las semanas consultadas. `filas`: filas de la consulta; `seriesAnuales`: { [grupo]: { anio, anios: { [año]: [{ n, ... }] } } };
// `metrica`: indicador cuyo encabezado se pulsó (se muestra primero).
export default function GraficasSemanalModal({ filas, seriesAnuales = {}, metrica, onClose }) {
  const grupos = useMemo(() => {
    const m = new Map();
    for (const r of filas) if (!m.has(r.fincaUuid ?? "GLOBAL")) m.set(r.fincaUuid ?? "GLOBAL", r.fincaNombre || "Todas las fincas");
    return [...m.entries()].map(([clave, nombre]) => ({ clave, nombre }));
  }, [filas]);
  const [grupo, setGrupo] = useState(grupos[0]?.clave);
  const [ocultos, setOcultos] = useState(new Set()); // años ocultos
  const [verPromedio, setVerPromedio] = useState(true);

  const serie = useMemo(() => seriesAnuales[grupo] || { anio: null, anios: {} }, [seriesAnuales, grupo]);
  const anioBase = serie.anio;
  const anios = useMemo(() => Object.keys(serie.anios).map(Number).sort((a, b) => b - a), [serie]); // del más reciente al más antiguo
  const colorAnio = (y) => COLORES_ANIOS[Math.min(COLORES_ANIOS.length - 1, Math.max(0, anioBase - y))];
  const delGrupo = useMemo(() => filas.filter((r) => (r.fincaUuid ?? "GLOBAL") === grupo), [filas, grupo]);
  const haySiguiente = delGrupo.some((r) => !r.real && r.anio > anioBase);

  const datos = useMemo(() => {
    const porN = new Map();
    for (let n = 1; n <= 53; n++) porN.set(n, { semana: n });
    // Años reales completos.
    for (const y of anios) {
      for (const d of serie.anios[y]) {
        const fila = porN.get(d.n);
        for (const ind of INDICADORES) if (ind.real) fila[`${y}_${ind.id}`] = ind.real(d);
        if (y === anioBase) for (const e of EDADES) fila[`edad${e}`] = d.edades?.[e] ?? null;
      }
    }
    // Proyección: semanas no reales de la consulta, unida al último punto real para que la línea no quede suelta.
    let ultimaReal = -1;
    delGrupo.forEach((r, i) => {
      if (r.real) ultimaReal = i;
    });
    delGrupo.forEach((r, i) => {
      if (r.real && i !== ultimaReal) return;
      const fila = porN.get(r.numeroSemana);
      if (!fila) return;
      // Las semanas del año siguiente (si la consulta cruza de año) van en su propia línea, para no unirlas con el final del año.
      const pref = r.anio > anioBase ? "proySig" : "proy";
      for (const ind of INDICADORES) if (ind.fila) fila[`${pref}_${ind.id}`] = ind.fila(r);
      if (!r.real && r.anio === anioBase) for (const a of r.ageBreakdown || []) fila[`edadProy${a.edad}`] = a.racimos;
    });
    // Aprovechamiento: solo las semanas consultadas (no hay dato semanal histórico).
    for (const r of delGrupo) {
      const fila = porN.get(r.numeroSemana);
      if (fila && r.real) fila[`${anioBase}_aprovechamiento`] = r.aprovechamiento * 100;
    }
    // Promedio de los años anteriores marcados.
    const previos = anios.filter((y) => y !== anioBase && !ocultos.has(y));
    for (const fila of porN.values()) {
      for (const ind of INDICADORES) {
        if (!ind.real) continue;
        const vals = previos.map((y) => fila[`${y}_${ind.id}`]).filter((v) => v != null);
        fila[`prom_${ind.id}`] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      }
    }
    return [...porN.values()];
  }, [serie, anios, anioBase, delGrupo, ocultos]);

  const orden = [...INDICADORES].sort((a, b) => (a.id === metrica ? -1 : b.id === metrica ? 1 : 0));
  const hayPrevios = anios.some((y) => y !== anioBase && !ocultos.has(y));
  const alternar = (y) =>
    setOcultos((prev) => {
      const n = new Set(prev);
      if (n.has(y)) n.delete(y);
      else n.add(y);
      return n;
    });

  return (
    <ModalShell title="Gráficas · Proyección semanal" onClose={onClose} fullscreen>
      <div className="p-3 overflow-auto flex-grow-1">
        <div className="d-flex flex-wrap align-items-center gap-3 mb-2 px-2 py-1 rounded-1" style={{ background: "#f1f6f2" }}>
          {grupos.length > 1 ? (
            <select className="form-select form-select-sm rounded-1" style={{ width: "auto" }} value={grupo} onChange={(e) => setGrupo(e.target.value)}>
              {grupos.map((g) => (
                <option key={g.clave} value={g.clave}>
                  {g.nombre}
                </option>
              ))}
            </select>
          ) : (
            <span className="small fw-semibold">{grupos[0]?.nombre}</span>
          )}
          {anios.map((y) => (
            <div key={y} className="form-check mb-0">
              <input type="checkbox" className="form-check-input" id={`gs-y-${y}`} checked={!ocultos.has(y)} onChange={() => alternar(y)} />
              <label className="form-check-label small" htmlFor={`gs-y-${y}`}>
                <span style={{ display: "inline-block", width: 14, height: 3, background: colorAnio(y), marginRight: 6, verticalAlign: "middle" }} />
                {y}
              </label>
            </div>
          ))}
          {anios.length > 1 && (
            <div className="form-check mb-0">
              <input type="checkbox" className="form-check-input" id="gs-prom" checked={verPromedio} onChange={() => setVerPromedio((v) => !v)} />
              <label className="form-check-label small" htmlFor="gs-prom">
                Promedio de los años anteriores marcados
              </label>
            </div>
          )}
        </div>
        <p className="small text-secondary mb-2">
          Las 53 semanas del año: {anioBase} real (línea oscura), los años anteriores en gris, su promedio punteado y en verde lo proyectado en las semanas consultadas. En
          racimos por edad, las líneas continuas son reales y las punteadas proyectadas; el aprovechamiento solo existe para las semanas consultadas.
        </p>
        <div className="row g-3">
          {orden.map((ind) => (
            <div key={ind.id} className="col-12 col-lg-6">
              <div className="border rounded-1 p-2" style={ind.id === metrica ? { borderColor: "#16a34a", boxShadow: "0 0 0 2px rgba(22,163,74,.15)" } : undefined}>
                <div className="fw-semibold small mb-1 ps-1">{ind.titulo}</div>
                <div style={{ height: "clamp(220px, 30vh, 340px)" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={datos} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} width={50} domain={["dataMin", "dataMax"]} tickCount={6} tickFormatter={(v) => (ind.dec ? fmt(v, ind.dec === 2 ? 2 : 0) : v >= 10000 ? `${Math.round(v / 1000)}k` : fmt(v))} />
                      <Tooltip formatter={(v, nombre) => [fmt(v, ind.dec), nombre]} labelFormatter={(l) => `Semana ${l}`} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {ind.porEdad
                        ? EDADES.flatMap((e) => [
                            <Line key={`r${e}`} type="monotone" dataKey={`edad${e}`} name={`Edad ${e}`} stroke={COLORES_EDAD[e]} strokeWidth={1.8} dot={false} connectNulls />,
                            <Line key={`p${e}`} type="monotone" dataKey={`edadProy${e}`} name={`Edad ${e} proy.`} stroke={COLORES_EDAD[e]} strokeWidth={1.8} strokeDasharray="5 3" dot={false} connectNulls legendType="none" />,
                          ])
                        : [
                            ...anios
                              .filter((y) => !ocultos.has(y) && (ind.real || (ind.id === "aprovechamiento" && y === anioBase)))
                              .map((y) => (
                                <Line key={y} type="monotone" dataKey={`${y}_${ind.id}`} name={`${y} real`} stroke={colorAnio(y)} strokeWidth={y === anioBase ? 2 : 1.5} dot={false} connectNulls />
                              )),
                            ind.real && verPromedio && hayPrevios ? (
                              <Line key="prom" type="monotone" dataKey={`prom_${ind.id}`} name="Promedio años anteriores" stroke={COLOR_PROMEDIO} strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
                            ) : null,
                            <Line key="proy" type="monotone" dataKey={`proy_${ind.id}`} name={`${anioBase} proyectado`} stroke={COLOR_PROYECCION} strokeWidth={3} dot={false} connectNulls />,
                            haySiguiente ? (
                              <Line key="proySig" type="monotone" dataKey={`proySig_${ind.id}`} name={`${anioBase + 1} proyectado`} stroke="#0d9488" strokeWidth={3} dot={false} connectNulls />
                            ) : null,
                          ]}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}
