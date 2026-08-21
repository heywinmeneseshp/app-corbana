"use client";

import { useEffect, useState } from "react";
import { FiCalendar, FiChevronRight, FiAlertTriangle, FiFilter, FiTrash2, FiSettings, FiPlus, FiX } from "react-icons/fi";
import { GiFarmTractor } from "react-icons/gi";
import { apiFetch } from "@/lib/api";
import { esAdministrador } from "@/lib/laborEstados";
import ModalShell from "@/components/ModalShell";
import VisitaLaborModal from "@/components/reportes/VisitaLaborModal";
import TagPicker from "@/components/TagPicker";

function nombreCompleto(u) {
  return `${u.nombre} ${u.apellido}`.trim();
}

// Listado de visitas de sanidad y labor cultural registradas desde la app
// móvil. Se muestra como pestaña dentro del módulo de Reportes.
export default function ReporteLabores() {
  const [fincas, setFincas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [semanas, setSemanas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [fincaUuid, setFincaUuid] = useState("");
  const [loteUuid, setLoteUuid] = useState("");
  const [semanaUuid, setSemanaUuid] = useState("");
  const [usuarioUuid, setUsuarioUuid] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const [visitas, setVisitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalConfig, setModalConfig] = useState(false);
  const [visitaModalUuid, setVisitaModalUuid] = useState(null);

  useEffect(() => {
    apiFetch("/fincas?limit=100")
      .then((data) => setFincas(data.items))
      .catch(() => {});
    apiFetch("/semanas?limit=100")
      .then((data) => setSemanas(data.items))
      .catch(() => {});
    apiFetch("/users?limit=100")
      .then((data) => setUsuarios(data.items))
      .catch(() => setUsuarios([])); // sin permiso para listar usuarios: el filtro queda oculto
  }, []);

  useEffect(() => {
    setLoteUuid("");
    if (!fincaUuid) {
      setLotes([]);
      return;
    }
    apiFetch(`/fincas/${fincaUuid}/lotes?limit=100&incluirGrupo=true`)
      .then((data) => setLotes(data.items))
      .catch(() => setLotes([]));
  }, [fincaUuid]);

  async function loadVisitas() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (fincaUuid) params.set("fincaUuid", fincaUuid);
      if (loteUuid) params.set("loteUuid", loteUuid);
      if (semanaUuid) params.set("semanaUuid", semanaUuid);
      if (usuarioUuid) params.set("usuarioUuid", usuarioUuid);
      if (fechaDesde) params.set("fechaDesde", fechaDesde);
      if (fechaHasta) params.set("fechaHasta", fechaHasta);
      const data = await apiFetch(`/labores-culturales/visitas?${params.toString()}`);
      setVisitas(data.items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVisitas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(visitaUuid) {
    if (!confirm("¿Eliminar esta visita de labor cultural? Esta acción no se puede deshacer.")) return;
    try {
      await apiFetch(`/labores-culturales/visitas/${visitaUuid}`, { method: "DELETE" });
      loadVisitas();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      {esAdministrador() && (
        <div className="d-flex justify-content-end mb-2">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary rounded-3 d-flex align-items-center gap-1"
            onClick={() => setModalConfig(true)}
            title="Configurar rol revisor"
          >
            <FiSettings /> Configurar rol revisor
          </button>
        </div>
      )}
      <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-6 col-md">
            <label className="form-label small fw-medium">Finca</label>
            <select className="form-select form-select-sm rounded-3" value={fincaUuid} onChange={(e) => setFincaUuid(e.target.value)}>
              <option value="">Todas</option>
              {fincas.map((f) => (
                <option key={f.uuid} value={f.uuid}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md">
            <label className="form-label small fw-medium">Lote</label>
            <select
              className="form-select form-select-sm rounded-3"
              value={loteUuid}
              disabled={!fincaUuid}
              onChange={(e) => setLoteUuid(e.target.value)}
            >
              <option value="">Todos</option>
              {lotes.map((l) => (
                <option key={l.uuid} value={l.uuid}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md">
            <label className="form-label small fw-medium">Semana</label>
            <select className="form-select form-select-sm rounded-3" value={semanaUuid} onChange={(e) => setSemanaUuid(e.target.value)}>
              <option value="">Todas</option>
              {semanas.map((s) => (
                <option key={s.uuid} value={s.uuid}>
                  {s.codigo}
                </option>
              ))}
            </select>
          </div>
          {usuarios.length > 0 && (
            <div className="col-6 col-md">
              <label className="form-label small fw-medium">Usuario</label>
              <select className="form-select form-select-sm rounded-3" value={usuarioUuid} onChange={(e) => setUsuarioUuid(e.target.value)}>
                <option value="">Todos</option>
                {usuarios.map((u) => (
                  <option key={u.uuid} value={u.uuid}>
                    {nombreCompleto(u)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="col-6 col-md">
            <label className="form-label small fw-medium">Desde</label>
            <input type="date" className="form-control form-control-sm rounded-3" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
          </div>
          <div className="col-6 col-md">
            <label className="form-label small fw-medium">Hasta</label>
            <input type="date" className="form-control form-control-sm rounded-3" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
          </div>
          <div className="col-12 col-md-auto">
            <button type="button" className="btn btn-sm btn-brand rounded-3 w-100 d-flex align-items-center justify-content-center gap-1" onClick={loadVisitas}>
              <FiFilter /> Filtrar
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {loading ? (
        <p className="text-secondary">Cargando...</p>
      ) : visitas.length === 0 ? (
        <p className="text-secondary">No hay visitas para estos filtros.</p>
      ) : (
        <div className="card border-0 shadow-sm rounded-4">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr className="text-secondary small">
                  <th className="ps-4">Fecha</th>
                  <th>Finca</th>
                  <th>Semana</th>
                  <th>Lotes</th>
                  <th>Responsable</th>
                  <th>Hallazgos</th>
                  {esAdministrador() && <th className="pe-4 text-end">Acciones</th>}
                  <th className="pe-4"></th>
                </tr>
              </thead>
              <tbody>
                {visitas.map((v) => (
                  <tr
                    key={v.visitaUuid}
                    role="button"
                    onClick={() => setVisitaModalUuid(v.visitaUuid)}
                  >
                    <td className="ps-4">
                      <span className="d-flex align-items-center gap-2">
                        <FiCalendar className="text-secondary" size={14} />
                        {v.fecha}
                      </span>
                    </td>
                    <td>
                      <span className="d-flex align-items-center gap-2">
                        <GiFarmTractor className="text-secondary" size={15} />
                        {v.fincaNombre || "—"}
                      </span>
                    </td>
                    <td>{v.semanaCodigo || "—"}</td>
                    <td>{v.totalLotes}</td>
                    <td>{v.usuarioNombre || "—"}</td>
                    <td>
                      {(Number(v.mokoPresente) === 1 || Number(v.fusariumPresente) === 1) ? (
                        <span className="badge rounded-pill text-bg-danger d-inline-flex align-items-center gap-1">
                          <FiAlertTriangle size={11} />
                          {Number(v.mokoPresente) === 1 && "Moko"}
                          {Number(v.mokoPresente) === 1 && Number(v.fusariumPresente) === 1 && " / "}
                          {Number(v.fusariumPresente) === 1 && "Fusarium"}
                        </span>
                      ) : (
                        <span className="badge rounded-pill text-bg-light text-secondary">Sin hallazgos</span>
                      )}
                    </td>
                    <td className="pe-4 text-end">
                      {esAdministrador() && (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger me-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(v.visitaUuid);
                          }}
                          title="Eliminar"
                        >
                          <FiTrash2 />
                        </button>
                      )}
                      <FiChevronRight className="text-secondary" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalConfig && <RevisorConfigModal onClose={() => setModalConfig(false)} />}

      {visitaModalUuid && (
        <VisitaLaborModal
          visitaUuid={visitaModalUuid}
          onClose={() => setVisitaModalUuid(null)}
          onChanged={loadVisitas}
        />
      )}
    </div>
  );
}

// ─── Modal: qué rol(es) pueden marcar una visita como revisada ───
function RevisorConfigModal({ onClose }) {
  const [roles, setRoles] = useState([]);
  const [usuariosDisponibles, setUsuariosDisponibles] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [rolTexto, setRolTexto] = useState("");
  const [loading, setLoading] = useState(true);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");
  const [ccTexto, setCcTexto] = useState("");
  const [ccRoles, setCcRoles] = useState([]);
  const [ccUsuarios, setCcUsuarios] = useState([]);
  const [guardandoCc, setGuardandoCc] = useState(false);
  const [ccGuardado, setCcGuardado] = useState(false);

  function labelRol(r) {
    return `${r.nombre} (${r.uuid})`;
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [{ items: todosLosRoles }, { items: todosLosUsuarios }, configsActuales, cc] = await Promise.all([
        apiFetch("/roles?limit=100"),
        apiFetch("/users?limit=100").catch(() => ({ items: [] })), // sin permiso para listar: el picker queda vacío
        apiFetch("/labores-culturales/revisor-config"),
        apiFetch("/labores-culturales/revisor-cc"),
      ]);
      setRoles(todosLosRoles);
      setUsuariosDisponibles(todosLosUsuarios);
      setConfigs(configsActuales);
      setCcTexto((cc.correos || []).join(", "));
      setCcRoles(
        todosLosRoles
          .filter((r) => (cc.rolesUuids || []).includes(r.uuid))
          .map((r) => ({ uuid: r.uuid, label: r.nombre })),
      );
      setCcUsuarios(
        todosLosUsuarios
          .filter((u) => (cc.usuariosUuids || []).includes(u.uuid))
          .map((u) => ({ uuid: u.uuid, label: nombreCompleto(u), sublabel: u.email })),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGuardarCc(e) {
    e.preventDefault();
    setGuardandoCc(true);
    setCcGuardado(false);
    setError("");
    const correos = ccTexto
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    try {
      await apiFetch("/labores-culturales/revisor-cc", {
        method: "PUT",
        body: JSON.stringify({
          correos,
          rolesUuids: ccRoles.map((r) => r.uuid),
          usuariosUuids: ccUsuarios.map((u) => u.uuid),
        }),
      });
      setCcGuardado(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoCc(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCrear(e) {
    e.preventDefault();
    const rol = roles.find((r) => labelRol(r) === rolTexto);
    if (!rol) {
      setError("Selecciona un rol válido de la lista.");
      return;
    }
    setCreando(true);
    setError("");
    try {
      await apiFetch("/labores-culturales/revisor-config", {
        method: "POST",
        body: JSON.stringify({ rolId: rol.id }),
      });
      setRolTexto("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  }

  async function handleToggle(uuid, activo) {
    try {
      await apiFetch(`/labores-culturales/revisor-config/${uuid}`, {
        method: "PUT",
        body: JSON.stringify({ activo: !activo }),
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleEliminar(uuid) {
    if (!confirm("¿Eliminar esta configuración?")) return;
    try {
      await apiFetch(`/labores-culturales/revisor-config/${uuid}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <ModalShell title="Configurar rol revisor" onClose={onClose}>
      <p className="small text-secondary mb-3">
        Solo los usuarios con alguno de estos roles (o el rol Administrador) pueden marcar una visita de Sanidad
        Vegetal como revisada. Además, cuando alguien con estos roles tenga acceso a la finca (o no tenga ninguna
        finca asignada), recibirá un correo automático al cargarse una evaluación y otro cuando se marque como
        revisada.
      </p>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <form onSubmit={handleCrear} className="d-flex gap-2 align-items-end mb-3">
        <div className="flex-grow-1">
          <label className="form-label small fw-medium">Rol</label>
          <input
            type="text"
            className="form-control"
            list="roles-revisor-datalist"
            placeholder="Escribe para buscar..."
            autoComplete="off"
            value={rolTexto}
            onChange={(e) => setRolTexto(e.target.value)}
            required
          />
          <datalist id="roles-revisor-datalist">
            {roles.map((r) => (
              <option key={r.id} value={labelRol(r)} />
            ))}
          </datalist>
        </div>
        <button type="submit" className="btn btn-brand rounded-3 d-flex align-items-center gap-1" disabled={creando}>
          <FiPlus /> {creando ? "..." : "Agregar"}
        </button>
      </form>

      {loading ? (
        <p className="text-secondary small mb-0">Cargando...</p>
      ) : configs.length === 0 ? (
        <p className="text-secondary small mb-0">Todavía no hay ningún rol configurado.</p>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr className="text-secondary small">
                <th>Rol</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c.uuid}>
                  <td>{c.rol_nombre}</td>
                  <td>
                    <div className="form-check form-switch mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={!!c.activo}
                        onChange={() => handleToggle(c.uuid, c.activo)}
                      />
                    </div>
                  </td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-link btn-sm text-danger p-0"
                      onClick={() => handleEliminar(c.uuid)}
                      title="Eliminar"
                    >
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <hr className="my-3" />

      <form onSubmit={handleGuardarCc}>
        <label className="form-label small fw-medium">Copia (CC) en los avisos por correo</label>
        <input
          type="text"
          className="form-control"
          placeholder="correo1@ejemplo.com, correo2@ejemplo.com"
          value={ccTexto}
          onChange={(e) => {
            setCcTexto(e.target.value);
            setCcGuardado(false);
          }}
        />
        <p className="form-text small text-secondary mb-0">
          Uno o varios correos separados por coma — reciben copia de ambos avisos (cargue y revisión aprobada),
          además de los usuarios con el rol configurado arriba.
        </p>

        <div className="mt-3">
          <label className="form-label small fw-medium">Roles en copia</label>
          <TagPicker
            items={roles.map((r) => ({ uuid: r.uuid, label: r.nombre }))}
            selected={ccRoles}
            onChange={(nuevos) => {
              setCcRoles(nuevos);
              setCcGuardado(false);
            }}
            placeholder="Buscar rol para agregar en copia..."
          />
          <p className="form-text small text-secondary mb-0">
            Cualquier usuario con este rol recibe copia, sin importar la finca.
          </p>
        </div>

        <div className="mt-3">
          <label className="form-label small fw-medium">Usuarios en copia</label>
          <TagPicker
            items={usuariosDisponibles.map((u) => ({ uuid: u.uuid, label: nombreCompleto(u), sublabel: u.email }))}
            selected={ccUsuarios}
            onChange={(nuevos) => {
              setCcUsuarios(nuevos);
              setCcGuardado(false);
            }}
            placeholder="Buscar usuario para agregar en copia..."
          />
        </div>

        <button type="submit" className="btn btn-outline-secondary rounded-3 w-100 mt-3" disabled={guardandoCc}>
          {guardandoCc ? "Guardando..." : "Guardar copia (CC)"}
        </button>
        {ccGuardado && <p className="small text-success mb-0 mt-1">Guardado.</p>}
      </form>

      <div className="d-flex mt-3">
        <button type="button" className="btn btn-outline-secondary rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1" onClick={onClose}>
          <FiX /> Cerrar
        </button>
      </div>
    </ModalShell>
  );
}