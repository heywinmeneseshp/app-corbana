"use client";

import { useMemo, useState } from "react";
import { FiPlus, FiSliders } from "react-icons/fi";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import ModalShell from "@/components/ModalShell";
import RangoSemanasSlider, { filtrarSemanas } from "@/components/reportes/RangoSemanasSlider";

const COLOR_PROYECCION = "#16a34a";
const COLOR_PROMEDIO = "#d97706";
const COLORES_ANIOS = ["#c0c9d4", "#8b9aab", "#4b5b6e"]; // del año más antiguo al más reciente
// Colores de las comparaciones agregadas (distintos de los grises/verde/naranja de la finca principal).
const COLORES_COMPARACION = ["#2563eb", "#dc2626", "#9333ea", "#0891b2", "#db2777", "#65a30d", "#ea580c", "#0d9488"];
const PROY = "PROY"; // «año» que representa la proyección del escenario

const fmt = (n, d = 0) => (n == null ? "—" : Number(n).toLocaleString("es", { minimumFractionDigits: d, maximumFractionDigits: d }));

const GRAFICAS = [
  { id: "ratio", titulo: "Ratio (cajas por racimo)", dec: 3 },
  { id: "embolses", titulo: "Embolses", dec: 0 },
  { id: "embolsesPorHa", titulo: "Embolses por hectárea", dec: 1 },
  { id: "cajas", titulo: "Cajas producidas", dec: 0 },
  { id: "hectareas", titulo: "Hectáreas en producción (total)", dec: 1, ancha: true, sinPromedio: true },
];

// Series semana a semana de un conjunto de fincas: por cada indicador, el valor de cada año histórico real (`${año}_${id}`), el de la proyección
// (`proy_${id}`) y el promedio de los años no excluidos (`prom_${id}`). `divisor` > 1 las lleva a promedio por finca (los ratios no cambian).
function armarSeries(resultado, sel, divisor, { anioProy, excluirUltimas, excluidos }) {
  const aniosHist = new Set();
  // Histórico: por año y semana, suma de las fincas seleccionadas.
  const hist = new Map(); // `${anio}|${n}` -> { e, ha, c, j }
  for (const uuid of sel) {
    for (const [y, lista] of Object.entries(resultado.historico?.[uuid] || {})) {
      aniosHist.add(Number(y));
      for (const w of lista) {
        const k = `${y}|${w.n}`;
        const t = hist.get(k) || { e: 0, ha: 0, c: 0, j: 0 };
        t.e += w.e / divisor;
        t.ha += w.ha / divisor;
        t.c += w.c / divisor;
        t.j += w.j / divisor;
        hist.set(k, t);
      }
    }
  }
  // Proyectado: suma de las filas de las fincas seleccionadas por semana del año.
  const proy = new Map(); // n -> { e, ha, rac, caj }
  for (const f of resultado.filas) {
    if (!sel.has(f.fincaUuid)) continue;
    const t = proy.get(f.numeroSemana) || { e: 0, ha: 0, rac: 0, caj: 0 };
    t.e += f.embolses / divisor;
    t.ha += f.hectareasEfectivas / divisor;
    t.rac += f.racimos / divisor;
    t.caj += f.cajas / divisor;
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
  return { filas, anios: ys };
}

// Gráficas por finca (o de varias): para cada indicador, la curva semana a semana de los años históricos reales y la del año
// proyectado. `uuids`: fincas incluidas (una sola, o todas las visibles para el total). Debajo se pueden agregar comparaciones
// (otra finca, varias fincas en promedio, todas, y uno o varios años reales o la proyección), como en los gráficos de Clima.
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

  // ── Comparaciones ──
  const fincasLista = useMemo(
    () => (resultado.aprovechamiento || []).map((a) => ({ uuid: a.fincaUuid, nombre: a.fincaNombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [resultado],
  );
  // Años reales con datos en alguna finca (más reciente primero) y la proyección como una opción más.
  const aniosDisponibles = useMemo(() => {
    const ys = new Set();
    for (const [uuid, porAnio] of Object.entries(resultado.historico || {})) if (uuid !== "TOTAL") for (const y of Object.keys(porAnio)) ys.add(Number(y));
    return [PROY, ...[...ys].sort((a, b) => b - a)];
  }, [resultado]);
  const etiquetaAnio = (a) => (a === PROY ? `${anioProy} proyectado` : String(a));
  const [comparaciones, setComparaciones] = useState([]); // { id, fincaUuids ([] = todas), anios, fincaLabel, anioLabel, color }
  const [contador, setContador] = useState(0);
  const [fincaParaAgregar, setFincaParaAgregar] = useState("");
  const [fincasPendientes, setFincasPendientes] = useState([]); // fincas a promediar juntas en una sola línea
  const [anioElegido, setAnioElegido] = useState(() => aniosDisponibles.find((a) => a !== PROY && a < anioProy) ?? aniosDisponibles[0]);
  const [aniosPendientes, setAniosPendientes] = useState([]); // años a promediar en una sola línea

  const agregarFincaAlCombo = () => {
    const f = fincasLista.find((x) => x.uuid === fincaParaAgregar);
    if (!f || fincasPendientes.some((p) => p.uuid === f.uuid)) return;
    setFincasPendientes((prev) => [...prev, f]);
    setFincaParaAgregar("");
  };
  const agregarAnioAlCombo = () => {
    if (aniosPendientes.includes(anioElegido)) return;
    const nuevos = [...aniosPendientes, anioElegido];
    setAniosPendientes(nuevos);
    const siguiente = aniosDisponibles.find((a) => !nuevos.includes(a));
    if (siguiente !== undefined) setAnioElegido(siguiente);
  };
  const agregarComparacion = () => {
    // Lo que quedó elegido en los selectores sin pulsar «+» también cuenta.
    const fincaSuelta = fincasLista.find((x) => x.uuid === fincaParaAgregar);
    const fincasSel = [...fincasPendientes, ...(fincaSuelta && !fincasPendientes.some((p) => p.uuid === fincaSuelta.uuid) ? [fincaSuelta] : [])];
    const anios = aniosPendientes.length > 0 ? aniosPendientes : [anioElegido];
    const fincaLabel = fincasSel.length === 0 ? "Todas las fincas (prom. por finca)" : fincasSel.length === 1 ? fincasSel[0].nombre : `${fincasSel.map((f) => f.nombre).join(" + ")} (prom.)`;
    const reales = anios.filter((a) => a !== PROY).sort();
    const anioLabel = anios.length === 1 ? etiquetaAnio(anios[0]) : `Promedio ${[...reales, ...(anios.includes(PROY) ? [`${anioProy} proy.`] : [])].join("-")}`;
    const id = contador + 1;
    setContador(id);
    setComparaciones((prev) => [...prev, { id, fincaUuids: fincasSel.map((f) => f.uuid), anios, fincaLabel, anioLabel, color: COLORES_COMPARACION[prev.length % COLORES_COMPARACION.length] }]);
    setFincasPendientes([]);
    setFincaParaAgregar("");
    setAniosPendientes([]);
  };
  const quitarComparacion = (id) => setComparaciones((prev) => prev.filter((c) => c.id !== id));

  const { datos, anios } = useMemo(() => {
    const opciones = { anioProy, excluirUltimas, excluidos };
    const base = armarSeries(resultado, new Set(uuids), 1, opciones);
    const sinExcluir = { anioProy, excluirUltimas, excluidos: new Set() };
    // Una serie por comparación: la proyección y/o los años reales elegidos, promediados semana a semana si son varios.
    const series = comparaciones.map((c) => {
      const sel = c.fincaUuids.length ? c.fincaUuids : fincasLista.map((f) => f.uuid);
      const divisor = Math.max(1, sel.length);
      return { c, filas: new Map(armarSeries(resultado, new Set(sel), divisor, sinExcluir).filas.map((r) => [r.semana, r])) };
    });
    const datos = base.filas.map((r) => {
      const extra = {};
      for (const { c, filas } of series) {
        const fila = filas.get(r.semana) || {};
        for (const g of GRAFICAS) {
          const vals = c.anios.map((a) => (a === PROY ? fila[`proy_${g.id}`] : fila[`${a}_${g.id}`])).filter((v) => v != null);
          extra[`cmp${c.id}_${g.id}`] = vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null;
        }
      }
      return { ...r, ...extra };
    });
    return { datos, anios: base.anios };
  }, [resultado, uuids, excluidos, excluirUltimas, anioProy, comparaciones, fincasLista]);

  const alternarAnio = (y) =>
    setExcluidos((prev) => {
      const n = new Set(prev);
      if (n.has(y)) n.delete(y);
      else n.add(y);
      return n;
    });
  const visibles = anios.filter((y) => !excluidos.has(y));
  const datosVista = useMemo(() => filtrarSemanas(datos, rangoSemanas, "semana"), [datos, rangoSemanas]);
  const hayPromedioPorFinca = comparaciones.some((c) => c.fincaUuids.length !== 1);

  return (
    <ModalShell title={titulo} onClose={onClose} fullscreen>
      <div className="p-3 overflow-auto flex-grow-1">
      <p className="small text-secondary mb-2">
        Cada gráfica compara, semana a semana, los años históricos reales con la proyección de {anioProy} (línea verde gruesa) y el promedio histórico (línea naranja punteada). Pasa el ratón sobre la gráfica para ver el valor de cada semana.
        {comparaciones.length > 0 && " Las líneas de colores son las comparaciones que agregaste."}
        {hayPromedioPorFinca && " Cuando comparas varias fincas (o todas), embolses, cajas y hectáreas se muestran como promedio por finca para que la escala sea comparable."}
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

      <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
        <label className="form-label small fw-semibold mb-2 d-flex align-items-center gap-2">
          <FiSliders size={14} className="text-secondary" /> Comparar con otra finca u otro año
        </label>
        <div className="d-flex flex-wrap gap-3 align-items-end">
          <div>
            <label className="form-label small text-secondary mb-1">Finca</label>
            <div className="d-flex gap-1">
              <select className="form-select form-select-sm rounded-3" style={{ width: "15rem" }} value={fincaParaAgregar} onChange={(e) => setFincaParaAgregar(e.target.value)}>
                <option value="">Todas las fincas (promedio por finca)</option>
                {fincasLista
                  .filter((f) => !fincasPendientes.some((p) => p.uuid === f.uuid))
                  .map((f) => (
                    <option key={f.uuid} value={f.uuid}>
                      {f.nombre}
                    </option>
                  ))}
              </select>
              <button type="button" className="btn btn-sm btn-outline-secondary rounded-3" title="Sumar esta finca a la comparación (se promedian en una sola línea)" disabled={!fincaParaAgregar} onClick={agregarFincaAlCombo}>
                <FiPlus />
              </button>
            </div>
          </div>
          <div>
            <label className="form-label small text-secondary mb-1">Año</label>
            <div className="d-flex gap-1">
              <select className="form-select form-select-sm rounded-3" style={{ width: "10rem" }} value={String(anioElegido)} onChange={(e) => setAnioElegido(e.target.value === PROY ? PROY : Number(e.target.value))}>
                {aniosDisponibles
                  .filter((a) => !aniosPendientes.includes(a))
                  .map((a) => (
                    <option key={a} value={String(a)}>
                      {etiquetaAnio(a)}
                    </option>
                  ))}
              </select>
              <button type="button" className="btn btn-sm btn-outline-secondary rounded-3" title="Sumar este año a la comparación (se promedian en una sola línea)" onClick={agregarAnioAlCombo}>
                <FiPlus />
              </button>
            </div>
          </div>
          <button type="button" className="btn btn-sm btn-brand rounded-3 d-flex align-items-center gap-1" onClick={agregarComparacion}>
            <FiPlus /> Agregar comparación
          </button>
        </div>

        {fincasPendientes.length > 0 && (
          <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
            <span className="text-secondary small">Fincas a promediar juntas en una sola línea:</span>
            {fincasPendientes.map((f) => (
              <span key={f.uuid} className="badge rounded-pill d-inline-flex align-items-center gap-2 py-2 px-3" style={{ backgroundColor: "var(--brand-100)", color: "var(--brand-800)" }}>
                {f.nombre}
                <button type="button" className="btn-close" style={{ fontSize: "0.5rem" }} onClick={() => setFincasPendientes((prev) => prev.filter((x) => x.uuid !== f.uuid))} aria-label="Quitar"></button>
              </span>
            ))}
          </div>
        )}
        {aniosPendientes.length > 0 && (
          <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
            <span className="text-secondary small">Años a promediar en una sola línea:</span>
            {aniosPendientes.map((a) => (
              <span key={a} className="badge rounded-pill d-inline-flex align-items-center gap-2 py-2 px-3" style={{ backgroundColor: "var(--brand-100)", color: "var(--brand-800)" }}>
                {etiquetaAnio(a)}
                <button type="button" className="btn-close" style={{ fontSize: "0.5rem" }} onClick={() => setAniosPendientes((prev) => prev.filter((x) => x !== a))} aria-label="Quitar"></button>
              </span>
            ))}
          </div>
        )}

        {comparaciones.length > 0 && (
          <div className="d-flex flex-wrap gap-2 mt-3 pt-3 border-top">
            {comparaciones.map((c) => (
              <span key={c.id} className="badge rounded-pill d-inline-flex align-items-center gap-2 py-2 px-3 text-white" style={{ backgroundColor: c.color }}>
                {c.fincaLabel} · {c.anioLabel}
                <button type="button" className="btn-close btn-close-white" style={{ fontSize: "0.5rem" }} onClick={() => quitarComparacion(c.id)} aria-label="Quitar"></button>
              </span>
            ))}
          </div>
        )}
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
                    {comparaciones.map((c) => (
                      <Line key={c.id} type="monotone" dataKey={`cmp${c.id}_${g.id}`} name={`${c.fincaLabel} · ${c.anioLabel}`} stroke={c.color} strokeWidth={2.4} dot={false} connectNulls />
                    ))}
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
