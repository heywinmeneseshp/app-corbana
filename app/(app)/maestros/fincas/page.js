"use client";

import { Fragment, useEffect, useState } from "react";
import {
  FiPlus,
  FiRefreshCw,
  FiSettings,
  FiSearch,
  FiEye,
  FiEdit2,
  FiTrash2,
  FiSave,
  FiX,
} from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import ModalShell from "@/components/ModalShell";
import RequirePermission from "@/components/RequirePermission";
import { hasPermission, getCurrentUser } from "@/lib/auth";

export default function FincasPage() {
  const [fincas, setFincas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());

  const [fincaModal, setFincaModal] = useState(null); // null | {} | finca
  const [lotesModal, setLotesModal] = useState(null); // null | finca
  const [configModal, setConfigModal] = useState(false);
  const [syncModal, setSyncModal] = useState(false);

  async function loadFincas() {
    setLoading(true);
    setError("");
    setSelected(new Set());
    try {
      const { items } = await apiFetch(`/fincas?limit=100${search ? `&search=${encodeURIComponent(search)}` : ""}`);
      setFincas(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFincas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSelected = (uuid) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) => (prev.size === fincas.length ? new Set() : new Set(fincas.map((f) => f.uuid))));
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`¿Eliminar ${selected.size} finca(s) seleccionada(s)? Esta acción no se puede deshacer.`)) return;
    setError("");
    try {
      for (const uuid of selected) {
        await apiFetch(`/fincas/${uuid}`, { method: "DELETE" });
      }
      loadFincas();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteOne = async (uuid) => {
    if (!confirm("¿Eliminar esta finca?")) return;
    try {
      await apiFetch(`/fincas/${uuid}`, { method: "DELETE" });
      loadFincas();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <RequirePermission code="finca.ver">
    <div className="p-4 p-md-5">
      <div className="mb-4">
        <h1 className="fw-bold h3 mb-1">Fincas</h1>
        <p className="text-secondary mb-0">Gestiona las fincas registradas en Corbana.</p>
      </div>

      <div className="d-flex flex-column flex-sm-row gap-2 mb-3">
        <div className="flex-grow-1 position-relative">
          <FiSearch className="position-absolute text-secondary" style={{ top: "0.65rem", left: "0.75rem" }} />
          <input
            type="text"
            className="form-control rounded-3 ps-5"
            placeholder="Buscar por nombre o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadFincas()}
          />
        </div>
        {hasPermission("finca.crear") && (
          <button type="button" className="btn btn-brand rounded-3 text-nowrap d-flex align-items-center gap-1" onClick={() => setFincaModal({})}>
            <FiPlus /> Nueva Finca
          </button>
        )}
        <button
          type="button"
          className="btn btn-outline-secondary rounded-3 text-nowrap d-flex align-items-center gap-1"
          onClick={() => setSyncModal(true)}
        >
          <FiRefreshCw /> Sincronizar con banarica
        </button>
        <button
          type="button"
          className="btn btn-outline-secondary rounded-3"
          title="Configurar enlace del API de banarica"
          onClick={() => setConfigModal(true)}
        >
          <FiSettings />
        </button>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {selected.size > 0 && (
        <div className="d-flex align-items-center justify-content-between rounded-3 px-3 py-2 mb-3" style={{ backgroundColor: "var(--brand-50)", border: "1px solid var(--brand-100)" }}>
          <span className="small fw-medium" style={{ color: "var(--brand-900)" }}>
            {selected.size} finca(s) seleccionada(s)
          </span>
          <button type="button" className="btn btn-link btn-sm text-danger text-decoration-none d-flex align-items-center gap-1" onClick={handleBulkDelete}>
            <FiTrash2 /> Eliminar seleccionadas
          </button>
        </div>
      )}

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th style={{ width: "2.5rem" }}>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={fincas.length > 0 && selected.size === fincas.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Finca</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
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
              {!loading && fincas.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-secondary py-4">
                    No hay fincas registradas todavía.
                  </td>
                </tr>
              )}
              {!loading &&
                fincas.map((finca) => (
                  <tr key={finca.uuid}>
                    <td>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selected.has(finca.uuid)}
                        onChange={() => toggleSelected(finca.uuid)}
                      />
                    </td>
                    <td>
                      <p className="fw-medium mb-0">{finca.nombre}</p>
                      <p className="small text-secondary mb-0">Código: {finca.codigo}</p>
                    </td>
                    <td>
                      {finca.estado ? (
                        <span className="badge rounded-pill" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>
                          Activo
                        </span>
                      ) : (
                        <span className="badge rounded-pill text-bg-secondary">Inactivo</span>
                      )}
                    </td>
                    <td>
                      <div className="d-flex justify-content-end gap-2 flex-nowrap">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1 text-nowrap"
                          onClick={() => setLotesModal(finca)}
                        >
                          <FiEye /> Ver lotes
                        </button>
                        {hasPermission("finca.editar") && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-warning"
                            title="Editar"
                            onClick={() => setFincaModal(finca)}
                          >
                            <FiEdit2 />
                          </button>
                        )}
                        {hasPermission("finca.eliminar") && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            title="Eliminar"
                            onClick={() => handleDeleteOne(finca.uuid)}
                          >
                            <FiTrash2 />
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

      {fincaModal && (
        <FincaModal
          finca={fincaModal.uuid ? fincaModal : null}
          onClose={() => setFincaModal(null)}
          onSaved={() => {
            setFincaModal(null);
            loadFincas();
          }}
        />
      )}

      {lotesModal && <LotesModal finca={lotesModal} onClose={() => setLotesModal(null)} />}

      {configModal && <ConfigModal onClose={() => setConfigModal(false)} />}

      {syncModal && <SyncModal onClose={() => setSyncModal(false)} onSynced={loadFincas} />}
    </div>
    </RequirePermission>
  );
}

// ─── Modal: crear/editar finca ───
function FincaModal({ finca, onClose, onSaved }) {
  const [nombre, setNombre] = useState(finca?.nombre || "");
  const [codigo, setCodigo] = useState(finca?.codigo || "");
  const [estado, setEstado] = useState(finca ? finca.estado : true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await apiFetch(finca ? `/fincas/${finca.uuid}` : "/fincas", {
        method: finca ? "PUT" : "POST",
        body: JSON.stringify({ nombre, codigo, estado }),
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={finca ? "Editar Finca" : "Nueva Finca"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label small fw-medium">Nombre de la finca</label>
          <input
            type="text"
            required
            className="form-control rounded-3"
            placeholder="Ej: Finca La Esmeralda"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="form-label small fw-medium">Código</label>
          <input
            type="text"
            required
            className="form-control rounded-3"
            placeholder="Ej: F-03"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
        </div>
        <div className="form-check mb-3">
          <input
            type="checkbox"
            className="form-check-input"
            id="fincaEstado"
            checked={estado}
            onChange={(e) => setEstado(e.target.checked)}
          />
          <label className="form-check-label small" htmlFor="fincaEstado">
            Activo
          </label>
        </div>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1" onClick={onClose}>
            <FiX /> Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn btn-brand rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1">
            <FiSave /> {saving ? "Guardando..." : "Guardar Finca"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Modal: ver / crear lotes de una finca ───
function LotesModal({ finca, onClose }) {
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [areaProdMap, setAreaProdMap] = useState({});
  const [expanded, setExpanded] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState({});
  const esAdmin = (getCurrentUser()?.roles || []).includes("Administrador");

  const enableEditMode = () => {
    const draft = {};
    for (const l of lotes) {
      draft[l.uuid] = { nombre: l.nombre, codigo: l.codigo, area: l.area ?? "", estado: l.estado };
    }
    setEditDraft(draft);
    setEditMode(true);
    setExpanded(null);
  };

  const cancelEditMode = () => {
    setEditMode(false);
    setEditDraft({});
  };

  const handleDeleteLote = async (lote) => {
    if (!confirm(`¿Eliminar el lote "${lote.nombre}" (${lote.codigo})? Esta acción no se puede deshacer.`)) return;
    try {
      await apiFetch(`/lotes/${lote.uuid}`, { method: "DELETE" });
      setLotes((prev) => prev.filter((l) => l.uuid !== lote.uuid));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveRow = async (uuid) => {
    const values = editDraft[uuid];
    if (!values) return;
    try {
      const res = await apiFetch(`/lotes/${uuid}`, {
        method: "PUT",
        body: JSON.stringify(
          values.area !== "" ? values : { ...values, area: null },
        ),
      });
      setLotes((prev) => prev.map((l) => (l.uuid === uuid ? res : l)));
    } catch (err) {
      setError(err.message);
    }
  };

  const setDraftField = (uuid, field, value) => {
    setEditDraft((prev) => ({ ...prev, [uuid]: { ...prev[uuid], [field]: value } }));
  };

  const toggle = (uuid, type) => {
    setExpanded((prev) => (prev && prev.uuid === uuid && prev.type === type ? null : { uuid, type }));
  };

  async function loadLotes() {
    setLoading(true);
    setError("");
    try {
      const { items } = await apiFetch(`/fincas/${finca.uuid}/lotes?limit=100`);
      setLotes(items);
      const entries = await Promise.all(
        items.map(async (lote) => {
          const { items: historial } = await apiFetch(`/lotes/${lote.uuid}/area-produccion?limit=1`);
          return [lote.uuid, historial[0] || null];
        }),
      );
      setAreaProdMap(Object.fromEntries(entries));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ModalShell title={`Lotes de ${finca.nombre}`} onClose={onClose} size="lg">
      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="small text-secondary">Código: {finca.codigo}</span>
        <div className="d-flex gap-2">
          {!editMode && (
            <>
              <button type="button" className="btn btn-sm btn-outline-warning rounded-3 d-inline-flex align-items-center gap-1" onClick={enableEditMode}>
                <FiEdit2 /> Modo edición
              </button>
              <button type="button" className="btn btn-sm btn-brand rounded-3 d-inline-flex align-items-center gap-1" onClick={() => setShowForm((v) => !v)}>
                {showForm ? <><FiX /> Cancelar</> : <><FiPlus /> Nuevo Lote</>}
              </button>
            </>
          )}
          {editMode && (
            <button type="button" className="btn btn-sm btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-1" onClick={cancelEditMode}>
              <FiX /> Salir de edición
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <NuevoLoteForm
          fincaUuid={finca.uuid}
          onCreated={(nuevo) => {
            setLotes((prev) => [...prev, nuevo]);
            setShowForm(false);
          }}
        />
      )}

      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Lote</th>
              <th>Área Disponible</th>
              <th>Área en Producción</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="text-center text-secondary py-3">Cargando...</td>
              </tr>
            )}
            {!loading && lotes.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-secondary py-3">Esta finca todavía no tiene lotes.</td>
              </tr>
            )}
            {!loading &&
              lotes.map((lote) => {
                const ultimo = areaProdMap[lote.uuid];
                const draft = editDraft[lote.uuid];
                return (
                  <Fragment key={lote.uuid}>
                    {editMode && draft ? (
                      <tr>
                        <td>
                          <input className="form-control form-control-sm rounded-3 mb-1" value={draft.nombre} onChange={(e) => setDraftField(lote.uuid, "nombre", e.target.value)} placeholder="Nombre" />
                          <input className="form-control form-control-sm rounded-3" value={draft.codigo} onChange={(e) => setDraftField(lote.uuid, "codigo", e.target.value)} placeholder="Código" />
                        </td>
                        <td>
                          <input className="form-control form-control-sm rounded-3" type="number" step="0.01" min="0" value={draft.area} onChange={(e) => setDraftField(lote.uuid, "area", e.target.value)} placeholder="Ha" style={{ width: "7rem" }} />
                        </td>
                        <td>
                          {ultimo ? (
                            <><span>{Number(ultimo.area).toFixed(1)} Ha</span><p className="small text-secondary mb-0">{ultimo.fechaRegistro}</p></>
                          ) : (
                            <span className="text-secondary small">Sin registrar</span>
                          )}
                        </td>
                        <td>
                          <div className="form-check">
                            <input type="checkbox" className="form-check-input" id={`edit-estado-${lote.uuid}`} checked={draft.estado} onChange={(e) => setDraftField(lote.uuid, "estado", e.target.checked)} />
                            <label className="form-check-label small" htmlFor={`edit-estado-${lote.uuid}`}>{draft.estado ? "Activo" : "Inactivo"}</label>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex justify-content-end gap-2 flex-nowrap">
                            <button type="button" className="btn btn-sm btn-brand rounded-3 d-inline-flex align-items-center gap-1 text-nowrap" onClick={() => handleSaveRow(lote.uuid)}>
                              <FiSave /> Guardar
                            </button>
                            {esAdmin && (
                              <button type="button" className="btn btn-sm btn-outline-danger" title="Eliminar lote" onClick={() => handleDeleteLote(lote)}>
                                <FiTrash2 />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <>
                        <tr>
                          <td>
                            <p className="mb-0">{lote.nombre}</p>
                            <p className="small text-secondary mb-0">Código: {lote.codigo}</p>
                          </td>
                          <td>{lote.area != null ? `${Number(lote.area).toFixed(1)} Ha` : "—"}</td>
                          <td>
                            {ultimo ? (
                              <><span>{Number(ultimo.area).toFixed(1)} Ha</span><p className="small text-secondary mb-0">{ultimo.fechaRegistro}</p></>
                            ) : (
                              <span className="text-secondary small">Sin registrar</span>
                            )}
                          </td>
                          <td>
                            {lote.estado ? (
                              <span className="badge rounded-pill" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>Activo</span>
                            ) : (
                              <span className="badge rounded-pill text-bg-secondary">Inactivo</span>
                            )}
                          </td>
                          <td>
                            <div className="d-flex justify-content-end gap-2 flex-nowrap">
                              <button type="button" className="btn btn-sm btn-outline-warning d-inline-flex align-items-center gap-1 text-nowrap" onClick={() => toggle(lote.uuid, "editar")}>
                                {expanded?.uuid === lote.uuid && expanded.type === "editar" ? <><FiX /> Cancelar</> : <><FiEdit2 /> Editar</>}
                              </button>
                              <button type="button" className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1 text-nowrap" onClick={() => toggle(lote.uuid, "area")}>
                                {expanded?.uuid === lote.uuid && expanded.type === "area" ? <><FiX /> Cancelar</> : <><FiRefreshCw /> Área</>}
                              </button>
                              {esAdmin && (
                                <button type="button" className="btn btn-sm btn-outline-danger" title="Eliminar lote" onClick={() => handleDeleteLote(lote)}>
                                  <FiTrash2 />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expanded?.uuid === lote.uuid && expanded.type === "area" && (
                          <tr><td colSpan={5} className="bg-light p-3"><AreaProduccionForm loteUuid={lote.uuid} onRegistered={async () => { const { items: historial } = await apiFetch(`/lotes/${lote.uuid}/area-produccion?limit=1`); setAreaProdMap((prev) => ({ ...prev, [lote.uuid]: historial[0] || null })); setExpanded(null); }} /></td></tr>
                        )}
                        {expanded?.uuid === lote.uuid && expanded.type === "editar" && (
                          <tr><td colSpan={5} className="bg-light p-3"><EditarLoteForm lote={lote} onSaved={(actualizado) => { setLotes((prev) => prev.map((l) => (l.uuid === actualizado.uuid ? actualizado : l))); setExpanded(null); }} /></td></tr>
                        )}
                      </>
                    )}
                  </Fragment>
                );
              })}
          </tbody>
        </table>
      </div>
    </ModalShell>
  );
}

function EditarLoteForm({ lote, onSaved }) {
  const [nombre, setNombre] = useState(lote.nombre);
  const [codigo, setCodigo] = useState(lote.codigo);
  const [area, setArea] = useState(lote.area ?? "");
  const [estado, setEstado] = useState(lote.estado);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await apiFetch(`/lotes/${lote.uuid}`, {
        method: "PUT",
        body: JSON.stringify({
          nombre,
          codigo,
          estado,
          ...(area !== "" ? { area: Number(area) } : {}),
        }),
      });
      onSaved(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="d-flex flex-wrap align-items-end gap-2 py-2">
      <div>
        <label className="form-label small mb-1">Nombre del lote</label>
        <input
          type="text"
          required
          className="form-control form-control-sm rounded-3"
          style={{ width: "12rem" }}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </div>
      <div>
        <label className="form-label small mb-1">Código</label>
        <input
          type="text"
          required
          className="form-control form-control-sm rounded-3"
          style={{ width: "7rem" }}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
        />
      </div>
      <div>
        <label className="form-label small mb-1">Área (Ha)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          className="form-control form-control-sm rounded-3"
          style={{ width: "6rem" }}
          value={area}
          onChange={(e) => setArea(e.target.value)}
        />
      </div>
      <div className="form-check pb-2">
        <input
          type="checkbox"
          className="form-check-input"
          id={`estado-${lote.uuid}`}
          checked={estado}
          onChange={(e) => setEstado(e.target.checked)}
        />
        <label className="form-check-label small" htmlFor={`estado-${lote.uuid}`}>
          Activo
        </label>
      </div>
      <button type="submit" disabled={saving} className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-1 text-nowrap">
        <FiSave /> {saving ? "Guardando..." : "Guardar"}
      </button>
      {error && <div className="alert alert-danger py-1 px-2 small mb-0 w-100">{error}</div>}
    </form>
  );
}

function AreaProduccionForm({ loteUuid, onRegistered }) {
  const [area, setArea] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await apiFetch(`/lotes/${loteUuid}/area-produccion`, {
        method: "POST",
        body: JSON.stringify({ area: Number(area), fecha }),
      });
      onRegistered();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="d-flex flex-wrap align-items-end gap-2 py-2">
      <div>
        <label className="form-label small mb-1">Nueva área en producción (Ha)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          required
          className="form-control form-control-sm rounded-3"
          value={area}
          onChange={(e) => setArea(e.target.value)}
        />
      </div>
      <div>
        <label className="form-label small mb-1">Fecha</label>
        <input
          type="date"
          required
          className="form-control form-control-sm rounded-3"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
      </div>
      <button type="submit" disabled={saving} className="btn btn-brand btn-sm rounded-3 d-inline-flex align-items-center gap-1">
        <FiSave /> {saving ? "Guardando..." : "Registrar"}
      </button>
      {error && <span className="text-danger small ms-2">{error}</span>}
    </form>
  );
}

function NuevoLoteForm({ fincaUuid, onCreated }) {
  const [nombre, setNombre] = useState("");
  const [area, setArea] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await apiFetch("/lotes", {
        method: "POST",
        body: JSON.stringify({
          fincaUuid,
          nombre,
          estado: true,
          ...(area ? { area: Number(area) } : {}),
        }),
      });
      onCreated(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border rounded-3 p-3 mb-3 bg-light">
      <p className="small text-secondary mb-2">El código del lote se genera automáticamente (código de la finca + consecutivo).</p>
      <div className="row g-2 mb-2">
        <div className="col-12 col-sm-7">
          <input
            type="text"
            required
            className="form-control form-control-sm rounded-3"
            placeholder="Nombre del lote"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        <div className="col-6 col-sm-3">
          <input
            type="number"
            step="0.01"
            min="0"
            className="form-control form-control-sm rounded-3"
            placeholder="Área (Ha)"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
        </div>
        <div className="col-12 col-sm-2">
          <button type="submit" disabled={saving} className="btn btn-brand btn-sm rounded-3 w-100 d-flex align-items-center justify-content-center gap-1">
            <FiPlus /> {saving ? "..." : "Agregar"}
          </button>
        </div>
      </div>
      {error && <div className="alert alert-danger py-1 px-2 small mb-0">{error}</div>}
    </form>
  );
}

// ─── Modal: configurar enlace de banarica ───
function ConfigModal({ onClose }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/configuraciones/banarica-url")
      .then((data) => setUrl(data.url))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");
    setSaving(true);
    try {
      await apiFetch("/configuraciones/banarica-url", { method: "PUT", body: JSON.stringify({ url }) });
      setOk("Enlace guardado correctamente.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Conexión con banarica" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label small fw-medium">Enlace del API de banarica</label>
          <input
            type="url"
            required
            disabled={loading}
            className="form-control rounded-3"
            placeholder="https://api-logistica-banarica.vercel.app"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <p className="form-text small">
            Se usará para consultar <code>/api/v1/almacenes/</code> al sincronizar.
          </p>
        </div>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        {ok && <div className="alert alert-success py-2 small">{ok}</div>}
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1" onClick={onClose}>
            <FiX /> Cancelar
          </button>
          <button type="submit" disabled={saving || loading} className="btn btn-brand rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1">
            <FiSave /> {saving ? "Guardando..." : "Guardar enlace"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Modal: elegir almacenes de banarica a sincronizar ───
function SyncModal({ onClose, onSynced }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    apiFetch("/fincas/banarica-almacenes")
      .then((data) => {
        setItems(data.items);
        setSelected(new Set(data.items.map((i) => i.consecutivo)));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (consecutivo) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(consecutivo)) next.delete(consecutivo);
      else next.add(consecutivo);
      return next;
    });
  };

  const handleSync = async () => {
    if (selected.size === 0) {
      setError("Selecciona al menos un almacén.");
      return;
    }
    setError("");
    setSyncing(true);
    try {
      const resultado = await apiFetch("/fincas/sync-banarica", {
        method: "POST",
        body: JSON.stringify({ consecutivos: Array.from(selected) }),
      });
      setResult(
        `Sincronización completada: ${resultado.fincasCreadas} finca(s) creada(s), ${resultado.fincasActualizadas} actualizada(s), ${resultado.fincasRestauradas} restaurada(s).`,
      );
      onSynced();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ModalShell title="Elegir almacenes a sincronizar" onClose={onClose} size="lg">
      <p className="small text-secondary">
        Selecciona qué almacenes activos de banarica quieres crear/actualizar como fincas.
      </p>

      <div className="d-flex gap-3 mb-2 small">
        <button type="button" className="btn btn-link btn-sm text-brand p-0" onClick={() => setSelected(new Set(items.map((i) => i.consecutivo)))}>
          Seleccionar todos
        </button>
        <button type="button" className="btn btn-link btn-sm text-secondary p-0" onClick={() => setSelected(new Set())}>
          Ninguno
        </button>
      </div>

      <div className="border rounded-3 mb-3" style={{ maxHeight: "18rem", overflowY: "auto" }}>
        {loading && <p className="text-center text-secondary small py-4 mb-0">Cargando almacenes...</p>}
        {!loading && items.length === 0 && <p className="text-center text-secondary small py-4 mb-0">No hay almacenes activos en banarica.</p>}
        {!loading &&
          items.map((item) => (
            <label
              key={item.consecutivo}
              className="d-flex align-items-center gap-3 px-3 py-2 border-bottom small mb-0"
              style={{ cursor: "pointer" }}
            >
              <input
                type="checkbox"
                className="form-check-input m-0"
                checked={selected.has(item.consecutivo)}
                onChange={() => toggle(item.consecutivo)}
              />
              <span className="flex-grow-1">{item.nombre}</span>
              <span className="text-secondary small">Cód. {item.consecutivo}</span>
              {item.yaSincronizado ? (
                <span className="badge text-bg-secondary">Ya existe</span>
              ) : (
                <span className="badge" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>
                  Nuevo
                </span>
              )}
            </label>
          ))}
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {result && <div className="alert alert-success py-2 small">{result}</div>}

      <div className="d-flex gap-2">
        <button type="button" className="btn btn-outline-secondary rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1" onClick={onClose}>
          <FiX /> Cancelar
        </button>
        <button type="button" disabled={syncing} className="btn btn-brand rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1" onClick={handleSync}>
          <FiRefreshCw /> {syncing ? "Sincronizando..." : "Sincronizar seleccionados"}
        </button>
      </div>
    </ModalShell>
  );
}
