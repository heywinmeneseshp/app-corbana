"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiActivity, FiDownload, FiRefreshCw, FiChevronDown, FiChevronUp, FiAlertTriangle } from "react-icons/fi";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";

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

function DistribucionEdad({ ageBreakdown }) {
  const max = Math.max(1, ...ageBreakdown.map((a) => a.racimos));
  return (
    <div className="d-flex align-items-end gap-1" style={{ height: 28 }} title={
      ageBreakdown.map((a) => `Edad ${a.edad}: ${a.racimos.toLocaleString("es")} racimos`).join(" · ")
    }>
      {ageBreakdown.map((a) => (
        <div
          key={a.edad}
          style={{
            width: 6,
            height: Math.max(2, Math.round((a.racimos / max) * 24)),
            backgroundColor: "#16a34a",
            opacity: 0.85,
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
}

export default function PronosticoPage() {
  const [fincas, setFincas] = useState([]);
  const [fincaUuidsSeleccionadas, setFincaUuidsSeleccionadas] = useState([]);
  const [todasFincas, setTodasFincas] = useState(true);

  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual);
  const [semanasDelAnio, setSemanasDelAnio] = useState([]);
  const [semanaInicioUuid, setSemanaInicioUuid] = useState("");
  const [semanasProyectar, setSemanasProyectar] = useState(8);

  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  const [pctNoCosechadoInput, setPctNoCosechadoInput] = useState("");
  const [pctNoCosechadoAplicado, setPctNoCosechadoAplicado] = useState(null);

  const [ratioOverrides, setRatioOverrides] = useState({});
  const [editandoRatio, setEditandoRatio] = useState(null);

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
    if (semanaInicioUuid) params.set("semanaInicioUuid", semanaInicioUuid);
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
    <RequirePermission code="pronostico.ver">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
              <FiActivity /> Pronóstico de Cajas
            </h1>
            <p className="text-secondary mb-0">Proyección de cajas 20kg por finca a partir del historial de embolses y cortes.</p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary rounded-3 d-flex align-items-center gap-2"
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

          <div className="mt-3">
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

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead>
                <tr>
                  <th>Semana</th>
                  {mostrarColumnaFinca && <th>Finca</th>}
                  <th className="text-end">Racimos cosechados</th>
                  <th>Distribución por edad</th>
                  <th className="text-end">Ratio</th>
                  <th className="text-end">Aprovechamiento</th>
                  <th className="text-end">Cajas 20k</th>
                  <th>Confianza</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="text-center text-secondary py-4">Cargando...</td></tr>
                )}
                {!loading && (!data || data.rows.length === 0) && (
                  <tr><td colSpan={8} className="text-center text-secondary py-4">No hay datos para los filtros seleccionados.</td></tr>
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
                        <td colSpan={8} className="bg-light fw-bold small py-2" style={{ borderTop: "2px solid #cbd5e1" }}>
                          {row.fincaCodigo} — {row.fincaNombre}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td>{row.semanaCodigo}</td>
                      {mostrarColumnaFinca && <td>{row.fincaNombre}</td>}
                      <td className="text-end">{row.racimosCosechados.toLocaleString("es")}</td>
                      <td><DistribucionEdad ageBreakdown={row.ageBreakdown} /></td>
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
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style jsx>{`
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
    </RequirePermission>
  );
}
