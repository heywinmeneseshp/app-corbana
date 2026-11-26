"use client";

import { useEffect, useMemo, useState } from "react";
import { FiPlus, FiUser } from "react-icons/fi";
import { apiFetch, apiFetchTodos } from "@/lib/api";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import BotonConfiguracion from "@/components/BotonConfiguracion";
import ModalShell from "@/components/ModalShell";

// Usuarios de los colaboradores (Maestros → Colaboradores; sin `modulo`, de todos los módulos): lista los que tienen usuario y permite
// crear el usuario de uno que no tiene. El usuario queda vinculado al colaborador y SOLO con el rol que configuró el
// administrador (tuerca de la pestaña Usuarios); basta con poder editar colaboradores.
const P = {
  SANIDAD_VEGETAL: "sanidad_vegetal.colaboradores.editar",
  GENERAL: "colaborador.editar",
};

export default function UsuariosColaboradores({ modulo = null }) {
  const [colaboradores, setColaboradores] = useState([]);
  const [rol, setRol] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [buscar, setBuscar] = useState("");
  const [nuevo, setNuevo] = useState(null); // { colaboradorUuid, usuario, password, email, guardando, error }
  const puedeCrear = hasPermission(P[modulo] || P.GENERAL);
  // Tuerca (solo el administrador): rol con el que se crean los usuarios. { roles, rolUuid, guardando, error } mientras se configura.
  const esAdmin = (getCurrentUser()?.roles || []).includes("Administrador");
  const [configRol, setConfigRol] = useState(null);
  const abrirConfig = () => {
    setConfigRol({ roles: [], rolUuid: rol?.uuid || "", guardando: false, error: "" });
    apiFetch("/roles?limit=100")
      .then((d) => setConfigRol((c) => (c ? { ...c, roles: d.items || [] } : c)))
      .catch((err) => setConfigRol((c) => (c ? { ...c, error: err.message } : c)));
  };
  const guardarConfig = async () => {
    setConfigRol((c) => ({ ...c, guardando: true, error: "" }));
    try {
      const d = await apiFetch("/colaboradores/config/rol-usuarios", { method: "PUT", body: JSON.stringify({ rolUuid: configRol.rolUuid || null }) });
      setRol(d?.rol || null);
      setConfigRol(null);
    } catch (err) {
      setConfigRol((c) => ({ ...c, guardando: false, error: err.message }));
    }
  };

  async function cargar() {
    setCargando(true);
    setError("");
    try {
      const [lista, cfg] = await Promise.all([
        apiFetchTodos(`/colaboradores?limit=100${modulo ? `&modulo=${modulo}` : ""}`),
        apiFetch("/colaboradores/config/rol-usuarios").catch(() => ({ rol: null })),
      ]);
      setColaboradores(lista.items || []);
      setRol(cfg?.rol || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modulo]);

  const nombre = (c) => `${c.nombre} ${c.apellido || ""}`.trim();
  const conUsuario = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    return colaboradores
      .filter((c) => c.usuario)
      .filter((c) => !q || `${nombre(c)} ${c.usuario.usuario} ${c.usuario.email || ""}`.toLowerCase().includes(q))
      .sort((a, b) => nombre(a).localeCompare(nombre(b), "es"));
  }, [colaboradores, buscar]);
  const sinUsuario = useMemo(() => colaboradores.filter((c) => !c.usuario && c.estado).sort((a, b) => nombre(a).localeCompare(nombre(b), "es")), [colaboradores]);

  async function crear(e) {
    e.preventDefault();
    setNuevo((n) => ({ ...n, guardando: true, error: "" }));
    try {
      await apiFetch(`/colaboradores/${nuevo.colaboradorUuid}/usuario`, {
        method: "POST",
        body: JSON.stringify({ usuario: nuevo.usuario, password: nuevo.password, ...(nuevo.email ? { email: nuevo.email } : {}) }),
      });
      setNuevo(null);
      cargar();
    } catch (err) {
      setNuevo((n) => ({ ...n, guardando: false, error: err.message }));
    }
  }

  // Activar / desactivar el usuario (al desactivarlo se cierran sus sesiones).
  const [cambiando, setCambiando] = useState(null);
  async function cambiarEstado(c) {
    const activar = c.usuario.estado === false;
    if (!window.confirm(`¿${activar ? "Activar" : "Desactivar"} el usuario ${c.usuario.usuario} de ${nombre(c)}?${activar ? "" : " Se cerrarán sus sesiones y no podrá ingresar."}`)) return;
    setCambiando(c.uuid);
    setError("");
    try {
      await apiFetch(`/colaboradores/${c.uuid}/usuario/estado`, { method: "PUT", body: JSON.stringify({ estado: activar }) });
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setCambiando(null);
    }
  }

  const elegido = nuevo ? colaboradores.find((c) => c.uuid === nuevo.colaboradorUuid) : null;

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <input
          type="search"
          className="form-control form-control-sm rounded-3"
          style={{ maxWidth: 280 }}
          placeholder="Buscar por nombre, usuario o correo"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />
        <span className="small text-secondary">
          Rol de los usuarios nuevos: <strong>{rol ? rol.nombre : "sin configurar"}</strong>
        </span>
        <div className="ms-auto d-flex align-items-center gap-2">
          {esAdmin && <BotonConfiguracion soloIcono title="Configurar el rol de los usuarios creados desde Colaboradores" onClick={abrirConfig} />}
          {puedeCrear && (
            <button
              type="button"
              className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-2"
              disabled={!rol}
              title={rol ? "Crear el usuario de un colaborador" : "El administrador todavía no configuró el rol (tuerca ⚙ de esta pestaña)"}
              onClick={() => setNuevo({ colaboradorUuid: "", usuario: "", password: "", email: "", guardando: false, error: "" })}
            >
              <FiPlus /> Nuevo usuario
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {cargando ? (
        <p className="text-secondary small">Cargando...</p>
      ) : conUsuario.length === 0 ? (
        <p className="text-secondary small">Ningún colaborador tiene usuario todavía.</p>
      ) : (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="table-responsive">
            <table className="table table-sm table-hover align-middle mb-0">
              <thead>
                <tr className="small text-secondary">
                  <th className="ps-3">Colaborador</th>
                  <th>Usuario</th>
                  <th>Correo</th>
                  <th>Cargo</th>
                  <th>Estado</th>
                  {puedeCrear && <th className="pe-3 text-end"></th>}
                </tr>
              </thead>
              <tbody>
                {conUsuario.map((c) => (
                  <tr key={c.uuid}>
                    <td className="ps-3">
                      <span className="d-flex align-items-center gap-2">
                        <FiUser className="text-secondary" size={14} />
                        {nombre(c)}
                      </span>
                    </td>
                    <td className="fw-semibold">{c.usuario.usuario}</td>
                    <td className="small">{c.usuario.email || "—"}</td>
                    <td className="small">{c.cargo || "—"}</td>
                    <td>
                      {c.usuario.estado === false ? (
                        <span className="badge rounded-pill text-bg-secondary">Inactivo</span>
                      ) : (
                        <span className="badge rounded-pill text-bg-success">Activo</span>
                      )}
                    </td>
                    {puedeCrear && (
                      <td className="pe-3 text-end">
                        <button
                          type="button"
                          className={`btn btn-link btn-sm p-0 text-decoration-none ${c.usuario.estado === false ? "text-success" : "text-danger"}`}
                          disabled={cambiando === c.uuid}
                          onClick={() => cambiarEstado(c)}
                        >
                          {cambiando === c.uuid ? "..." : c.usuario.estado === false ? "Activar" : "Desactivar"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {configRol && (
        <ModalShell title="Rol de los usuarios creados desde Colaboradores" onClose={() => setConfigRol(null)}>
          <p className="small text-secondary">
            Quien puede editar colaboradores podrá crearles un usuario, que quedará solo con este rol. Elige un rol con los permisos justos.
          </p>
          <select
            className="form-select form-select-sm rounded-3 mb-2"
            value={configRol.rolUuid}
            onChange={(e) => setConfigRol((c) => ({ ...c, rolUuid: e.target.value }))}
          >
            <option value="">Sin configurar (no se pueden crear usuarios)</option>
            {configRol.roles.map((x) => (
              <option key={x.uuid} value={x.uuid}>
                {x.nombre}
              </option>
            ))}
          </select>
          {configRol.roles.find((x) => x.uuid === configRol.rolUuid)?.nombre === "Administrador" && (
            <div className="alert alert-warning py-2 small">Ojo: con este rol, quien edita colaboradores podría crear administradores.</div>
          )}
          {configRol.error && <div className="alert alert-danger py-2 small">{configRol.error}</div>}
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => setConfigRol(null)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-brand btn-sm rounded-3" disabled={configRol.guardando} onClick={guardarConfig}>
              {configRol.guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </ModalShell>
      )}

      {nuevo && (
        <ModalShell title="Nuevo usuario" onClose={() => setNuevo(null)}>
          <form onSubmit={crear}>
            <div className="mb-3">
              <label className="form-label small fw-medium">
                Colaborador <span className="text-danger">*</span>
              </label>
              <select
                className="form-select form-select-sm rounded-3"
                required
                value={nuevo.colaboradorUuid}
                onChange={(e) => {
                  const c = colaboradores.find((x) => x.uuid === e.target.value);
                  setNuevo((n) => ({ ...n, colaboradorUuid: e.target.value, email: n.email || c?.email || "" }));
                }}
              >
                <option value="">Selecciona el colaborador…</option>
                {sinUsuario.map((c) => (
                  <option key={c.uuid} value={c.uuid}>
                    {nombre(c)}
                    {c.documento ? ` · CC ${c.documento}` : ""}
                  </option>
                ))}
              </select>
              <div className="small text-secondary mt-1">El usuario toma el nombre, apellido y cargo del colaborador. Solo aparecen los que no tienen usuario.</div>
            </div>
            <div className="row g-3 mb-3">
              <div className="col-6">
                <label className="form-label small fw-medium">
                  Usuario <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm rounded-3"
                  required
                  minLength={3}
                  maxLength={50}
                  value={nuevo.usuario}
                  onChange={(e) => setNuevo((n) => ({ ...n, usuario: e.target.value.replace(/[^a-zA-Z0-9]/g, "") }))}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-medium">
                  Contraseña <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  className="form-control form-control-sm rounded-3"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={nuevo.password}
                  onChange={(e) => setNuevo((n) => ({ ...n, password: e.target.value }))}
                />
                <div className="small text-secondary">Mínimo 8, con letras y números.</div>
              </div>
              <div className="col-12">
                <label className="form-label small fw-medium">Correo {elegido && !elegido.email ? <span className="text-danger">*</span> : null}</label>
                <input
                  type="email"
                  className="form-control form-control-sm rounded-3"
                  required={Boolean(elegido && !elegido.email)}
                  value={nuevo.email}
                  onChange={(e) => setNuevo((n) => ({ ...n, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="alert alert-light border py-2 small">
              Se creará con el rol <strong>{rol?.nombre}</strong> (lo configura el administrador).
            </div>
            {nuevo.error && <div className="alert alert-danger py-2 small">{nuevo.error}</div>}
            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => setNuevo(null)}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-brand btn-sm rounded-3" disabled={nuevo.guardando}>
                {nuevo.guardando ? "Creando..." : "Crear usuario"}
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}
