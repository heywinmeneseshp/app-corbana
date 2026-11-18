"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiActivity, FiDownload, FiRefreshCw, FiChevronDown, FiChevronUp, FiAlertTriangle, FiBarChart2, FiChevronRight } from "react-icons/fi";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";
import ProyeccionAnual from "@/components/proyeccion/ProyeccionAnual";
import GraficoRatio from "@/components/precalibracion/GraficoRatio";
import GraficasSemanalModal from "@/components/proyeccion/GraficasSemanalModal";
import { hasPermission } from "@/lib/auth";
import { calcularColorSemana, COLOR_HEX, COLOR_TEXT } from "@/lib/semanaColor";

const SEMANAS_OPCIONES = [4, 8, 12, 26, 52];
const SEMANAS_MAX = 53; // hasta un año calendario completo

const CONFIANZA_ESTILO = {
  Real: { bg: "#e2e8f0", color: "#334155" },
  Alta: { bg: "#dcfce7", color: "#166534" },
  Media: { bg: "#fef3c7", color: "#92400e" },
  Baja: { bg: "#fee2e2", color: "#991b1b" },
};

function rowKey(row) {
  return `${row.fincaUuid}-${row.semanaUuid}`;
}

// Origen de los racimos de cada edad: saldo real de la cinta, embolse real, o estimado por hectáreas × embolse por ha histórico.
const ORIGEN_EDAD = {
  saldo: { color: "#16a34a", texto: "saldo real" },
  embolse: { color: "#16a34a", texto: "embolse real" },
  real: { color: "#16a34a", texto: "real" },
  estimado: { color: "#f59e0b", texto: "estimado por hectáreas" },
  mixto: { color: "#65a30d", texto: "saldo real y estimado" },
};

function DistribucionEdad({ ageBreakdown }) {
  const max = Math.max(1, ...ageBreakdown.map((a) => a.racimos));
  return (
    <div className="d-flex align-items-end justify-content-center gap-1" style={{ height: 28 }} title={
      ageBreakdown.map((a) => `Edad ${a.edad}: ${a.racimos.toLocaleString("es")} racimos${a.origen ? ` (${ORIGEN_EDAD[a.origen]?.texto || a.origen})` : ""}`).join(" · ")
    }>
      {ageBreakdown.map((a) => (
        <div
          key={a.edad}
          style={{
            width: 6,
            height: Math.max(2, Math.round((a.racimos / max) * 24)),
            backgroundColor: ORIGEN_EDAD[a.origen]?.color || "#16a34a",
            opacity: 0.85,
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
}

const EDADES_COSECHA = [8, 9, 10, 11, 12];

// Patrón de corte de las últimas 5 cintas que ya tienen 12 semanas o más (cosecha terminada): % de lo procesado en cada edad y
// aprovechamiento (procesado ÷ procesado + repique + recuse), como en Estimaciones. `porGrupo`: { [fincaUuid | "GLOBAL"]: filas }.
function PatronCorteCard({ porGrupo, grupos }) {
  const [grupo, setGrupo] = useState(grupos[0]?.clave);
  const filas = porGrupo?.[grupo] || [];
  const promedio = EDADES_COSECHA.map((e) => {
    const v = filas.map((f) => f.porEdad.find((p) => p.edad === e)?.porcentaje).filter((x) => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  });
  const aprov = filas.map((f) => f.aprovechamiento).filter((x) => x != null);
  const aprovProm = aprov.length ? aprov.reduce((a, b) => a + b, 0) / aprov.length : null;
  return (
    <div className="card border-0 shadow-sm rounded-4 p-3 h-100">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
        <div className="fw-semibold small">Patrón de corte · últimas 5 cintas con 12 semanas o más</div>
        {grupos.length > 1 && (
          <select className="form-select form-select-sm rounded-1" style={{ width: "auto" }} value={grupo} onChange={(e) => setGrupo(e.target.value)}>
            {grupos.map((g) => (
              <option key={g.clave} value={g.clave}>
                {g.nombre}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="small text-secondary mb-2">% de los racimos procesados de cada cinta que se cortó en cada edad.</div>
      {filas.length === 0 ? (
        <div className="small text-secondary">Sin cintas con la cosecha terminada.</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm mb-0 text-center" style={{ fontSize: "0.8rem" }}>
            <thead className="table-light">
              <tr>
                <th>Cinta</th>
                {EDADES_COSECHA.map((e) => (
                  <th key={e}>{e} sem.</th>
                ))}
                <th>Aprov.</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const nombre = calcularColorSemana(f.cinta.anio, f.cinta.numeroSemana);
                return (
                  <tr key={f.cinta.codigo}>
                    <td>
                      <span className="badge rounded-pill" style={{ backgroundColor: COLOR_HEX[nombre], color: COLOR_TEXT[nombre] }} title={`${nombre} · ${f.edadHoy} semanas de edad`}>
                        {f.cinta.codigo}
                      </span>
                    </td>
                    {f.porEdad.map((p) => (
                      <td key={p.edad}>{p.porcentaje == null ? "—" : `${p.porcentaje.toFixed(1)}%`}</td>
                    ))}
                    <td className="fw-semibold">{f.aprovechamiento == null ? "—" : `${(f.aprovechamiento * 100).toFixed(1)}%`}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="table-light fw-bold">
                <td>Promedio</td>
                {promedio.map((v, i) => (
                  <td key={i}>{v == null ? "—" : `${v.toFixed(1)}%`}</td>
                ))}
                <td>{aprovProm == null ? "—" : `${(aprovProm * 100).toFixed(1)}%`}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// Encabezado de columna que abre las gráficas de ese indicador (como en Proyección anual).
function ThGrafica({ metrica, onGraficas, children, className = "" }) {
  return (
    <th className={className}>
      <span role="button" className="text-nowrap" style={{ cursor: "pointer", borderBottom: "1px dashed #94a3b8" }} title="Clic para ver las gráficas" onClick={() => onGraficas(metrica)}>
        {children} <FiBarChart2 size={11} className="text-secondary" />
      </span>
    </th>
  );
}

// Resumen de una simulación: error de las cajas y del ratio contra lo que realmente ocurrió, por total y por horizonte.
function ResumenSimulacion({ data }) {
  const filas = data.rows.filter((r) => r.cajasReales != null);
  if (filas.length === 0) {
    return <div className="alert alert-info py-2 small">Simulación al {data.meta.simulacion.fecha}: todavía no hay datos reales para comparar.</div>;
  }
  const porSemana = new Map();
  for (const r of filas) {
    const acc = porSemana.get(r.semanaCodigo) || { proy: 0, real: 0, ratioP: 0, ratioR: 0, n: 0 };
    acc.proy += r.cajas20kg;
    acc.real += r.cajasReales;
    if (r.ratioReal != null) {
      acc.ratioP += r.ratio;
      acc.ratioR += r.ratioReal;
      acc.n += 1;
    }
    porSemana.set(r.semanaCodigo, acc);
  }
  const semanas = [...porSemana.values()];
  const mape = (semanas.reduce((a, s) => a + Math.abs(s.proy - s.real) / s.real, 0) / semanas.length) * 100;
  const sesgo = (semanas.reduce((a, s) => a + (s.proy - s.real) / s.real, 0) / semanas.length) * 100;
  const totalProy = semanas.reduce((a, s) => a + s.proy, 0);
  const totalReal = semanas.reduce((a, s) => a + s.real, 0);
  return (
    <div className="alert alert-info py-2 small">
      <strong>Simulación al {data.meta.simulacion.fecha}</strong> (semana {data.meta.simulacion.semana}): se pronosticó con lo que se sabía ese día y se
      comparó con lo real en {semanas.length} semanas. Error medio de las cajas por semana: <strong>{mape.toFixed(1)}%</strong>, sesgo{" "}
      <strong>{sesgo > 0 ? "+" : ""}{sesgo.toFixed(1)}%</strong> ({sesgo > 0 ? "sobreestima" : "subestima"}). Total proyectado{" "}
      {totalProy.toLocaleString("es", { maximumFractionDigits: 0 })} cajas contra {totalReal.toLocaleString("es", { maximumFractionDigits: 0 })} reales (
      {((totalProy / totalReal - 1) * 100).toFixed(1)}%).
    </div>
  );
}

function PronosticoSemanal() {
  const [fincas, setFincas] = useState([]);
  const [fincaUuidsSeleccionadas, setFincaUuidsSeleccionadas] = useState([]);
  const [todasFincas, setTodasFincas] = useState(true);

  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual);
  const [semanasDelAnio, setSemanasDelAnio] = useState([]);
  const [semanaInicioUuid, setSemanaInicioUuid] = useState("");
  const [semanasProyectar, setSemanasProyectar] = useState(8);
  // Simulación: pronosticar como si hoy fuera una fecha pasada, para compararlo con lo que realmente ocurrió.
  const [simularDesde, setSimularDesde] = useState("");
  // Ventana de la gráfica del ratio (semanas antes y después de hoy); se aplica al pulsar Enter o salir del campo.
  const [ratioPasadas, setRatioPasadas] = useState(26);
  const [ratioFuturas, setRatioFuturas] = useState(26);

  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  const [pctNoCosechadoInput, setPctNoCosechadoInput] = useState("");
  const [pctNoCosechadoAplicado, setPctNoCosechadoAplicado] = useState(null);

  const [ratioOverrides, setRatioOverrides] = useState({});
  const [editandoRatio, setEditandoRatio] = useState(null);
  // Indicador cuyas gráficas se muestran (null = cerrado).
  const [graficas, setGraficas] = useState(null);
  // Semanas desplegadas (detalle de racimos por edad).
  const [abiertas, setAbiertas] = useState(new Set());
  const alternarSemana = (key) =>
    setAbiertas((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/fincas?limit=100")
      .then((res) => setFincas(res.items))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    apiFetch(`/semanas?limit=55&anio=${anio}`)
      .then((res) => setSemanasDelAnio(res.items))
      .catch((err) => setError(err.message));
  }, [anio]);

  function toggleFinca(uuid) {
    setTodasFincas(false);
    setFincaUuidsSeleccionadas((prev) =>
      prev.includes(uuid) ? prev.filter((u) => u !== uuid) : [...prev, uuid]
    );
  }

  function seleccionarTodas() {
    setTodasFincas(true);
    setFincaUuidsSeleccionadas([]);
  }

  function buildParams() {
    const params = new URLSearchParams({ semanas: String(semanasProyectar) });
    if (!todasFincas && fincaUuidsSeleccionadas.length > 0) {
      params.set("fincaUuids", fincaUuidsSeleccionadas.join(","));
    }
    params.set("ratioPasadas", String(ratioPasadas));
    params.set("ratioFuturas", String(ratioFuturas));
    if (simularDesde) params.set("simularDesde", simularDesde);
    else if (semanaInicioUuid) params.set("semanaInicioUuid", semanaInicioUuid);
    if (pctNoCosechadoAplicado !== null) params.set("pctNoCosechado", String(pctNoCosechadoAplicado));
    return params;
  }

  async function handleConsultar() {
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch(`/pronostico?${buildParams().toString()}`);
      setData(res);
      setRatioOverrides({});
    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const filtrosKey = JSON.stringify({
    todasFincas,
    fincaUuidsSeleccionadas,
    semanaInicioUuid,
    semanasProyectar,
    pctNoCosechadoAplicado,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleConsultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosKey]);

  async function handleExportar() {
    try {
      const blob = await apiFetchBlob(`/pronostico/exportar?${buildParams().toString()}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pronostico-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  function aplicarOverride() {
    if (pctNoCosechadoInput === "") {
      setPctNoCosechadoAplicado(null);
      return;
    }
    const valor = Number(pctNoCosechadoInput) / 100;
    if (Number.isNaN(valor) || valor < 0 || valor > 0.9) {
      setError("El % no cosechado debe estar entre 0 y 90.");
      return;
    }
    setPctNoCosechadoAplicado(valor);
  }

  function restablecerOverride() {
    setPctNoCosechadoInput("");
    setPctNoCosechadoAplicado(null);
  }

  function setRatioOverride(key, racimos, nuevoRatio) {
    const ratio = Number(nuevoRatio);
    if (Number.isNaN(ratio) || ratio < 0) return;
    setRatioOverrides((prev) => ({
      ...prev,
      [key]: { ratio, cajas20kg: Math.round(racimos * ratio * 100) / 100 },
    }));
  }

  // Basado en las filas (no en meta.fincas): "Todas" produce un solo grupo
  // global agregado por semana, no una fila por finca — meta.fincas sigue
  // listando todas las fincas incluidas en la suma, pero eso no debe
  // decidir si se muestra la columna Finca.
  const mostrarColumnaFinca = new Set((data?.rows || []).map((r) => r.fincaCodigo)).size > 1;
  const pctHistoricoLabel = useMemo(() => {
    const v = data?.meta?.pctNoCosechadoHistoricoPromedio;
    return v === null || v === undefined ? "—" : `${(v * 100).toFixed(1)}%`;
  }, [data]);

  return (
    <>
      <div>
        <div className="mb-4 d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
              <FiActivity /> Proyección semanal
            </h1>
            <p className="text-secondary mb-0">Proyección de cajas 20kg por finca: saldos reales por cinta y, donde no hay saldo, embolse estimado con hectáreas productivas y el comportamiento de años pasados.</p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2"
              onClick={handleExportar}
              disabled={!data || data.rows.length === 0}
            >
              <FiDownload /> Exportar Excel
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2"
              onClick={handleConsultar}
              disabled={loading}
              title="Actualizar"
            >
              <FiRefreshCw className={loading ? "spin" : ""} />
            </button>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        {data?.meta?.calendarioIncompleto && (
          <div className="alert alert-warning py-2 small d-flex align-items-start gap-2">
            <FiAlertTriangle className="flex-shrink-0 mt-1" />
            <span>
              Se pidieron {data.meta.semanas} semanas pero el calendario solo llega hasta{" "}
              <strong>{data.meta.ultimaSemanaCalendario?.codigo}</strong> — se muestran {data.meta.semanasDisponibles} semana(s) por finca.
              Genera el año siguiente en{" "}
              <Link href="/maestros/semanas" className="alert-link">Maestros → Semanas</Link> para proyectar más adelante.
            </span>
          </div>
        )}

        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
          <div className="row g-3 align-items-end">
            <div className="col-12">
              <label className="form-label small fw-medium mb-1">Finca</label>
              <div className="d-flex flex-wrap gap-1">
                <label className={`btn btn-sm rounded-3 ${todasFincas ? "btn-brand" : "btn-outline-secondary"}`}>
                  <input type="checkbox" className="d-none" checked={todasFincas} onChange={seleccionarTodas} />
                  Todas
                </label>
                {fincas.map((f) => (
                  <label
                    key={f.uuid}
                    className={`btn btn-sm rounded-3 ${!todasFincas && fincaUuidsSeleccionadas.includes(f.uuid) ? "btn-brand" : "btn-outline-secondary"}`}
                  >
                    <input
                      type="checkbox"
                      className="d-none"
                      checked={!todasFincas && fincaUuidsSeleccionadas.includes(f.uuid)}
                      onChange={() => toggleFinca(f.uuid)}
                    />
                    {f.nombre}
                  </label>
                ))}
              </div>
            </div>

            <div className="col-6 col-md-2">
              <label className="form-label small fw-medium mb-1">Año</label>
              <select className="form-select form-select-sm rounded-3" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
                {[anioActual - 1, anioActual, anioActual + 1].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small fw-medium mb-1">Semana inicial</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={semanaInicioUuid}
                onChange={(e) => setSemanaInicioUuid(e.target.value)}
              >
                <option value="">Semana actual</option>
                {semanasDelAnio.map((s) => (
                  <option key={s.uuid} value={s.uuid}>S{s.numeroSemana} - {s.anio}</option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-4">
              <label className="form-label small fw-medium mb-1">Semanas a proyectar</label>
              <div className="d-flex flex-wrap align-items-center gap-1">
                {SEMANAS_OPCIONES.map((n) => (
                  <label key={n} className={`btn btn-sm rounded-3 ${semanasProyectar === n ? "btn-brand" : "btn-outline-secondary"}`}>
                    <input type="radio" className="d-none" checked={semanasProyectar === n} onChange={() => setSemanasProyectar(n)} />
                    {n}
                  </label>
                ))}
                <input
                  type="number"
                  className="form-control form-control-sm rounded-3"
                  style={{ width: "5rem" }}
                  min="1"
                  max={SEMANAS_MAX}
                  value={semanasProyectar}
                  onChange={(e) => {
                    const valor = Math.max(1, Math.min(SEMANAS_MAX, Number(e.target.value) || 1));
                    setSemanasProyectar(valor);
                  }}
                  title={`Personalizado (máximo ${SEMANAS_MAX}, un año calendario)`}
                />
              </div>
            </div>
          </div>

          <div className="mt-3 d-flex flex-wrap align-items-end gap-2">
            <div>
              <label className="form-label small fw-medium mb-1">Simular desde (fecha pasada)</label>
              <input
                type="date"
                className="form-control form-control-sm rounded-3"
                style={{ width: "10rem" }}
                max={new Date().toISOString().slice(0, 10)}
                value={simularDesde}
                onChange={(e) => setSimularDesde(e.target.value)}
              />
            </div>
            {simularDesde && (
              <button type="button" className="btn btn-link btn-sm text-decoration-none" onClick={() => setSimularDesde("")}>
                Quitar simulación
              </button>
            )}
            <span className="text-secondary small mb-1">
              Pronostica como si hoy fuera esa fecha, usando solo lo que se sabía entonces, y lo compara con lo que pasó. Pulsa actualizar para aplicarlo.
            </span>
          </div>

          <div className="mt-2">
            <button
              type="button"
              className="btn btn-link btn-sm text-decoration-none px-0 d-flex align-items-center gap-1"
              onClick={() => setAjustesAbiertos((v) => !v)}
            >
              {ajustesAbiertos ? <FiChevronUp /> : <FiChevronDown />}
              Ajustes avanzados
            </button>
            {ajustesAbiertos && (
              <div className="d-flex align-items-end gap-2 mt-2">
                <div>
                  <label className="form-label small fw-medium mb-1">% no cosechado (opcional)</label>
                  <input
                    type="number"
                    className="form-control form-control-sm rounded-3"
                    style={{ width: "8rem" }}
                    min="0"
                    max="90"
                    step="0.5"
                    placeholder={pctHistoricoLabel}
                    value={pctNoCosechadoInput}
                    onChange={(e) => setPctNoCosechadoInput(e.target.value)}
                  />
                </div>
                <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={aplicarOverride}>
                  Aplicar
                </button>
                <button type="button" className="btn btn-link btn-sm text-decoration-none" onClick={restablecerOverride}>
                  Restablecer
                </button>
                <span className="text-secondary small mb-2">Histórico calculado: {pctHistoricoLabel}</span>
              </div>
            )}
          </div>
        </div>

        {data?.meta?.simulacion && <ResumenSimulacion data={data} />}

        {data?.ratioSerie?.serie?.length > 0 && (
          <div className="row g-3 mb-3">
          <div className="col-12 col-xl-7">
            <GraficoRatio
              datos={data.ratioSerie.serie}
              alcance={`${data.ratioSerie.pasadas} semanas pasadas y ${data.ratioSerie.futuras} futuras, vs. promedio de ${data.ratioSerie.aniosHistoricos} años anteriores`}
              controles={
                <div className="d-flex align-items-center gap-2 ms-auto me-1 small">
                  <label className="d-flex align-items-center gap-1 mb-0">
                    Pasadas
                    <input
                      type="number"
                      className="form-control form-control-sm rounded-3"
                      style={{ width: "4.5rem" }}
                      min="0"
                      max="156"
                      value={ratioPasadas}
                      onChange={(e) => setRatioPasadas(Math.max(0, Math.min(156, Number(e.target.value) || 0)))}
                      onBlur={handleConsultar}
                      onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                    />
                  </label>
                  <label className="d-flex align-items-center gap-1 mb-0">
                    Futuras
                    <input
                      type="number"
                      className="form-control form-control-sm rounded-3"
                      style={{ width: "4.5rem" }}
                      min="0"
                      max="53"
                      value={ratioFuturas}
                      onChange={(e) => setRatioFuturas(Math.max(0, Math.min(53, Number(e.target.value) || 0)))}
                      onBlur={handleConsultar}
                      onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                    />
                  </label>
                </div>
              }
            />
          </div>
          <div className="col-12 col-xl-5">
            <PatronCorteCard
              key={Object.keys(data.patronCorte || {}).join(",")}
              porGrupo={data.patronCorte}
              grupos={[...new Map(data.rows.map((r) => [r.fincaUuid ?? "GLOBAL", { clave: r.fincaUuid ?? "GLOBAL", nombre: r.fincaNombre || "Todas las fincas" }])).values()]}
            />
          </div>
          </div>
        )}

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle tabla-pronostico" style={{ fontSize: "0.84rem" }}>
              <thead className="table-light">
                <tr>
                  <th style={{ width: 24 }} />
                  <th>Semana</th>
                  {mostrarColumnaFinca && <th>Finca</th>}
                  <ThGrafica metrica="hectareas" onGraficas={setGraficas} className="text-end">Hectáreas</ThGrafica>
                  <ThGrafica metrica="edades" onGraficas={setGraficas}>Distribución por edad</ThGrafica>
                  <th className="text-end">Racimos cosechados</th>
                  <ThGrafica metrica="ratio" onGraficas={setGraficas} className="text-end">Ratio</ThGrafica>
                  <ThGrafica metrica="aprovechamiento" onGraficas={setGraficas} className="text-end">Aprovechamiento</ThGrafica>
                  <ThGrafica metrica="cajas" onGraficas={setGraficas} className="text-end">Cajas 20k</ThGrafica>
                  {data?.meta?.simulacion && <th className="text-end">Cajas reales</th>}
                  {data?.meta?.simulacion && <th className="text-end">Dif.</th>}
                  <th>Confianza</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={data?.meta?.simulacion ? 12 : 10} className="text-center text-secondary py-4">Cargando...</td></tr>
                )}
                {!loading && (!data || data.rows.length === 0) && (
                  <tr><td colSpan={data?.meta?.simulacion ? 12 : 10} className="text-center text-secondary py-4">No hay datos para los filtros seleccionados.</td></tr>
                )}
                {!loading && data && data.rows.map((row, idx) => {
                  const key = rowKey(row);
                  const override = ratioOverrides[key];
                  const ratioMostrado = override ? override.ratio : row.ratio;
                  const cajasMostradas = override ? override.cajas20kg : row.cajas20kg;
                  const estilo = CONFIANZA_ESTILO[row.confianza] || CONFIANZA_ESTILO.Media;
                  const esNuevaFinca = mostrarColumnaFinca && (idx === 0 || data.rows[idx - 1].fincaUuid !== row.fincaUuid);
                  return (
                    <Fragment key={key}>
                    {esNuevaFinca && (
                      <tr>
                        <td colSpan={data?.meta?.simulacion ? 12 : 10} className="bg-light fw-bold small py-2" style={{ borderTop: "2px solid #cbd5e1" }}>
                          {row.fincaCodigo} — {row.fincaNombre}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="text-secondary" role="button" style={{ cursor: "pointer" }} title="Ver los racimos por edad de esta semana" onClick={() => alternarSemana(key)}>
                        {abiertas.has(key) ? <FiChevronDown /> : <FiChevronRight />}
                      </td>
                      <td role="button" style={{ cursor: "pointer" }} onClick={() => alternarSemana(key)}>{row.semanaCodigo}</td>
                      {mostrarColumnaFinca && <td>{row.fincaNombre}</td>}
                      <td className="text-end">{row.hectareas != null ? row.hectareas.toLocaleString("es", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "—"}</td>
                      <td><DistribucionEdad ageBreakdown={row.ageBreakdown} /></td>
                      <td className="text-end">{row.racimosCosechados.toLocaleString("es")}</td>
                      <td className="text-end" style={{ minWidth: "5rem" }}>
                        {editandoRatio === key ? (
                          <input
                            type="number"
                            autoFocus
                            className="form-control form-control-sm text-end rounded-3"
                            defaultValue={ratioMostrado}
                            step="0.01"
                            min="0"
                            onBlur={(e) => {
                              setRatioOverride(key, row.racimosCosechados, e.target.value);
                              setEditandoRatio(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.target.blur();
                              if (e.key === "Escape") setEditandoRatio(null);
                            }}
                          />
                        ) : (
                          <span
                            role="button"
                            title="Click para editar el ratio (no se guarda, solo afecta esta vista/export)"
                            onClick={() => setEditandoRatio(key)}
                            style={{ cursor: "pointer", borderBottom: "1px dashed #94a3b8" }}
                          >
                            {ratioMostrado.toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="text-end">{(row.aprovechamiento * 100).toFixed(1)}%</td>
                      <td className="text-end fw-bold">{cajasMostradas.toLocaleString("es", { maximumFractionDigits: 0 })}</td>
                      {data?.meta?.simulacion && (
                        <>
                          <td className="text-end">{row.cajasReales != null ? row.cajasReales.toLocaleString("es", { maximumFractionDigits: 0 }) : "—"}</td>
                          <td className="text-end small" style={{ color: row.cajasReales ? (Math.abs(cajasMostradas / row.cajasReales - 1) > 0.1 ? "#dc2626" : "#16a34a") : undefined }}>
                            {row.cajasReales ? `${((cajasMostradas / row.cajasReales - 1) * 100).toFixed(1)}%` : "—"}
                          </td>
                        </>
                      )}
                      <td>
                        <span
                          className="badge rounded-pill"
                          style={{ backgroundColor: estilo.bg, color: estilo.color, fontWeight: 600 }}
                          title={row.detalle}
                        >
                          {row.confianza}
                        </span>
                      </td>
                    </tr>
                    {abiertas.has(key) && (
                      <tr>
                        <td />
                        <td colSpan={data?.meta?.simulacion ? 11 : 9} className="py-2" style={{ background: "#f8fafc" }}>
                          <table className="table table-sm mb-0" style={{ fontSize: "0.72rem", maxWidth: 560, background: "transparent" }}>
                            <thead>
                              <tr className="text-secondary">
                                <th>Edad</th>
                                <th>Cinta (semana de embolse)</th>
                                <th className="text-end">Racimos</th>
                                <th className="text-end">% de la semana</th>
                                <th>Origen</th>
                              </tr>
                            </thead>
                            <tbody>
                              {EDADES_COSECHA.map((e) => {
                                const a = (row.ageBreakdown || []).find((x) => x.edad === e);
                                const n = ((row.numeroSemana - e) % 52 + 52) % 52 + 1;
                                return (
                                  <tr key={e}>
                                    <td>{e} semanas</td>
                                    <td className="text-secondary">S{n}</td>
                                    <td className="text-end fw-medium">{a ? a.racimos.toLocaleString("es") : "—"}</td>
                                    <td className="text-end text-secondary">{a && row.racimosCosechados > 0 ? `${((a.racimos / row.racimosCosechados) * 100).toFixed(1)}%` : "—"}</td>
                                    <td>
                                      {a?.origen ? (
                                        <span className="d-inline-flex align-items-center gap-1">
                                          <span style={{ width: 8, height: 8, borderRadius: 2, background: ORIGEN_EDAD[a.origen]?.color || "#16a34a", display: "inline-block" }} />
                                          {ORIGEN_EDAD[a.origen]?.texto || a.origen}
                                        </span>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {graficas && data && (
        <GraficasSemanalModal
          filas={data.rows.map((r) => {
            const o = ratioOverrides[rowKey(r)];
            return o ? { ...r, ratio: o.ratio, cajas20kg: o.cajas20kg } : r;
          })}
          seriesAnuales={data.seriesAnuales || {}}
          metrica={graficas}
          onClose={() => setGraficas(null)}
        />
      )}

      <style jsx>{`
        :global(.tabla-pronostico th),
        :global(.tabla-pronostico td) {
          text-align: center !important;
        }
        .spin {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .btn-brand {
          background-color: #16a34a;
          border-color: #16a34a;
          color: #fff;
        }
        .btn-brand:hover {
          background-color: #15803d;
          border-color: #15803d;
          color: #fff;
        }
      `}</style>
    </>
  );
}

// Pestañas: el pronóstico semanal de siempre y la proyección anual con escenarios (hectáreas nuevas, % no cosechado).
export default function PronosticoPage() {
  const puedeProyeccion = hasPermission("proyeccion.ver");
  const [vista, setVista] = useState("pronostico");
  return (
    <RequirePermission code="menu.pronostico">
      <div className="p-4 p-md-5">
        {puedeProyeccion && (
          <ul className="nav nav-pills gap-1 mb-3">
            <li className="nav-item">
              <button type="button" className={`nav-link btn-sm py-1 px-3 ${vista === "pronostico" ? "active" : ""}`} onClick={() => setVista("pronostico")}>
                Proyección semanal
              </button>
            </li>
            <li className="nav-item">
              <button type="button" className={`nav-link btn-sm py-1 px-3 ${vista === "anual" ? "active" : ""}`} onClick={() => setVista("anual")}>
                Proyección anual
              </button>
            </li>
          </ul>
        )}
        {vista === "anual" && puedeProyeccion ? <ProyeccionAnual /> : <PronosticoSemanal />}
      </div>
    </RequirePermission>
  );
}
