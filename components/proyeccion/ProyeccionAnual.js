"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiCopy, FiDownload, FiPlus, FiSave, FiTrash2, FiRefreshCw } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import {
  listarEscenarios,
  getEscenario,
  crearEscenario,
  actualizarEscenario,
  eliminarEscenario,
  guardarAreas,
  getResultado,
  exportarEscenario,
} from "@/lib/proyeccion/api";
import PlanHectareas from "./PlanHectareas";
import ParametrosFinca from "./ParametrosFinca";
import ResultadosProyeccion from "./ResultadosProyeccion";

const PARAMS_VACIOS = { rampaPct: 50, rampaSemanas: 12, aniosHistoricos: 3, anios: [], pctNoCosechado: null, pctNoCosechadoPorFinca: {}, hectareasBasePorFinca: {} };
const mismoJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Proyección anual de embolses y cajas: escenarios con nombre, plan de hectáreas nuevas por finca y semana, parámetros
// (rampa, años históricos, % no cosechado y hectáreas base por finca) y resultados (tablas, gráfico y comparativo).
export default function ProyeccionAnual() {
  const puedeEditar = hasPermission("proyeccion.editar");
  const [escenarios, setEscenarios] = useState([]);
  const [uuid, setUuid] = useState("");
  const [escenario, setEscenario] = useState(null); // lo guardado en el servidor
  const [draft, setDraft] = useState(null); // lo que se está editando
  const [resultado, setResultado] = useState(null);
  const [fincas, setFincas] = useState([]);
  const [semanas, setSemanas] = useState([]);
  const [seccion, setSeccion] = useState("resultados");
  const [cargando, setCargando] = useState(true);
  const [calculando, setCalculando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [nuevo, setNuevo] = useState(null); // { nombre, anio, copiarDeUuid } mientras se crea un escenario

  const cargarLista = useCallback(async (seleccionar) => {
    const lista = await listarEscenarios();
    setEscenarios(lista);
    setUuid((actual) => seleccionar || (lista.some((e) => e.uuid === actual) ? actual : lista[0]?.uuid || ""));
    return lista;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await cargarLista();
        const { items } = await apiFetch("/fincas?limit=100");
        setFincas(items.filter((f) => f.estado !== false && !f.esExterna));
      } catch (err) {
        setError(err.message);
      } finally {
        setCargando(false);
      }
    })();
  }, [cargarLista]);

  const calcular = useCallback(async (id) => {
    setCalculando(true);
    setError("");
    try {
      setResultado(await getResultado(id));
    } catch (err) {
      setResultado(null);
      setError(err.message);
    } finally {
      setCalculando(false);
    }
  }, []);

  const cargarEscenario = useCallback(
    async (id) => {
      const e = await getEscenario(id);
      setEscenario(e);
      setDraft({ nombre: e.nombre, descripcion: e.descripcion || "", params: { ...PARAMS_VACIOS, ...e.params }, areas: e.areas });
      const { items } = await apiFetch(`/semanas?limit=100&anio=${e.anio}`);
      setSemanas([...items].sort((a, b) => String(a.fechaInicio).localeCompare(String(b.fechaInicio))));
      return e;
    },
    [],
  );

  useEffect(() => {
    if (!uuid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEscenario(null);
      setDraft(null);
      setResultado(null);
      return;
    }
    (async () => {
      try {
        await cargarEscenario(uuid);
        await calcular(uuid);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [uuid, cargarEscenario, calcular]);

  const sucio = useMemo(() => {
    if (!escenario || !draft) return false;
    return (
      draft.nombre !== escenario.nombre ||
      (draft.descripcion || "") !== (escenario.descripcion || "") ||
      !mismoJson({ ...PARAMS_VACIOS, ...escenario.params }, draft.params) ||
      !mismoJson(escenario.areas.map((a) => [a.fincaUuid, a.semanaUuid, a.hectareas, a.nota || null]), draft.areas.map((a) => [a.fincaUuid, a.semanaUuid, a.hectareas, a.nota || null]))
    );
  }, [escenario, draft]);

  async function guardar() {
    setGuardando(true);
    setError("");
    setAviso("");
    try {
      await actualizarEscenario(uuid, { nombre: draft.nombre, descripcion: draft.descripcion, params: draft.params });
      await guardarAreas(uuid, draft.areas.map((a) => ({ fincaUuid: a.fincaUuid, semanaUuid: a.semanaUuid, hectareas: a.hectareas, nota: a.nota || undefined })));
      await cargarLista(uuid);
      await cargarEscenario(uuid);
      await calcular(uuid);
      setAviso("Escenario guardado y recalculado.");
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function crear(e) {
    e.preventDefault();
    setError("");
    try {
      const creado = await crearEscenario({ nombre: nuevo.nombre, anio: Number(nuevo.anio), ...(nuevo.copiarDeUuid ? { copiarDeUuid: nuevo.copiarDeUuid } : {}) });
      setNuevo(null);
      await cargarLista(creado.uuid);
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminar() {
    if (!window.confirm(`¿Eliminar el escenario "${escenario.nombre}"?`)) return;
    try {
      await eliminarEscenario(uuid);
      setUuid("");
      await cargarLista();
    } catch (err) {
      setError(err.message);
    }
  }

  async function exportar() {
    try {
      const blob = await exportarEscenario(uuid);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proyeccion-${escenario.anio}-${escenario.nombre.replace(/[^a-zA-Z0-9-_]+/g, "_")}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  const setParam = (cambios) => setDraft((d) => ({ ...d, params: { ...d.params, ...cambios } }));
  const aniosDisponibles = escenario ? Array.from({ length: 5 }, (_, k) => escenario.anio - 1 - k).reverse() : [];
  const aniosUsados = draft ? (draft.params.anios.length ? draft.params.anios : aniosDisponibles.slice(-draft.params.aniosHistoricos)) : [];
  const alternarAnio = (a) => {
    const actual = new Set(aniosUsados);
    if (actual.has(a)) actual.delete(a);
    else actual.add(a);
    setParam({ anios: [...actual].sort() });
  };

  if (cargando) return <p className="text-secondary">Cargando...</p>;

  return (
    <div>
      <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
        <div>
          <label className="form-label small mb-1">Escenario</label>
          <select className="form-select form-select-sm" style={{ minWidth: 240 }} value={uuid} onChange={(e) => setUuid(e.target.value)} disabled={escenarios.length === 0}>
            {escenarios.length === 0 && <option value="">Sin escenarios</option>}
            {escenarios.map((e) => (
              <option key={e.uuid} value={e.uuid}>
                {e.anio} · {e.nombre}
              </option>
            ))}
          </select>
        </div>
        {puedeEditar && (
          <>
            <button type="button" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" onClick={() => setNuevo({ nombre: "", anio: new Date().getFullYear() + 1, copiarDeUuid: "" })}>
              <FiPlus /> Nuevo
            </button>
            {escenario && (
              <button type="button" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" onClick={() => setNuevo({ nombre: `${escenario.nombre} (copia)`, anio: escenario.anio, copiarDeUuid: escenario.uuid })}>
                <FiCopy /> Duplicar
              </button>
            )}
          </>
        )}
        <div className="ms-auto d-flex align-items-center gap-2">
          {puedeEditar && escenario && (
            <button type="button" className="btn btn-sm btn-brand btn-brand-verde d-inline-flex align-items-center gap-1" disabled={!sucio || guardando} onClick={guardar}>
              <FiSave /> {guardando ? "Guardando..." : "Guardar y calcular"}
            </button>
          )}
          {escenario && (
            <>
              <button type="button" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" onClick={exportar} disabled={!resultado}>
                <FiDownload /> Excel
              </button>
              <button type="button" className="btn btn-sm btn-outline-secondary" title="Recalcular" onClick={() => calcular(uuid)} disabled={calculando}>
                <FiRefreshCw className={calculando ? "spin" : ""} />
              </button>
            </>
          )}
          {puedeEditar && escenario && (
            <button type="button" className="btn btn-sm btn-link text-danger p-1" title="Eliminar escenario" onClick={eliminar}>
              <FiTrash2 />
            </button>
          )}
        </div>
      </div>

      {nuevo && (
        <form onSubmit={crear} className="border rounded-3 p-3 mb-3 bg-light">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-5">
              <label className="form-label small mb-1">Nombre</label>
              <input type="text" className="form-control form-control-sm" required maxLength={120} placeholder="Ej. Base 2027" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small mb-1">Año</label>
              <input type="number" className="form-control form-control-sm" required min="2000" max="2100" value={nuevo.anio} onChange={(e) => setNuevo({ ...nuevo, anio: e.target.value })} />
            </div>
            <div className="col-6 col-md-5 d-flex gap-2">
              <button type="submit" className="btn btn-sm btn-brand btn-brand-verde">
                {nuevo.copiarDeUuid ? "Crear copia" : "Crear"}
              </button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setNuevo(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {aviso && <div className="alert alert-success py-2 small">{aviso}</div>}

      {!escenario && escenarios.length === 0 && (
        <div className="border rounded-3 p-4 text-center text-secondary">
          Aún no hay escenarios. {puedeEditar ? "Crea el primero con «Nuevo» (por ejemplo, «Base 2027») para proyectar el año completo." : ""}
        </div>
      )}

      {escenario && draft && (
        <>
          {resultado?.meta?.advertencias?.map((t) => (
            <div key={t} className="alert alert-warning py-2 small d-flex align-items-start gap-2">
              <FiAlertTriangle className="mt-1 flex-shrink-0" /> <span>{t}</span>
            </div>
          ))}
          {resultado?.meta?.fincasSinHistorial?.length > 0 && (
            <div className="alert alert-light border py-2 small">Sin historial suficiente (usan el promedio de todas las fincas): {resultado.meta.fincasSinHistorial.join(", ")}.</div>
          )}

          <div className="d-flex flex-wrap gap-3 mb-2" style={{ borderBottom: "1px solid #d5e2d9" }} role="tablist">
            {[
              ["resultados", "Resultados"],
              ["hectareas", "Hectáreas nuevas", draft.areas.length],
              ["parametros", "Parámetros y aprovechamiento"],
            ].map(([id, label, cuenta]) => {
              const activa = seccion === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activa}
                  className="btn btn-link text-decoration-none p-0 pb-1 d-inline-flex align-items-center gap-1"
                  style={{ color: activa ? "#166534" : "#64748b", fontWeight: activa ? 700 : 500, fontSize: "0.82rem", borderRadius: 0, borderBottom: activa ? "2px solid #166534" : "2px solid transparent", marginBottom: -1 }}
                  onClick={() => setSeccion(id)}
                >
                  {label}
                  {cuenta > 0 && (
                    <span className="badge rounded-pill" style={{ background: activa ? "#166534" : "#cbd5e1", color: activa ? "#fff" : "#334155", fontWeight: 600, fontSize: "0.65rem" }}>
                      {cuenta}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {seccion === "resultados" &&
            (calculando && !resultado ? (
              <p className="text-secondary">Calculando la proyección...</p>
            ) : resultado ? (
              <>
                {sucio && <div className="alert alert-info py-2 small">Hay cambios sin guardar: los resultados corresponden a la última versión guardada.</div>}
                <ResultadosProyeccion resultado={resultado} />
              </>
            ) : null)}

          {seccion === "hectareas" && (
            <PlanHectareas
              escenarioUuid={uuid}
              areas={draft.areas}
              onChange={(areas) => setDraft((d) => ({ ...d, areas }))}
              fincas={fincas}
              semanas={semanas}
              deshabilitado={!puedeEditar}
              onCargado={async () => {
                await cargarEscenario(uuid);
                await calcular(uuid);
              }}
            />
          )}

          {seccion === "parametros" && (
            <div>
              <div className="row g-3 mb-4">
                <div className="col-12 col-md-4">
                  <label className="form-label small mb-1">Nombre del escenario</label>
                  <input type="text" className="form-control form-control-sm" maxLength={120} disabled={!puedeEditar} value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} />
                </div>
                <div className="col-6 col-md-2">
                  <label className="form-label small mb-1" title="Con qué porcentaje del embolse por hectárea arranca una hectárea nueva">
                    Arranque hectárea nueva (%)
                  </label>
                  <input type="number" min="0" max="100" className="form-control form-control-sm" disabled={!puedeEditar} value={draft.params.rampaPct} onChange={(e) => setParam({ rampaPct: Number(e.target.value) })} />
                </div>
                <div className="col-6 col-md-2">
                  <label className="form-label small mb-1" title="Semanas que tarda en llegar al 100 % del embolse por hectárea de la finca">
                    Semanas hasta el 100 %
                  </label>
                  <input type="number" min="0" max="104" className="form-control form-control-sm" disabled={!puedeEditar} value={draft.params.rampaSemanas} onChange={(e) => setParam({ rampaSemanas: Number(e.target.value) })} />
                </div>
                <div className="col-12 col-md-4">
                  <label className="form-label small mb-1">Años históricos usados (promedio simple)</label>
                  <div className="d-flex flex-wrap gap-3 pt-1">
                    {aniosDisponibles.map((a) => (
                      <div key={a} className="form-check">
                        <input type="checkbox" className="form-check-input" id={`anio-${a}`} disabled={!puedeEditar} checked={aniosUsados.includes(a)} onChange={() => alternarAnio(a)} />
                        <label className="form-check-label small" htmlFor={`anio-${a}`}>
                          {a}
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="form-text">Excluye un año si sus datos (por ejemplo, hectáreas) no son confiables.</div>
                </div>
              </div>

              {resultado ? (
                <>
                  <h3 className="h6 fw-bold">Aprovechamiento / % no cosechado y hectáreas base por finca</h3>
                  <ParametrosFinca filas={resultado.aprovechamiento} params={draft.params} onChange={(params) => setDraft((d) => ({ ...d, params }))} deshabilitado={!puedeEditar} />
                  <p className="small text-secondary mt-2 mb-0">Los valores aplicados se actualizan al guardar y calcular.</p>
                </>
              ) : (
                <p className="text-secondary small">Calcula la proyección para ver el aprovechamiento histórico de cada finca.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
