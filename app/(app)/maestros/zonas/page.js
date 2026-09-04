"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiMapPin, FiSave, FiX } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";
import TagPicker from "@/components/TagPicker";

function emptyForm() {
  return { nombre: "", estado: true };
}

export default function ZonasPage() {
  const [zonas, setZonas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [zonaModal, setZonaModal] = useState(null); // null | {} | zona (edición)
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [fincasModal, setFincasModal] = useState(null); // null | zona

  async function loadZonas() {
    setLoading(true);
    setError("");
    try {
      const { items } = await apiFetch(`/zonas?limit=100${search ? `&search=${encodeURIComponent(search)}` : ""}`);
      setZonas(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadZonas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setForm(emptyForm());
    setFormError("");
    setZonaModal({});
  }

  function openEdit(zona) {
    setForm({ nombre: zona.nombre, estado: zona.estado });
    setFormError("");
    setZonaModal(zona);
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      if (zonaModal?.uuid) {
        await apiFetch(`/zonas/${zonaModal.uuid}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await apiFetch("/zonas", { method: "POST", body: JSON.stringify(form) });
      }
      setZonaModal(null);
      loadZonas();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(zona) {
    if (!confirm(`¿Eliminar la zona "${zona.nombre}"?`)) return;
    try {
      await apiFetch(`/zonas/${zona.uuid}`, { method: "DELETE" });
      loadZonas();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <RequirePermission code="menu.maestros.zonas">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-medium h4 mb-1">Zonas</h1>
          <p className="text-secondary small mb-0">
            Agrupa fincas en zonas geográficas u operativas. Una finca puede pertenecer a varias zonas.
          </p>
        </div>

        <div className="d-flex flex-column flex-sm-row gap-2 mb-3">
          <div className="flex-grow-1 position-relative">
            <FiSearch className="position-absolute text-secondary" size={15} style={{ top: "0.7rem", left: "0.85rem" }} />
            <input
              type="text"
              className="form-control rounded-3 ps-5 border-0 bg-light"
              placeholder="Buscar zona por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadZonas()}
            />
          </div>
          {hasPermission("zona.crear") && (
            <button type="button" className="btn btn-brand rounded-3 text-nowrap d-flex align-items-center gap-2 px-3" onClick={openCreate}>
              <FiPlus size={15} /> Nueva Zona
            </button>
          )}
        </div>

        {error && <div className="alert alert-danger py-2 small border-0 rounded-3">{error}</div>}

        <div className="card border-0 rounded-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead>
                <tr className="small text-secondary" style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <th className="fw-medium">Zona</th>
                  <th className="fw-medium">Fincas</th>
                  <th className="fw-medium text-center">Acciones</th>
                  <th className="fw-medium text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={4} className="text-center text-secondary py-4">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && zonas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-secondary py-4">
                      No hay zonas registradas todavía.
                    </td>
                  </tr>
                )}
                {!loading &&
                  zonas.map((zona) => (
                    <tr key={zona.uuid}>
                      <td className="fw-medium">{zona.nombre}</td>
                      <td>
                        {zona.fincas?.length > 0 ? (
                          <span className="small text-secondary">
                            {zona.fincas.map((f) => f.nombre).join(", ")}
                          </span>
                        ) : (
                          <span className="small text-secondary fst-italic">Sin fincas asignadas</span>
                        )}
                      </td>
                      <td className="text-center">
                        <div className="d-flex justify-content-center gap-1 flex-nowrap">
                          {hasPermission("zona.editar") && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex align-items-center gap-1 text-secondary text-decoration-none text-nowrap"
                              title="Asignar fincas"
                              onClick={() => setFincasModal(zona)}
                            >
                              <FiMapPin size={15} /> Fincas
                            </button>
                          )}
                          {hasPermission("zona.editar") && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex text-secondary"
                              title="Editar"
                              onClick={() => openEdit(zona)}
                            >
                              <FiEdit2 size={15} />
                            </button>
                          )}
                          {hasPermission("zona.eliminar") && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex"
                              style={{ color: "#dc2626" }}
                              title="Eliminar"
                              onClick={() => handleDelete(zona)}
                            >
                              <FiTrash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="text-center">
                        <span className="d-inline-flex align-items-center gap-1 small text-secondary">
                          <span
                            className="rounded-circle d-inline-block"
                            style={{ width: 6, height: 6, background: zona.estado ? "#16a34a" : "#cbd5e1" }}
                          />
                          {zona.estado ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {zonaModal && (
          <ModalShell title={zonaModal.uuid ? "Editar zona" : "Nueva zona"} onClose={() => setZonaModal(null)}>
            <form onSubmit={handleSave}>
              <div className="mb-3">
                <label className="form-label small fw-medium">
                  Nombre <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control rounded-3"
                  required
                  maxLength={100}
                  placeholder="Ej: Zona Norte"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="zona-estado"
                  checked={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.checked }))}
                />
                <label className="form-check-label small" htmlFor="zona-estado">
                  Activo
                </label>
              </div>

              {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-light rounded-3" onClick={() => setZonaModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-brand rounded-3" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </ModalShell>
        )}

        {fincasModal && (
          <FincasZonaModal zona={fincasModal} onClose={() => setFincasModal(null)} onChanged={loadZonas} />
        )}
      </div>
    </RequirePermission>
  );
}

// ─── Modal: asignar fincas a una zona (N:M) ───
function FincasZonaModal({ zona, onClose, onChanged }) {
  const [allItems, setAllItems] = useState([]);
  const [selected, setSelected] = useState([]);
  const [originalUuids, setOriginalUuids] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [{ items: todasLasFincas }, misFincas] = await Promise.all([
        apiFetch(`/fincas?limit=100`),
        apiFetch(`/zonas/${zona.uuid}/fincas`),
      ]);
      setAllItems(todasLasFincas.map((f) => ({ uuid: f.uuid, label: f.nombre, sublabel: f.codigo })));
      const misItems = misFincas.map((f) => ({ uuid: f.uuid, label: f.nombre, sublabel: f.codigo }));
      setSelected(misItems);
      setOriginalUuids(new Set(misItems.map((f) => f.uuid)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGuardar = async () => {
    setError("");
    setSaving(true);
    const selectedUuids = new Set(selected.map((s) => s.uuid));
    const aAgregar = [...selectedUuids].filter((uuid) => !originalUuids.has(uuid));
    const aQuitar = [...originalUuids].filter((uuid) => !selectedUuids.has(uuid));

    try {
      await Promise.all([
        ...aAgregar.map((fincaUuid) =>
          apiFetch(`/zonas/${zona.uuid}/fincas`, { method: "POST", body: JSON.stringify({ fincaUuid }) }),
        ),
        ...aQuitar.map((fincaUuid) => apiFetch(`/zonas/${zona.uuid}/fincas/${fincaUuid}`, { method: "DELETE" })),
      ]);
      onChanged();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Fincas de la zona ${zona.nombre}`} onClose={onClose} size="lg" height="90vh" minHeight="80vh">
      <p className="small text-secondary mb-3">
        Una finca puede pertenecer a varias zonas al mismo tiempo — a diferencia de Grupos de Finca, aquí no hay
        límite de una sola zona por finca.
      </p>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading ? (
        <p className="text-center text-secondary small py-4 mb-0">Cargando fincas...</p>
      ) : (
        <TagPicker items={allItems} selected={selected} onChange={setSelected} placeholder="Buscar finca para agregar..." />
      )}

      <div className="d-flex gap-2 mt-3">
        <button type="button" className="btn btn-outline-secondary rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1" onClick={onClose}>
          <FiX /> Cancelar
        </button>
        <button
          type="button"
          disabled={saving || loading}
          className="btn btn-brand rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1"
          onClick={handleGuardar}
        >
          <FiSave /> {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </ModalShell>
  );
}
