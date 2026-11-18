"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import ModalShell from "@/components/ModalShell";

const COLOR_REAL = "#334155";
const COLOR_PROYECCION = "#16a34a";
const COLOR_PROMEDIO = "#d97706";
const COLORES_ANTERIORES = ["#8b9aab", "#b4bfcc", "#d5dbe3"]; // hace 1, 2 y 3 años
const COLORES_EDAD = { 8: "#a855f7", 9: "#3b82f6", 10: "#16a34a", 11: "#f59e0b", 12: "#dc2626" };
const EDADES = [8, 9, 10, 11, 12];

const fmt = (n, d = 0) => (n == null ? "—" : Number(n).toLocaleString("es", { minimumFractionDigits: d, maximumFractionDigits: d }));

// Indicadores de la proyección semanal. `valor(row)` lee la fila consultada y `anterior(a)` la misma semana de un año anterior
// (sin `anterior`, la gráfica solo muestra lo consultado).
export const INDICADORES = [
  { id: "cajas", titulo: "Cajas 20k", dec: 0, valor: (r) => r.cajas20kg, anterior: (a) => a.cajas },
  { id: "racimos", titulo: "Racimos cosechados", dec: 0, valor: (r) => r.racimosCosechados, anterior: (a) => a.racimos },
  { id: "hectareas", titulo: "Hectáreas en producción", dec: 1, valor: (r) => r.hectareas, anterior: (a) => a.hectareas },
  { id: "racimosHa", titulo: "Racimos por hectárea en producción", dec: 1, valor: (r) => (r.hectareas > 0 ? r.racimosCosechados / r.hectareas : null), anterior: (a) => (a.hectareas > 0 ? a.racimos / a.hectareas : null) },
  { id: "edades", titulo: "Racimos por edad de cosecha", dec: 0, porEdad: true },
  { id: "aprovechamiento", titulo: "Aprovechamiento (%)", dec: 1, valor: (r) => (r.aprovechamiento != null ? r.aprovechamiento * 100 : null) },
  { id: "ratio", titulo: "Ratio (cajas por racimo)", dec: 2, valor: (r) => r.ratio, anterior: (a) => a.ratio },
];

// Gráficas de la proyección semanal: las semanas consultadas (real y proyectado) frente a las mismas semanas de 1 a 3 años atrás y su promedio.
// `filas`: todas las filas de la consulta; `metrica`: el indicador cuyo encabezado se pulsó (se muestra primero).
export default function GraficasSemanalModal({ filas, metrica, onClose }) {
  const grupos = useMemo(() => {
    const m = new Map();
    for (const r of filas) if (!m.has(r.fincaUuid ?? "GLOBAL")) m.set(r.fincaUuid ?? "GLOBAL", r.fincaNombre || "Todas las fincas");
    return [...m.entries()].map(([clave, nombre]) => ({ clave, nombre }));
  }, [filas]);
  const [grupo, setGrupo] = useState(grupos[0]?.clave);
  const [ocultos, setOcultos] = useState(new Set()); // k (1..3) ocultos
  const [verPromedio, setVerPromedio] = useState(true);

  const delGrupo = useMemo(() => filas.filter((r) => (r.fincaUuid ?? "GLOBAL") === grupo), [filas, grupo]);
  // Años anteriores disponibles (k = 1..3). Si la ventana cruza de año, se nombran "hace k año(s)".
  const ks = useMemo(() => {
    const s = new Set();
    for (const r of delGrupo) for (const a of r.anteriores || []) s.add(r.anio - a.anio);
    return [...s].sort();
  }, [delGrupo]);
  const unAnio = new Set(delGrupo.map((r) => r.anio)).size === 1;
  const etiquetaK = (k) => (unAnio && delGrupo[0] ? `${delGrupo[0].anio - k} real` : `Hace ${k} año${k > 1 ? "s" : ""}`);

  const datos = useMemo(() => {
    // Índice de la última semana real: ese punto se repite en la serie proyectada para que las dos líneas queden unidas.
    let ultimaReal = -1;
    delGrupo.forEach((r, i) => {
      if (r.real) ultimaReal = i;
    });
    return delGrupo.map((r, i) => {
      const fila = { semana: r.semanaCodigo };
      for (const ind of INDICADORES) {
        if (ind.porEdad) {
          for (const a of r.ageBreakdown || []) fila[`edad${a.edad}`] = a.racimos;
          continue;
        }
        const v = ind.valor(r);
        if (r.real) fila[`real_${ind.id}`] = v;
        if (!r.real || i === ultimaReal) fila[`proy_${ind.id}`] = v;
        if (!ind.anterior) continue;
        const vals = [];
        for (const a of r.anteriores || []) {
          const k = r.anio - a.anio;
          const va = ind.anterior(a);
          fila[`a${k}_${ind.id}`] = va;
          if (va != null && !ocultos.has(k)) vals.push(va);
        }
        fila[`prom_${ind.id}`] = vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null;
      }
      return fila;
    });
  }, [delGrupo, ocultos]);

  const orden = [...INDICADORES].sort((a, b) => (a.id === metrica ? -1 : b.id === metrica ? 1 : 0));
  const alternar = (k) =>
    setOcultos((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <ModalShell title="Gráficas · Proyección semanal" onClose={onClose} fullscreen>
      <div className="p-3 overflow-auto flex-grow-1">
        <div className="d-flex flex-wrap align-items-center gap-3 mb-2 px-2 py-1 rounded-1" style={{ background: "#f1f6f2" }}>
          {grupos.length > 1 && (
            <select className="form-select form-select-sm rounded-1" style={{ width: "auto" }} value={grupo} onChange={(e) => setGrupo(e.target.value)}>
              {grupos.map((g) => (
                <option key={g.clave} value={g.clave}>
                  {g.nombre}
                </option>
              ))}
            </select>
          )}
          {grupos.length === 1 && <span className="small fw-semibold">{grupos[0].nombre}</span>}
          {ks.map((k) => (
            <div key={k} className="form-check mb-0">
              <input type="checkbox" className="form-check-input" id={`gs-k-${k}`} checked={!ocultos.has(k)} onChange={() => alternar(k)} />
              <label className="form-check-label small" htmlFor={`gs-k-${k}`}>
                <span style={{ display: "inline-block", width: 14, height: 3, background: COLORES_ANTERIORES[k - 1], marginRight: 6, verticalAlign: "middle" }} />
                {etiquetaK(k)}
              </label>
            </div>
          ))}
          {ks.length > 0 && (
            <div className="form-check mb-0">
              <input type="checkbox" className="form-check-input" id="gs-prom" checked={verPromedio} onChange={() => setVerPromedio((v) => !v)} />
              <label className="form-check-label small" htmlFor="gs-prom">
                Promedio de los años marcados
              </label>
            </div>
          )}
        </div>
        <p className="small text-secondary mb-2">
          Línea oscura: semanas reales; verde gruesa: proyectadas. En gris, las mismas semanas de años anteriores y, punteado, su promedio. El aprovechamiento y las edades muestran solo las semanas consultadas.
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
                      <Tooltip formatter={(v, nombre) => [fmt(v, ind.dec), nombre]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {ind.porEdad ? (
                        EDADES.map((e) => <Line key={e} type="monotone" dataKey={`edad${e}`} name={`Edad ${e}`} stroke={COLORES_EDAD[e]} strokeWidth={2} dot={false} connectNulls />)
                      ) : (
                        <>
                          {ind.anterior &&
                            ks.filter((k) => !ocultos.has(k)).map((k) => (
                              <Line key={k} type="monotone" dataKey={`a${k}_${ind.id}`} name={etiquetaK(k)} stroke={COLORES_ANTERIORES[k - 1]} strokeWidth={1.5} dot={false} connectNulls />
                            ))}
                          {ind.anterior && verPromedio && ks.some((k) => !ocultos.has(k)) && (
                            <Line type="monotone" dataKey={`prom_${ind.id}`} name="Promedio años anteriores" stroke={COLOR_PROMEDIO} strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
                          )}
                          <Line type="monotone" dataKey={`real_${ind.id}`} name="Real" stroke={COLOR_REAL} strokeWidth={2} dot={{ r: 2 }} connectNulls />
                          <Line type="monotone" dataKey={`proy_${ind.id}`} name="Proyectado" stroke={COLOR_PROYECCION} strokeWidth={3} dot={{ r: 2 }} connectNulls />
                        </>
                      )}
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
