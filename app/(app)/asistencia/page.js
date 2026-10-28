"use client";

import { useCallback, useEffect, useState } from "react";
import { FiCamera, FiMapPin, FiShield, FiTrash2, FiUserCheck } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import InfoTooltip from "@/components/reportes/InfoTooltip";
import MarcarAsistenciaModal from "@/components/asistencia/MarcarAsistenciaModal";
import ProbarRostroModal from "@/components/asistencia/ProbarRostroModal";
import JornadasAsistencia from "@/components/asistencia/JornadasAsistencia";
import LugaresModal from "@/components/asistencia/LugaresModal";
import { EtiquetaLugar, SelectorUbicacion, aParametros, nombreUbicacion } from "@/components/asistencia/ubicaciones";
import MiRegistro from "@/components/asistencia/MiRegistro";
import SolicitudesRostroModal from "@/components/asistencia/SolicitudesRostroModal";

// `ubicacion`: "f:<uuid>" (finca) o "l:<uuid>" (oficina u otro lugar).
const FILTROS_VACIOS = { ubicacion: "", colaboradorUuid: "", tipo: "", desde: "", hasta: "" };

const formatoFechaHora = (iso) =>
  new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bogota" });

const etiquetaColaborador = (c) => `${c.nombre} ${c.apellido || ""}${c.documento ? ` · ${c.documento}` : ""}`.replace(/\s+·/, " ·").trim();

// Asistencia: marcaciones de entrada/salida de los colaboradores, verificadas por reconocimiento facial desde la app de
// campo o desde aquí con la webcam (no se guardan fotos). Misma estética de filtros y tabla que el resto de módulos.
export default function AsistenciaPage() {
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [aplicados, setAplicados] = useState(FILTROS_VACIOS);
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState({ items: [], meta: null });
  const [fincas, setFincas] = useState([]);
  const [lugares, setLugares] = useState([]);
  const [colaboradores, setColaboradores] = useState([]);
  const [textoColaborador, setTextoColaborador] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null); // "marcar" | "probar" | "lugares" | "solicitudes"
  const [solicitudesN, setSolicitudesN] = useState(0);
  // Sin «Ver asistencia» (solo marca): la API devuelve únicamente lo suyo; aquí se ocultan los filtros de otras personas.
  const veTodo = hasPermission("asistencia.ver");
  const puedeMarcar = hasPermission("asistencia.marcar") || hasPermission("asistencia.marcar_cuadrilla");
  const puedeAprobar = hasPermission("asistencia.aprobar_rostro");
  const [tab, setTab] = useState("marcaciones"); // "marcaciones" | "jornadas"

  useEffect(() => {
    apiFetch("/fincas?limit=100").then(({ items }) => setFincas(items)).catch(() => {});
    if (veTodo) apiFetch("/colaboradores?limit=100").then(({ items }) => setColaboradores(items)).catch(() => {});
    cargarLugares();
    contarSolicitudes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function contarSolicitudes() {
    if (puedeAprobar) apiFetch("/asistencia/rostros/solicitudes").then((l) => setSolicitudesN(l.length)).catch(() => {});
  }

  function cargarLugares() {
    apiFetch("/asistencia/lugares").then(setLugares).catch(() => {});
  }

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const qs = new URLSearchParams({ page: String(pagina), limit: "50" });
      const { ubicacion, ...resto } = aplicados;
      for (const [k, v] of Object.entries({ ...resto, ...aParametros(ubicacion) })) if (v) qs.set(k, v);
      setDatos(await apiFetch(`/asistencia?${qs}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [aplicados, pagina]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function eliminar(m) {
    if (!window.confirm(`¿Eliminar la marcación de ${m.colaborador?.nombre || "este colaborador"}?`)) return;
    try {
      await apiFetch(`/asistencia/${m.uuid}`, { method: "DELETE" });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  const cambiar = (campo, valor) => setFiltros((f) => ({ ...f, [campo]: valor }));
  const aplicar = () => {
    setPagina(1);
    setAplicados(filtros);
  };
  const limpiar = () => {
    setFiltros(FILTROS_VACIOS);
    setTextoColaborador("");
    setPagina(1);
    setAplicados(FILTROS_VACIOS);
  };

  const { items, meta } = datos;

  return (
    <RequirePermission code="menu.asistencia">
      <div className="p-3 p-md-4">
        <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4">
          <div>
            <h1 className="fw-bold h4 mb-1">{veTodo ? "Asistencia" : "Mi asistencia"}</h1>
            <p className="text-secondary mb-0">
              {veTodo
                ? "Entradas y salidas verificadas por reconocimiento facial, desde la app de campo o desde aquí con la cámara."
                : "Tus entradas y salidas. En este equipo cualquier persona con rostro registrado puede marcar la suya."}
            </p>
          </div>
          <div className="d-flex flex-wrap gap-2">
            {puedeAprobar && (
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2" onClick={() => setModal("solicitudes")} title="Nuevos registros de rostro por aprobar">
                <FiShield /> Solicitudes de rostro
                {solicitudesN > 0 && <span className="badge rounded-pill text-bg-warning">{solicitudesN}</span>}
              </button>
            )}
            {hasPermission("asistencia.lugares") && (
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2" onClick={() => setModal("lugares")} title="Oficinas y otros lugares donde se marca">
                <FiMapPin /> Lugares
              </button>
            )}
            {hasPermission("asistencia.marcar_cuadrilla") && (
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2" onClick={() => setModal("probar")}>
                <FiUserCheck /> Probar rostro
              </button>
            )}
            {puedeMarcar && (
              <button type="button" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-2" onClick={() => setModal("marcar")}>
                <FiCamera /> Marcar asistencia
              </button>
            )}
          </div>
        </div>

        {puedeMarcar && <MiRegistro fincas={fincas} />}

        <ul className="nav nav-tabs mb-3">
          <li className="nav-item">
            <button type="button" className={`nav-link btn-sm py-1 ${tab === "marcaciones" ? "active" : ""}`} onClick={() => setTab("marcaciones")}>
              Marcaciones
            </button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link btn-sm py-1 ${tab === "jornadas" ? "active" : ""}`} onClick={() => setTab("jornadas")}>
              Jornadas
            </button>
          </li>
        </ul>

        {tab === "jornadas" ? (
          <JornadasAsistencia fincas={fincas} lugares={lugares} colaboradores={colaboradores} veTodo={veTodo} />
        ) : (
          <>
          <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
            <div className="row g-2 align-items-end">
              <div className="col-6 col-md-2">
                <label className="form-label small fw-medium">Ubicación</label>
                <SelectorUbicacion fincas={fincas} lugares={lugares} value={filtros.ubicacion} onChange={(v) => cambiar("ubicacion", v)} />
              </div>
              {veTodo && (
                <div className="col-6 col-md-3">
                  <label className="form-label small fw-medium">Colaborador</label>
                  <input
                    list="colaboradores-asistencia"
                    className="form-control form-control-sm rounded-3"
                    placeholder="Todos (nombre, apellido o identificación)"
                    value={textoColaborador}
                    onChange={(e) => {
                      setTextoColaborador(e.target.value);
                      cambiar("colaboradorUuid", colaboradores.find((c) => etiquetaColaborador(c) === e.target.value)?.uuid || "");
                    }}
                  />
                  <datalist id="colaboradores-asistencia">
                    {colaboradores.map((c) => (
                      <option key={c.uuid} value={etiquetaColaborador(c)} />
                    ))}
                  </datalist>
                </div>
              )}
              <div className="col-6 col-md-2">
                <label className="form-label small fw-medium">Tipo</label>
                <select className="form-select form-select-sm rounded-3" value={filtros.tipo} onChange={(e) => cambiar("tipo", e.target.value)}>
                  <option value="">Todos</option>
                  <option value="ENTRADA">Entrada</option>
                  <option value="SALIDA">Salida</option>
                </select>
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label small fw-medium">Desde</label>
                <input type="date" className="form-control form-control-sm rounded-3" value={filtros.desde} onChange={(e) => cambiar("desde", e.target.value)} />
              </div>
              <div className="col-6 col-md-2">
                <label className="form-label small fw-medium">Hasta</label>
                <input type="date" className="form-control form-control-sm rounded-3" value={filtros.hasta} onChange={(e) => cambiar("hasta", e.target.value)} />
              </div>
              <div className="col-6 col-md-1 d-grid">
                <button type="button" className="btn btn-brand btn-sm rounded-3" onClick={aplicar}>
                  Aplicar
                </button>
              </div>
            </div>
            {Object.values(aplicados).some(Boolean) && (
              <div className="mt-2">
                <button type="button" className="btn btn-sm btn-link p-0" onClick={limpiar}>
                  Quitar filtros
                </button>
              </div>
            )}
          </div>

          {error && <div className="alert alert-danger py-2 small">{error}</div>}

          {cargando ? (
            <p className="text-secondary">Cargando...</p>
          ) : items.length === 0 ? (
            <p className="text-secondary">No hay marcaciones para estos filtros.</p>
          ) : (
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle" style={{ fontSize: "0.78rem" }}>
                  <thead className="table-light">
                    <tr>
                      <th className="fw-medium text-start">Colaborador</th>
                      <th className="fw-medium text-center">Cargo</th>
                      <th className="fw-medium text-center">Ubicación</th>
                      <th className="fw-medium text-center">Tipo</th>
                      <th className="fw-medium text-center">Fecha y hora</th>
                      <th className="fw-medium text-center text-nowrap">
                        Parecido{" "}
                        <InfoTooltip
                          fijo
                          titulo="Qué significa este número"
                          texto={
                            <>
                              <div className="fw-semibold text-dark mb-1">Distancia entre rostros</div>
                              <p className="mb-2">
                                Compara el rostro que marcó con el rostro registrado del colaborador. <strong>Mientras más bajo, más parecido</strong>; no es
                                un porcentaje.
                              </p>
                              <ul className="mb-2 ps-3">
                                <li>Hasta 0.40: coincidencia muy buena.</li>
                                <li>0.40 a 0.50: coincide, con menos margen (poca luz o la cara de lado).</li>
                                <li>Más de 0.50: no se acepta y la marcación no se registra.</li>
                              </ul>
                              <p className="mb-0">Además, la persona reconocida debe parecerse claramente más que la segunda más parecida; si no, se rechaza.</p>
                            </>
                          }
                        />
                      </th>
                      <th className="fw-medium text-center">Ubicación</th>
                      <th className="fw-medium text-center">Marcó</th>
                      {hasPermission("asistencia.eliminar") && <th className="fw-medium text-center">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((m) => (
                      <tr key={m.uuid}>
                        <td className="fw-medium">{m.colaborador?.nombre || "—"}</td>
                        <td className="text-center text-secondary">{m.colaborador?.cargo || "—"}</td>
                        <td className="text-center text-secondary">
                          {nombreUbicacion(m)}
                          {m.lugar && <EtiquetaLugar tipo={m.lugar.tipo} />}
                        </td>
                        <td className="text-center">
                          <span className="badge rounded-pill" style={m.tipo === "ENTRADA" ? { backgroundColor: "#d1fae5", color: "#047857" } : { backgroundColor: "#fef3c7", color: "#b45309" }}>
                            {m.tipo === "ENTRADA" ? "Entrada" : "Salida"}
                          </span>
                        </td>
                        <td className="text-center text-nowrap">{formatoFechaHora(m.fechaHora)}</td>
                        <td className="text-center text-secondary" title="Distancia facial: menor es más parecido">
                          {m.distancia != null ? m.distancia.toFixed(2) : "—"}
                        </td>
                        <td className="text-center">
                          {m.lat != null && m.lng != null ? (
                            <a href={`https://www.google.com/maps?q=${m.lat},${m.lng}`} target="_blank" rel="noreferrer">
                              Ver mapa
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="text-center text-secondary">{m.marcadoPor || "—"}</td>
                        {hasPermission("asistencia.eliminar") && (
                          <td className="text-center">
                            <button type="button" className="btn btn-sm btn-link p-1 d-inline-flex" style={{ color: "#dc2626" }} title="Eliminar" onClick={() => eliminar(m)}>
                              <FiTrash2 />
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

          {meta && meta.totalPages > 1 && (
            <div className="d-flex justify-content-center align-items-center gap-3 mt-3 small">
              <button type="button" className="btn btn-sm btn-outline-secondary" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
                Anterior
              </button>
              <span>
                Página {meta.page} de {meta.totalPages}
              </span>
              <button type="button" className="btn btn-sm btn-outline-secondary" disabled={pagina >= meta.totalPages} onClick={() => setPagina((p) => p + 1)}>
                Siguiente
              </button>
            </div>
          )}
          </>
        )}

        {modal === "marcar" && <MarcarAsistenciaModal onClose={() => setModal(null)} onCambio={cargar} />}
        {modal === "probar" && <ProbarRostroModal onClose={() => setModal(null)} />}
        {modal === "lugares" && <LugaresModal onClose={() => setModal(null)} onCambio={cargarLugares} />}
        {modal === "solicitudes" && <SolicitudesRostroModal onClose={() => setModal(null)} onCambio={contarSolicitudes} />}
      </div>
    </RequirePermission>
  );
}
