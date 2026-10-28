"use client";

import { useEffect, useState } from "react";
import { FiEdit2, FiPlus, FiTrash2 } from "react-icons/fi";
import ModalShell from "@/components/ModalShell";
import { apiFetch } from "@/lib/api";
import { TIPOS_LUGAR, nombreTipoLugar } from "./ubicaciones";

const VACIO = { nombre: "", tipo: "OFICINA", direccion: "", lat: "", lng: "", estado: true };

// Lugares de asistencia distintos de las fincas (oficinas, plantas, bodegas...): aparecen junto a las fincas al marcar
// asistencia, en la web y en la app de campo. Los ve cualquiera con permiso de asistencia.
export default function LugaresModal({ onClose, onCambio }) {
  const [lugares, setLugares] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [form, setForm] = useState(null); // null | { ...VACIO, uuid? }
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const cargar = () =>
    apiFetch("/asistencia/lugares")
      .then(setLugares)
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));

  useEffect(() => {
    cargar();
  }, []);

  const campo = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const num = (v) => (v === "" || v === null || v === undefined ? null : Number(String(v).replace(",", ".")));

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError("");
    try {
      const body = { nombre: form.nombre, tipo: form.tipo, direccion: form.direccion || null, lat: num(form.lat), lng: num(form.lng), estado: form.estado };
      await apiFetch(form.uuid ? `/asistencia/lugares/${form.uuid}` : "/asistencia/lugares", { method: form.uuid ? "PUT" : "POST", body: JSON.stringify(body) });
      setForm(null);
      await cargar();
      onCambio?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(l) {
    if (!window.confirm(`¿Eliminar «${l.nombre}»? Las marcaciones que ya tiene se conservan. Si solo quieres que no aparezca para marcar, mejor desactívalo.`)) return;
    try {
      await apiFetch(`/asistencia/lugares/${l.uuid}`, { method: "DELETE" });
      await cargar();
      onCambio?.();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <ModalShell title="Lugares de asistencia" onClose={onClose} size="lg" height="auto">
      <p className="small text-secondary mb-3">
        Oficinas, plantas, bodegas y otros sitios donde también se marca asistencia, además de las fincas. Aparecen al marcar en la web y en la app de campo, y los ve
        cualquiera con permiso de asistencia.
      </p>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {form ? (
        <form onSubmit={guardar} className="row g-2 border rounded-3 p-3 mb-3">
          <div className="col-md-6">
            <label className="form-label small fw-medium">Nombre</label>
            <input className="form-control form-control-sm rounded-3" required minLength={2} maxLength={120} placeholder="Ej. Oficina principal" value={form.nombre} onChange={(e) => campo("nombre", e.target.value)} />
          </div>
          <div className="col-md-3">
            <label className="form-label small fw-medium">Tipo</label>
            <select className="form-select form-select-sm rounded-3" value={form.tipo} onChange={(e) => campo("tipo", e.target.value)}>
              {TIPOS_LUGAR.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-3 d-flex align-items-end">
            <div className="form-check mb-1">
              <input type="checkbox" className="form-check-input" id="lugar-activo" checked={form.estado} onChange={(e) => campo("estado", e.target.checked)} />
              <label className="form-check-label small" htmlFor="lugar-activo">
                Activo (se puede marcar)
              </label>
            </div>
          </div>
          <div className="col-12">
            <label className="form-label small fw-medium">Dirección (opcional)</label>
            <input className="form-control form-control-sm rounded-3" maxLength={200} value={form.direccion} onChange={(e) => campo("direccion", e.target.value)} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small fw-medium">Latitud (opcional)</label>
            <input type="number" step="any" min="-90" max="90" className="form-control form-control-sm rounded-3" value={form.lat} onChange={(e) => campo("lat", e.target.value)} />
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small fw-medium">Longitud (opcional)</label>
            <input type="number" step="any" min="-180" max="180" className="form-control form-control-sm rounded-3" value={form.lng} onChange={(e) => campo("lng", e.target.value)} />
          </div>
          <div className="col-12 d-flex justify-content-end gap-2 mt-2">
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => setForm(null)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-brand btn-sm rounded-3" disabled={guardando}>
              {guardando ? "Guardando..." : form.uuid ? "Guardar cambios" : "Crear lugar"}
            </button>
          </div>
        </form>
      ) : (
        <div className="d-flex justify-content-end mb-2">
          <button type="button" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-2" onClick={() => setForm(VACIO)}>
            <FiPlus /> Nuevo lugar
          </button>
        </div>
      )}

      {cargando ? (
        <p className="text-secondary small mb-0">Cargando...</p>
      ) : lugares.length === 0 ? (
        <p className="text-secondary small mb-0">Aún no hay lugares: crea el primero con «Nuevo lugar».</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0" style={{ fontSize: "0.8rem" }}>
            <thead className="table-light">
              <tr>
                <th className="fw-medium">Nombre</th>
                <th className="fw-medium text-center">Tipo</th>
                <th className="fw-medium">Dirección</th>
                <th className="fw-medium text-center">Estado</th>
                <th className="fw-medium text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lugares.map((l) => (
                <tr key={l.uuid} className={l.estado ? "" : "text-secondary"}>
                  <td className="fw-medium">{l.nombre}</td>
                  <td className="text-center">{nombreTipoLugar(l.tipo)}</td>
                  <td>{l.direccion || "—"}</td>
                  <td className="text-center">
                    <span className="badge rounded-pill" style={l.estado ? { backgroundColor: "#d1fae5", color: "#047857" } : { backgroundColor: "#f1f5f9", color: "#64748b" }}>
                      {l.estado ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="text-center text-nowrap">
                    <button
                      type="button"
                      className="btn btn-sm btn-link p-1 text-secondary"
                      title="Editar"
                      onClick={() => setForm({ ...VACIO, ...l, direccion: l.direccion || "", lat: l.lat ?? "", lng: l.lng ?? "" })}
                    >
                      <FiEdit2 />
                    </button>
                    <button type="button" className="btn btn-sm btn-link p-1" style={{ color: "#dc2626" }} title="Eliminar" onClick={() => eliminar(l)}>
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModalShell>
  );
}
