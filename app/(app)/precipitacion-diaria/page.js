"use client";

import { useEffect, useMemo, useState } from "react";
import { FiPlus, FiTrash2, FiCloudRain, FiAlertTriangle, FiCheck, FiChevronDown, FiChevronRight, FiTool } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import GraficoPrecipitacion from "@/components/GraficoPrecipitacion";
import RequirePermission from "@/components/RequirePermission";
import { hasPermission } from "@/lib/auth";
import SemanaAutocomplete from "@/components/SemanaAutocomplete";
import ModalShell from "@/components/ModalShell";

export default function PrecipitacionDiariaPage() {
  const [configs, setConfigs] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [fincas, setFincas] = useState([]);
  const [roles, setRoles] = useState([]);
  const [semanas, setSemanas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [creando, setCreando] = useState(false);

  const [modalConfig, setModalConfig] = useState(false);
  const [mostrarInconsistencias, setMostrarInconsistencias] = useState(false);

  const [inconsistencias, setInconsistencias] = useState([]);
  const [resolviendo, setResolviendo] = useState(null); // uuid en proceso
  const [resueltos, setResueltos] = useState(new Set()); // uuids ya resueltos en esta sesión (fila sigue visible, sin botones)
  const [mmClimaEditado, setMmClimaEditado] = useState({}); // uuid -> texto editado en el input de Clima (mm)

  // Filtros de "Últimos registros" (Finca + Semana + Usuario). Rol no aplica
  // acá — la lista de registros no guarda por qué rol se capturó, así que
  // no hay nada que filtrar por ese campo.
  const [filtroFincaUuid, setFiltroFincaUuid] = useState("");
  const [filtroSemanaUuid, setFiltroSemanaUuid] = useState("");
  const [filtroUsuarioId, setFiltroUsuarioId] = useState("");
  const [filtroFechaDesde, setFiltroFechaDesde] = useState("");
  const [filtroFechaHasta, setFiltroFechaHasta] = useState("");
  const [paginaRegistros, setPaginaRegistros] = useState(1);
  const [totalPaginasRegistros, setTotalPaginasRegistros] = useState(1);

  const semanasFiltro = useMemo(() => {
    const hoy = new Date();
    return semanas.filter((s) => new Date(s.fechaInicio) <= hoy);
  }, [semanas]);

  // Nueva configuración en bloque: se marcan varias fincas y varios roles y se crea cada combinación de una vez (misma semana de inicio).
  const [fincasSel, setFincasSel] = useState(new Set());
  const [rolesSel, setRolesSel] = useState(new Set());
  const [filtroFincas, setFiltroFincas] = useState("");
  const [semanaTexto, setSemanaTexto] = useState("");

  const labelFinca = (f) => `${f.codigo} — ${f.nombre}`;
  const labelSemana = (s) => s.codigo;
  const semanaSeleccionada = semanas.find((s) => labelSemana(s) === semanaTexto);
  const fincasVisibles = fincas.filter((f) => labelFinca(f).toLowerCase().includes(filtroFincas.trim().toLowerCase()));
  const alternar = (setFn, valor) =>
    setFn((prev) => {
      const n = new Set(prev);
      if (n.has(valor)) n.delete(valor);
      else n.add(valor);
      return n;
    });
  const [resumenCreacion, setResumenCreacion] = useState("");

  // Filtro compartido (Finca/rango de fechas/Usuario) — un solo lugar para
  // "Últimos registros" e "Inconsistencias con Clima", que ahora comparten
  // el mismo filtro de arriba. Las fechas explícitas ganan sobre el rango
  // de la semana elegida si ambas están puestas.
  const paramsDeFiltros = () => {
    const params = new URLSearchParams();
    if (filtroFincaUuid) params.set("fincaUuid", filtroFincaUuid);
    if (filtroUsuarioId) params.set("usuarioId", filtroUsuarioId);
    if (filtroFechaDesde) {
      params.set("fechaDesde", filtroFechaDesde);
    } else if (filtroSemanaUuid) {
      const s = semanas.find((s) => s.uuid === filtroSemanaUuid);
      if (s) params.set("fechaDesde", s.fechaInicio);
    }
    if (filtroFechaHasta) {
      params.set("fechaHasta", filtroFechaHasta);
    } else if (filtroSemanaUuid) {
      const s = semanas.find((s) => s.uuid === filtroSemanaUuid);
      if (s) params.set("fechaHasta", s.fechaFin);
    }
    return params;
  };

  const paramsDeRegistros = (pagina) => {
    const params = paramsDeFiltros();
    params.set("limit", "20");
    params.set("page", String(pagina));
    return params;
  };

  const cargarTodo = async () => {
    setLoading(true);
    setError("");
    try {
      const [configData, registrosData, fincasData, rolesData, semanasData, inconsistenciasData, usuariosData] =
        await Promise.all([
          apiFetch("/precipitacion-diaria/config"),
          apiFetch(`/precipitacion-diaria?${paramsDeRegistros(paginaRegistros).toString()}`),
          apiFetch("/fincas?limit=100&soloOperativas=true"),
          // roles.ver es un permiso de administración aparte de los de
          // Precipitación Diaria — sin permiso, el picker de rol (solo usado
          // dentro del modal "Configurar", ya detrás de
          // precipitacion_diaria.configurar) queda vacío en vez de tumbar
          // toda la pantalla.
          apiFetch("/roles?limit=100").catch(() => ({ items: [] })),
          // Mismo caso: semana.ver es de Maestros, no de Precipitación
          // Diaria — sin permiso, el filtro "Semana" queda vacío en vez de
          // tumbar la pantalla (las fechas Desde/Hasta siguen funcionando).
          apiFetch("/semanas?limit=100").catch(() => ({ items: [] })),
          apiFetch(`/precipitacion-diaria/inconsistencias?${paramsDeFiltros().toString()}`),
          // Endpoint propio (no /users): solo nombres de quienes ya
          // registraron acá, sin exponer email/roles/fincas de todo el
          // sistema a quien solo tiene precipitacion_diaria.ver.
          apiFetch("/precipitacion-diaria/usuarios"),
        ]);
      setConfigs(configData);
      setRegistros(registrosData.items);
      setTotalPaginasRegistros(Math.max(1, Math.ceil(registrosData.meta.total / registrosData.meta.limit)));
      setFincas(fincasData.items);
      setRoles(rolesData.items);
      setSemanas(semanasData.items);
      setInconsistencias(inconsistenciasData);
      setUsuarios(usuariosData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroFincaUuid, filtroSemanaUuid, filtroUsuarioId, filtroFechaDesde, filtroFechaHasta, paginaRegistros]);

  // Cambiar cualquier filtro vuelve a la página 1 — el efecto de arriba ya
  // se dispara por el cambio del filtro en sí, este solo corrige la página.
  const cambiarFiltro = (setter) => (valor) => {
    setPaginaRegistros(1);
    setter(valor);
  };

  // Búsqueda con debounce contra /fincas?search= y /roles?search= — repuebla
  // las opciones del <datalist> mientras se escribe (semanas no tiene
  // ?search todavía, se filtra solo del lado del navegador vía datalist
  // sobre las primeras 100 ya cargadas).
  const handleResolver = async (uuid, fuente, mmEditado) => {
    setResolviendo(uuid);
    setError("");
    try {
      await apiFetch(`/precipitacion-diaria/inconsistencias/${uuid}`, {
        method: "PUT",
        body: JSON.stringify(fuente === "clima" ? { fuente, mm: mmEditado } : { fuente }),
      });
      // No se vuelve a pedir /inconsistencias: esa lista ya filtra en el
      // backend por coincide_clima = 0, así que un refetch haría
      // desaparecer la fila al instante. En vez de eso, se actualiza el
      // valor localmente para que el usuario VEA el cambio reflejado (mm de
      // clima igualado) — la fila se va a ir sola recién cuando se recargue
      // la página de nuevo, no en este mismo momento.
      setInconsistencias((prev) =>
        prev.map((i) => {
          if (i.uuid !== uuid) return i;
          if (fuente === "clima") {
            const mm = Number(mmEditado);
            return { ...i, precipitacionDiaria: { mm }, clima: { uuid: i.clima?.uuid, mm } };
          }
          return { ...i, clima: { uuid: i.clima?.uuid, mm: i.precipitacionDiaria.mm } };
        }),
      );
      setResueltos((prev) => new Set(prev).add(uuid));
    } catch (err) {
      setError(err.message);
    } finally {
      setResolviendo(null);
    }
  };

  // Solo cambia la lista de configuraciones — refresca únicamente eso, sin
  // volver a pedir fincas/roles/semanas/usuarios/registros/inconsistencias.
  const recargarConfigs = async () => {
    const configData = await apiFetch("/precipitacion-diaria/config");
    setConfigs(configData);
  };

  const handleCrear = async (e) => {
    e.preventDefault();
    setError("");
    setResumenCreacion("");
    if (fincasSel.size === 0 || rolesSel.size === 0 || !semanaSeleccionada) {
      setError("Marca al menos una finca y un rol, y elige una semana válida de la lista.");
      return;
    }
    setCreando(true);
    let creadas = 0;
    const omitidas = [];
    try {
      for (const fincaUuid of fincasSel) {
        for (const rolId of rolesSel) {
          try {
            await apiFetch("/precipitacion-diaria/config", { method: "POST", body: JSON.stringify({ fincaUuid, rolId, semanaInicioUuid: semanaSeleccionada.uuid }) });
            creadas += 1;
          } catch (err) {
            const f = fincas.find((x) => x.uuid === fincaUuid);
            omitidas.push(`${f ? f.nombre : "Finca"}: ${err.message}`);
          }
        }
      }
      setFincasSel(new Set());
      setRolesSel(new Set());
      setSemanaTexto("");
      await recargarConfigs();
      setResumenCreacion(`${creadas} configuración(es) creada(s)${omitidas.length ? `; ${omitidas.length} no se crearon (probablemente ya existían): ${omitidas.slice(0, 3).join(" · ")}${omitidas.length > 3 ? "…" : ""}` : "."}`);
    } finally {
      setCreando(false);
    }
  };

  const handleToggle = async (uuid, activo) => {
    try {
      await apiFetch(`/precipitacion-diaria/config/${uuid}`, {
        method: "PUT",
        body: JSON.stringify({ activo: !activo }),
      });
      await recargarConfigs();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEliminar = async (uuid) => {
    if (!confirm("¿Eliminar esta configuración?")) return;
    try {
      await apiFetch(`/precipitacion-diaria/config/${uuid}`, { method: "DELETE" });
      await recargarConfigs();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <RequirePermission code="menu.precipitacion_diaria">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex align-items-start justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
              <FiCloudRain className="text-primary" /> Precipitación Diaria
            </h1>
            <p className="text-secondary mb-0">
              Programa qué rol debe registrar la precipitación diaria de una finca, a partir de qué semana. A los
              usuarios con ese rol se les va a pedir (con bloqueo) los días que no hayan registrado.
            </p>
          </div>
          {hasPermission("precipitacion_diaria.configurar") && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-1 text-nowrap"
              onClick={() => setModalConfig(true)}
              title="Configuración de captura obligatoria"
            >
              <FiTool /> Configurar
            </button>
          )}
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 shadow-sm rounded-4 mb-4">
          <div className="card-body p-4">
            <h2 className="h6 fw-semibold mb-3">Filtros</h2>
            <p className="text-secondary small mb-3">
              Aplican tanto a &quot;Últimos registros&quot; como a &quot;Inconsistencias con Clima&quot;.
            </p>
            <div className="row g-2 align-items-end">
              <div className="col-md-2">
                <label className="form-label small fw-medium mb-1">Finca</label>
                <select
                  className="form-select form-select-sm rounded-3"
                  value={filtroFincaUuid}
                  onChange={(e) => cambiarFiltro(setFiltroFincaUuid)(e.target.value)}
                >
                  <option value="">Todas</option>
                  {fincas.map((f) => (
                    <option key={f.uuid} value={f.uuid}>
                      {labelFinca(f)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-medium mb-1">Semana</label>
                <SemanaAutocomplete
                  semanas={semanasFiltro}
                  value={filtroSemanaUuid}
                  onChange={cambiarFiltro(setFiltroSemanaUuid)}
                  width="100%"
                />
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-medium mb-1">Desde</label>
                <input
                  type="date"
                  className="form-control form-control-sm rounded-3"
                  value={filtroFechaDesde}
                  onChange={(e) => cambiarFiltro(setFiltroFechaDesde)(e.target.value)}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-medium mb-1">Hasta</label>
                <input
                  type="date"
                  className="form-control form-control-sm rounded-3"
                  value={filtroFechaHasta}
                  onChange={(e) => cambiarFiltro(setFiltroFechaHasta)(e.target.value)}
                />
              </div>
              <div className="col-md-2">
                <label className="form-label small fw-medium mb-1">Usuario</label>
                <select
                  className="form-select form-select-sm rounded-3"
                  value={filtroUsuarioId}
                  onChange={(e) => cambiarFiltro(setFiltroUsuarioId)(e.target.value)}
                >
                  <option value="">Todos</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {`${u.nombre} ${u.apellido || ""}`.trim()}
                    </option>
                  ))}
                </select>
              </div>
              {(filtroFincaUuid || filtroSemanaUuid || filtroUsuarioId || filtroFechaDesde || filtroFechaHasta) && (
                <div className="col-md-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm rounded-3"
                    onClick={() => {
                      setPaginaRegistros(1);
                      setFiltroFincaUuid("");
                      setFiltroSemanaUuid("");
                      setFiltroUsuarioId("");
                      setFiltroFechaDesde("");
                      setFiltroFechaHasta("");
                    }}
                  >
                    Limpiar filtros
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-secondary">Cargando...</p>
        ) : (
          <>
            <div className="card border-0 shadow-sm rounded-4 mb-4">
              <div className="card-body p-4">
                <button
                  type="button"
                  onClick={() => setMostrarInconsistencias((v) => !v)}
                  className="btn btn-link btn-sm p-0 text-decoration-none text-reset w-100 d-flex align-items-center justify-content-between"
                >
                  <h2 className="h6 fw-semibold mb-0 d-flex align-items-center gap-2">
                    <FiAlertTriangle className="text-warning" /> Inconsistencias con Clima
                    {inconsistencias.length > 0 && (
                      <span className="badge bg-warning-subtle text-warning-emphasis">{inconsistencias.length}</span>
                    )}
                  </h2>
                  {mostrarInconsistencias ? <FiChevronDown /> : <FiChevronRight />}
                </button>
                {mostrarInconsistencias && (
                  <div className="mt-3">
                    <p className="text-secondary small">
                      Precipitación Diaria y Clima son dos registros independientes — acá se comparan por finca y fecha.
                      Cuando no coinciden, elige cuál valor es el correcto; eso va a sobreescribir el otro.
                    </p>
                    {inconsistencias.length === 0 ? (
                      <p className="text-secondary small mb-0">No hay inconsistencias pendientes.</p>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-sm align-middle mb-0">
                          <thead>
                            <tr className="text-secondary small">
                              <th>Fecha</th>
                              <th>Finca</th>
                              <th>Precipitación Finca (mm)</th>
                              <th>Precipitación Analista (mm)</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {inconsistencias.map((i) => {
                              const valorClima = mmClimaEditado[i.uuid] ?? (i.clima?.mm ?? "0");
                              const valorClimaValido = valorClima !== "" && !isNaN(Number(valorClima));
                              return (
                              <tr key={i.uuid}>
                                <td>{i.fecha}</td>
                                <td>{i.fincaNombre}</td>
                                <td>{i.precipitacionDiaria.mm}</td>
                                <td>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    className="form-control form-control-sm"
                                    style={{ width: 90 }}
                                    disabled={resueltos.has(i.uuid) || !hasPermission("precipitacion_diaria.sincronizar_precipitaciones")}
                                    value={valorClima}
                                    onChange={(e) => setMmClimaEditado((prev) => ({ ...prev, [i.uuid]: e.target.value }))}
                                  />
                                </td>
                                <td className="text-end">
                                  {resueltos.has(i.uuid) ? (
                                    <span className="badge bg-success-subtle text-success-emphasis d-inline-flex align-items-center gap-1">
                                      <FiCheck /> Resuelto
                                    </span>
                                  ) : hasPermission("precipitacion_diaria.sincronizar_precipitaciones") && (
                                    <div className="d-flex gap-1 justify-content-end">
                                      <button
                                        type="button"
                                        className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                                        disabled={resolviendo === i.uuid}
                                        onClick={() => handleResolver(i.uuid, "precipitacion_diaria")}
                                        title="Tomar el valor de Precipitación Finca como correcto"
                                      >
                                        <FiCheck /> Usar dato Finca
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                                        disabled={resolviendo === i.uuid || !valorClimaValido}
                                        onClick={() => handleResolver(i.uuid, "clima", valorClima)}
                                        title="Tomar el valor de Precipitación Analista (editable acá al lado) como correcto"
                                      >
                                        <FiCheck /> Usar dato Analista
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <GraficoPrecipitacion filtros={paramsDeFiltros().toString()} fincaFiltrada={!!filtroFincaUuid} />

            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-body p-4">
                <h2 className="h6 fw-semibold mb-3">Últimos registros</h2>
                {registros.length === 0 ? (
                  <p className="text-secondary small mb-0">Todavía no hay registros.</p>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead>
                        <tr className="text-secondary small">
                          <th>Fecha</th>
                          <th>Finca</th>
                          <th>mm</th>
                          <th>Registrado por</th>
                        </tr>
                      </thead>
                      <tbody>
                        {registros.map((r) => (
                          <tr key={r.uuid}>
                            <td>{r.fecha}</td>
                            <td>{r.finca_nombre}</td>
                            <td>{r.mm}</td>
                            <td>{r.usuario_nombre || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {registros.length > 0 && (
                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <span className="small text-secondary">
                      Página {paginaRegistros} de {totalPaginasRegistros}
                    </span>
                    <div className="d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm rounded-3"
                        disabled={paginaRegistros <= 1}
                        onClick={() => setPaginaRegistros((p) => p - 1)}
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm rounded-3"
                        disabled={paginaRegistros >= totalPaginasRegistros}
                        onClick={() => setPaginaRegistros((p) => p + 1)}
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {modalConfig && (
          <ModalShell title="Configuración de captura obligatoria" onClose={() => setModalConfig(false)} width="80%">
            <div className="mb-4">
              <h2 className="h6 fw-semibold mb-3">Nueva configuración (varias fincas y roles a la vez)</h2>
              <form onSubmit={handleCrear}>
                <div className="row g-3">
                  <div className="col-12 col-lg-6">
                    <div className="d-flex align-items-center justify-content-between mb-1">
                      <label className="form-label small fw-medium mb-0">Fincas ({fincasSel.size} marcada(s))</label>
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0"
                        onClick={() => setFincasSel(fincasSel.size === fincasVisibles.length ? new Set() : new Set(fincasVisibles.map((f) => f.uuid)))}
                      >
                        {fincasSel.size === fincasVisibles.length && fincasVisibles.length > 0 ? "Quitar todas" : "Marcar todas"}
                      </button>
                    </div>
                    <input type="text" className="form-control form-control-sm mb-1" placeholder="Filtrar fincas..." value={filtroFincas} onChange={(e) => setFiltroFincas(e.target.value)} />
                    <div className="border rounded-2 p-2" style={{ maxHeight: "12rem", overflowY: "auto" }}>
                      {fincasVisibles.length === 0 && <div className="small text-secondary">Sin fincas.</div>}
                      {fincasVisibles.map((f) => (
                        <div className="form-check" key={f.uuid}>
                          <input type="checkbox" className="form-check-input" id={`pd-f-${f.uuid}`} checked={fincasSel.has(f.uuid)} onChange={() => alternar(setFincasSel, f.uuid)} />
                          <label className="form-check-label small" htmlFor={`pd-f-${f.uuid}`}>
                            {labelFinca(f)}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="col-12 col-lg-3">
                    <label className="form-label small fw-medium mb-1">Roles ({rolesSel.size} marcado(s))</label>
                    <div className="border rounded-2 p-2" style={{ maxHeight: "14.5rem", overflowY: "auto" }}>
                      {roles.map((r) => (
                        <div className="form-check" key={r.id}>
                          <input type="checkbox" className="form-check-input" id={`pd-r-${r.id}`} checked={rolesSel.has(r.id)} onChange={() => alternar(setRolesSel, r.id)} />
                          <label className="form-check-label small" htmlFor={`pd-r-${r.id}`}>
                            {r.nombre}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="col-12 col-lg-3">
                    <label className="form-label small fw-medium mb-1">A partir de la semana</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      list="semanas-datalist"
                      placeholder="Escribe para buscar..."
                      autoComplete="off"
                      value={semanaTexto}
                      onChange={(e) => setSemanaTexto(e.target.value)}
                      required
                    />
                    <datalist id="semanas-datalist">
                      {semanas.map((s) => (
                        <option key={s.uuid} value={labelSemana(s)} />
                      ))}
                    </datalist>
                    <button type="submit" className="btn btn-brand btn-sm w-100 rounded-3 d-flex align-items-center justify-content-center gap-1 mt-3" disabled={creando || fincasSel.size === 0 || rolesSel.size === 0}>
                      <FiPlus /> {creando ? "Creando..." : `Agregar ${fincasSel.size * rolesSel.size || ""} configuración(es)`}
                    </button>
                    <div className="form-text small">Se crea una por cada finca y rol marcados.</div>
                  </div>
                </div>
                {resumenCreacion && <div className="alert alert-info py-2 small mt-3 mb-0">{resumenCreacion}</div>}
              </form>
            </div>

            <div>
              <h2 className="h6 fw-semibold mb-3">Configuración activa</h2>
              {configs.length === 0 ? (
                <p className="text-secondary small mb-0">Todavía no hay ninguna configuración.</p>
              ) : (
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr className="text-secondary small">
                        <th>Finca</th>
                        <th>Rol</th>
                        <th>Desde</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {configs.map((c) => (
                        <tr key={c.uuid}>
                          <td>{c.finca_nombre}</td>
                          <td>{c.rol_nombre}</td>
                          <td>{c.semana_inicio_codigo}</td>
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
            </div>
          </ModalShell>
        )}
      </div>
    </RequirePermission>
  );
}
