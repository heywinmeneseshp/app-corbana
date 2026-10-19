"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import ModalShell from "@/components/ModalShell";
import RangoSemanasSlider, { filtrarSemanas } from "@/components/reportes/RangoSemanasSlider";

const COLOR_PROYECCION = "#16a34a";
const COLOR_PROMEDIO = "#d97706";
const COLORES_ANIOS = ["#c0c9d4", "#8b9aab", "#4b5b6e"]; // del año más antiguo al más reciente

const fmt = (n, d = 0) => (n == null ? "—" : Number(n).toLocaleString("es", { minimumFractionDigits: d, maximumFractionDigits: d }));

const GRAFICAS = [
  { id: "ratio", titulo: "Ratio (cajas por racimo)", dec: 3 },
  { id: "embolses", titulo: "Embolses", dec: 0 },
  { id: "embolsesPorHa", titulo: "Embolses por hectárea", dec: 1 },
  { id: "cajas", titulo: "Cajas producidas", dec: 0 },
  { id: "hectareas", titulo: "Hectáreas en producción (total)", dec: 1, ancha: true, sinPromedio: true },
];

// Gráficas por finca (o de varias): para cada indicador, la curva semana a semana de los años históricos reales y la del año
// proyectado. `uuids`: fincas incluidas (una sola, o todas las visibles para el total).
export default function GraficasFincaModal({ resultado, uuids, titulo, onClose }) {
  const anioProy = resultado.meta.anio;
  // Años históricos ocultos (y fuera del promedio). Arranca respetando los "años históricos usados" del escenario: los que
  // el escenario no usa para proyectar quedan desmarcados (se pueden volver a marcar para compararlos).
  const [excluidos, setExcluidos] = useState(() => {
    const usados = new Set((resultado.meta.anios || []).map(Number));
    const presentes = new Set();
    for (const u of uuids) for (const y of Object.keys(resultado.historico?.[u] || {})) presentes.add(Number(y));
    return new Set([...presentes].filter((y) => !usados.has(y)));
  });
  const [verPromedio, setVerPromedio] = useState(true);
  // Rango de semanas visible en todas las gráficas (null = año completo).
  const [rangoSemanas, setRangoSemanas] = useState(null);
  // Cuántas de las últimas semanas con datos reales del año actual se dejan fuera de todas las gráficas (y del promedio).
  const [excluirUltimas, setExcluirUltimas] = useState(0);
  const [excluirTexto, setExcluirTexto] = useState("");

  const { datos, anios } = useMemo(() => {
    const sel = new Set(uuids);
    const aniosHist = new Set();
    // Histórico: por año y semana, suma de las fincas seleccionadas.
    const hist = new Map(); // `${anio}|${n}` -> { e, ha, c, j }
    for (const uuid of sel) {
      for (const [y, lista] of Object.entries(resultado.historico?.[uuid] || {})) {
        aniosHist.add(Number(y));
        for (const w of lista) {
          const k = `${y}|${w.n}`;
          const t = hist.get(k) || { e: 0, ha: 0, c: 0, j: 0 };
          t.e += w.e;
          t.ha += w.ha;
          t.c += w.c;
          t.j += w.j;
          hist.set(k, t);
        }
      }
    }
    // Proyectado: suma de las filas de las fincas seleccionadas por semana del año.
    const proy = new Map(); // n -> { e, ha, rac, caj }
    for (const f of resultado.filas) {
      if (!sel.has(f.fincaUuid)) continue;
      const t = proy.get(f.numeroSemana) || { e: 0, ha: 0, rac: 0, caj: 0 };
      t.e += f.embolses;
      t.ha += f.hectareasEfectivas;
      t.rac += f.racimos;
      t.caj += f.cajas;
      proy.set(f.numeroSemana, t);
    }
    const ys = [...aniosHist].sort();
    // Última semana con datos reales del año actual: de ahí se descuentan las semanas excluidas.
    let ultimaSemanaActual = 0;
    for (const k of hist.keys()) {
      const [y, n] = k.split("|").map(Number);
      if (y === anioProy && n > ultimaSemanaActual) ultimaSemanaActual = n;
    }
    const limiteActual = ultimaSemanaActual - excluirUltimas;
    const filas = [];
    for (let n = 1; n <= 53; n++) {
      const fila = { semana: n };
      const p = proy.get(n);
      if (p) {
        fila.proy_ratio = p.rac > 0 ? p.caj / p.rac : null;
        fila.proy_embolses = p.e;
        fila.proy_embolsesPorHa = p.ha > 0 ? p.e / p.ha : null;
        fila.proy_cajas = p.caj;
        fila.proy_hectareas = p.ha;
      }
      for (const y of ys) {
        const h = hist.get(`${y}|${n}`);
        if (!h) continue;
        if (y === anioProy && excluirUltimas > 0 && n > limiteActual) continue;
        fila[`${y}_ratio`] = h.c > 0 && h.j > 0 ? h.j / h.c : null;
        fila[`${y}_embolses`] = h.e;
        fila[`${y}_embolsesPorHa`] = h.ha > 0 && h.e > 0 ? h.e / h.ha : null;
        fila[`${y}_cajas`] = h.j;
        fila[`${y}_hectareas`] = h.ha > 0 ? h.ha : null;
      }
      // Promedio histórico de la semana: media simple de los años que siguen marcados.
      for (const g of GRAFICAS) {
        const vals = ys.filter((y) => !excluidos.has(y)).map((y) => fila[`${y}_${g.id}`]).filter((v) => v != null);
        fila[`prom_${g.id}`] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      }
      filas.push(fila);
    }
    return { datos: filas, anios: ys };
  }, [resultado, uuids, excluidos, excluirUltimas, anioProy]);

  const alternarAnio = (y) =>
    setExcluidos((prev) => {
      const n = new Set(prev);
      if (n.has(y)) n.delete(y);
      else n.add(y);
      return n;
    });
  const visibles = anios.filter((y) => !excluidos.has(y));
  const datosVista = useMemo(() => filtrarSemanas(datos, rangoSemanas, "semana"), [datos, rangoSemanas]);

  return (
    <ModalShell title={titulo} onClose={onClose} fullscreen>
      <div className="p-3 overflow-auto flex-grow-1">
      <p className="small text-secondary mb-2">
        Cada gráfica compara, semana a semana, los años históricos reales con la proyección de {anioProy} (línea verde gruesa) y el promedio histórico (línea naranja punteada). Pasa el ratón sobre la gráfica para ver el valor de cada semana.
      </p>
      <div className="d-flex flex-wrap align-items-center gap-3 mb-3 p-2 rounded-3" style={{ background: "#f1f6f2" }}>
        <span className="small fw-semibold">Años</span>
        {anios.map((y, i) => (
          <div key={y} className="form-check mb-0">
            <input type="checkbox" className="form-check-input" id={`gf-anio-${y}`} checked={!excluidos.has(y)} onChange={() => alternarAnio(y)} />
            <label className="form-check-label small" htmlFor={`gf-anio-${y}`}>
              <span style={{ display: "inline-block", width: 14, height: 3, background: COLORES_ANIOS[Math.max(0, COLORES_ANIOS.length - anios.length) + i] || "#94a3b8", marginRight: 6, verticalAlign: "middle" }} />
              {y}
            </label>
          </div>
        ))}
        {anios.includes(anioProy) && (
          <div className="d-flex align-items-center gap-2 ms-2">
            <label className="small mb-0" htmlFor="gf-excluir" title={`Deja fuera de todas las gráficas las últimas semanas con datos reales de ${anioProy} (y del promedio), por si todavía están incompletas`}>
              Excluir últimas semanas de {anioProy}
            </label>
            <input
              id="gf-excluir"
              type="text"
              inputMode="numeric"
              className="form-control form-control-sm rounded-3 text-center"
              style={{ width: "4rem" }}
              placeholder="0"
              value={excluirTexto}
              onChange={(e) => {
                const t = e.target.value;
                if (!/^\d{0,2}$/.test(t)) return;
                setExcluirTexto(t);
                setExcluirUltimas(t === "" ? 0 : Math.min(Number(t), 53));
              }}
            />
          </div>
        )}
        <div className="form-check mb-0 ms-2">
          <input type="checkbox" className="form-check-input" id="gf-promedio" checked={verPromedio} onChange={() => setVerPromedio((v) => !v)} />
          <label className="form-check-label small" htmlFor="gf-promedio">
            Promedio de los años marcados
          </label>
        </div>
      </div>
      <div className="mb-3 px-2">
        <RangoSemanasSlider value={rangoSemanas} onChange={setRangoSemanas} />
      </div>
      <div className="row g-3">
        {GRAFICAS.map((g0) => {
          const g = g0.id === "cajas" ? { ...g0, titulo: `Cajas producidas (${resultado.meta.tasaConversion ?? 18.6})` } : g0;
          return (
          <div key={g.id} className={g.ancha ? "col-12" : "col-12 col-lg-6"}>
            <div className="border rounded-3 p-2">
              <div className="fw-semibold small mb-1 ps-1">{g.titulo}</div>
              <div style={{ height: "clamp(240px, 32vh, 380px)" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={datosVista} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="semana" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={g.dec ? 44 : 50} domain={["auto", "auto"]} tickFormatter={(v) => (g.dec ? fmt(v, g.dec === 3 ? 2 : 0) : v >= 10000 ? `${Math.round(v / 1000)}k` : fmt(v))} />
                    <Tooltip formatter={(v, nombre) => [fmt(v, g.dec), nombre]} labelFormatter={(l) => `Semana ${l}`} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {anios.map((y, i) => !excluidos.has(y) && (
                      <Line key={y} type="monotone" dataKey={`${y}_${g.id}`} name={`${y} real`} stroke={COLORES_ANIOS[Math.max(0, COLORES_ANIOS.length - anios.length) + i] || "#94a3b8"} strokeWidth={1.5} dot={false} connectNulls />
                    ))}
                    {verPromedio && visibles.length > 0 && !g.sinPromedio && (
                      <Line type="monotone" dataKey={`prom_${g.id}`} name="Promedio histórico" stroke={COLOR_PROMEDIO} strokeWidth={2.2} strokeDasharray="6 4" dot={false} connectNulls />
                    )}
                    <Line type="monotone" dataKey={`proy_${g.id}`} name={`${anioProy} proyectado`} stroke={COLOR_PROYECCION} strokeWidth={3} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          );
        })}
      </div>
      </div>
    </ModalShell>
  );
}
