"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { FiX, FiPlus } from "react-icons/fi";
import { apiFetch } from "@/lib/api";

const COLORES_COMPARACION = ["#dc2626", "#f59e0b", "#0891b2", "#7c3aed", "#db2777", "#65a30d", "#0f172a"];

// Día del año (1-366) de una fecha — mismo cálculo que hace el backend, para
// poder convertir el filtro de rango de fechas (vista Diaria) al mismo
// `periodo` que usan las demás vistas.
const diaDelAnio = (fechaIso) => {
  if (!fechaIso) return null;
  const d = new Date(`${fechaIso}T00:00:00Z`);
  const inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.floor((d - inicioAnio) / (24 * 60 * 60 * 1000)) + 1;
};

// `periodo` ubica cada punto DENTRO de su año (lo que antes era siempre
// "número de semana" 1-53) — cambia de rango según la granularidad elegida,
// para poder superponer el mismo período de años distintos sea cual sea la
// vista.
const GRANULARIDADES = [
  { key: "dia", label: "Diario", max: 366, etiqueta: "Día" },
  { key: "semana", label: "Semanal", max: 53, etiqueta: "Semana" },
  { key: "mes", label: "Mensual", max: 12, etiqueta: "Mes" },
];

// Mismo patrón que ChartCompareModal (Inicio → gráficos de Ratio/Cajas/etc.):
// una línea base + comparaciones agregables (otra finca, otro año), que solo
// se piden al agregarlas — nada de esto se precarga en la tarjeta chica de
// Clima. A diferencia de esa, acá la base tampoco viene ya cargada (la
// tarjeta chica muestra todos los años seguidos, sin recortar por año), así
// que el modal pide su propia línea base al abrir, para el año más reciente
// con datos.
export default function ClimaCompareModal({
  open,
  onClose,
  metricaKey, // 'mm' | 'temperatura' | 'humedad'
  metricaLabel,
  metricaCampo, // 'totalMm' | 'promedioTemperatura' | 'promedioHumedad'
  metricaColor,
  metricaUnidad,
  fincaUuidBase,
  fincaBaseLabel,
}) {
  const [fincas, setFincas] = useState([]);
  const [fincaParaAgregar, setFincaParaAgregar] = useState("");
  const [fincasPendientes, setFincasPendientes] = useState([]);
  const [aniosDisponibles, setAniosDisponibles] = useState([]);
  const [anioBase, setAnioBase] = useState(null);
  const [anioElegido, setAnioElegido] = useState(null);
  const [aniosPendientes, setAniosPendientes] = useState([]);
  const [comparaciones, setComparaciones] = useState([]);
  const [granularidad, setGranularidad] = useState("semana");
  const granularidadActual = GRANULARIDADES.find((g) => g.key === granularidad);
  const [semanaDesde, setSemanaDesde] = useState(1);
  const [semanaHasta, setSemanaHasta] = useState(53);
  // Solo para la vista Diaria: en vez de pedir un número de día del año (poco
  // intuitivo), se elige un rango de fechas de calendario, que se traduce a
  // "día del año" para el filtro real.
  const [fechaDiaDesde, setFechaDiaDesde] = useState("");
  const [fechaDiaHasta, setFechaDiaHasta] = useState("");
  const [mostrarBase, setMostrarBase] = useState(true);
  const [baseData, setBaseData] = useState(null);
  const [cargandoBase, setCargandoBase] = useState(true);
  const [error, setError] = useState("");
  const [detalle, setDetalle] = useState(null); // { semanaCodigo, fincas } | null
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState("");

  useEffect(() => {
    if (!open) return;
    apiFetch("/fincas?limit=100")
      .then((res) => setFincas(res.items))
      .catch(() => {});
  }, [open]);

  // Al abrir, pide la línea base para el año más reciente disponible con la
  // finca que ya estaba elegida en la tarjeta chica (o todas, si no había
  // ninguna elegida). Es el único fetch que se hace "solo", sin que el
  // usuario tenga que agregarlo — el resto son comparaciones a pedido.
  useEffect(() => {
    if (!open) return;
    setCargandoBase(true);
    setError("");
    const params = new URLSearchParams({ granularidad });
    if (fincaUuidBase) params.set("fincaUuid", fincaUuidBase);
    apiFetch(`/clima/serie?${params.toString()}`)
      .then((res) => {
        const anios = res.aniosDisponibles || [];
        setAniosDisponibles(anios);
        const anioMasReciente = anios[0] || new Date().getFullYear();
        setAnioBase(anioMasReciente);
        setAnioElegido(anioMasReciente);
        return apiFetch(
          `/clima/serie?${new URLSearchParams({
            ...(fincaUuidBase ? { fincaUuid: fincaUuidBase } : {}),
            anio: anioMasReciente,
            granularidad,
          }).toString()}`,
        );
      })
      .then((res) => {
        setBaseData(res.items || []);
        setCargandoBase(false);
      })
      .catch((err) => {
        setError(err.message);
        setCargandoBase(false);
      });
  }, [open, fincaUuidBase, granularidad]);

  // Cambiar de granularidad invalida las comparaciones ya cargadas (estaban
  // agrupadas por semana/mes/día distintos) y el rango desde/hasta, que
  // tiene un tope distinto en cada vista (366 días, 53 semanas, 12 meses).
  useEffect(() => {
    if (!open) return;
    setComparaciones([]);
    setSemanaDesde(1);
    setSemanaHasta(granularidadActual.max);
    const anioRef = anioBase || new Date().getFullYear();
    setFechaDiaDesde(`${anioRef}-01-01`);
    setFechaDiaHasta(`${anioRef}-12-31`);
    setDetalle(null);
    setErrorDetalle("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, granularidad]);

  useEffect(() => {
    if (!open) {
      setComparaciones([]);
      setFincaParaAgregar("");
      setFincasPendientes([]);
      setAniosPendientes([]);
      setSemanaDesde(1);
      setSemanaHasta(53);
      setMostrarBase(true);
      setBaseData(null);
      setDetalle(null);
      setErrorDetalle("");
    }
  }, [open]);

  // Al hacer clic en un punto, trae cuánto aportó cada finca a ese total —
  // `fincaUuidFiltro` es el alcance de fincas de LA LÍNEA en la que se hizo
  // clic (la base puede ser una finca distinta a una comparación), para que
  // el detalle no mezcle fincas que esa línea ni siquiera incluye.
  const verDetalleSemana = (semanaUuid, fincaUuidFiltro) => {
    if (!semanaUuid) return;
    setDetalle(null);
    setErrorDetalle("");
    setCargandoDetalle(true);
    const params = new URLSearchParams();
    if (fincaUuidFiltro) params.set("fincaUuid", fincaUuidFiltro);
    apiFetch(`/clima/promedio-semanal/${semanaUuid}/detalle?${params.toString()}`)
      .then((res) => {
        setDetalle(res);
        setCargandoDetalle(false);
      })
      .catch((err) => {
        setErrorDetalle(err.message);
        setCargandoDetalle(false);
      });
  };

  const agregarFincaAlCombo = () => {
    if (!fincaParaAgregar) return;
    if (fincasPendientes.some((f) => String(f.uuid) === fincaParaAgregar)) return;
    const finca = fincas.find((f) => String(f.uuid) === fincaParaAgregar);
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
    if (fincasPendientes.length === 0 && anios.length === 0) return;
    const fincaUuids = fincasPendientes.map((f) => f.uuid);
    const id = `${fincaUuids.join("-") || "todas"}-${anios.join("-")}-${Date.now()}`;
    const fincaLabel = fincasPendientes.length > 0 ? fincasPendientes.map((f) => f.nombre).join(" + ") : "Todas las fincas";
    const anioLabel = anios.length > 1 ? `Promedio ${anios.slice().sort().join("-")}` : String(anios[0]);
    // El color se calcula DENTRO del updater funcional (con prev.length, no
    // con comparaciones.length de afuera) — si no, dos clics seguidos en
    // "Agregar comparación" pueden leer la misma longitud desactualizada
    // (el segundo clic pasa antes de que el primero termine de re-renderizar)
    // y las dos comparaciones terminan con el mismo color, imposibles de
    // distinguir en el gráfico.
    setComparaciones((prev) => [
      ...prev,
      { id, fincaUuids, anios, fincaLabel, anio: anioLabel, color: COLORES_COMPARACION[prev.length % COLORES_COMPARACION.length], data: null, loading: true, error: "" },
    ]);

    Promise.all(
      anios.map((anio) => {
        const params = new URLSearchParams({ granularidad, anio });
        if (fincaUuids.length > 0) params.set("fincaUuid", fincaUuids.join(","));
        return apiFetch(`/clima/serie?${params.toString()}`).then((res) => res.items || []);
      }),
    )
      .then((resultadosPorAnio) => {
        const dataPromediada = [];
        for (let n = 1; n <= granularidadActual.max; n++) {
          const valores = resultadosPorAnio
            .map((filas) => filas.find((f) => f.periodo === n)?.[metricaCampo])
            .filter((v) => v !== null && v !== undefined);
          if (valores.length === 0) continue;
          const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
          // El detalle por finca de un punto solo tiene sentido si esa línea
          // representa UN año real (no un promedio entre varios) y estamos en
          // vista semanal (única con semanaUuid) — ahí sí hay una semana
          // concreta a la que consultarle el detalle.
          const semanaUuid = anios.length === 1 ? resultadosPorAnio[0].find((f) => f.periodo === n)?.semanaUuid : null;
          dataPromediada.push({ periodo: n, [metricaCampo]: Math.round(promedio * 100) / 100, semanaUuid });
        }
        setComparaciones((prev) => prev.map((c) => (c.id === id ? { ...c, data: dataPromediada, loading: false } : c)));
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

  const periodoDiaDesde = diaDelAnio(fechaDiaDesde) || 1;
  const periodoDiaHasta = diaDelAnio(fechaDiaHasta) || granularidadActual.max;
  const desde = granularidad === "dia" ? Math.min(periodoDiaDesde, periodoDiaHasta) : Math.min(semanaDesde, semanaHasta);
  const hasta = granularidad === "dia" ? Math.max(periodoDiaDesde, periodoDiaHasta) : Math.max(semanaDesde, semanaHasta);

  const mergedData = useMemo(() => {
    const porPeriodo = new Map();
    for (let n = desde; n <= hasta; n++) porPeriodo.set(n, { periodo: n });
    for (const fila of baseData || []) {
      const row = porPeriodo.get(fila.periodo);
      if (row) {
        row.base = fila[metricaCampo];
        row.baseSemanaUuid = fila.semanaUuid;
      }
    }
    for (const comp of comparaciones) {
      if (!comp.data) continue;
      for (const fila of comp.data) {
        const row = porPeriodo.get(fila.periodo);
        if (row) {
          row[comp.id] = fila[metricaCampo];
          row[`${comp.id}SemanaUuid`] = fila.semanaUuid;
        }
      }
    }
    return [...porPeriodo.values()];
  }, [baseData, comparaciones, metricaCampo, desde, hasta]);

  const nombreSerie = (dataKey) => {
    if (dataKey === "base") return `${fincaBaseLabel || "Selección actual"} · ${anioBase}`;
    const comp = comparaciones.find((c) => c.id === dataKey);
    return comp ? `${comp.fincaLabel} · ${comp.anio}` : dataKey;
  };

  // Punto clicleable genérico para cualquier línea del gráfico — cada línea
  // puede representar un alcance de fincas distinto (la base puede ser
  // "todas", una comparación puede ser una finca puntual), así que cada una
  // pasa su propio filtro de finca al pedir el detalle.
  const dotClicleable = (color, semanaUuidKey, fincaUuidFiltro) => function DotClicleable(props) {
    const { cx, cy, payload, key } = props;
    if (cx == null || cy == null) return null;
    const semanaUuid = payload?.[semanaUuidKey];
    return (
      <g
        key={key}
        style={{ cursor: semanaUuid ? "pointer" : "default" }}
        onClick={() => semanaUuid && verDetalleSemana(semanaUuid, fincaUuidFiltro)}
      >
        {/* Círculo invisible más grande: el visible (r=4) es muy chico para
            hacerle clic con precisión — este amplía el área clicleable sin
            cambiar cómo se ve el punto. */}
        <circle cx={cx} cy={cy} r={12} fill="transparent" />
        <circle cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={1} />
      </g>
    );
  };

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1060, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div className="bg-white rounded-4 shadow-lg p-4 d-flex flex-column" style={{ width: "90vw", height: "90vh" }}>
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div>
            <h2 className="h5 fw-bold mb-0">{metricaLabel}</h2>
            <p className="text-secondary small mb-0">Comparación entre fincas y años</p>
          </div>
          <button className="btn btn-sm p-1 border-0" onClick={onClose}>
            <FiX size={24} />
          </button>
        </div>

        <div className="d-flex gap-2 mb-2">
          {GRANULARIDADES.map((g) => (
            <button
              key={g.key}
              type="button"
              className={`btn btn-sm rounded-3 ${granularidad === g.key ? "btn-brand text-white" : "btn-outline-secondary"}`}
              onClick={() => setGranularidad(g.key)}
            >
              {g.label}
            </button>
          ))}
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="border rounded-3 p-3 mb-3">
          <label className="form-label small fw-semibold mb-2">Comparar con otra finca u otro año</label>
          <div className="d-flex flex-wrap gap-2 align-items-end">
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
                <select className="form-select form-select-sm rounded-3" style={{ width: "7rem" }} value={anioElegido || ""} onChange={(e) => setAnioElegido(Number(e.target.value))}>
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
            {granularidad === "dia" ? (
              <div className="d-flex align-items-end gap-2 ms-md-3">
                <div>
                  <label className="form-label small text-secondary mb-1">Fecha desde</label>
                  <input
                    type="date"
                    className="form-control form-control-sm rounded-3"
                    value={fechaDiaDesde}
                    onChange={(e) => setFechaDiaDesde(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label small text-secondary mb-1">hasta</label>
                  <input
                    type="date"
                    className="form-control form-control-sm rounded-3"
                    value={fechaDiaHasta}
                    onChange={(e) => setFechaDiaHasta(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="d-flex align-items-end gap-2 ms-md-3">
                <div>
                  <label className="form-label small text-secondary mb-1">{granularidadActual.etiqueta} desde</label>
                  <input
                    type="number"
                    min={1}
                    max={granularidadActual.max}
                    className="form-control form-control-sm rounded-3"
                    style={{ width: "6rem" }}
                    value={semanaDesde}
                    onChange={(e) => setSemanaDesde(Math.min(granularidadActual.max, Math.max(1, Number(e.target.value) || 1)))}
                  />
                </div>
                <div>
                  <label className="form-label small text-secondary mb-1">hasta</label>
                  <input
                    type="number"
                    min={1}
                    max={granularidadActual.max}
                    className="form-control form-control-sm rounded-3"
                    style={{ width: "6rem" }}
                    value={semanaHasta}
                    onChange={(e) => setSemanaHasta(Math.min(granularidadActual.max, Math.max(1, Number(e.target.value) || granularidadActual.max)))}
                  />
                </div>
              </div>
            )}
          </div>

          {fincasPendientes.length > 0 && (
            <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
              <span className="text-secondary small">Fincas a promediar juntas en una sola línea:</span>
              {fincasPendientes.map((f) => (
                <span key={f.uuid} className="badge rounded-pill bg-secondary d-inline-flex align-items-center gap-2">
                  {f.nombre}
                  <button type="button" className="btn-close btn-close-white" style={{ fontSize: "0.55rem" }} onClick={() => quitarFincaDelCombo(f.uuid)} aria-label="Quitar"></button>
                </span>
              ))}
            </div>
          )}

          {aniosPendientes.length > 0 && (
            <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
              <span className="text-secondary small">Años a promediar en una sola línea:</span>
              {aniosPendientes.map((a) => (
                <span key={a} className="badge rounded-pill bg-secondary d-inline-flex align-items-center gap-2">
                  {a}
                  <button type="button" className="btn-close btn-close-white" style={{ fontSize: "0.55rem" }} onClick={() => quitarAnioDelCombo(a)} aria-label="Quitar"></button>
                </span>
              ))}
            </div>
          )}

          {(mostrarBase || comparaciones.length > 0) && (
            <div className="d-flex flex-wrap gap-2 mt-3">
              {mostrarBase && (
                <span className="badge rounded-pill d-inline-flex align-items-center gap-2" style={{ backgroundColor: metricaColor }}>
                  {fincaBaseLabel || "Selección actual"} · {anioBase}
                  <button type="button" className="btn-close btn-close-white" style={{ fontSize: "0.55rem" }} onClick={() => setMostrarBase(false)} aria-label="Quitar"></button>
                </span>
              )}
              {comparaciones.map((c) => (
                <span key={c.id} className="badge rounded-pill d-inline-flex align-items-center gap-2" style={{ backgroundColor: c.color }}>
                  {c.loading ? "Cargando..." : c.error ? `Error: ${c.error}` : `${c.fincaLabel} · ${c.anio}`}
                  <button type="button" className="btn-close btn-close-white" style={{ fontSize: "0.55rem" }} onClick={() => quitarComparacion(c.id)} aria-label="Quitar"></button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          {cargandoBase ? (
            <p className="text-secondary small text-center py-5">Cargando...</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={mergedData}
                margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
                onClick={(e) => {
                  // Respaldo por si el clic no cae justo en el punto: toma la
                  // línea base de ese período (solo tiene sentido en vista
                  // Semanal, que es la única con semanaUuid).
                  const punto = e?.activePayload?.[0]?.payload;
                  if (mostrarBase && punto?.baseSemanaUuid) verDetalleSemana(punto.baseSemanaUuid, fincaUuidBase);
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="periodo" tick={{ fontSize: 12 }} domain={[desde, hasta]} type="number" allowDecimals={false} />
                <YAxis tick={{ fontSize: 12 }} width={50} unit={metricaUnidad || ""} />
                <Tooltip
                  formatter={(value, name) => [value != null ? `${Number(value).toLocaleString("es")} ${metricaUnidad}` : "—", nombreSerie(name)]}
                  labelFormatter={(l) => `${granularidadActual.etiqueta} ${l}`}
                />
                <Legend formatter={(value) => nombreSerie(value)} />
                {mostrarBase && (
                  <Line
                    type="monotone"
                    dataKey="base"
                    name="base"
                    stroke={metricaColor}
                    strokeWidth={3}
                    dot={dotClicleable(metricaColor, "baseSemanaUuid", fincaUuidBase)}
                    connectNulls={false}
                  />
                )}
                {comparaciones.map((c) => (
                  <Line
                    key={c.id}
                    type="monotone"
                    dataKey={c.id}
                    name={c.id}
                    stroke={c.color}
                    strokeWidth={2}
                    dot={dotClicleable(c.color, `${c.id}SemanaUuid`, (c.fincaUuids || []).join(","))}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
          <p className="text-secondary mb-0 mt-1" style={{ fontSize: "0.7rem" }}>
            {granularidad === "semana"
              ? "Hacé clic en un punto para ver el detalle por finca de esa semana (no disponible en líneas que promedian varios años)."
              : "El detalle por finca solo está disponible en la vista Semanal."}
          </p>
        </div>

        {(cargandoDetalle || errorDetalle || detalle) && (
          <div className="border rounded-3 p-3 mt-2" style={{ maxHeight: "12rem", overflowY: "auto" }}>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fw-semibold small">
                Detalle por finca {detalle ? `— ${detalle.semanaCodigo}` : ""}
              </span>
              <button
                type="button"
                className="btn-close"
                style={{ fontSize: "0.6rem" }}
                onClick={() => {
                  setDetalle(null);
                  setErrorDetalle("");
                }}
                aria-label="Cerrar"
              ></button>
            </div>
            {cargandoDetalle && <p className="text-secondary small mb-0">Cargando...</p>}
            {errorDetalle && <p className="text-danger small mb-0">{errorDetalle}</p>}
            {detalle && !cargandoDetalle && (
              <table className="table table-sm mb-0">
                <thead>
                  <tr className="text-secondary small">
                    <th>Finca</th>
                    <th className="text-end">{metricaLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.fincas.length === 0 && (
                    <tr>
                      <td colSpan={2} className="text-secondary small text-center py-2">
                        Ninguna finca estaba siendo monitoreada esa semana.
                      </td>
                    </tr>
                  )}
                  {detalle.fincas.map((f) => (
                    <tr key={f.fincaUuid}>
                      <td className="small">{f.fincaNombre}</td>
                      <td className="text-end small fw-medium">
                        {f[metricaCampo] != null ? `${f[metricaCampo]} ${metricaUnidad}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
