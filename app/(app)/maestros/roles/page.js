"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiKey, FiSave, FiX, FiEye, FiInfo } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import ModalShell from "@/components/ModalShell";
import PermisosGroupedPicker from "@/components/PermisosGroupedPicker";
import RequirePermission from "@/components/RequirePermission";
import { hasPermission, startPreviewRol } from "@/lib/auth";

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [roleModal, setRoleModal] = useState(null); // null | {} | rol
  const [permisosModal, setPermisosModal] = useState(null); // null | rol
  const [infoOpen, setInfoOpen] = useState(false);

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

  // "Ver como": trae los permisos reales de ese rol y los guarda como
  // simulación (ver lib/auth.js) — solo cambia lo que se ve en el frontend,
  // no crea una sesión nueva. Confirmamos con el usuario que así estaba
  // bien, en vez de una suplantación real con sesión propia.
  const handleVerComo = async (rol) => {
    try {
      const misPermisos = await apiFetch(`/roles/${rol.uuid}/permisos`);
      startPreviewRol(rol.nombre, misPermisos.map((p) => p.codigo));
      window.location.assign("/");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <RequirePermission code="menu.maestros.roles">
    <div className="p-4 p-md-5">
      <div className="mb-4">
        <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
          Roles
          <button
            type="button"
            className="btn btn-sm btn-link p-1 d-inline-flex text-decoration-none text-secondary"
            title="¿Cómo funciona este módulo?"
            onClick={() => setInfoOpen(true)}
          >
            <FiInfo size={17} />
          </button>
        </h1>
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
          <table className="table table-sm table-hover mb-0 align-middle">
            <thead>
              <tr className="table-light small text-secondary">
                <th>Rol</th>
                <th>Descripción</th>
                <th className="text-center" style={{ minWidth: "26rem" }}>Acciones</th>
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
                    <td className="small fw-medium">{rol.nombre}</td>
                    <td className="text-secondary small">{rol.descripcion || "—"}</td>
                    <td className="text-center">
                      <div className="d-flex justify-content-around flex-nowrap">
                        {rol.nombre === "Administrador" && <span className="small text-secondary">—</span>}
                        {rol.nombre !== "Administrador" && hasPermission("roles.editar") && (
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-1 d-inline-flex align-items-center gap-1 text-nowrap text-decoration-none"
                            title="Editar"
                            style={{ color: "#d97706" }}
                            onClick={() => setRoleModal(rol)}
                          >
                            <FiEdit2 size={15} /> Editar
                          </button>
                        )}
                        {rol.nombre !== "Administrador" && hasPermission("roles.asignar_permiso") && (
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-1 d-inline-flex align-items-center gap-1 text-nowrap text-decoration-none"
                            title="Permisos"
                            style={{ color: "#16a34a" }}
                            onClick={() => setPermisosModal(rol)}
                          >
                            <FiKey size={15} /> Permisos
                          </button>
                        )}
                        {rol.nombre !== "Administrador" && hasPermission("roles.asignar_permiso") && (
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-1 d-inline-flex align-items-center gap-1 text-nowrap text-decoration-none text-secondary"
                            title="Ver el menú y las pantallas como este rol"
                            onClick={() => handleVerComo(rol)}
                          >
                            <FiEye size={15} /> Ver como
                          </button>
                        )}
                        {rol.nombre !== "Administrador" && hasPermission("roles.eliminar") && (
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-1 d-inline-flex align-items-center gap-1 text-nowrap text-decoration-none"
                            title="Eliminar"
                            style={{ color: "#dc2626" }}
                            onClick={() => handleDelete(rol.uuid)}
                          >
                            <FiTrash2 size={15} /> Eliminar
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

      {infoOpen && <InfoModal onClose={() => setInfoOpen(false)} />}
    </div>
    </RequirePermission>
  );
}

// ─── Modal: cómo funciona el módulo ───
function InfoModal({ onClose }) {
  return (
    <ModalShell title="¿Cómo funciona este módulo?" onClose={onClose}>
      <p className="small text-secondary">
        Un <strong>rol</strong> agrupa permisos y se asigna a los usuarios — así se controla qué puede ver y hacer
        cada uno en el sistema. El rol <strong>Administrador</strong> siempre tiene todos los permisos y no se puede
        editar.
      </p>
      <ul className="list-unstyled d-flex flex-column gap-2 small mb-0">
        <li className="d-flex align-items-start gap-2">
          <FiPlus className="flex-shrink-0 mt-1" />
          <span><strong>Nuevo Rol</strong>: crea un rol vacío, sin permisos — se le asignan después con &quot;Permisos&quot;.</span>
        </li>
        <li className="d-flex align-items-start gap-2">
          <FiEdit2 className="flex-shrink-0 mt-1" style={{ color: "#d97706" }} />
          <span><strong>Editar</strong>: cambia el nombre y la descripción del rol.</span>
        </li>
        <li className="d-flex align-items-start gap-2">
          <FiKey className="flex-shrink-0 mt-1" style={{ color: "#16a34a" }} />
          <span><strong>Permisos</strong>: elige qué menús, pantallas y acciones puede usar este rol.</span>
        </li>
        <li className="d-flex align-items-start gap-2">
          <FiEye className="flex-shrink-0 mt-1 text-secondary" />
          <span><strong>Ver como</strong>: muestra el menú y las pantallas tal como las vería un usuario con este rol, sin cerrar tu sesión.</span>
        </li>
        <li className="d-flex align-items-start gap-2">
          <FiTrash2 className="flex-shrink-0 mt-1" style={{ color: "#dc2626" }} />
          <span><strong>Eliminar</strong>: borra el rol. Los usuarios que lo tenían asignado quedan sin ese rol.</span>
        </li>
      </ul>
    </ModalShell>
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
      // El backend limita /permisos a 100 por página (ya hay más de 100
      // permisos entre los granulares y los nuevos de menú/submenú) — hay
      // que traer todas las páginas, no solo la primera.
      const cargarTodosLosPermisos = async () => {
        const primera = await apiFetch(`/permisos?limit=100&page=1`);
        const todos = [...primera.items];
        const totalPages = primera.meta?.totalPages || 1;
        for (let page = 2; page <= totalPages; page++) {
          const siguiente = await apiFetch(`/permisos?limit=100&page=${page}`);
          todos.push(...siguiente.items);
        }
        return todos;
      };

      const [todosLosPermisos, misPermisos] = await Promise.all([
        cargarTodosLosPermisos(),
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
    <ModalShell title={`Permisos de ${rol.nombre}`} onClose={onClose} size="xl">
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
