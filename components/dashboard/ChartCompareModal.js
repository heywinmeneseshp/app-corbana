"use client";

import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import { FiX, FiPlus } from "react-icons/fi";
import { apiFetch } from "@/lib/api";

const COLORES_COMPARACION = ["#dc2626", "#f59e0b", "#0891b2", "#7c3aed", "#db2777", "#65a30d", "#0f172a"];

// Modal de gráfico con comparaciones agregables (otra finca, otro año). La
// línea "base" es la que ya se ve en el dashboard (no se vuelve a pedir acá,
// ya está cargada) — las comparaciones sí se piden recién cuando se agregan
// desde este modal, nunca antes: el dashboard no precarga nada de esto.
export default function ChartCompareModal({
  open,
  onClose,
  title,
  subtitle,
  metricKey, // 'ratio' | 'cajas' | 'embolse' | 'aprovechamiento'
  arrayField, // 'ratioAnual' | 'embolseAnual' | 'aprovechamientoAnual' — qué campo de /dashboard/resumen trae esta métrica
  baseData,
  baseLabel,
  baseColor,
  decimal,
  prefix,
  yDomain,
  yUnit,
  aniosDisponibles,
  anioBase,
  fincaBaseLabel,
}) {
  const [fincas, setFincas] = useState([]);
  const [fincaParaAgregar, setFincaParaAgregar] = useState(""); // select temporal, antes de sumarla a fincasPendientes
  const [fincasPendientes, setFincasPendientes] = useState([]); // fincas que van a combinarse en UNA sola línea
  const [anioElegido, setAnioElegido] = useState(anioBase);
  const [aniosPendientes, setAniosPendientes] = useState([]); // años que van a promediarse en UNA sola línea
  const [comparaciones, setComparaciones] = useState([]); // [{id, fincaId, fincaLabel, anio, color, data, loading, error}]
  const [semanaDesde, setSemanaDesde] = useState(1);
  const [semanaHasta, setSemanaHasta] = useState(53);
  const [mostrarBase, setMostrarBase] = useState(true); // la línea que viene precargada del dashboard

  useEffect(() => {
    if (!open) return;
    // Se pide recién al abrir el modal — el dashboard nunca carga esto.
    apiFetch("/fincas?limit=100")
      .then((res) => setFincas(res.items))
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) {
      setComparaciones([]);
      setFincaParaAgregar("");
      setFincasPendientes([]);
      setAnioElegido(anioBase);
      setAniosPendientes([]);
      setSemanaDesde(1);
      setSemanaHasta(53);
      setMostrarBase(true);
    }
  }, [open, anioBase]);

  // Suma una finca al combo que se está armando para la próxima
  // comparación — así "Villagrande + Oasis" termina siendo UNA sola línea
  // (el backend ya suma los datos de todas las fincas en `fincas=` separadas
  // por coma), en vez de una línea por finca.
  const agregarFincaAlCombo = () => {
    if (!fincaParaAgregar) return;
    if (fincasPendientes.some((f) => String(f.id) === fincaParaAgregar)) return;
    const finca = fincas.find((f) => String(f.id) === fincaParaAgregar);
    if (finca) setFincasPendientes((prev) => [...prev, finca]);
    setFincaParaAgregar("");
  };

  const quitarFincaDelCombo = (id) => {
    setFincasPendientes((prev) => prev.filter((f) => f.id !== id));
  };

  // Mismo mecanismo que las fincas, pero para años — la diferencia es cómo
  // se combinan: varias fincas se SUMAN (el backend ya lo hace), varios
  // años se PROMEDIAN semana a semana (no tendría sentido sumar, por
  // ejemplo, el ratio de 3 años) — eso sí hay que calcularlo acá, porque
  // el backend solo acepta un `anio` por consulta.
  const agregarAnioAlCombo = () => {
    if (aniosPendientes.includes(anioElegido)) return;
    const nuevosPendientes = [...aniosPendientes, anioElegido];
    setAniosPendientes(nuevosPendientes);
    // El año recién agregado sale de las opciones del <select> (ver el
    // filter más abajo) — si no se avanza acá, el estado se queda apuntando
    // a un valor que ya no está en la lista visible, y el próximo clic en
    // "+" parece no hacer nada (compara contra ese año viejo otra vez).
    const siguiente = (aniosDisponibles || []).find((a) => !nuevosPendientes.includes(a));
    if (siguiente !== undefined) setAnioElegido(siguiente);
  };

  const quitarAnioDelCombo = (anio) => {
    setAniosPendientes((prev) => prev.filter((a) => a !== anio));
  };

  const agregarComparacion = () => {
    const anios = aniosPendientes.length > 0 ? aniosPendientes : [anioElegido];
    if (fincasPendientes.length === 0 && anios.length === 0) return;
    const fincaIds = fincasPendientes.map((f) => f.id);
    const id = `${fincaIds.join("-") || "todas"}-${anios.join("-")}-${Date.now()}`;
    const fincaLabel = fincasPendientes.length > 0 ? fincasPendientes.map((f) => f.nombre).join(" + ") : "Todas las fincas";
    const anioLabel = anios.length > 1 ? `Promedio ${anios.slice().sort().join("-")}` : String(anios[0]);
    // El color se calcula DENTRO del updater funcional (con prev.length, no
    // con comparaciones.length de afuera) — si no, dos clics seguidos en
    // "Agregar comparación" pueden leer la misma longitud desactualizada y
    // las dos comparaciones terminan con el mismo color.
    setComparaciones((prev) => [
      ...prev,
      {
        id,
        fincaIds,
        fincaLabel,
        anio: anioLabel,
        color: COLORES_COMPARACION[prev.length % COLORES_COMPARACION.length],
        data: null,
        loading: true,
        error: "",
      },
    ]);

    Promise.all(
      anios.map((anio) => {
        const params = new URLSearchParams();
        if (fincaIds.length > 0) params.set("fincas", fincaIds.join(","));
        params.set("anio", anio);
        return apiFetch(`/dashboard/resumen?${params.toString()}`).then((res) => res[arrayField] || []);
      }),
    )
      .then((resultadosPorAnio) => {
        // Promedio por número de semana, ignorando los años donde esa
        // semana no tiene dato (ej. semanas futuras) en vez de contarlos
        // como 0 y bajar el promedio artificialmente.
        const dataPromediada = [];
        for (let n = 1; n <= 53; n++) {
          const valores = resultadosPorAnio
            .map((filas) => filas.find((f) => f.numeroSemana === n)?.[metricKey])
            .filter((v) => v !== null && v !== undefined);
          if (valores.length === 0) continue;
          const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
          dataPromediada.push({ numeroSemana: n, [metricKey]: Math.round(promedio * 100) / 100 });
        }
        setComparaciones((prev) =>
          prev.map((c) => (c.id === id ? { ...c, data: dataPromediada, loading: false } : c)),
        );
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

  // Se arma una sola serie mergeada por número de semana (1-53), con una
  // columna por línea — es lo que Recharts necesita para dibujar varias
  // líneas independientes en el mismo eje.
  // Rango válido (por si "desde" quedó mayor que "hasta" al tipear).
  const desde = Math.min(semanaDesde, semanaHasta);
  const hasta = Math.max(semanaDesde, semanaHasta);

  const mergedData = useMemo(() => {
    const porSemana = new Map();
    for (let n = desde; n <= hasta; n++) porSemana.set(n, { numeroSemana: n });

    for (const fila of baseData || []) {
      const row = porSemana.get(fila.numeroSemana);
      if (row) {
        row.base = fila[metricKey];
        row.baseSemanaCodigo = fila.semanaCodigo;
      }
    }
    for (const comp of comparaciones) {
      if (!comp.data) continue;
      for (const fila of comp.data) {
        const row = porSemana.get(fila.numeroSemana);
        if (row) row[comp.id] = fila[metricKey];
      }
    }
    return [...porSemana.values()];
  }, [baseData, comparaciones, metricKey, desde, hasta]);

  // Traduce el dataKey interno de cada línea ("base", o el id generado para
  // cada comparación) a una etiqueta legible — se usa tanto en la leyenda
  // como en el tooltip, para no mostrar el id crudo en ninguno de los dos.
  const nombreSerie = (dataKey) => {
    if (dataKey === "base") return `${fincaBaseLabel || "Selección actual"} · ${anioBase}`;
    const comp = comparaciones.find((c) => c.id === dataKey);
    return comp ? `${comp.fincaLabel} · ${comp.anio}` : dataKey;
  };

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1060, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div className="bg-white rounded-4 shadow-lg p-4 d-flex flex-column" style={{ width: "90vw", height: "90vh" }}>
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div>
            <h2 className="h5 fw-bold mb-0">{title}</h2>
            <p className="text-secondary small mb-0">{subtitle}</p>
          </div>
          <button className="btn btn-sm p-1 border-0" onClick={onClose}>
            <FiX size={24} />
          </button>
        </div>

        <div className="border rounded-3 p-3 mb-3">
          <label className="form-label small fw-semibold mb-2">Comparar con otra finca u otro año</label>
          <div className="d-flex flex-wrap gap-2 align-items-end">
            <div>
              <label className="form-label small text-secondary mb-1">Finca</label>
              <div className="d-flex gap-1">
                <select className="form-select form-select-sm rounded-3" style={{ width: "13rem" }} value={fincaParaAgregar} onChange={(e) => setFincaParaAgregar(e.target.value)}>
                  <option value="">Elegir finca...</option>
                  {fincas.filter((f) => !fincasPendientes.some((p) => p.id === f.id)).map((f) => (
                    <option key={f.id} value={f.id}>{f.codigo} — {f.nombre}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-3"
                  title="Sumar esta finca a la comparación"
                  disabled={!fincaParaAgregar}
                  onClick={agregarFincaAlCombo}
                >
                  <FiPlus />
                </button>
              </div>
            </div>
            <div>
              <label className="form-label small text-secondary mb-1">Año</label>
              <div className="d-flex gap-1">
                <select className="form-select form-select-sm rounded-3" style={{ width: "7rem" }} value={anioElegido} onChange={(e) => setAnioElegido(Number(e.target.value))}>
                  {(aniosDisponibles || [anioBase]).filter((a) => !aniosPendientes.includes(a)).map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-3"
                  title="Sumar este año al promedio de la comparación"
                  onClick={agregarAnioAlCombo}
                >
                  <FiPlus />
                </button>
              </div>
            </div>
            <button type="button" className="btn btn-sm btn-brand rounded-3 d-flex align-items-center gap-1" onClick={agregarComparacion}>
              <FiPlus /> Agregar comparación
            </button>
            <div className="d-flex align-items-end gap-2 ms-md-3">
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
            <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
              <span className="text-secondary small">Fincas a sumar en una sola línea:</span>
              {fincasPendientes.map((f) => (
                <span key={f.id} className="badge rounded-pill bg-secondary d-inline-flex align-items-center gap-2">
                  {f.nombre}
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    style={{ fontSize: "0.55rem" }}
                    onClick={() => quitarFincaDelCombo(f.id)}
                    aria-label="Quitar"
                  ></button>
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
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    style={{ fontSize: "0.55rem" }}
                    onClick={() => quitarAnioDelCombo(a)}
                    aria-label="Quitar"
                  ></button>
                </span>
              ))}
            </div>
          )}

          {(mostrarBase || comparaciones.length > 0) && (
            <div className="d-flex flex-wrap gap-2 mt-3">
              {mostrarBase && (
                <span className="badge rounded-pill d-inline-flex align-items-center gap-2" style={{ backgroundColor: baseColor }}>
                  {fincaBaseLabel || "Selección actual"} · {anioBase}
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    style={{ fontSize: "0.55rem" }}
                    onClick={() => setMostrarBase(false)}
                    aria-label="Quitar"
                  ></button>
                </span>
              )}
              {comparaciones.map((c) => (
                <span key={c.id} className="badge rounded-pill d-inline-flex align-items-center gap-2" style={{ backgroundColor: c.color }}>
                  {c.loading ? "Cargando..." : c.error ? `Error: ${c.error}` : `${c.fincaLabel} · ${c.anio}`}
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    style={{ fontSize: "0.55rem" }}
                    onClick={() => quitarComparacion(c.id)}
                    aria-label="Quitar"
                  ></button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mergedData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="numeroSemana" tick={{ fontSize: 12 }} domain={[desde, hasta]} type="number" allowDecimals={false} />
              <YAxis tick={{ fontSize: 12 }} width={50} domain={yDomain || ["auto", "auto"]} unit={yUnit || ""} />
              <Tooltip
                formatter={(value, name) => [value != null ? (decimal ? value : Number(value).toLocaleString("es")) : "—", nombreSerie(name)]}
                labelFormatter={(l) => `Semana ${l}`}
              />
              <Legend formatter={(value) => nombreSerie(value)} />
              {metricKey === "ratio" && <ReferenceLine y={1} stroke="#b45309" strokeDasharray="4 4" />}
              {mostrarBase && (
                <Line type="monotone" dataKey="base" name="base" stroke={baseColor} strokeWidth={3} dot={{ r: 4 }} connectNulls={false} />
              )}
              {comparaciones.map((c) => (
                <Line key={c.id} type="monotone" dataKey={c.id} name={c.id} stroke={c.color} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
