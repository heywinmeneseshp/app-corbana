"use client";

import { useEffect, useState } from "react";
import { FiMap, FiAlertTriangle } from "react-icons/fi";
import { apiFetch } from "@/lib/api";

// Modal bloqueante: si el usuario tiene un rol programado para confirmar el
// área de los lotes de alguna finca (ver Maestros > Área de Lotes) y todavía
// no lo hizo desde la fecha objetivo, no puede usar el resto del sistema
// hasta registrar el área total y en producción de cada lote pendiente — sin
// botón de cerrar, sin click-fuera-para-cerrar. Mismo patrón que
// PrecipitacionDiariaModal.
export default function AreaLoteModal() {
  const [pendientes, setPendientes] = useState(null); // null = todavía no se sabe
  const [valores, setValores] = useState({}); // `${loteUuid}|total|produccion` -> string
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  if (!pendientes || pendientes.length === 0) return null;

  const totalCampos = pendientes.reduce((acc, f) => acc + f.lotes.length * 2, 0);
  const completos = Object.values(valores).filter((v) => v !== undefined && v !== "" && !isNaN(Number(v))).length;
  const listo = completos === totalCampos;

  const setValor = (loteUuid, campo, valor) => {
    setValores((prev) => ({ ...prev, [`${loteUuid}|${campo}`]: valor }));
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
      await apiFetch("/lote-area-config/registrar", { method: "POST", body: JSON.stringify({ registros }) });
      setValores({});
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
        <div className="d-flex align-items-center gap-2 mb-2">
          <FiMap className="text-primary" size={22} />
          <h2 className="h5 fw-bold mb-0">Área de lotes pendiente de confirmar</h2>
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
                  <div key={l.uuid} className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="text-secondary small" style={{ width: 110 }}>
                      Lote {l.nombre}
                    </span>
                    <div className="input-group input-group-sm" style={{ maxWidth: 160 }}>
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
                    <div className="input-group input-group-sm" style={{ maxWidth: 180 }}>
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
                ))}
              </div>
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
