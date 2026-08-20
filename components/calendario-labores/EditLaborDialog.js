"use client";

import { useState } from "react";
import { FiTrash2 } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import ModalShell from "@/components/ModalShell";
import { esAdministrador, estaBloqueada } from "@/lib/laborEstados";

// Diálogo de edición/eliminación de una ocurrencia, con el mismo
// comportamiento de Google Calendar: alcance ESTA / ESTA_Y_SIGUIENTES /
// TODA_LA_SERIE cuando la programación es recurrente.
export default function EditLaborDialog({ ocurrencia, onClose, onChanged }) {
  const [fecha, setFecha] = useState(ocurrencia.fecha);
  const [hora, setHora] = useState(ocurrencia.hora ? ocurrencia.hora.slice(0, 5) : "");
  const [duracionMinutos, setDuracionMinutos] = useState(ocurrencia.duracionMinutos ?? "");
  const [numeroColaboradores, setNumeroColaboradores] = useState(ocurrencia.numeroColaboradores ?? "");
  const [observaciones, setObservaciones] = useState(ocurrencia.observaciones || "");
  const [estado, setEstado] = useState(ocurrencia.estado);
  const [alcance, setAlcance] = useState("ESTA");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const editable = esAdministrador() || !estaBloqueada(ocurrencia);
  const puedeEditar = hasPermission("labor_programacion.editar") && editable;
  const puedeEliminar = hasPermission("labor_programacion.eliminar") && editable;
  const esRecurrente = Boolean(ocurrencia.serie?.esRecurrente);
  const permiteEstaYSiguientes = ocurrencia.serie?.modoLotes === "UNICO";

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const body = {
        alcance,
        hora: hora || null,
        duracionMinutos: duracionMinutos === "" ? null : Number(duracionMinutos),
        numeroColaboradores: numeroColaboradores === "" ? null : Number(numeroColaboradores),
        observaciones: observaciones || null,
      };
      if (alcance !== "TODA_LA_SERIE") body.fecha = fecha;
      if (alcance === "ESTA") body.estado = estado;

      await apiFetch(`/labor-ocurrencias/${ocurrencia.uuid}`, { method: "PUT", body: JSON.stringify(body) });
      onChanged();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const avisos = {
      ESTA: "¿Eliminar esta ocurrencia? Solo se elimina este registro, no el resto de la programación.",
      ESTA_Y_SIGUIENTES: "¿Eliminar esta ocurrencia y todas las siguientes de esta programación? Las anteriores no se tocan.",
      TODA_LA_SERIE: "¿Eliminar toda la programación? Se eliminan todas sus ocurrencias pendientes (las ya completadas quedan como histórico).",
    };
    if (!confirm(avisos[alcance])) return;
    setSaving(true);
    try {
      await apiFetch(`/labor-ocurrencias/${ocurrencia.uuid}?alcance=${alcance}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={`${ocurrencia.labor?.nombre || "Labor"} — ${ocurrencia.lote?.nombre || ""}`} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {!editable && (
          <div className="alert alert-warning py-2 small">
            Esta labor está completada o su fecha ya pasó. Solo un usuario con rol de Administrador puede editarla.
          </div>
        )}
        {esRecurrente && (puedeEditar || puedeEliminar) && (
          <div className="border rounded-3 p-3 mb-3 bg-light">
            <label className="form-label small fw-medium d-block mb-2">Esta acción aplica a</label>
            <div className="d-flex flex-column gap-2">
              <div className="form-check">
                <input
                  type="radio"
                  className="form-check-input"
                  id="alcance-esta"
                  checked={alcance === "ESTA"}
                  onChange={() => setAlcance("ESTA")}
                />
                <label className="form-check-label small" htmlFor="alcance-esta">
                  Solo este evento
                </label>
              </div>
              <div className="form-check">
                <input
                  type="radio"
                  className="form-check-input"
                  id="alcance-siguientes"
                  disabled={!permiteEstaYSiguientes}
                  checked={alcance === "ESTA_Y_SIGUIENTES"}
                  onChange={() => setAlcance("ESTA_Y_SIGUIENTES")}
                />
                <label className="form-check-label small" htmlFor="alcance-siguientes">
                  Este evento y los siguientes
                  {!permiteEstaYSiguientes && <span className="text-secondary"> (no disponible: la serie tiene varios lotes)</span>}
                </label>
              </div>
              <div className="form-check">
                <input
                  type="radio"
                  className="form-check-input"
                  id="alcance-toda"
                  checked={alcance === "TODA_LA_SERIE"}
                  onChange={() => setAlcance("TODA_LA_SERIE")}
                />
                <label className="form-check-label small" htmlFor="alcance-toda">
                  Toda la serie
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="row g-3 mb-3">
          <div className="col-6">
            <label className="form-label small fw-medium">Fecha</label>
            <input
              type="date"
              className="form-control rounded-3"
              value={fecha}
              disabled={!puedeEditar || alcance === "TODA_LA_SERIE"}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div className="col-3">
            <label className="form-label small fw-medium">Hora</label>
            <input
              type="time"
              className="form-control rounded-3"
              value={hora}
              disabled={!puedeEditar}
              onChange={(e) => setHora(e.target.value)}
            />
          </div>
          <div className="col-3">
            <label className="form-label small fw-medium">Duración (min)</label>
            <input
              type="number"
              min={1}
              className="form-control rounded-3"
              value={duracionMinutos}
              disabled={!puedeEditar}
              onChange={(e) => setDuracionMinutos(e.target.value)}
            />
          </div>
        </div>

        {alcance === "ESTA" && (
          <div className="mb-3">
            <label className="form-label small fw-medium">Estado</label>
            <select className="form-select rounded-3" value={estado} disabled={!puedeEditar} onChange={(e) => setEstado(e.target.value)}>
              <option value="PROGRAMADA">Programada</option>
              <option value="COMPLETADA">Completada</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </div>
        )}

        <div className="mb-3">
          <label className="form-label small fw-medium">Número de colaboradores</label>
          <input
            type="number"
            min={1}
            className="form-control rounded-3"
            value={numeroColaboradores}
            disabled={!puedeEditar}
            onChange={(e) => setNumeroColaboradores(e.target.value)}
          />
        </div>

        <div className="mb-3">
          <label className="form-label small fw-medium">Observaciones</label>
          <textarea
            className="form-control rounded-3"
            rows={2}
            maxLength={500}
            value={observaciones}
            disabled={!puedeEditar}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </div>

        {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

        <div className="d-flex justify-content-between gap-2">
          {puedeEliminar ? (
            <button
              type="button"
              className="btn btn-outline-danger rounded-3 d-flex align-items-center gap-2"
              onClick={handleDelete}
              disabled={saving}
            >
              <FiTrash2 /> Eliminar
            </button>
          ) : (
            <span />
          )}
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary rounded-3" onClick={onClose}>
              Cerrar
            </button>
            {puedeEditar && (
              <button type="submit" className="btn btn-brand rounded-3" disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            )}
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
