"use client";

import { useEffect, useState } from "react";
import { FiEdit2 } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { esAdministrador } from "@/lib/laborEstados";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

function emptyForm() {
  return { estadio: "", valorL3: "", valorL4: "", valorL5: "", estado: true };
}

export default function EstadiosSigatokaPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { items: rows } = await apiFetch("/estadios-sigatoka?limit=100");
      setItems(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openEdit(estadio) {
    setEditing(estadio);
    setForm({
      estadio: estadio.estadio,
      valorL3: String(estadio.valorL3),
      valorL4: String(estadio.valorL4),
      valorL5: String(estadio.valorL5),
      estado: estadio.estado,
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const body = {
        ...form,
        valorL3: Number(form.valorL3) || 0,
        valorL4: Number(form.valorL4) || 0,
        valorL5: Number(form.valorL5) || 0,
      };
      await apiFetch(`/estadios-sigatoka/${editing.uuid}`, { method: "PUT", body: JSON.stringify(body) });
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequirePermission code="menu.maestros.estadios_sigatoka">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1">Estadios de Sigatoka</h1>
          <p className="text-secondary mb-0">
            Valores numéricos por estadio y por hoja evaluada (L3, L4, L5) para el cálculo automático de la Suma
            Bruta: <strong>0</strong> = sin estadio (hoja sin estadio en la app móvil) y la escala de Sigatoka de{" "}
            <strong>1-</strong> a <strong>6+</strong>. Los cambios se aplican en tiempo real, sin tocar código.
          </p>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>Estadio</th>
                  <th>L3</th>
                  <th>L4</th>
                  <th>L5</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} className="text-center text-secondary py-4">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-secondary py-4">
                      No hay estadios de Sigatoka registrados todavía.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((e) => (
                    <tr key={e.uuid}>
                      <td className="fw-medium">{e.estadio}</td>
                      <td className="small text-secondary">{Number(e.valorL3)}</td>
                      <td className="small text-secondary">{Number(e.valorL4)}</td>
                      <td className="small text-secondary">{Number(e.valorL5)}</td>
                      <td>
                        <div className="d-flex justify-content-end gap-2 flex-nowrap">
                          {esAdministrador() && (
                            <button type="button" className="btn btn-sm btn-outline-warning" title="Editar" onClick={() => openEdit(e)}>
                              <FiEdit2 />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {modalOpen && (
          <ModalShell title={`Editar estadio ${editing?.estadio || ""}`} onClose={() => setModalOpen(false)}>
            <form onSubmit={handleSave}>
              <div className="row g-3 mb-3">
                <div className="col-4">
                  <label className="form-label small fw-medium">
                    L3 <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="form-control rounded-3"
                    required
                    value={form.valorL3}
                    onChange={(e) => setForm((f) => ({ ...f, valorL3: e.target.value }))}
                  />
                </div>
                <div className="col-4">
                  <label className="form-label small fw-medium">
                    L4 <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="form-control rounded-3"
                    required
                    value={form.valorL4}
                    onChange={(e) => setForm((f) => ({ ...f, valorL4: e.target.value }))}
                  />
                </div>
                <div className="col-4">
                  <label className="form-label small fw-medium">
                    L5 <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="form-control rounded-3"
                    required
                    value={form.valorL5}
                    onChange={(e) => setForm((f) => ({ ...f, valorL5: e.target.value }))}
                  />
                </div>
                <div className="form-text small">Valores con los que se calcula la Suma Bruta según la hoja evaluada.</div>
              </div>
              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="estadio-sigatoka-estado"
                  checked={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.checked }))}
                />
                <label className="form-check-label small" htmlFor="estadio-sigatoka-estado">
                  Activo
                </label>
              </div>

              {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary rounded-3" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-brand rounded-3" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </ModalShell>
        )}
      </div>
    </RequirePermission>
  );
}
