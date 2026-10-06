"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiTrash2, FiMap, FiCheck, FiX } from "react-icons/fi";
import ModalShell from "@/components/ModalShell";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";
import { hasPermission } from "@/lib/auth";

function hoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AreaLotesConfigPage() {
  const [configs, setConfigs] = useState([]);
  const [fincas, setFincas] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal "Nueva configuración": varios roles y varias fincas a la vez (una
  // configuración por cada combinación finca + rol, con la misma fecha y
  // recurrencia) para no crearlas una por una.
  const [modalOpen, setModalOpen] = useState(false);
  const [fincasSel, setFincasSel] = useState([]); // uuids
  const [rolesSel, setRolesSel] = useState([]); // ids (string)
  const [fechaObjetivo, setFechaObjetivo] = useState(hoyIso());
  const [recurrencia, setRecurrencia] = useState("UNA_VEZ");
  const [creando, setCreando] = useState(false);
  const [modalError, setModalError] = useState("");

  const RECURRENCIAS = [
    { valor: "UNA_VEZ", nombre: "Una vez" },
    { valor: "SEMANAL", nombre: "Semanal" },
    { valor: "QUINCENAL", nombre: "Quincenal" },
    { valor: "MENSUAL", nombre: "Mensual" },
  ];
  const nombreRecurrencia = (valor) => RECURRENCIAS.find((r) => r.valor === valor)?.nombre || "Una vez";

  // Solicitudes de cambio de área enviadas desde el modal por usuarios sin
  // permiso de aprobar (area_lote.aprobar).
  const puedeAprobar = hasPermission("area_lote.aprobar");
  const [solicitudes, setSolicitudes] = useState([]);
  const [resolviendo, setResolviendo] = useState("");

  const cargarSolicitudes = async () => {
    if (!puedeAprobar) return;
    try {
      setSolicitudes(await apiFetch("/lote-area-config/solicitudes?estado=PENDIENTE"));
    } catch (err) {
      setError(err.message);
    }
  };

  const resolverSolicitud = async (uuid, accion) => {
    let body = {};
    if (accion === "rechazar") {
      const motivo = prompt("Motivo del rechazo (opcional):");
      if (motivo === null) return;
      body = { motivo };
    } else if (!confirm("¿Aprobar este cambio? Se aplicará al lote.")) {
      return;
    }
    setResolviendo(uuid);
    try {
      await apiFetch(`/lote-area-config/solicitudes/${uuid}/${accion}`, { method: "POST", body: JSON.stringify(body) });
      await cargarSolicitudes();
    } catch (err) {
      setError(err.message);
    } finally {
      setResolviendo("");
    }
  };

  const cargarTodo = async () => {
    setLoading(true);
    setError("");
    try {
      const [configData, fincasData, rolesData] = await Promise.all([
        apiFetch("/lote-area-config?limit=50"),
        apiFetch("/fincas?limit=100"),
        // roles.ver es un permiso aparte de area_lote.ver/configurar — sin
        // él, el picker de rol del formulario "Nueva configuración" queda
        // vacío en vez de tumbar toda la pantalla (ver mismo caso en
        // Precipitación Diaria).
        apiFetch("/roles?limit=100").catch(() => ({ items: [] })),
      ]);
      setConfigs(configData.items);
      setFincas(fincasData.items);
      setRoles(rolesData.items);
      await cargarSolicitudes();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTodo();
  }, []);

  const abrirModal = () => {
    setFincasSel([]);
    setRolesSel([]);
    setFechaObjetivo(hoyIso());
    setRecurrencia("UNA_VEZ");
    setModalError("");
    setModalOpen(true);
  };

  const alternar = (lista, setLista, valor) =>
    setLista(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);

  const handleCrear = async (e) => {
    e.preventDefault();
    setModalError("");
    if (fincasSel.length === 0 || rolesSel.length === 0) {
      setModalError("Selecciona al menos una finca y un rol.");
      return;
    }
    setCreando(true);
    const fallos = [];
    // Una petición por combinación finca + rol: el backend actualiza la
    // existente en vez de duplicarla.
    for (const fUuid of fincasSel) {
      for (const rId of rolesSel) {
        try {
          await apiFetch("/lote-area-config", {
            method: "POST",
            body: JSON.stringify({ fincaUuid: fUuid, rolId: Number(rId), fechaObjetivo, recurrencia }),
          });
        } catch (err) {
          const finca = fincas.find((f) => f.uuid === fUuid)?.nombre || fUuid;
          const rol = roles.find((r) => String(r.id) === String(rId))?.nombre || rId;
          fallos.push(`${finca} / ${rol}: ${err.message}`);
        }
      }
    }
    await cargarTodo();
    setCreando(false);
    if (fallos.length > 0) {
      setModalError(`No se pudieron guardar ${fallos.length}: ${fallos.join("; ")}`);
      return;
    }
    setModalOpen(false);
  };

  const handleToggle = async (uuid, activo) => {
    try {
      await apiFetch(`/lote-area-config/${uuid}`, { method: "PUT", body: JSON.stringify({ activo: !activo }) });
      await cargarTodo();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEliminar = async (uuid) => {
    if (!confirm("¿Eliminar esta configuración?")) return;
    try {
      await apiFetch(`/lote-area-config/${uuid}`, { method: "DELETE" });
      await cargarTodo();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <RequirePermission code="menu.maestros.area_lotes">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
            <FiMap className="text-primary" /> Área de Lotes
          </h1>
          <p className="text-secondary mb-0">
            Programa qué rol debe confirmar el área total y en producción de cada lote de una finca, a partir de qué
            fecha y cada cuánto se repite. Si ya existe configuración para esa finca y rol, se actualiza la fecha en
            vez de duplicarla. Al cumplirse, la opción de una sola vez se desactiva sola y las demás programan
            solas la siguiente fecha.
          </p>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        {puedeAprobar && solicitudes.length > 0 && (
          <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="card-body p-4">
              <h2 className="h6 fw-semibold mb-3">Cambios pendientes de aprobación ({solicitudes.length})</h2>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr className="text-secondary small">
                      <th>Finca</th>
                      <th>Lote</th>
                      <th>Solicitó</th>
                      <th>Fecha</th>
                      <th className="text-end">Total actual → nuevo (Ha)</th>
                      <th className="text-end">En producción (Ha)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {solicitudes.map((sol) => (
                      <tr key={sol.uuid}>
                        <td>{sol.finca?.nombre}</td>
                        <td>{sol.lote?.nombre}</td>
                        <td>{sol.solicitante || "—"}</td>
                        <td>{sol.fechaSolicitud}</td>
                        <td className="text-end">
                          {sol.areaActual ?? "—"} → <strong>{sol.areaTotal}</strong>
                        </td>
                        <td className="text-end">{sol.areaProduccion}</td>
                        <td className="text-end text-nowrap">
                          <button
                            type="button"
                            className="btn btn-link btn-sm text-success p-0 me-3"
                            disabled={resolviendo === sol.uuid}
                            onClick={() => resolverSolicitud(sol.uuid, "aprobar")}
                            title="Aprobar"
                          >
                            <FiCheck /> Aprobar
                          </button>
                          <button
                            type="button"
                            className="btn btn-link btn-sm text-danger p-0"
                            disabled={resolviendo === sol.uuid}
                            onClick={() => resolverSolicitud(sol.uuid, "rechazar")}
                            title="Rechazar"
                          >
                            <FiX /> Rechazar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {hasPermission("area_lote.configurar") && (
          <div className="mb-4">
            <button type="button" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-1" onClick={abrirModal}>
              <FiPlus /> Nueva configuración
            </button>
          </div>
        )}

        {modalOpen && (
          <ModalShell title="Nueva configuración" onClose={() => setModalOpen(false)} size="lg">
            <form onSubmit={handleCrear}>
              <p className="text-secondary small">
                Elige uno o varios roles y una o varias fincas: se crea una configuración por cada combinación, todas con
                la misma fecha y recurrencia. Si ya existe, se actualiza.
              </p>

              <div className="mb-3">
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <label className="form-label small fw-medium mb-0">Roles ({rolesSel.length})</label>
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 text-decoration-none"
                    onClick={() => setRolesSel(rolesSel.length === roles.length ? [] : roles.map((r) => String(r.id)))}
                  >
                    {rolesSel.length === roles.length ? "Quitar todos" : "Todos"}
                  </button>
                </div>
                <div className="border rounded-3 p-2" style={{ maxHeight: 140, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.4rem 0.75rem" }}>
                  {roles.length === 0 && <span className="text-secondary small">No hay roles disponibles.</span>}
                  {roles.map((r) => (
                    <label key={r.id} className="form-check m-0 small text-nowrap">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={rolesSel.includes(String(r.id))}
                        onChange={() => alternar(rolesSel, setRolesSel, String(r.id))}
                      />{" "}
                      <span className="form-check-label">{r.nombre}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <label className="form-label small fw-medium mb-0">Fincas ({fincasSel.length})</label>
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 text-decoration-none"
                    onClick={() => setFincasSel(fincasSel.length === fincas.length ? [] : fincas.map((f) => f.uuid))}
                  >
                    {fincasSel.length === fincas.length ? "Quitar todas" : "Todas"}
                  </button>
                </div>
                <div className="border rounded-3 p-2 d-flex flex-column gap-1" style={{ maxHeight: 200, overflowY: "auto" }}>
                  {fincas.map((f) => (
                    <label key={f.uuid} className="form-check m-0 small">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={fincasSel.includes(f.uuid)}
                        onChange={() => alternar(fincasSel, setFincasSel, f.uuid)}
                      />{" "}
                      <span className="form-check-label">
                        {f.codigo} — {f.nombre}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="row g-2 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-medium">Fecha objetivo</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={fechaObjetivo}
                    onChange={(e) => setFechaObjetivo(e.target.value)}
                    required
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Se repite</label>
                  <select className="form-select form-select-sm" value={recurrencia} onChange={(e) => setRecurrencia(e.target.value)}>
                    {RECURRENCIAS.map((r) => (
                      <option key={r.valor} value={r.valor}>
                        {r.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {modalError && <div className="alert alert-danger py-2 small">{modalError}</div>}

              <div className="d-flex justify-content-between align-items-center">
                <span className="text-secondary small">Se guardarán {fincasSel.length * rolesSel.length} configuración(es)</span>
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => setModalOpen(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-brand btn-sm rounded-3" disabled={creando}>
                    {creando ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            </form>
          </ModalShell>
        )}

        {loading ? (
          <p className="text-secondary">Cargando...</p>
        ) : (
          <div className="card border-0 shadow-sm rounded-4">
            <div className="card-body p-4">
              <h2 className="h6 fw-semibold mb-3">Configuración</h2>
              {configs.length === 0 ? (
                <p className="text-secondary small mb-0">Todavía no hay ninguna configuración.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr className="text-secondary small">
                        <th>Finca</th>
                        <th>Rol</th>
                        <th>Fecha objetivo</th>
                        <th>Se repite</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {configs.map((c) => (
                        <tr key={c.uuid}>
                          <td>{c.finca?.nombre}</td>
                          <td>{c.rol?.nombre}</td>
                          <td>{c.fechaObjetivo}</td>
                          <td>{nombreRecurrencia(c.recurrencia)}</td>
                          <td>
                            {hasPermission("area_lote.configurar") ? (
                              <div className="form-check form-switch mb-0">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={!!c.activo}
                                  onChange={() => handleToggle(c.uuid, c.activo)}
                                />
                              </div>
                            ) : (
                              <span className={`badge rounded-pill ${c.activo ? "text-bg-success" : "text-bg-secondary"}`}>
                                {c.activo ? "Activo" : "Inactivo"}
                              </span>
                            )}
                          </td>
                          <td className="text-end">
                            {hasPermission("area_lote.configurar") && (
                              <button
                                type="button"
                                className="btn btn-link btn-sm text-danger p-0"
                                onClick={() => handleEliminar(c.uuid)}
                                title="Eliminar"
                              >
                                <FiTrash2 />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </RequirePermission>
  );
}
