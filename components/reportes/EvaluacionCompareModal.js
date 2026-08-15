"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import { FiX, FiPlus } from "react-icons/fi";
import { apiFetch } from "@/lib/api";

const COLORES_COMPARACION = ["#dc2626", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#0f172a"];

// Modal de comparación reutilizable para los gráficos de evaluaciones
// (Suma Bruta, Índice de Infección, Conteo de Hojas) — mismo patrón que
// ChartCompareModal (dashboard) y ClimaCompareModal:
// una línea "base" (la finca/año que ya se estaba viendo) más comparaciones
// agregables donde varias fincas se SUMAN en una sola línea (el backend ya
// las suma vía fincaUuid separadas por coma) y varios años se PROMEDIAN
// semana a semana (eso sí se calcula acá, el backend solo acepta un año por
// consulta).
//
// `lineas`: una o más series a extraer de la MISMA respuesta del endpoint,
// ej. [{ key: "promedio", label: "Promedio", color }] para el gráfico por
// semana, o [{ key: "h3", label: "Suma Bruta Hoja 3", color, filtro: i =>
// i.hoja === 3 }, { key: "h5", ... }] para el de por hoja.
export default function EvaluacionCompareModal({
  open,
  onClose,
  titulo,
  endpoint,
  lineas,
  limitesControl = [],
  fincaUuidBase,
  fincaBaseLabel,
}) {
  const anioActual = new Date().getFullYear();
  const [fincas, setFincas] = useState([]);
  const [fincaParaAgregar, setFincaParaAgregar] = useState("");
  const [fincasPendientes, setFincasPendientes] = useState([]);
  const [anioBase] = useState(anioActual);
  const [anioElegido, setAnioElegido] = useState(anioActual);
  const [aniosPendientes, setAniosPendientes] = useState([]);
  const [comparaciones, setComparaciones] = useState([]);
  const [semanaDesde, setSemanaDesde] = useState(1);
  const [semanaHasta, setSemanaHasta] = useState(53);
  const [mostrarBase, setMostrarBase] = useState(true);
  const [baseData, setBaseData] = useState([]);
  const [cargandoBase, setCargandoBase] = useState(false);
  const [error, setError] = useState("");

  const aniosDisponibles = useMemo(
    () => [anioActual, anioActual - 1, anioActual - 2],
    [anioActual],
  );

  useEffect(() => {
    if (!open) return;
    apiFetch("/fincas?limit=100")
      .then((res) => setFincas(res.items))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setCargandoBase(true);
    setError("");
    const params = new URLSearchParams({ anio: anioBase });
    if (fincaUuidBase) params.set("fincaUuid", fincaUuidBase);
    apiFetch(`${endpoint}?${params.toString()}`)
      .then((res) => {
        setBaseData(res.items || []);
        setCargandoBase(false);
      })
      .catch((err) => {
        setError(err.message);
        setCargandoBase(false);
      });
  }, [open, fincaUuidBase, anioBase, endpoint]);

  useEffect(() => {
    if (!open) {
      setComparaciones([]);
      setFincaParaAgregar("");
      setFincasPendientes([]);
      setAnioElegido(anioActual);
      setAniosPendientes([]);
      setSemanaDesde(1);
      setSemanaHasta(53);
      setMostrarBase(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const agregarFincaAlCombo = () => {
    if (!fincaParaAgregar) return;
    if (fincasPendientes.some((f) => f.uuid === fincaParaAgregar)) return;
    const finca = fincas.find((f) => f.uuid === fincaParaAgregar);
    if (finca) setFincasPendientes((prev) => [...prev, finca]);
    setFincaParaAgregar("");
  };

  const quitarFincaDelCombo = (uuid) => {
    setFincasPendientes((prev) => prev.filter((f) => f.uuid !== uuid));
  };

  const agregarAnioAlCombo = () => {
    if (aniosPendientes.includes(anioElegido)) return;
    const nuevosPendientes = [...aniosPendientes, anioElegido];
    setAniosPendientes(nuevosPendientes);
    const siguiente = aniosDisponibles.find((a) => !nuevosPendientes.includes(a));
    if (siguiente !== undefined) setAnioElegido(siguiente);
  };

  const quitarAnioDelCombo = (anio) => {
    setAniosPendientes((prev) => prev.filter((a) => a !== anio));
  };

  const agregarComparacion = () => {
    const anios = aniosPendientes.length > 0 ? aniosPendientes : [anioElegido];
    const fincaUuids = fincasPendientes.map((f) => f.uuid);
    const id = `${fincaUuids.join("-") || "todas"}-${anios.join("-")}-${Date.now()}`;
    const fincaLabel = fincasPendientes.length > 0 ? fincasPendientes.map((f) => f.nombre).join(" + ") : "Todas las fincas";
    const anioLabel = anios.length > 1 ? `Promedio ${[...anios].sort().join("-")}` : String(anios[0]);

    setComparaciones((prev) => [
      ...prev,
      {
        id,
        fincaLabel,
        anioLabel,
        color: COLORES_COMPARACION[prev.length % COLORES_COMPARACION.length],
        porLinea: null,
        loading: true,
        error: "",
      },
    ]);

    Promise.all(
      anios.map((anio) => {
        const params = new URLSearchParams({ anio });
        if (fincaUuids.length > 0) params.set("fincaUuid", fincaUuids.join(","));
        return apiFetch(`${endpoint}?${params.toString()}`).then((res) => res.items || []);
      }),
    )
      .then((resultadosPorAnio) => {
        const porLinea = {};
        lineas.forEach((linea) => {
          const campo = linea.campo || "promedio";
          const dataPromediada = [];
          for (let n = 1; n <= 53; n++) {
            const valores = resultadosPorAnio
              .map((items) => items.find((i) => i.numeroSemana === n && (!linea.filtro || linea.filtro(i)))?.[campo])
              .filter((v) => v !== null && v !== undefined);
            if (valores.length === 0) continue;
            dataPromediada.push({ numeroSemana: n, valor: Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 100) / 100 });
          }
          porLinea[linea.key] = dataPromediada;
        });
        setComparaciones((prev) => prev.map((c) => (c.id === id ? { ...c, porLinea, loading: false } : c)));
      })
      .catch((err) => {
        setComparaciones((prev) => prev.map((c) => (c.id === id ? { ...c, loading: false, error: err.message } : c)));
      });

    setFincasPendientes([]);
    setAniosPendientes([]);
  };

  const quitarComparacion = (id) => {
    setComparaciones((prev) => prev.filter((c) => c.id !== id));
  };

  const desde = Math.min(semanaDesde, semanaHasta);
  const hasta = Math.max(semanaDesde, semanaHasta);

  const mergedData = useMemo(() => {
    const porSemana = new Map();
    for (let n = desde; n <= hasta; n++) porSemana.set(n, { numeroSemana: n });

    lineas.forEach((linea) => {
      const campo = linea.campo || "promedio";
      for (const item of baseData) {
        if (linea.filtro && !linea.filtro(item)) continue;
        const row = porSemana.get(item.numeroSemana);
        if (row) row[`base_${linea.key}`] = item[campo];
      }
    });

    for (const comp of comparaciones) {
      if (!comp.porLinea) continue;
      lineas.forEach((linea) => {
        for (const fila of comp.porLinea[linea.key] || []) {
          const row = porSemana.get(fila.numeroSemana);
          if (row) row[`${comp.id}_${linea.key}`] = fila.valor;
        }
      });
    }
    return [...porSemana.values()];
  }, [baseData, comparaciones, lineas, desde, hasta]);

  const nombreSerie = (dataKey) => {
    if (dataKey.startsWith("base_")) {
      const lineaKey = dataKey.slice("base_".length);
      const linea = lineas.find((l) => l.key === lineaKey);
      return `${fincaBaseLabel || "Selección actual"} · ${linea?.label || lineaKey} · ${anioBase}`;
    }
    for (const comp of comparaciones) {
      if (dataKey.startsWith(`${comp.id}_`)) {
        const lineaKey = dataKey.slice(comp.id.length + 1);
        const linea = lineas.find((l) => l.key === lineaKey);
        return `${comp.fincaLabel} · ${linea?.label || lineaKey} · ${comp.anioLabel}`;
      }
    }
    return dataKey;
  };

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1060, backgroundColor: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div className="bg-white rounded-4 shadow-lg d-flex flex-column" style={{ width: "90vw", maxWidth: "80rem", height: "90vh" }}>
        <div className="d-flex align-items-center justify-content-between px-4 pt-4 pb-3 border-bottom">
          <div>
            <h2 className="h5 fw-bold mb-0">{titulo}</h2>
            <p className="text-secondary small mb-0">Comparación entre fincas y años</p>
          </div>
          <button className="btn btn-sm btn-light rounded-circle d-flex align-items-center justify-content-center p-0" style={{ width: "2rem", height: "2rem" }} onClick={onClose}>
            <FiX size={18} />
          </button>
        </div>

        <div className="flex-grow-1 overflow-auto px-4 pb-4 pt-3">
          {error && <div className="alert alert-danger py-2 small">{error}</div>}

          <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
            <label className="form-label small fw-semibold mb-2">Comparar con otra finca u otro año</label>
            <div className="d-flex flex-wrap gap-3 align-items-end">
              <div>
                <label className="form-label small text-secondary mb-1">Finca</label>
                <div className="d-flex gap-1">
                  <select className="form-select form-select-sm rounded-3" style={{ width: "13rem" }} value={fincaParaAgregar} onChange={(e) => setFincaParaAgregar(e.target.value)}>
                    <option value="">Elegir finca...</option>
                    {fincas.filter((f) => !fincasPendientes.some((p) => p.uuid === f.uuid)).map((f) => (
                      <option key={f.uuid} value={f.uuid}>{f.codigo} — {f.nombre}</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-sm btn-outline-secondary rounded-3" title="Sumar esta finca a la comparación" disabled={!fincaParaAgregar} onClick={agregarFincaAlCombo}>
                    <FiPlus />
                  </button>
                </div>
              </div>
              <div>
                <label className="form-label small text-secondary mb-1">Año</label>
                <div className="d-flex gap-1">
                  <select className="form-select form-select-sm rounded-3" style={{ width: "7rem" }} value={anioElegido} onChange={(e) => setAnioElegido(Number(e.target.value))}>
                    {aniosDisponibles.filter((a) => !aniosPendientes.includes(a)).map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-sm btn-outline-secondary rounded-3" title="Sumar este año al promedio de la comparación" onClick={agregarAnioAlCombo}>
                    <FiPlus />
                  </button>
                </div>
              </div>
              <button type="button" className="btn btn-sm btn-brand rounded-3 d-flex align-items-center gap-1" onClick={agregarComparacion}>
                <FiPlus /> Agregar comparación
              </button>
              <div className="d-flex align-items-end gap-2">
                <div>
                  <label className="form-label small text-secondary mb-1">Semana desde</label>
                  <input
                    type="number"
                    min={1}
                    max={53}
                    className="form-control form-control-sm rounded-3"
                    style={{ width: "6rem" }}
                    value={semanaDesde}
                    onChange={(e) => setSemanaDesde(Math.min(53, Math.max(1, Number(e.target.value) || 1)))}
                  />
                </div>
                <div>
                  <label className="form-label small text-secondary mb-1">hasta</label>
                  <input
                    type="number"
                    min={1}
                    max={53}
                    className="form-control form-control-sm rounded-3"
                    style={{ width: "6rem" }}
                    value={semanaHasta}
                    onChange={(e) => setSemanaHasta(Math.min(53, Math.max(1, Number(e.target.value) || 53)))}
                  />
                </div>
              </div>
            </div>

            {fincasPendientes.length > 0 && (
              <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
                <span className="text-secondary small">Fincas a sumar en una sola línea:</span>
                {fincasPendientes.map((f) => (
                  <span key={f.uuid} className="badge rounded-pill bg-secondary d-inline-flex align-items-center gap-2 py-2 px-3">
                    {f.nombre}
                    <button type="button" className="btn-close btn-close-white" style={{ fontSize: "0.5rem" }} onClick={() => quitarFincaDelCombo(f.uuid)} aria-label="Quitar"></button>
                  </span>
                ))}
              </div>
            )}

            {aniosPendientes.length > 0 && (
              <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
                <span className="text-secondary small">Años a promediar en una sola línea:</span>
                {aniosPendientes.map((a) => (
                  <span key={a} className="badge rounded-pill bg-secondary d-inline-flex align-items-center gap-2 py-2 px-3">
                    {a}
                    <button type="button" className="btn-close btn-close-white" style={{ fontSize: "0.5rem" }} onClick={() => quitarAnioDelCombo(a)} aria-label="Quitar"></button>
                  </span>
                ))}
              </div>
            )}

            {(mostrarBase || comparaciones.length > 0) && (
              <div className="d-flex flex-wrap gap-2 mt-3 pt-3 border-top">
                {mostrarBase && (
                  <span className="badge rounded-pill d-inline-flex align-items-center gap-2 py-2 px-3 text-white" style={{ backgroundColor: lineas[0]?.color || "#16a34a" }}>
                    {fincaBaseLabel || "Selección actual"} · {anioBase}
                    <button type="button" className="btn-close btn-close-white" style={{ fontSize: "0.5rem" }} onClick={() => setMostrarBase(false)} aria-label="Quitar"></button>
                  </span>
                )}
                {comparaciones.map((c) => (
                  <span key={c.id} className="badge rounded-pill d-inline-flex align-items-center gap-2 py-2 px-3 text-white" style={{ backgroundColor: c.color }}>
                    {c.loading ? "Cargando..." : c.error ? `Error: ${c.error}` : `${c.fincaLabel} · ${c.anioLabel}`}
                    <button type="button" className="btn-close btn-close-white" style={{ fontSize: "0.5rem" }} onClick={() => quitarComparacion(c.id)} aria-label="Quitar"></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="card border-0 shadow-sm rounded-4 p-3">
            <div style={{ height: "24rem" }}>
              {cargandoBase ? (
                <div className="d-flex align-items-center justify-content-center h-100">
                  <p className="text-secondary small mb-0">Cargando...</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mergedData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="numeroSemana" tick={{ fontSize: 12 }} domain={[desde, hasta]} type="number" allowDecimals={false} />
                    <YAxis tick={{ fontSize: 12 }} width={50} />
                    <Tooltip
                      cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
                      formatter={(value, name) => [value != null ? Number(value).toLocaleString("es") : "—", nombreSerie(name)]}
                      labelFormatter={(l) => `Semana ${l}`}
                    />
                    <Legend formatter={(value) => nombreSerie(value)} />
                    {limitesControl.map((limite) => (
                      <ReferenceLine
                        key={limite.valor}
                        y={limite.valor}
                        stroke={limite.color || "#dc2626"}
                        strokeDasharray="5 4"
                        strokeWidth={1.5}
                        label={{ value: String(limite.valor), position: "right", fill: limite.color || "#dc2626", fontSize: 11, fontWeight: 600 }}
                      />
                    ))}
                    {mostrarBase &&
                      lineas.map((linea) => (
                        <Line
                          key={`base_${linea.key}`}
                          type="monotone"
                          dataKey={`base_${linea.key}`}
                          name={`base_${linea.key}`}
                          stroke={linea.color}
                          strokeWidth={3}
                          dot={{ r: 4 }}
                          connectNulls={false}
                        />
                      ))}
                    {comparaciones.flatMap((comp) =>
                      lineas.map((linea, i) => (
                        <Line
                          key={`${comp.id}_${linea.key}`}
                          type="monotone"
                          dataKey={`${comp.id}_${linea.key}`}
                          name={`${comp.id}_${linea.key}`}
                          stroke={comp.color}
                          strokeWidth={2}
                          strokeDasharray={i === 0 ? undefined : "6 3"}
                          dot={{ r: 3 }}
                          connectNulls={false}
                        />
                      )),
                    )}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
