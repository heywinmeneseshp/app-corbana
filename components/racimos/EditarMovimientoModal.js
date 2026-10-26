"use client";

import { useEffect, useState } from "react";
import { apiFetch, apiFetchTodos } from "@/lib/api";
import ModalShell from "@/components/ModalShell";
import SemanaAutocomplete from "@/components/SemanaAutocomplete";

const TIPOS = [
  { value: "EMBOLSE", label: "Embolse" },
  { value: "REPIQUE", label: "Repique" },
  { value: "RECUSE", label: "Recuse" },
  { value: "PROCESADO", label: "Procesado" },
];

// Edición de una línea de movimiento de racimos (solo Administrador). La finca se conserva; se puede cambiar lote, semanas, tipo, motivo,
// cantidad, fecha y observación. Si el cambio deja una cohorte con saldo negativo, el backend lo rechaza y aquí se pide confirmar.
export default function EditarMovimientoModal({ movimiento, onClose, onSaved }) {
  const [lotes, setLotes] = useState([]);
  const [semanas, setSemanas] = useState([]);
  const [motivosRepique, setMotivosRepique] = useState([]);
  const [motivosRecuse, setMotivosRecuse] = useState([]);
  const [form, setForm] = useState({
    fecha: movimiento.fecha || "",
    semanaRegistroUuid: movimiento.semanaRegistro?.uuid || "",
    semanaEmbolseUuid: movimiento.semanaEmbolse?.uuid || "",
    loteUuid: movimiento.lote?.uuid || "",
    tipo: movimiento.tipo,
    motivoRepiqueUuid: movimiento.motivoRepique?.uuid || "",
    motivoRecuseUuid: movimiento.motivoRecuse?.uuid || "",
    cantidad: String(movimiento.cantidad ?? ""),
    observacion: movimiento.observacion || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pideConfirmar, setPideConfirmar] = useState(false);

  useEffect(() => {
    const fincaUuid = movimiento.finca?.uuid;
    Promise.all([
      fincaUuid ? apiFetch(`/lotes?fincaUuid=${fincaUuid}&limit=100`) : Promise.resolve({ items: [] }),
      apiFetchTodos("/semanas?limit=100"),
      apiFetch("/motivos-repique?limit=100").catch(() => ({ items: [] })),
      apiFetch("/motivos-recuse?limit=100").catch(() => ({ items: [] })),
    ])
      .then(([l, s, mrp, mrc]) => {
        setLotes(l.items || []);
        setSemanas(s.items || []);
        setMotivosRepique(mrp.items || []);
        setMotivosRecuse(mrc.items || []);
      })
      .catch((err) => setError(err.message));
  }, [movimiento]);

  const cambiar = (patch) => {
    setPideConfirmar(false);
    setForm((f) => ({ ...f, ...patch }));
  };

  async function guardar(e, forzar = false) {
    e?.preventDefault();
    setError("");
    const cantidad = Number(form.cantidad);
    if (!Number.isInteger(cantidad) || cantidad === 0) {
      setError("La cantidad debe ser un número entero distinto de cero.");
      return;
    }
    if (form.tipo === "REPIQUE" && !form.motivoRepiqueUuid) {
      setError("El repique requiere un motivo.");
      return;
    }
    if (form.tipo === "RECUSE" && !form.motivoRecuseUuid) {
      setError("El recuse requiere un motivo.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        fecha: form.fecha,
        semanaRegistroUuid: form.semanaRegistroUuid || undefined,
        semanaEmbolseUuid: form.semanaEmbolseUuid || undefined,
        loteUuid: form.loteUuid || undefined,
        tipo: form.tipo,
        motivoRepiqueUuid: form.tipo === "REPIQUE" ? form.motivoRepiqueUuid : null,
        motivoRecuseUuid: form.tipo === "RECUSE" ? form.motivoRecuseUuid : null,
        cantidad,
        observacion: form.observacion,
        forzarSaldoNegativo: forzar,
      };
      await apiFetch(`/racimo-movimientos/${movimiento.uuid}`, { method: "PUT", body: JSON.stringify(body) });
      onSaved();
    } catch (err) {
      if (/saldo negativo/i.test(err.message)) setPideConfirmar(true);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title={`Editar movimiento — ${movimiento.finca?.nombre || ""}`} onClose={onClose}>
      <form onSubmit={(e) => guardar(e, false)}>
        <div className="row g-2">
          <div className="col-6">
            <label className="form-label small fw-medium mb-1">Fecha</label>
            <input type="date" className="form-control form-control-sm rounded-3" value={form.fecha} onChange={(e) => cambiar({ fecha: e.target.value })} required />
          </div>
          <div className="col-6">
            <label className="form-label small fw-medium mb-1">Tipo</label>
            <select className="form-select form-select-sm rounded-3" value={form.tipo} onChange={(e) => cambiar({ tipo: e.target.value })}>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6">
            <label className="form-label small fw-medium mb-1">Semana de registro</label>
            <SemanaAutocomplete semanas={semanas} value={form.semanaRegistroUuid} onChange={(v) => cambiar({ semanaRegistroUuid: v })} placeholder="Semana" width="100%" limit={30} />
          </div>
          <div className="col-6">
            <label className="form-label small fw-medium mb-1">Semana de embolse (cinta)</label>
            <SemanaAutocomplete semanas={semanas} value={form.semanaEmbolseUuid} onChange={(v) => cambiar({ semanaEmbolseUuid: v })} placeholder="Semana" width="100%" limit={30} />
          </div>
          <div className="col-6">
            <label className="form-label small fw-medium mb-1">Lote</label>
            <select className="form-select form-select-sm rounded-3" value={form.loteUuid} onChange={(e) => cambiar({ loteUuid: e.target.value })}>
              {lotes.length === 0 && movimiento.lote && <option value={movimiento.lote.uuid}>{movimiento.lote.nombre}</option>}
              {lotes.map((l) => (
                <option key={l.uuid} value={l.uuid}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6">
            <label className="form-label small fw-medium mb-1">Cantidad</label>
            <input
              type="number"
              step="1"
              className="form-control form-control-sm rounded-3 text-end"
              value={form.cantidad}
              onChange={(e) => cambiar({ cantidad: e.target.value })}
              required
            />
          </div>
          {form.tipo === "REPIQUE" && (
            <div className="col-12">
              <label className="form-label small fw-medium mb-1">Motivo de repique</label>
              <select className="form-select form-select-sm rounded-3" value={form.motivoRepiqueUuid} onChange={(e) => cambiar({ motivoRepiqueUuid: e.target.value })}>
                <option value="">Selecciona...</option>
                {motivosRepique.map((m) => (
                  <option key={m.uuid} value={m.uuid}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          {form.tipo === "RECUSE" && (
            <div className="col-12">
              <label className="form-label small fw-medium mb-1">Motivo de recuse</label>
              <select className="form-select form-select-sm rounded-3" value={form.motivoRecuseUuid} onChange={(e) => cambiar({ motivoRecuseUuid: e.target.value })}>
                <option value="">Selecciona...</option>
                {motivosRecuse.map((m) => (
                  <option key={m.uuid} value={m.uuid}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="col-12">
            <label className="form-label small fw-medium mb-1">Observación</label>
            <input type="text" maxLength={255} className="form-control form-control-sm rounded-3" value={form.observacion} onChange={(e) => cambiar({ observacion: e.target.value })} />
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small mt-3 mb-0">{error}</div>}

        <div className="d-flex justify-content-end gap-2 mt-3">
          <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          {pideConfirmar ? (
            <button type="button" className="btn btn-danger btn-sm rounded-3" onClick={() => guardar(null, true)} disabled={saving}>
              {saving ? "Guardando..." : "Guardar con saldo negativo"}
            </button>
          ) : (
            <button type="submit" className="btn btn-brand btn-sm rounded-3" disabled={saving}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          )}
        </div>
      </form>
    </ModalShell>
  );
}
