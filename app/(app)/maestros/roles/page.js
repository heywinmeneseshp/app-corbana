"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiKey, FiSave, FiX } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import ModalShell from "@/components/ModalShell";
import PermisosGroupedPicker from "@/components/PermisosGroupedPicker";
import RequirePermission from "@/components/RequirePermission";
import { hasPermission } from "@/lib/auth";

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [roleModal, setRoleModal] = useState(null); // null | {} | rol
  const [permisosModal, setPermisosModal] = useState(null); // null | rol

  async function loadRoles() {
    setLoading(true);
    setError("");
    try {
      const { items } = await apiFetch(`/roles?limit=100${search ? `&search=${encodeURIComponent(search)}` : ""}`);
      setRoles(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (uuid) => {
    if (!confirm("¿Eliminar este rol?")) return;
    try {
      await apiFetch(`/roles/${uuid}`, { method: "DELETE" });
      loadRoles();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <RequirePermission code="roles.ver">
    <div className="p-4 p-md-5">
      <div className="mb-4">
        <h1 className="fw-bold h3 mb-1">Roles</h1>
        <p className="text-secondary mb-0">
          Crea roles y define qué permisos incluye cada uno. El rol <strong>Administrador</strong> ya tiene todos los
          permisos del sistema.
        </p>
      </div>

      <div className="d-flex flex-column flex-sm-row gap-2 mb-3">
        <div className="flex-grow-1 position-relative">
          <FiSearch className="position-absolute text-secondary" style={{ top: "0.65rem", left: "0.75rem" }} />
          <input
            type="text"
            className="form-control rounded-3 ps-5"
            placeholder="Buscar por nombre de rol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadRoles()}
          />
        </div>
        {hasPermission("roles.crear") && (
          <button type="button" className="btn btn-brand rounded-3 text-nowrap d-flex align-items-center gap-1" onClick={() => setRoleModal({})}>
            <FiPlus /> Nuevo Rol
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Rol</th>
                <th>Descripción</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={3} className="text-center text-secondary py-4">
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && roles.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-secondary py-4">
                    No hay roles registrados todavía.
                  </td>
                </tr>
              )}
              {!loading &&
                roles.map((rol) => (
                  <tr key={rol.uuid}>
                    <td className="fw-medium">{rol.nombre}</td>
                    <td className="text-secondary small">{rol.descripcion || "—"}</td>
                    <td>
                      <div className="d-flex justify-content-end gap-2 flex-nowrap">
                        {hasPermission("roles.editar") && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-warning"
                            title="Editar"
                            onClick={() => setRoleModal(rol)}
                          >
                            <FiEdit2 />
                          </button>
                        )}
                        {hasPermission("roles.asignar_permiso") && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1 text-nowrap"
                            onClick={() => setPermisosModal(rol)}
                          >
                            <FiKey /> Permisos
                          </button>
                        )}
                        {hasPermission("roles.eliminar") && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            title="Eliminar"
                            onClick={() => handleDelete(rol.uuid)}
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

      {roleModal && (
        <RoleModal
          rol={roleModal.uuid ? roleModal : null}
          onClose={() => setRoleModal(null)}
          onSaved={() => {
            setRoleModal(null);
            loadRoles();
          }}
        />
      )}

      {permisosModal && <PermisosModal rol={permisosModal} onClose={() => setPermisosModal(null)} />}
    </div>
    </RequirePermission>
  );
}

// ─── Modal: crear/editar rol ───
function RoleModal({ rol, onClose, onSaved }) {
  const [nombre, setNombre] = useState(rol?.nombre || "");
  const [descripcion, setDescripcion] = useState(rol?.descripcion || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await apiFetch(rol ? `/roles/${rol.uuid}` : "/roles", {
        method: rol ? "PUT" : "POST",
        body: JSON.stringify({ nombre, descripcion }),
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={rol ? "Editar Rol" : "Nuevo Rol"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="mb-2">
          <label className="form-label small fw-medium">Nombre del rol</label>
          <input
            type="text"
            required
            className="form-control rounded-3"
            placeholder="Ej: Supervisor de campo"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="form-label small fw-medium">Descripción (opcional)</label>
          <textarea
            className="form-control rounded-3"
            rows={2}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </div>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1" onClick={onClose}>
            <FiX /> Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn btn-brand rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1">
            <FiSave /> {saving ? "Guardando..." : "Guardar Rol"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Modal: asignar permisos a un rol ───
function PermisosModal({ rol, onClose }) {
  const [allItems, setAllItems] = useState([]); // [{uuid, label, sublabel}]
  const [selected, setSelected] = useState([]);
  const [originalUuids, setOriginalUuids] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [{ items: todosLosPermisos }, misPermisos] = await Promise.all([
        apiFetch(`/permisos?limit=100`),
        apiFetch(`/roles/${rol.uuid}/permisos`),
      ]);
      setAllItems(todosLosPermisos.map((p) => ({ uuid: p.uuid, label: p.nombre, sublabel: p.codigo })));
      const misItems = misPermisos.map((p) => ({ uuid: p.uuid, label: p.nombre, sublabel: p.codigo }));
      setSelected(misItems);
      setOriginalUuids(new Set(misItems.map((p) => p.uuid)));
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
        ...aAgregar.map((permisoUuid) =>
          apiFetch(`/roles/${rol.uuid}/permisos`, { method: "POST", body: JSON.stringify({ permisoUuid }) }),
        ),
        ...aQuitar.map((permisoUuid) => apiFetch(`/roles/${rol.uuid}/permisos/${permisoUuid}`, { method: "DELETE" })),
      ]);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Permisos de ${rol.nombre}`} onClose={onClose} size="lg">
      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading ? (
        <p className="text-center text-secondary small py-4 mb-0">Cargando permisos...</p>
      ) : (
        <PermisosGroupedPicker items={allItems} selected={selected} onChange={setSelected} />
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
