"use client";

import { useEffect, useState } from "react";
import { FiMap, FiAlertTriangle, FiX, FiTrash2, FiPlus } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { getSesionSeq, hasPermission } from "@/lib/auth";
import { esAdministrador } from "@/lib/laborEstados";

// Modal bloqueante: si el usuario tiene un rol programado para confirmar el
// área de los lotes de alguna finca (ver Maestros > Área de Lotes) y todavía
// no lo hizo desde la fecha objetivo, no puede usar el resto del sistema
// hasta registrar el área total y en producción de cada lote pendiente.
// Solo el rol Administrador ve el botón de cerrar. Los iconos de agregar y
// ocultar lote se muestran con el permiso configurable
// `area_lote.gestionar_lotes` (asignable en Maestros > Roles): ocultar solo
// quita el lote de esta confirmación, no lo borra (sigue en Maestros,
// estadísticas e informes). Mismo patrón que PrecipitacionDiariaModal.
export default function AreaLoteModal() {
  const [pendientes, setPendientes] = useState(null); // null = todavía no se sabe
  const [valores, setValores] = useState({}); // `${loteUuid}|total|produccion` -> string
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [cerradoSeq, setCerradoSeq] = useState(null); // secuencia de sesión en que se cerró
  const [nuevoLote, setNuevoLote] = useState({}); // fincaUuid -> nombre en borrador
  const [agregando, setAgregando] = useState({}); // fincaUuid -> bool (formulario visible)
  const esAdmin = esAdministrador();
  const puedeGestionar = hasPermission("area_lote.gestionar_lotes");
  // El cierre dura solo la sesión actual: al cerrar se guarda la secuencia
  // de login vigente; con un login nuevo la secuencia cambia y el modal
  // vuelve a mostrarse (ver marcarNuevaSesion en lib/auth.js).
  const seqActual = getSesionSeq();
  const cerrado = cerradoSeq !== null && (seqActual === null || cerradoSeq === seqActual);

  const cargar = () => {
    apiFetch("/lote-area-config/pendientes")
      .then((data) => {
        setPendientes(data);
        // Precarga el área total con el valor actual del lote (rara vez
        // cambia, alcanza con confirmarla) — sin esto, un campo que el
        // usuario nunca toca queda "sin completar" aunque se vea prellenado.
        setValores((prev) => {
          const next = { ...prev };
          for (const f of data) {
            for (const l of f.lotes) {
              const key = `${l.uuid}|total`;
              if (next[key] === undefined && l.areaActual != null) next[key] = String(l.areaActual);
            }
          }
          return next;
        });
      })
      .catch(() => setPendientes([])); // si falla el chequeo, no bloqueamos al usuario por eso
  };

  useEffect(cargar, []);

  if (cerrado || !pendientes || pendientes.length === 0) return null;

  const totalCampos = pendientes.reduce((acc, f) => acc + f.lotes.length * 2, 0);
  const completos = Object.values(valores).filter((v) => v !== undefined && v !== "" && !isNaN(Number(v))).length;
  const listo = completos === totalCampos;

  const setValor = (loteUuid, campo, valor) => {
    setValores((prev) => ({ ...prev, [`${loteUuid}|${campo}`]: valor }));
  };

  // Oculta el lote de este pendiente (no lo borra: sigue en Maestros,
  // estadísticas e informes, y reaparece en una campaña nueva). Requiere
  // area_lote.gestionar_lotes.
  const handleEliminarLote = async (loteUuid, nombreLote) => {
    if (!confirm(`¿Ocultar el lote ${nombreLote} de esta confirmación? Solo hazlo si no pertenece a esta finca. El lote seguirá existiendo.`)) return;
    setError("");
    try {
      await apiFetch(`/lote-area-config/pendientes/${loteUuid}`, { method: "DELETE" });
      setPendientes((prev) =>
        (prev || [])
          .map((f) => ({ ...f, lotes: f.lotes.filter((l) => l.uuid !== loteUuid) }))
          .filter((f) => f.lotes.length > 0),
      );
      setValores((prev) => {
        const next = { ...prev };
        delete next[`${loteUuid}|total`];
        delete next[`${loteUuid}|produccion`];
        return next;
      });
    } catch (err) {
      setError(err.message);
    }
  };

  // Crea el lote en la finca y lo suma a la lista para confirmarle el área
  // ahí mismo. Requiere area_lote.gestionar_lotes.
  const handleAgregarLote = async (fincaUuid) => {
    const nombre = (nuevoLote[fincaUuid] || "").trim();
    if (!nombre) return;
    setError("");
    try {
      const lote = await apiFetch("/lote-area-config/pendientes/lotes", {
        method: "POST",
        body: JSON.stringify({ fincaUuid, nombre }),
      });
      setPendientes((prev) =>
        (prev || []).map((f) => (f.fincaUuid === fincaUuid ? { ...f, lotes: [...f.lotes, lote] } : f)),
      );
      setNuevoLote((prev) => ({ ...prev, [fincaUuid]: "" }));
      setAgregando((prev) => ({ ...prev, [fincaUuid]: false }));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!listo) return;
    setError("");
    setSaving(true);
    try {
      const registros = pendientes.flatMap((f) =>
        f.lotes.map((l) => ({
          loteUuid: l.uuid,
          areaTotal: Number(valores[`${l.uuid}|total`]),
          areaProduccion: Number(valores[`${l.uuid}|produccion`]),
        })),
      );
      const resultado = await apiFetch("/lote-area-config/registrar", { method: "POST", body: JSON.stringify({ registros }) });
      setValores({});
      // Sin permiso de aprobar, los cambios quedan pendientes de aprobación
      // (Maestros > Área de Lotes) y no se aplican al lote todavía.
      if (Array.isArray(resultado) && resultado.some((r) => r.pendienteAprobacion)) {
        alert("Cambios enviados. Quedan pendientes de aprobación y se aplicarán cuando un administrador los apruebe.");
      }
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
      style={{ backgroundColor: "rgba(0,0,0,0.55)", zIndex: 2000 }}
    >
      <div className="bg-white rounded-4 shadow-lg p-4 p-md-5" style={{ maxWidth: 640, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
          <div className="d-flex align-items-center gap-2">
            <FiMap className="text-primary" size={22} />
            <h2 className="h5 fw-bold mb-0">Área de lotes pendiente de confirmar</h2>
          </div>
          {esAdmin && (
            <button
              type="button"
              className="btn btn-sm p-1 border-0 text-secondary"
              title="Cerrar (solo Administrador, vuelve a mostrarse en el próximo inicio de sesión)"
              onClick={() => setCerradoSeq(seqActual ?? "sin-secuencia")}
            >
              <FiX size={18} />
            </button>
          )}
        </div>
        <p className="text-secondary small mb-4">
          Confirma el área total y el área en producción de cada lote para poder continuar.
        </p>

        <form onSubmit={handleSubmit}>
          {pendientes.map((f) => (
            <div key={f.fincaUuid} className="mb-4">
              <h3 className="h6 fw-semibold mb-2">
                {f.fincaNombre} <span className="text-secondary fw-normal small">(desde {f.fechaObjetivo})</span>
              </h3>
              <div className="d-flex flex-column gap-2">
                {f.lotes.map((l) => (
                  <div key={l.uuid} className="row g-2 align-items-center">
                    <div className="col-12 col-md-3">
                      <span className="d-flex align-items-center gap-2">
                        <span className="text-secondary small fw-medium d-block">Lote {l.nombre}</span>
                        {puedeGestionar && (
                          <button
                            type="button"
                            className="btn btn-sm p-0 border-0 text-danger"
                            title="Ocultar lote de esta confirmación (no lo borra)"
                            onClick={() => handleEliminarLote(l.uuid, l.nombre)}
                          >
                            <FiTrash2 size={14} />
                          </button>
                        )}
                      </span>
                    </div>
                    <div className="col-12 col-md-4">
                      <div className="input-group input-group-sm">
                        <span className="input-group-text">Total</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          className="form-control"
                          placeholder="0.00"
                          value={valores[`${l.uuid}|total`] ?? ""}
                          onChange={(e) => setValor(l.uuid, "total", e.target.value)}
                        />
                        <span className="input-group-text">Ha</span>
                      </div>
                    </div>
                    <div className="col-12 col-md-5">
                      <div className="input-group input-group-sm">
                        <span className="input-group-text">En producción</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          className="form-control"
                          placeholder="0.00"
                          value={valores[`${l.uuid}|produccion`] ?? ""}
                          onChange={(e) => setValor(l.uuid, "produccion", e.target.value)}
                        />
                        <span className="input-group-text">Ha</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {puedeGestionar && (
                <div className="mt-2">
                  {agregando[f.fincaUuid] ? (
                    <div className="d-flex gap-2 align-items-center">
                      <div className="input-group input-group-sm" style={{ maxWidth: 220 }}>
                        <span className="input-group-text">Lote</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="form-control"
                          placeholder="N.º (ej: 09)"
                          value={nuevoLote[f.fincaUuid] || ""}
                          onChange={(e) => setNuevoLote((prev) => ({ ...prev, [f.fincaUuid]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAgregarLote(f.fincaUuid);
                            }
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-brand rounded-3"
                        onClick={() => handleAgregarLote(f.fincaUuid)}
                      >
                        Agregar
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-secondary text-decoration-none"
                        onClick={() => setAgregando((prev) => ({ ...prev, [f.fincaUuid]: false }))}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm btn-link text-decoration-none p-0 small d-flex align-items-center gap-1"
                      onClick={() => setAgregando((prev) => ({ ...prev, [f.fincaUuid]: true }))}
                    >
                      <FiPlus size={14} /> Agregar lote
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {error && (
            <div className="alert alert-danger py-2 small d-flex align-items-center gap-2">
              <FiAlertTriangle /> {error}
            </div>
          )}

          <button type="submit" className="btn btn-brand w-100 rounded-3 py-2" disabled={!listo || saving}>
            {saving ? "Guardando..." : "Guardar y continuar"}
          </button>
        </form>
      </div>
    </div>
  );
}
