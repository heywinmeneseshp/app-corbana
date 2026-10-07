"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { apiFetch } from "@/lib/api";
import { GRANULARIDADES, VARIABLES, agregar } from "@/lib/climaAgregar";

const COLORES = ["#166534", "#2563eb", "#dc2626", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#475569", "#ea580c"];
const CARD_STYLE = { boxShadow: "0 1px 3px rgba(0,0,0,.06)" };

function hoyIso() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Bogota" });
}

function Tarjeta({ titulo, children }) {
  return (
    <div className="card border-0 rounded-4 mb-4 overflow-hidden" style={CARD_STYLE}>
      <div className="px-3 py-1" style={{ backgroundColor: "#166534" }}>
        <h2 className="h6 fw-bold mb-0 text-white text-uppercase" style={{ fontSize: "0.8rem", letterSpacing: "0.03em" }}>
          {titulo}
        </h2>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

// Gráficas de clima: comparar años (una línea por año, con una fuente) o
// comparar fuentes (la estación y las fincas de Open-Meteo, cada una una
// línea). Se agrupa por día, semana (ISO) o mes.
export default function ClimaGraficas({ ucBases }) {
  const anioActual = Number(hoyIso().slice(0, 4));
  const todosAnios = Array.from({ length: anioActual - 2023 + 1 }, (_, i) => 2023 + i);

  const [fuentes, setFuentes] = useState([]);
  const [modo, setModo] = useState("anios"); // "anios" | "fuentes"
  const [variable, setVariable] = useState("mm");
  const [granularidad, setGranularidad] = useState("mes");
  const [baseUc, setBaseUc] = useState(ucBases[0] ?? 14);

  // modo años
  const [fuenteAnios, setFuenteAnios] = useState("");
  const [anios, setAnios] = useState(todosAnios.slice(-3));
  // modo fuentes
  const [fuentesSel, setFuentesSel] = useState([]);
  const [desde, setDesde] = useState(`${anioActual}-01-01`);
  const [hasta, setHasta] = useState(hoyIso());

  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  // Fuentes disponibles; por defecto la estación y la finca más cercana (Pantoja).
  useEffect(() => {
    apiFetch("/estacion-meteorologica/comparativa/fuentes")
      .then((f) => {
        setFuentes(f || []);
        const pantoja = (f || []).find((x) => x.codigo === "204") || (f || []).find((x) => x.tipo === "openmeteo");
        setFuenteAnios(pantoja?.id || f?.[0]?.id || "");
        setFuentesSel([(f || []).find((x) => x.tipo === "estacion")?.id, pantoja?.id].filter(Boolean));
      })
      .catch((err) => setError(err.message));
  }, []);

  const nombreFuente = (id) => {
    const f = fuentes.find((x) => x.id === id);
    if (!f) return id;
    return f.tipo === "openmeteo" ? `${f.nombre} (Open-Meteo)` : f.nombre;
  };

  // Rango y fuentes a pedir según el modo.
  const consulta = useMemo(() => {
    if (modo === "anios") {
      if (!fuenteAnios || anios.length === 0) return null;
      return { fuentes: [fuenteAnios], desde: `${Math.min(...anios)}-01-01`, hasta: `${Math.max(...anios)}-12-31` };
    }
    if (fuentesSel.length === 0 || !desde || !hasta) return null;
    return { fuentes: fuentesSel, desde, hasta };
  }, [modo, fuenteAnios, anios, fuentesSel, desde, hasta]);

  const claveConsulta = consulta ? JSON.stringify(consulta) : "";

  useEffect(() => {
    if (!consulta) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDatos([]);
      return;
    }
    let cancelado = false;
    setCargando(true);
    setError("");
    const params = new URLSearchParams({ fuentes: consulta.fuentes.join(","), fechaDesde: consulta.desde, fechaHasta: consulta.hasta });
    apiFetch(`/estacion-meteorologica/comparativa?${params.toString()}`)
      .then((d) => {
        if (!cancelado) setDatos(d.items || []);
      })
      .catch((err) => {
        if (!cancelado) setError(err.message);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveConsulta]);

  // Modo años: solo los años elegidos (el rango pedido puede traer años intermedios).
  const datosFiltrados = useMemo(
    () => (modo === "anios" ? datos.filter((d) => anios.includes(Number(d.fecha.slice(0, 4)))) : datos),
    [datos, modo, anios],
  );

  const { filas, series } = useMemo(() => {
    const r = agregar(datosFiltrados, { modo: modo === "anios" ? "anios" : "fuentes", granularidad, variable, baseUc });
    // Por semana ISO, los primeros/últimos días del año pueden caer en la
    // semana del año vecino (ej. 1-ene-2023 es S52 de 2022): no se grafica
    // ese año si no está elegido.
    if (modo === "anios") r.series = r.series.filter((s) => anios.includes(Number(s)));
    return r;
  }, [datosFiltrados, modo, granularidad, variable, baseUc, anios]);

  const nombreSerie = (s) => (modo === "anios" ? s : nombreFuente(s));
  const defVariable = VARIABLES.find((v) => v.key === variable);
  const alternar = (lista, setLista, valor) => setLista(lista.includes(valor) ? lista.filter((x) => x !== valor) : [...lista, valor]);

  const estacionSeleccionada = modo === "fuentes" ? fuentesSel.includes("estacion") : fuenteAnios === "estacion";
  const sinDatosEstacion = estacionSeleccionada && !cargando && !datos.some((d) => d.fuente === "estacion");

  return (
    <div>
      <div className="mb-3">
        <h1 className="h4 fw-bold mb-1">Gráficas</h1>
        <p className="text-secondary small mb-0">Compara el clima entre años o entre fuentes (la estación y cada finca de Open-Meteo).</p>
      </div>

      <Tarjeta titulo="Configuración de la gráfica">
        <div className="d-flex flex-wrap align-items-end gap-3 mb-3">
          <div>
            <label className="form-label small text-secondary mb-1">Comparar</label>
            <div className="btn-group btn-group-sm">
              <button type="button" className={`btn ${modo === "anios" ? "btn-brand" : "btn-light"}`} onClick={() => setModo("anios")}>
                Años
              </button>
              <button type="button" className={`btn ${modo === "fuentes" ? "btn-brand" : "btn-light"}`} onClick={() => setModo("fuentes")}>
                Fuentes
              </button>
            </div>
          </div>
          <div>
            <label className="form-label small text-secondary mb-1">Variable</label>
            <select className="form-select form-select-sm rounded-3" value={variable} onChange={(e) => setVariable(e.target.value)}>
              {VARIABLES.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          {variable === "uc" && (
            <div>
              <label className="form-label small text-secondary mb-1">Base UC</label>
              <select className="form-select form-select-sm rounded-3" value={baseUc} onChange={(e) => setBaseUc(Number(e.target.value))}>
                {ucBases.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="form-label small text-secondary mb-1">Agrupar por</label>
            <select className="form-select form-select-sm rounded-3" value={granularidad} onChange={(e) => setGranularidad(e.target.value)}>
              {GRANULARIDADES.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          {modo === "anios" ? (
            <div>
              <label className="form-label small text-secondary mb-1">Fuente</label>
              <select className="form-select form-select-sm rounded-3" value={fuenteAnios} onChange={(e) => setFuenteAnios(e.target.value)}>
                {fuentes.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.tipo === "openmeteo" ? `${f.nombre} (Open-Meteo)` : f.nombre}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="form-label small text-secondary mb-1">Desde</label>
                <input type="date" className="form-control form-control-sm rounded-3" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
              </div>
              <div>
                <label className="form-label small text-secondary mb-1">Hasta</label>
                <input type="date" className="form-control form-control-sm rounded-3" value={hasta} min={desde} max={hoyIso()} onChange={(e) => setHasta(e.target.value)} />
              </div>
            </>
          )}
        </div>

        {modo === "anios" ? (
          <div>
            <div className="small fw-medium text-secondary mb-1">Años a comparar</div>
            <div className="d-flex flex-wrap gap-3">
              {todosAnios.map((a) => (
                <label key={a} className="form-check m-0 small">
                  <input type="checkbox" className="form-check-input" checked={anios.includes(a)} onChange={() => alternar(anios, setAnios, a)} />{" "}
                  <span className="form-check-label">{a}</span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="small fw-medium text-secondary">Fuentes ({fuentesSel.length})</span>
              <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => setFuentesSel(fuentes.map((f) => f.id))}>
                Todas
              </button>
              <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => setFuentesSel([])}>
                Ninguna
              </button>
            </div>
            <div className="d-flex flex-wrap gap-3" style={{ maxHeight: 130, overflowY: "auto" }}>
              {fuentes.map((f) => (
                <label key={f.id} className="form-check m-0 small">
                  <input type="checkbox" className="form-check-input" checked={fuentesSel.includes(f.id)} onChange={() => alternar(fuentesSel, setFuentesSel, f.id)} />{" "}
                  <span className="form-check-label">{f.tipo === "estacion" ? f.nombre : `${f.nombre}`}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </Tarjeta>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <Tarjeta titulo={`${defVariable?.label || ""} — ${modo === "anios" ? "comparación entre años" : "comparación entre fuentes"} (por ${GRANULARIDADES.find((g) => g.key === granularidad)?.label.toLowerCase()})`}>
        {cargando ? (
          <p className="text-secondary small mb-0">Cargando...</p>
        ) : filas.length === 0 ? (
          <p className="text-secondary small mb-0">Sin datos para esa selección.</p>
        ) : (
          <div style={{ width: "100%", height: 400 }}>
            <ResponsiveContainer>
              <LineChart data={filas} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend formatter={(v) => nombreSerie(v)} />
                {series.map((s, i) => (
                  <Line key={s} type="monotone" dataKey={s} name={s} stroke={COLORES[i % COLORES.length]} strokeWidth={2} dot={granularidad !== "dia"} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="text-secondary small mb-0 mt-2">
          {defVariable?.agg === "sum" ? "Por semana o mes se suman los días." : "Por semana o mes se promedian los días."}
          {sinDatosEstacion && " La estación aún no tiene datos en este rango: carga su historial con «Sincronizar rango» en la pestaña Estación."}
        </p>
      </Tarjeta>
    </div>
  );
}
