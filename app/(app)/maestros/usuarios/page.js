"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiShield, FiSave, FiX } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import ModalShell from "@/components/ModalShell";
import TagPicker from "@/components/TagPicker";
import RequirePermission from "@/components/RequirePermission";
import { hasPermission } from "@/lib/auth";

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [usuarioModal, setUsuarioModal] = useState(null); // null | {} | usuario
  const [rolesModal, setRolesModal] = useState(null); // null | usuario

  async function loadUsuarios() {
    setLoading(true);
    setError("");
    try {
      const { items } = await apiFetch(`/users?limit=100${search ? `&search=${encodeURIComponent(search)}` : ""}`);
      setUsuarios(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsuarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (uuid) => {
    if (!confirm("¿Eliminar este usuario?")) return;
    try {
      await apiFetch(`/users/${uuid}`, { method: "DELETE" });
      loadUsuarios();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <RequirePermission code="usuarios.ver">
    <div className="p-4 p-md-5">
      <div className="mb-4">
        <h1 className="fw-bold h3 mb-1">Usuarios</h1>
        <p className="text-secondary mb-0">
          Administra los usuarios del sistema y sus roles. El rol <strong>Administrador</strong> tiene acceso a todo;
          el resto depende de los permisos que traiga cada rol asignado.
        </p>
      </div>

      <div className="d-flex flex-column flex-sm-row gap-2 mb-3">
        <div className="flex-grow-1 position-relative">
          <FiSearch className="position-absolute text-secondary" style={{ top: "0.65rem", left: "0.75rem" }} />
          <input
            type="text"
            className="form-control rounded-3 ps-5"
            placeholder="Buscar por nombre, usuario o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadUsuarios()}
          />
        </div>
        {hasPermission("usuarios.crear") && (
          <button type="button" className="btn btn-brand rounded-3 text-nowrap d-flex align-items-center gap-1" onClick={() => setUsuarioModal({})}>
            <FiPlus /> Nuevo Usuario
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Estado</th>
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
              {!loading && usuarios.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-secondary py-4">
                    No hay usuarios registrados todavía.
                  </td>
                </tr>
              )}
              {!loading &&
                usuarios.map((usuario) => (
                  <tr key={usuario.uuid}>
                    <td>
                      <p className="fw-medium mb-0">
                        {usuario.nombre} {usuario.apellido}
                      </p>
                      <p className="small text-secondary mb-0">@{usuario.usuario}</p>
                    </td>
                    <td>{usuario.email}</td>
                    <td>
                      {(usuario.roles || []).length > 0 ? (
                        usuario.roles.map((rol) => (
                          <span key={rol.uuid} className="badge rounded-pill text-bg-light border me-1 mb-1">
                            {rol.nombre}
                          </span>
                        ))
                      ) : (
                        <span className="text-secondary small">Sin roles</span>
                      )}
                    </td>
                    <td>
                      {usuario.estado ? (
                        <span className="badge rounded-pill" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>
                          Activo
                        </span>
                      ) : (
                        <span className="badge rounded-pill text-bg-secondary">Inactivo</span>
                      )}
                    </td>
                    <td>
                      <div className="d-flex justify-content-end gap-2 flex-nowrap">
                        {hasPermission("usuarios.editar") && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-warning"
                            title="Editar"
                            onClick={() => setUsuarioModal(usuario)}
                          >
                            <FiEdit2 />
                          </button>
                        )}
                        {hasPermission("usuarios.asignar_rol") && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1 text-nowrap"
                            onClick={() => setRolesModal(usuario)}
                          >
                            <FiShield /> Roles
                          </button>
                        )}
                        {hasPermission("usuarios.eliminar") && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            title="Eliminar"
                            onClick={() => handleDelete(usuario.uuid)}
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

      {usuarioModal && (
        <UsuarioModal
          usuario={usuarioModal.uuid ? usuarioModal : null}
          onClose={() => setUsuarioModal(null)}
          onSaved={() => {
            setUsuarioModal(null);
            loadUsuarios();
          }}
        />
      )}

      {rolesModal && (
        <RolesModal
          usuario={rolesModal}
          onClose={() => setRolesModal(null)}
          onChanged={loadUsuarios}
        />
      )}
    </div>
    </RequirePermission>
  );
}

// ─── Modal: crear/editar usuario ───
function UsuarioModal({ usuario, onClose, onSaved }) {
  const [nombre, setNombre] = useState(usuario?.nombre || "");
  const [apellido, setApellido] = useState(usuario?.apellido || "");
  const [usuarioField, setUsuarioField] = useState(usuario?.usuario || "");
  const [email, setEmail] = useState(usuario?.email || "");
  const [password, setPassword] = useState("");
  const [estado, setEstado] = useState(usuario ? usuario.estado : true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body = {
        nombre,
        apellido,
        usuario: usuarioField,
        email,
        estado,
        ...(password ? { password } : {}),
      };
      await apiFetch(usuario ? `/users/${usuario.uuid}` : "/users", {
        method: usuario ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={usuario ? "Editar Usuario" : "Nuevo Usuario"} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="row g-2 mb-2">
          <div className="col-6">
            <label className="form-label small fw-medium">Nombre</label>
            <input
              type="text"
              required
              className="form-control rounded-3"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="col-6">
            <label className="form-label small fw-medium">Apellido</label>
            <input
              type="text"
              required
              className="form-control rounded-3"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
            />
          </div>
        </div>
        <div className="mb-2">
          <label className="form-label small fw-medium">Usuario</label>
          <input
            type="text"
            required
            minLength={3}
            className="form-control rounded-3"
            placeholder="Ej: jperez"
            value={usuarioField}
            onChange={(e) => setUsuarioField(e.target.value)}
          />
        </div>
        <div className="mb-2">
          <label className="form-label small fw-medium">Email</label>
          <input
            type="email"
            required
            className="form-control rounded-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="form-label small fw-medium">
            {usuario ? "Nueva contraseña (dejar en blanco para no cambiar)" : "Contraseña"}
          </label>
          <input
            type="password"
            required={!usuario}
            minLength={8}
            className="form-control rounded-3"
            placeholder="Mínimo 8 caracteres, letras y números"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="form-check mb-3">
          <input
            type="checkbox"
            className="form-check-input"
            id="usuarioEstado"
            checked={estado}
            onChange={(e) => setEstado(e.target.checked)}
          />
          <label className="form-check-label small" htmlFor="usuarioEstado">
            Activo
          </label>
        </div>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1" onClick={onClose}>
            <FiX /> Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn btn-brand rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1">
            <FiSave /> {saving ? "Guardando..." : "Guardar Usuario"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Modal: asignar roles a un usuario ───
function RolesModal({ usuario, onClose, onChanged }) {
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
      const [{ items: todosLosRoles }, misRoles] = await Promise.all([
        apiFetch(`/roles?limit=100`),
        apiFetch(`/users/${usuario.uuid}/roles`),
      ]);
      setAllItems(todosLosRoles.map((r) => ({ uuid: r.uuid, label: r.nombre, sublabel: r.descripcion })));
      const misItems = misRoles.map((r) => ({ uuid: r.uuid, label: r.nombre, sublabel: r.descripcion }));
      setSelected(misItems);
      setOriginalUuids(new Set(misItems.map((r) => r.uuid)));
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
        ...aAgregar.map((roleUuid) =>
          apiFetch(`/users/${usuario.uuid}/roles`, { method: "POST", body: JSON.stringify({ roleUuid }) }),
        ),
        ...aQuitar.map((roleUuid) => apiFetch(`/users/${usuario.uuid}/roles/${roleUuid}`, { method: "DELETE" })),
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
    <ModalShell title={`Roles de ${usuario.nombre} ${usuario.apellido}`} onClose={onClose}>
      <p className="small text-secondary mb-3">
        Los permisos del usuario dependen de los roles asignados aquí. El rol <strong>Administrador</strong> incluye
        todos los permisos del sistema.
      </p>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading ? (
        <p className="text-center text-secondary small py-4 mb-0">Cargando roles...</p>
      ) : (
        <TagPicker items={allItems} selected={selected} onChange={setSelected} placeholder="Buscar rol para agregar..." />
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
