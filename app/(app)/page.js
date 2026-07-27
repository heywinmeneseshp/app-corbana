"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiBarChart2,
  FiInfo,
  FiRefreshCw,
  FiPlusCircle,
  FiMinusCircle,
  FiXCircle,
  FiCheckCircle,
  FiFilter,
  FiChevronDown,
  FiChevronUp,
  FiMaximize2,
  FiX,
} from "react-icons/fi";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { apiFetch } from "@/lib/api";
import { COLOR_HEX, COLOR_TEXT } from "@/lib/semanaColor";

const FILAS_CONCEPTO = [
  { key: "totalEmbolsado", label: "Total Embolsado", sign: 1, color: "#16a34a", Icon: FiPlusCircle },
  { key: "totalRepicado", label: "Total Repicado", sign: -1, color: "#dc2626", Icon: FiMinusCircle },
  { key: "totalRecusado", label: "Total Recusado", sign: -1, color: "#ea580c", Icon: FiXCircle },
  { key: "totalProcesado", label: "Total Procesado", sign: -1, color: "#2563eb", Icon: FiCheckCircle },
];

const LS_KEY = "dashboard_fincas";

export default function InicioPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [allFincas, setAllFincas] = useState([]);
  const [fincasParam, setFincasParam] = useState(() => localStorage.getItem(LS_KEY) || "");
  const [fetchParam, setFetchParam] = useState(() => localStorage.getItem(LS_KEY) || "");
  const [fincasOpen, setFincasOpen] = useState(false);
  const [expandedChart, setExpandedChart] = useState(null);
  const [anioGraficos, setAnioGraficos] = useState("");
  const debounceRef = useRef(null);
  const initialFincasSet = useRef(false);

  function updateFincasParam(next) {
    setFincasParam(next);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setFetchParam(next), 400);
  }

  useEffect(() => {
    const timer = setTimeout(() => setLoading(true), 50);
    const params = new URLSearchParams();
    if (fetchParam) params.set("fincas", fetchParam);
    if (anioGraficos) params.set("anio", anioGraficos);
    const qs = params.toString();
    const url = `/dashboard/resumen${qs ? `?${qs}` : ""}`;
    apiFetch(url)
      .then((res) => {
        clearTimeout(timer);
        setData(res);
        if (!initialFincasSet.current && res.fincasActivas) {
          setAllFincas(res.fincasActivas);
          initialFincasSet.current = true;
        }
        setLoading(false);
      })
      .catch((err) => {
        clearTimeout(timer);
        setError(err.message);
        setLoading(false);
      });
    return () => clearTimeout(timer);
  }, [fetchParam, anioGraficos]);

  // El backend ya marca `ratio: null` semana por semana según si esa semana
  // REALMENTE tiene cajas/racimos registrados o no (ver dashboard.service.js)
  // — no hay que asumir a ciegas que las primeras ~12 semanas después del
  // primer embolse no tienen datos: con cargas históricas, sí pueden
  // tenerlos. Se confía en el dato real en vez de una suposición fija.
  //
  // Importante: NO se filtran las semanas sin dato (a diferencia de antes)
  // — el eje X de ChartLine es de tipo "categoría", así que su rango
  // depende de qué valores de `numeroSemana` aparecen en el arreglo, no del
  // `domain` fijo declarado. Si se acorta el arreglo, el eje también se
  // acorta. Se mantienen las 52 semanas (como en Cajas/Embolses), con
  // `ratio: null` en las que no tienen dato — ChartLine ya sabe no dibujar
  // punto ni conectar la línea en esos huecos.
  const ratioFiltrado = useMemo(() => data?.ratioAnual || [], [data]);
  const hayDatosDeRatio = useMemo(() => ratioFiltrado.some((s) => s.ratio !== null), [ratioFiltrado]);

  const totAncho = 120 + (data?.cohortes?.length || 0) * 68;

  function valorClase(valor) {
    if (valor > 0) return "text-success fw-medium";
    if (valor < 0) return "text-danger fw-medium";
    return "";
  }

  function saldoClase(valor) {
    return valor < 0 ? "text-danger fw-medium" : "fw-medium";
  }

  function formato(valor) {
    return Number(valor).toLocaleString("es");
  }

  function toggleFinca(id) {
    const next = ((prev) => {
      const current = prev
        ? prev.split(",").map(Number)
        : allFincas.map((f) => f.id);
      const n = current.includes(id)
        ? current.filter((fid) => fid !== id)
        : [...current, id];
      if (n.length === 0 || n.length === allFincas.length) {
        localStorage.removeItem(LS_KEY);
        return "";
      }
      const param = n.join(",");
      localStorage.setItem(LS_KEY, param);
      return param;
    })(fincasParam);
    updateFincasParam(next);
  }

  const selectedSet = useMemo(() => {
    if (fincasParam === "" || fincasParam === "none") return new Set();
    return new Set(fincasParam.split(",").map(Number));
  }, [fincasParam]);

  if (loading && !data) {
    return (
      <div className="p-4 p-md-5">
        <h1 className="fw-bold h3 mb-4 d-flex align-items-center gap-2">
          <FiBarChart2 /> Inicio
        </h1>
        <p className="text-secondary">Cargando resumen...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-4 p-md-5">
        <h1 className="fw-bold h3 mb-4 d-flex align-items-center gap-2">
          <FiBarChart2 /> Inicio
        </h1>
        <div className="alert alert-danger py-2 small">{error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 p-md-5">
        <h1 className="fw-bold h3 mb-4 d-flex align-items-center gap-2">
          <FiBarChart2 /> Inicio
        </h1>
        <p className="text-secondary">No hay datos disponibles.</p>
      </div>
    );
  }

  const { ultimaSemana, cajasProducidas, racimosCortados, ratio, cohortes } = data;

  return (
    <div className="p-4 p-md-5">
      <h1 className="fw-bold h3 mb-4 d-flex align-items-center gap-2">
        <FiBarChart2 /> Inicio
      </h1>

      {loading && data && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1050,
          backgroundColor: "rgba(0,0,0,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div className="bg-white rounded-4 shadow-lg p-4 d-flex flex-column align-items-center gap-2">
            <div className="spinner-border text-primary" role="status" />
            <span className="fw-semibold small">Recalculando dashboard...</span>
          </div>
        </div>
      )}

      {allFincas.length > 0 && (
        <div className="card border-0 shadow-sm rounded-4 mb-3">
          <button
            className="btn d-flex align-items-center justify-content-between w-100 px-3 py-1"
            onClick={() => setFincasOpen((v) => !v)}
            style={{ fontSize: "0.75rem", minHeight: "2rem" }}
          >
            <span className="fw-semibold d-flex align-items-center gap-2">
              <FiFilter />
              <span>Fincas Activas</span>
              <span className="text-secondary fw-normal">({allFincas.length})</span>
              {fincasParam !== "" && (
                <span className="badge bg-warning text-dark" style={{ fontSize: "0.6rem" }}>Filtrado</span>
              )}
            </span>
            {fincasOpen ? <FiChevronUp style={{ fontSize: "0.8rem" }} /> : <FiChevronDown style={{ fontSize: "0.8rem" }} />}
          </button>
          {fincasOpen && (
            <div className="px-3 pb-2" style={{ fontSize: "0.75rem" }}>
              {(() => {
                const fincaDataMap = new Map((data.fincasActivas || []).map((f) => [f.id, f]));
                const filas = allFincas.map((f) => {
                  const activa = fincaDataMap.get(f.id);
                  const checked = fincasParam === "" || selectedSet.has(f.id);
                  return { ...f, cajas: activa?.cajas ?? 0, recusados: activa?.recusados ?? 0, procesados: activa?.procesados ?? 0, ratio: activa?.ratio, checked };
                });
                return (
                  <div>
                    <div className="d-flex align-items-center py-1 border-bottom" style={{ fontSize: "0.6rem", letterSpacing: "0.03em", textTransform: "uppercase", color: "#94a3b8" }}>
                      <span style={{ width: "1.5rem" }}>
                        <input type="checkbox" className="form-check-input m-0" style={{ transform: "scale(0.75)" }}
                          checked={fincasParam === ""}
                          onChange={() => {
                            if (fincasParam === "") {
                              localStorage.setItem(LS_KEY, "none");
                              updateFincasParam("none");
                            } else {
                              localStorage.removeItem(LS_KEY);
                              updateFincasParam("");
                            }
                          }}
                        />
                      </span>
                      <span style={{ width: "3rem" }}>Código</span>
                      <span style={{ width: "9rem" }}>Finca</span>
                      <span className="text-end" style={{ width: "4rem" }}>Cajas</span>
                      <span className="text-end" style={{ width: "4rem" }}>Recus.</span>
                      <span className="text-end" style={{ width: "4rem" }}>Proc.</span>
                      <span className="text-end" style={{ width: "3.5rem" }}>Ratio</span>
                    </div>
                    {filas.map((f) => {
                      const ratioColor = f.ratio >= 1 ? "#047857" : "#b45309";
                      return (
                        <div key={f.id} className="d-flex align-items-center py-1 border-bottom border-light" style={{ fontSize: "0.75rem" }}>
                          <span style={{ width: "1.5rem" }}>
                            <input type="checkbox" className="form-check-input m-0" style={{ transform: "scale(0.75)" }} checked={f.checked} onChange={() => toggleFinca(f.id)} />
                          </span>
                          <span className="fw-medium" style={{ width: "3rem" }}>{f.codigo}</span>
                          <span className="text-secondary text-truncate" style={{ width: "9rem", fontSize: "0.7rem" }}>{f.nombre}</span>
                          <span className="fw-medium text-end" style={{ width: "4rem" }}>{f.cajas > 0 ? f.cajas.toLocaleString("es") : "—"}</span>
                          <span className="fw-medium text-end" style={{ width: "4rem", color: f.recusados > 0 ? "#ea580c" : undefined }}>{f.recusados > 0 ? f.recusados.toLocaleString("es") : "—"}</span>
                          <span className="fw-medium text-end" style={{ width: "4rem", color: f.procesados > 0 ? "#2563eb" : undefined }}>{f.procesados > 0 ? f.procesados.toLocaleString("es") : "—"}</span>
                          <span className="fw-bold text-end" style={{ width: "3.5rem", color: ratioColor }}>{f.ratio ?? "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card border-0 shadow-sm rounded-4 p-3 text-center">
            <p className="small text-secondary mb-1">Semana</p>
            <p className="fw-bold h4 mb-0">{ultimaSemana.codigo}</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm rounded-4 p-3 text-center">
            <p className="small text-secondary mb-1">Cajas Producidas</p>
            <p className="fw-bold h4 mb-0 text-brand">{cajasProducidas.toLocaleString("es")}</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm rounded-4 p-3 text-center">
            <p className="small text-secondary mb-1">Racimos Cortados</p>
            <p className="fw-bold h4 mb-0 text-danger">{racimosCortados.toLocaleString("es")}</p>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card border-0 shadow-sm rounded-4 p-3 text-center">
            <p className="small text-secondary mb-1">Ratio (cajas/racimo)</p>
            <p className="fw-bold h4 mb-0" style={{ color: ratio >= 1 ? "#047857" : "#b45309" }}>{ratio}</p>
          </div>
        </div>
      </div>

      {data.aniosDisponibles?.length > 0 && (
        <div className="d-flex align-items-center justify-content-end gap-2 mb-2">
          <label htmlFor="anio-graficos" className="small text-secondary mb-0">
            Año de los gráficos:
          </label>
          <select
            id="anio-graficos"
            className="form-select form-select-sm rounded-3"
            style={{ width: "auto" }}
            value={anioGraficos || String(data.anioSeleccionado || "")}
            onChange={(e) => setAnioGraficos(e.target.value)}
          >
            {data.aniosDisponibles.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      )}

      {!hayDatosDeRatio && (
        <div className="alert alert-light border small mb-3">
          No hay datos de cajas/racimos procesados para el año {anioGraficos || data.anioSeleccionado}.
        </div>
      )}

      {hayDatosDeRatio && (() => {
        function ChartTooltip({ active, payload, label, dataKey, prefix, decimal }) {
          if (!active || !payload || payload.length === 0) return null;
          const entry = payload.find((p) => p.dataKey === dataKey);
          if (!entry) return null;
          return (
            <div className="bg-white border rounded-3 shadow-sm p-2 small">
              <div className="fw-semibold mb-1">{label}</div>
              <div className="d-flex align-items-center gap-2">
                <span style={{ color: entry.color }}>●</span>
                <span>{prefix}:</span>
                <span className="fw-bold">{entry.value != null ? (decimal ? entry.value : Number(entry.value).toLocaleString("es")) : "—"}</span>
              </div>
            </div>
          );
        }
        const cajasData = data.ratioAnual || [];
        const embolseData = data.embolseAnual || [];
        return (
          <>
            {(() => {
              const aproData = (data.aprovechamientoAnual || []).filter((s) => {
                if (!data.primeraSemanaEmbolse) return true;
                return s.numeroSemana >= data.primeraSemanaEmbolse.numeroSemana;
              });

              function ChartCard({ id, title, subtitle, children, height }) {
                return (
                  <div className="card border-0 shadow-sm rounded-4 p-3 h-100">
                    <div className="d-flex align-items-start justify-content-between">
                      <div>
                        <h2 className="h6 fw-bold mb-0">{title}</h2>
                        <p className="text-secondary small mb-2">{subtitle}</p>
                      </div>
                      <button className="btn btn-sm p-0 border-0 text-secondary" onClick={() => setExpandedChart(id)} style={{ fontSize: "0.8rem" }}>
                        <FiMaximize2 />
                      </button>
                    </div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                      {children}
                    </div>
                  </div>
                );
              }

              function ChartLine({ data, dataKey, color, yDomain, yUnit, decimal, prefix }) {
                return (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 10, left: -5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="numeroSemana" tick={{ fontSize: 10 }} domain={[1, 53]} ticks={[1,10,20,30,40,50]} />
                      <YAxis tick={{ fontSize: 10 }} width={35} domain={yDomain || ['auto', 'auto']} unit={yUnit || ''} />
                      <Tooltip content={<ChartTooltip dataKey={dataKey} prefix={prefix} decimal={decimal} />} labelFormatter={(l) => {
                        const s = data.find((r) => r.numeroSemana === l);
                        return s ? s.semanaCodigo : `Semana ${l}`;
                      }} />
                      {dataKey === 'ratio' && <ReferenceLine y={1} stroke="#b45309" strokeDasharray="3 3" />}
                      <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={(p) => p.payload?.[dataKey] != null ? <circle cx={p.cx} cy={p.cy} r={3} fill={color} stroke="#374151" strokeWidth={1} /> : null} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                );
              }

              const charts = [
                { id: "ratio", title: "Ratio", subtitle: "Cajas producidas / racimos procesados, por semana", data: ratioFiltrado, dataKey: "ratio", color: "#6d28d9", decimal: true, prefix: "Ratio" },
                { id: "cajas", title: "Cajas Producidas", subtitle: "Por semana de registro", data: cajasData, dataKey: "cajas", color: "#16a34a", prefix: "Cajas" },
                { id: "embolses", title: "Embolses", subtitle: "Por semana de embolse", data: embolseData, dataKey: "embolse", color: "#2563eb", prefix: "Embolses" },
                { id: "aprovechamiento", title: "Aprovechamiento", subtitle: "(RECUSE + PROCESADO) / embolsado", data: aproData, dataKey: "aprovechamiento", color: "#047857", yDomain: [0, 100], yUnit: "%", decimal: true, prefix: "Aprov." },
              ];

              return (
                <>
                  <div className="row g-3 mt-0">
                    <div className="col-md-6" style={{ height: "280px" }}>
                      <ChartCard id="ratio" title="Ratio" subtitle="Cajas producidas / racimos procesados, por semana">
                        {hayDatosDeRatio && <ChartLine data={ratioFiltrado} dataKey="ratio" color="#6d28d9" decimal prefix="Ratio" />}
                      </ChartCard>
                    </div>
                    <div className="col-md-6" style={{ height: "280px" }}>
                      <ChartCard id="cajas" title="Cajas Producidas" subtitle="Por semana de registro">
                        {cajasData.length > 0 && <ChartLine data={cajasData} dataKey="cajas" color="#16a34a" prefix="Cajas" />}
                      </ChartCard>
                    </div>
                  </div>
                  <div className="row g-3 mt-0">
                    <div className="col-md-6" style={{ height: "280px" }}>
                      <ChartCard id="embolses" title="Embolses" subtitle="Por semana de embolse">
                        {embolseData.length > 0 && <ChartLine data={embolseData} dataKey="embolse" color="#2563eb" prefix="Embolses" />}
                      </ChartCard>
                    </div>
                    <div className="col-md-6" style={{ height: "280px" }}>
                      <ChartCard id="aprovechamiento" title="Aprovechamiento" subtitle="(RECUSE + PROCESADO) / embolsado">
                        {aproData.length > 0
                          ? <ChartLine data={aproData} dataKey="aprovechamiento" color="#047857" yDomain={[0, 100]} yUnit="%" decimal prefix="Aprov." />
                          : <div className="text-secondary small d-flex align-items-center justify-content-center" style={{ height: "100%" }}>Sin datos</div>}
                      </ChartCard>
                    </div>
                  </div>

                  {expandedChart && (() => {
                    const cfg = charts.find((c) => c.id === expandedChart);
                    if (!cfg) return null;
                    return (
                      <div style={{ position: "fixed", inset: 0, zIndex: 1060, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
                        <div className="bg-white rounded-4 shadow-lg p-4 d-flex flex-column" style={{ width: "90vw", height: "85vh" }}>
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <div>
                              <h2 className="h5 fw-bold mb-0">{cfg.title}</h2>
                              <p className="text-secondary small mb-0">{cfg.subtitle}</p>
                            </div>
                            <button className="btn btn-sm p-1 border-0" onClick={() => setExpandedChart(null)}>
                              <FiX size={24} />
                            </button>
                          </div>
                          <div style={{ flex: 1, minHeight: 0 }}>
                            {cfg.data.length > 0 && (
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={cfg.data} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                  <XAxis dataKey="numeroSemana" tick={{ fontSize: 12 }} domain={[1, 53]} ticks={[1,5,10,15,20,25,30,35,40,45,50]} />
                                  <YAxis tick={{ fontSize: 12 }} width={50} domain={cfg.yDomain || ['auto', 'auto']} unit={cfg.yUnit || ''} />
                                  <Tooltip content={<ChartTooltip dataKey={cfg.dataKey} prefix={cfg.prefix} decimal={cfg.decimal} />} labelFormatter={(l) => {
                                    const s = cfg.data.find((r) => r.numeroSemana === l);
                                    return s ? s.semanaCodigo : `Semana ${l}`;
                                  }} />
                                  {cfg.dataKey === 'ratio' && <ReferenceLine y={1} stroke="#b45309" strokeDasharray="4 4" />}
                                  <Line type="monotone" dataKey={cfg.dataKey} stroke={cfg.color} strokeWidth={3} dot={(p) => p.payload?.[cfg.dataKey] != null ? <circle cx={p.cx} cy={p.cy} r={5} fill={cfg.color} stroke="#374151" strokeWidth={2} /> : null} connectNulls={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              );
            })()}
        </>
      );
      })()}

      <div className="card border-0 shadow-sm rounded-4 p-0 overflow-auto mt-4">
        <div style={{ minWidth: totAncho + "px" }}>
          <table className="table table-bordered mb-0 align-middle" style={{ fontSize: "0.8125rem" }}>
            <thead>
              <tr>
                <th
                  className="sticky-col bg-white text-secondary small fw-semibold"
                  style={{ minWidth: "120px", left: 0, zIndex: 3 }}
                >
                  Concepto
                </th>
                {cohortes.map((col) => {
                  const bg = COLOR_HEX[col.color] || "#94a3b8";
                  const fg = COLOR_TEXT[col.color] || "#111827";
                  return (
                    <th
                      key={col.semanaUuid}
                      className="text-center"
                      style={{ minWidth: "68px", backgroundColor: bg, color: fg }}
                    >
                      <div className="fw-bold" style={{ fontSize: "0.7rem" }}>
                        {col.color?.toUpperCase()}
                      </div>
                      <div style={{ fontSize: "0.75rem" }}>{col.semanaCodigo}</div>
                      <div className="small" style={{ fontSize: "0.7rem", opacity: 0.85 }}>
                        Edad {col.edadSemanas}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {FILAS_CONCEPTO.map((fila) => (
                <tr key={fila.key} style={{ backgroundColor: "#eef2f6" }}>
                  <td className="sticky-col" style={{ left: 0, zIndex: 2, backgroundColor: "#eef2f6" }}>
                    <span className="d-flex align-items-center gap-2 fw-semibold" style={{ color: fila.color }}>
                      <fila.Icon /> {fila.label}
                    </span>
                  </td>
                  {cohortes.map((col) => {
                    const val = col[fila.key];
                    return (
                      <td
                        key={col.semanaUuid}
                        className={`text-center ${valorClase(fila.sign * val)}`}
                        style={{ backgroundColor: "#eef2f6" }}
                      >
                        {formato(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}

              <tr style={{ backgroundColor: "#eef2f6" }}>
                <td className="sticky-col fw-semibold" style={{ left: 0, zIndex: 2, backgroundColor: "#eef2f6" }}>
                  Recobros
                </td>
                {cohortes.map((col) => (
                  <td key={col.semanaUuid} className="text-center fw-medium" style={{ backgroundColor: "#eef2f6" }}>
                    {col.totalEmbolsado
                      ? `${(((col.totalProcesado + col.totalRecusado + col.totalRepicado) / col.totalEmbolsado) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                ))}
              </tr>
              <tr style={{ backgroundColor: "#eef2f6" }}>
                <td className="sticky-col fw-semibold" style={{ left: 0, zIndex: 2, backgroundColor: "#eef2f6" }}>
                  Aprovechamiento
                </td>
                {cohortes.map((col) => (
                  <td key={col.semanaUuid} className="text-center fw-medium" style={{ backgroundColor: "#eef2f6" }}>
                    {col.totalEmbolsado
                      ? `${(((col.totalRecusado + col.totalProcesado) / col.totalEmbolsado) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                ))}
              </tr>
              <tr style={{ borderTop: "2px solid #94a3b8" }}>
                <td className="sticky-col fw-bold bg-white" style={{ left: 0, zIndex: 2 }}>
                  Saldo
                </td>
                {cohortes.map((col) => {
                  const val = col.saldo;
                  return (
                    <td key={col.semanaUuid} className={`text-center fw-bold ${saldoClase(val)}`}>
                      {formato(val)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-secondary mt-2" style={{ fontSize: "0.7rem" }}>
        <p className="mb-1">
          <FiInfo className="me-1" />
          <strong>Recobros</strong> = (Total Procesado + Total Recusado + Total Repicado) / Total Embolsado — el % de
          racimos embolsados que ya tuvieron algún movimiento de salida.
        </p>
        <p className="mb-0">
          <FiInfo className="me-1" />
          <strong>Aprovechamiento</strong> = (Total Recusado + Total Procesado) / Total Embolsado — el % de racimos
          embolsados que llegaron a cosecha.
        </p>
      </div>

      <style jsx>{`
        .sticky-col {
          position: sticky;
          left: 0;
          z-index: 2;
        }
        .table th,
        .table td {
          white-space: nowrap;
          vertical-align: middle;
          padding: 0.25rem 0.3rem;
        }
        .table tbody th,
        .table tbody td {
          padding-top: 0.2rem;
          padding-bottom: 0.2rem;
        }
        .table-bordered th,
        .table-bordered td {
          border: 1px solid #e2e8f0;
        }
      `}</style>
    </div>
  );
}
