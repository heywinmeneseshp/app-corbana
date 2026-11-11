"use client";

import { useCallback, useEffect, useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { apiFetch } from "@/lib/api";

const num = (n) => Number(n).toLocaleString("es-CO");
const fechaHora = (iso) => (iso ? new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "");

// Re-estimaciones: volver a cargar la estimación de una finca en la misma semana queda pendiente hasta que la aprueba un usuario con permiso.
export default function CambiosPendientes({ alCambiar }) {
  const [estado, setEstado] = useState("PENDIENTE");
  const [datos, setDatos] = useState({ items: [], puedeAprobar: false });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [rechazando, setRechazando] = useState(null);
  const [motivo, setMotivo] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      setDatos(await apiFetch(`/estimaciones/cambios?estado=${estado}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [estado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function resolver(c, aprobar) {
    setOcupado(c.uuid);
    setError("");
    try {
      await apiFetch(`/estimaciones/cambios/${c.uuid}/${aprobar ? "aprobar" : "rechazar"}`, { method: "POST", body: JSON.stringify(aprobar ? {} : { motivo }) });
      setRechazando(null);
      setMotivo("");
      await cargar();
      alCambiar?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado("");
    }
  }

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-2">
        <div className="btn-group btn-group-sm">
          {[
            ["PENDIENTE", "Pendientes"],
            ["APROBADA", "Aprobadas"],
            ["RECHAZADA", "Rechazadas"],
          ].map(([k, l]) => (
            <button key={k} type="button" className={`btn ${estado === k ? "btn-brand" : "btn-outline-secondary"}`} onClick={() => setEstado(k)}>
              {l}
            </button>
          ))}
        </div>
        <span className="small text-secondary">
          {datos.puedeAprobar ? "Aprueba o rechaza las re-estimaciones." : "Estas son tus re-estimaciones; las aprueba un usuario con permiso."} Mientras esperan, sigue vigente la estimación anterior.
        </span>
      </div>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-sm table-hover mb-0 align-middle" style={{ fontSize: "0.8rem" }}>
            <thead className="table-light">
              <tr>
                <th>Finca</th>
                <th>Semana</th>
                <th className="text-end">Anterior (cajas)</th>
                <th className="text-end">Nueva (cajas)</th>
                <th>Solicitó</th>
                <th>{estado === "PENDIENTE" ? "Fecha" : "Resolvió"}</th>
                {estado === "PENDIENTE" && datos.puedeAprobar && <th />}
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={7} className="text-center text-secondary py-4">
                    Cargando...
                  </td>
                </tr>
              ) : datos.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-secondary py-4">
                    No hay re-estimaciones {estado === "PENDIENTE" ? "pendientes" : estado === "APROBADA" ? "aprobadas" : "rechazadas"}.
                  </td>
                </tr>
              ) : (
                datos.items.map((c) => (
                  <tr key={c.uuid}>
                    <td className="fw-medium">{c.finca?.nombre}</td>
                    <td>{c.semana?.codigo}</td>
                    <td className="text-end text-secondary">{num(c.cajasAnterior)}</td>
                    <td className="text-end fw-semibold">
                      {num(c.cajasNueva)}
                      {c.cajasNueva !== c.cajasAnterior && (
                        <span className="ms-1" style={{ fontSize: "0.7rem", color: c.cajasNueva > c.cajasAnterior ? "#166534" : "#b91c1c" }}>
                          ({c.cajasNueva > c.cajasAnterior ? "+" : ""}
                          {num(Math.round((c.cajasNueva - c.cajasAnterior) * 100) / 100)})
                        </span>
                      )}
                    </td>
                    <td>{c.solicitadoPor?.nombre || "—"}</td>
                    <td className="text-secondary">
                      {estado === "PENDIENTE" ? fechaHora(c.createdAt) : `${c.resueltoPor?.nombre || "—"} · ${fechaHora(c.resueltoAt)}`}
                      {c.motivoRechazo && <div style={{ color: "#b91c1c" }}>Motivo: {c.motivoRechazo}</div>}
                      {c.observaciones && <div className="fst-italic">{c.observaciones}</div>}
                    </td>
                    {estado === "PENDIENTE" && datos.puedeAprobar && (
                      <td className="text-end text-nowrap">
                        {rechazando === c.uuid ? (
                          <div className="d-flex gap-1 align-items-center">
                            <input className="form-control form-control-sm" style={{ minWidth: 160 }} placeholder="Motivo del rechazo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                            <button type="button" className="btn btn-danger btn-sm" disabled={ocupado === c.uuid || !motivo.trim()} onClick={() => resolver(c, false)}>
                              Rechazar
                            </button>
                            <button type="button" className="btn btn-link btn-sm text-secondary p-1 border-0" onClick={() => (setRechazando(null), setMotivo(""))}>
                              <FiX />
                            </button>
                          </div>
                        ) : (
                          <>
                            <button type="button" className="btn btn-brand btn-sm d-inline-flex align-items-center gap-1 me-1" disabled={ocupado === c.uuid} onClick={() => resolver(c, true)}>
                              <FiCheck /> Aprobar
                            </button>
                            <button type="button" className="btn btn-outline-danger btn-sm" disabled={ocupado === c.uuid} onClick={() => (setRechazando(c.uuid), setMotivo(""))}>
                              Rechazar
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
