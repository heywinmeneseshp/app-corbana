"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiSearch, FiEdit2, FiShield, FiSave, FiX, FiMapPin, FiToggleLeft, FiToggleRight, FiCheck, FiRefreshCw } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import ModalShell from "@/components/ModalShell";
import TagPicker from "@/components/TagPicker";
import RequirePermission from "@/components/RequirePermission";

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [usuarioModal, setUsuarioModal] = useState(null); // null | {} | usuario
  const [rolesModal, setRolesModal] = useState(null); // null | usuario
  const [fincasModal, setFincasModal] = useState(null); // null | usuario

  const [selected, setSelected] = useState(new Set());
  const [resetModal, setResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState(null);

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

  const handleToggleEstado = async (usuario) => {
    const nuevoEstado = !usuario.estado;
    const accion = nuevoEstado ? "activar" : "desactivar";
    if (!confirm(`¿${accion} a ${usuario.nombre} ${usuario.apellido}?`)) return;
    try {
      await apiFetch(`/users/${usuario.uuid}`, {
        method: "PUT",
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      loadUsuarios();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleAll = () => {
    if (selected.size === usuarios.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(usuarios.map((u) => u.uuid)));
    }
  };

  const toggleOne = (uuid) => {
    const next = new Set(selected);
    if (next.has(uuid)) next.delete(uuid);
    else next.add(uuid);
    setSelected(next);
  };

  const handleBulkReset = async () => {
    setResetting(true);
    setResetResult(null);
    try {
      const r = await apiFetch("/users/bulk-reset-password", {
        method: "POST",
        body: JSON.stringify({ uuids: [...selected] }),
      });
      setResetResult(r);
    } catch (err) {
      setError(err.message);
      setResetResult(null);
    } finally {
      setResetting(false);
    }
  };

  const closeResetModal = () => {
    setResetModal(false);
    setResetResult(null);
    setSelected(new Set());
    loadUsuarios();
  };

  return (
    <RequirePermission code="menu.maestros.usuarios">
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
        <button type="button" className="btn btn-brand rounded-3 text-nowrap d-flex align-items-center gap-1" onClick={() => setUsuarioModal({})}>
          <FiPlus /> Nuevo Usuario
        </button>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th style={{ width: 40 }}>
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={selected.size > 0 && selected.size === usuarios.length}
                      ref={(el) => { if (el) el.indeterminate = selected.size > 0 && selected.size < usuarios.length; }}
                      onChange={toggleAll}
                    />
                  </div>
                </th>
                <th>Usuario</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Fincas</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="text-center text-secondary py-4">
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && usuarios.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-secondary py-4">
                    No hay usuarios registrados todavía.
                  </td>
                </tr>
              )}
              {!loading &&
                usuarios.map((usuario) => (
                  <tr key={usuario.uuid}>
                    <td>
                      <div className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={selected.has(usuario.uuid)}
                          onChange={() => toggleOne(usuario.uuid)}
                        />
                      </div>
                    </td>
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
                      {(usuario.fincas || []).length > 0 ? (
                        usuario.fincas.map((f) => (
                          <span key={f.uuid} className="badge rounded-pill text-bg-light border me-1 mb-1">
                            {f.codigo}
                          </span>
                        ))
                      ) : (
                        <span className="text-secondary small">Sin fincas</span>
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
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-warning"
                          title="Editar"
                          onClick={() => setUsuarioModal(usuario)}
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1 text-nowrap"
                          onClick={() => setRolesModal(usuario)}
                        >
                          <FiShield /> Roles
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1 text-nowrap"
                          onClick={() => setFincasModal(usuario)}
                        >
                          <FiMapPin /> Fincas
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm border-0 ${usuario.estado ? "text-secondary" : "text-success"}`}
                          title={usuario.estado ? "Desactivar" : "Activar"}
                          onClick={() => handleToggleEstado(usuario)}
                        >
                          {usuario.estado ? <FiToggleLeft /> : <FiToggleRight />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="d-flex align-items-center gap-2 mb-3 p-2 bg-light rounded-3 border">
          <span className="small text-secondary fw-medium">{selected.size} seleccionado(s)</span>
          <button
            type="button"
            className="btn btn-sm btn-brand d-inline-flex align-items-center gap-1"
            onClick={() => setResetModal(true)}
          >
            <FiRefreshCw /> Restablecer contraseña
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
            onClick={() => setSelected(new Set())}
          >
            <FiX /> Limpiar
          </button>
        </div>
      )}

      {resetModal && (
        <ModalShell title="Restablecer contraseñas" onClose={() => setResetModal(false)}>
          {resetResult ? (
            <div>
              <p className="small text-secondary mb-3">
                Resultado del restablecimiento para {resetResult.data?.length ?? 0} usuario(s):
              </p>
              <div className="mb-3" style={{ maxHeight: 240, overflowY: "auto" }}>
                {(resetResult.data || []).map((r) => (
                  <div key={r.uuid} className="d-flex align-items-center gap-2 mb-1 small">
                    {r.ok ? (
                      <FiCheck className="text-success flex-shrink-0" />
                    ) : (
                      <FiX className="text-danger flex-shrink-0" />
                    )}
                    <span>
                      <strong>{r.usuario}</strong> — {r.email}
                      {!r.ok && <span className="text-danger ms-1">(error al enviar correo)</span>}
                    </span>
                  </div>
                ))}
              </div>
              <div className="d-flex">
                <button
                  type="button"
                  className="btn btn-brand rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1"
                  onClick={closeResetModal}
                >
                  <FiCheck /> Listo
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="small text-secondary mb-3">
                Se restablecerá la contraseña de <strong>{selected.size} usuario(s)</strong>. Recibirán un correo con
                su nueva contraseña y se les pedirá cambiarla. ¿Continuar?
              </p>
              {error && <div className="alert alert-danger py-2 small">{error}</div>}
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1"
                  onClick={() => setResetModal(false)}
                >
                  <FiX /> Cancelar
                </button>
                <button
                  type="button"
                  disabled={resetting}
                  className="btn btn-brand rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1"
                  onClick={handleBulkReset}
                >
                  <FiRefreshCw /> {resetting ? "Restableciendo..." : "Sí, restablecer"}
                </button>
              </div>
            </div>
          )}
        </ModalShell>
      )}

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

      {fincasModal && (
        <FincasModal
          usuario={fincasModal}
          onClose={() => setFincasModal(null)}
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
  const [cargo, setCargo] = useState(usuario?.cargo || "");
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
        cargo: cargo || null,
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
        <div className="mb-2">
          <label className="form-label small fw-medium">Cargo</label>
          <input
            type="text"
            className="form-control rounded-3"
            placeholder="Ej: Ingeniero Agrónomo"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
          />
          <p className="form-text small text-secondary mb-0">
            Se usa para las firmas de documentos (ej. visitas de Sanidad Vegetal), en vez del rol del sistema.
          </p>
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

// ─── Modal: asignar fincas a un usuario ───
// Un usuario solo puede ver/administrar los datos de las fincas asignadas
// aquí (salvo que sea Administrador, que ve todas sin restricción). Un
// usuario sin ninguna finca asignada no ve ningún dato hasta que se le
// asigne al menos una.
function FincasModal({ usuario, onClose, onChanged }) {
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
        apiFetch(`/users/${usuario.uuid}/fincas`),
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
          apiFetch(`/users/${usuario.uuid}/fincas`, { method: "POST", body: JSON.stringify({ fincaUuid }) }),
        ),
        ...aQuitar.map((fincaUuid) => apiFetch(`/users/${usuario.uuid}/fincas/${fincaUuid}`, { method: "DELETE" })),
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
    <ModalShell title={`Fincas de ${usuario.nombre} ${usuario.apellido}`} onClose={onClose}>
      <p className="small text-secondary mb-3">
        Sin ninguna finca seleccionada aquí, el usuario ve todas (sin restricción). En cuanto le asignes al menos
        una, queda restringido a ver y administrar (según sus permisos) solo los datos de esas fincas. El rol{" "}
        <strong>Administrador</strong> siempre ve todas las fincas sin restricción, sin importar lo que se elija
        aquí.
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
