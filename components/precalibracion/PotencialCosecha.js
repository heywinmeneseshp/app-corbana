"use client";

import { useState } from "react";
import { FiAlertCircle, FiEdit2, FiRotateCcw } from "react-icons/fi";

// Espacio fijo para el lápiz de edición: las celdas sin lápiz lo dejan
// vacío para que los números queden alineados en la columna.
function HuecoIcono({ children }) {
  return (
    <span className="d-inline-flex justify-content-center flex-shrink-0" style={{ width: 14 }}>
      {children}
    </span>
  );
}

// Potencial de cosecha para la semana actual: compara la escalera de
// Estimación de fincas (racimos estimados, ratio, cajas) con la
// precalibración (racimos que cumplen, ratio teórico, nueva estimación).
// La escalera NO se edita: la nueva estimación (cajas o ratio, en ambos
// sentidos) vive del lado de precalibración.
// Hoy todo es local (mock); en la API real la escalera saldrá de
// GET /estimaciones/resumen-finca y la nueva será un registro nuevo
// (ver lib/precalibracion/api.js).
export default function PotencialCosecha({ potencial }) {
  const [editando, setEditando] = useState(null); // null | "cajas" | "ratio"
  const [borrador, setBorrador] = useState("");
  const [cajasEdit, setCajasEdit] = useState(null);
  const [ratioEdit, setRatioEdit] = useState(null);
  const [ultimo, setUltimo] = useState(null);

  const alcance = `Semana ${potencial.semana?.codigo || "—"}${potencial.fincaNombre ? ` · ${potencial.fincaNombre}` : " · todas las fincas"}`;
  const est = potencial.estimacion;
  const racimos = potencial.precal.racimos;

  const nueva =
    ultimo === "ratio" && ratioEdit != null
      ? Math.round(ratioEdit * racimos)
      : (cajasEdit ?? est.cajas);
  const ratioNuevo = racimos > 0 ? Math.round((nueva / racimos) * 1000) / 1000 : null;
  const editado = nueva !== est.cajas;

  const difRacimos = racimos - est.racimos;
  const difRacimosPct = est.racimos > 0 ? Math.round((difRacimos / est.racimos) * 1000) / 10 : null;
  const difRatio = ratioNuevo != null && est.ratio != null ? Math.round((ratioNuevo - est.ratio) * 1000) / 1000 : null;
  const difCajas = nueva - est.cajas;
  const difCajasPct = est.cajas > 0 ? Math.round((difCajas / est.cajas) * 1000) / 10 : null;

  function iniciarEdicionCajas() {
    setBorrador(String(nueva));
    setEditando("cajas");
  }

  function confirmarEdicionCajas() {
    const valor = Math.floor(Number(borrador));
    if (Number.isFinite(valor) && valor >= 0) {
      setCajasEdit(valor === est.cajas ? null : valor);
      setUltimo("cajas");
    }
    setEditando(null);
  }

  function iniciarEdicionRatio() {
    if (racimos === 0) return;
    setBorrador(ratioNuevo != null ? String(ratioNuevo) : "");
    setEditando("ratio");
  }

  function confirmarEdicionRatio() {
    const valor = Number(borrador);
    if (Number.isFinite(valor) && valor >= 0 && racimos > 0) {
      const cajasNuevo = Math.round(valor * racimos);
      setRatioEdit(valor);
      setCajasEdit(cajasNuevo === est.cajas ? null : cajasNuevo);
      setUltimo("ratio");
    }
    setEditando(null);
  }

  function cancelarEdicion() {
    setEditando(null);
  }

  function restablecer() {
    setCajasEdit(null);
    setRatioEdit(null);
    setUltimo(null);
  }

  function formatoEntero(valor) {
    return Number(valor).toLocaleString("es");
  }

  function formatoRatio(valor) {
    return valor != null
      ? valor.toLocaleString("es", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
      : "—";
  }

  function claseDif(valor) {
    return valor === 0 ? "text-secondary" : valor > 0 ? "text-success" : "text-danger";
  }

  function textoDif(valor, sufijo = "", decimales = null) {
    if (valor === 0) return "Sin cambios";
    const numero =
      decimales == null
        ? valor.toLocaleString("es")
        : valor.toLocaleString("es", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
    return `${valor > 0 ? "+" : ""}${numero}${sufijo}`;
  }

  function inputEdicion(valor, onConfirmar) {
    return (
      <input
        autoFocus
        type="number"
        min={0}
        step={valor === "ratio" ? 0.001 : 1}
        className="form-control form-control-sm rounded-3"
        style={{ width: "7rem" }}
        value={borrador}
        onChange={(e) => setBorrador(e.target.value)}
        onBlur={onConfirmar}
        onKeyDown={(e) => {
          if (e.key === "Enter") onConfirmar();
          if (e.key === "Escape") cancelarEdicion();
        }}
      />
    );
  }

  return (
    <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
      <div className="d-flex align-items-center justify-content-between gap-2">
        <div>
          <h2 className="h5 fw-bold mb-0">Potencial de cosecha</h2>
          <p className="small text-secondary mb-0">{alcance}</p>
        </div>
        {editado && editando !== "cajas" && editando !== "ratio" && (
          <button
            type="button"
            className="btn btn-link btn-sm p-0 text-decoration-none small text-nowrap"
            onClick={restablecer}
          >
            <FiRotateCcw size={12} /> Volver a estimación
          </button>
        )}
      </div>
      <div className="table-responsive mt-2">
        <table className="table table-sm table-borderless mb-0 align-middle tabla-minimalista" style={{ fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr>
              <th className="text-secondary fw-medium small" style={{ minWidth: 130 }}>Fuente</th>
              <th className="text-end text-secondary fw-medium small">Racimos</th>
              <th className="text-end text-secondary fw-medium small">
                <span className="d-inline-flex align-items-center gap-1 justify-content-end">
                  Ratio
                  <HuecoIcono />
                </span>
              </th>
              <th className="text-end text-secondary fw-medium small">
                <span className="d-inline-flex align-items-center gap-1 justify-content-end">
                  Cajas
                  <HuecoIcono />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-secondary">
              <td className="fw-medium" style={{ backgroundColor: "#eef2f6" }}>Estimación finca</td>
              <td className="text-end" style={{ backgroundColor: "#eef2f6" }}>{formatoEntero(est.racimos)}</td>
              <td className="text-end" style={{ backgroundColor: "#eef2f6" }}>
                <span className="d-inline-flex align-items-center gap-1 justify-content-end">
                  {formatoRatio(est.ratio)}
                  <HuecoIcono />
                </span>
              </td>
              <td className="text-end" style={{ backgroundColor: "#eef2f6" }}>
                <span className="d-inline-flex align-items-center gap-1 justify-content-end">
                  {formatoEntero(est.cajas)}
                  <HuecoIcono />
                </span>
              </td>
            </tr>
            <tr>
              <td className="fw-medium">Precalibración</td>
              <td className="text-end fw-bold text-success">{formatoEntero(racimos)}</td>
              <td className="text-end">
                <span className="d-inline-flex align-items-center gap-1 justify-content-end">
                  {editando === "ratio" ? (
                    inputEdicion("ratio", confirmarEdicionRatio)
                  ) : (
                    <>
                      <strong>{formatoRatio(ratioNuevo)}</strong>
                      <HuecoIcono>
                        <button
                          type="button"
                          className="btn btn-sm p-0 border-0 text-secondary"
                          title={racimos === 0 ? "Sin racimos precalibrados" : "Ajustar ratio (recalcula las cajas)"}
                          disabled={racimos === 0}
                          onClick={iniciarEdicionRatio}
                        >
                          <FiEdit2 size={12} />
                        </button>
                      </HuecoIcono>
                    </>
                  )}
                </span>
              </td>
              <td className="text-end">
                <span className="d-inline-flex align-items-center gap-1 justify-content-end">
                  {editando === "cajas" ? (
                    inputEdicion("cajas", confirmarEdicionCajas)
                  ) : (
                    <>
                      <strong>{formatoEntero(nueva)}</strong>
                      <HuecoIcono>
                        <button
                          type="button"
                          className="btn btn-sm p-0 border-0 text-secondary"
                          title="Crear nueva estimación basada en precalibración"
                          onClick={iniciarEdicionCajas}
                        >
                          <FiEdit2 size={12} />
                        </button>
                      </HuecoIcono>
                    </>
                  )}
                </span>
              </td>
            </tr>
            <tr className="fw-bold" style={{ borderTop: "2px solid #e2e8f0" }}>
              <td>Diferencia</td>
              <td className={`text-end ${claseDif(difRacimos)}`}>
                {textoDif(difRacimos)}
                {difRacimosPct != null && difRacimos !== 0 && (
                  <span className="small"> ({difRacimos > 0 ? "+" : ""}{difRacimosPct.toLocaleString("es")}%)</span>
                )}
              </td>
              <td className={`text-end ${difRatio == null ? "text-secondary" : claseDif(difRatio)}`}>
                <span className="d-inline-flex align-items-center gap-1 justify-content-end">
                  {difRatio == null ? "—" : textoDif(difRatio, "", 3)}
                  <HuecoIcono />
                </span>
              </td>
              <td className={`text-end ${claseDif(difCajas)}`}>
                <span className="d-inline-flex align-items-center gap-1 justify-content-end">
                  {textoDif(difCajas)}
                  {difCajasPct != null && difCajas !== 0 && (
                    <span className="small"> ({difCajas > 0 ? "+" : ""}{difCajasPct.toLocaleString("es")}%)</span>
                  )}
                  <HuecoIcono />
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="small text-secondary mt-2 mb-0">
        Estimación finca (escalera, no se modifica) vs precalibración de la misma semana. La nueva estimación
        ajustada se guardará como un registro nuevo.
      </p>

      <style jsx>{`
        .tabla-minimalista thead th {
          border-bottom: 1px solid #e2e8f0;
        }
        .tabla-minimalista tbody tr + tr td {
          border-top: 1px solid #f1f5f9;
        }
      `}</style>

      <div className="alert alert-warning py-2 small mt-2 mb-0 d-flex align-items-center gap-2">
        <FiAlertCircle size={16} className="flex-shrink-0" />
        <span>Datos simulados con fines de validación visual.</span>
      </div>
    </div>
  );
}
