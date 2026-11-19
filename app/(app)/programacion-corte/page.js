"use client";

import { useEffect, useId, useState } from "react";
import { FiCalendar, FiDownload, FiEye, FiFilter, FiRefreshCw, FiTrash2, FiX } from "react-icons/fi";
import { armarTablaProgramacion, descargarProgramacionCorteExcel } from "@/lib/programacionCorteExport";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

// Buscador dinámico de semana (input + <datalist>) — mismo estilo ya usado
// en Sanidad Vegetal → Aspersiones ("de ahora en adelante todos los
// filtros de semana en este estilo"). Reemplaza el <select> plano: el
// usuario escribe y el navegador filtra las opciones en vivo; al elegir/
// escribir un código exacto (ej. "S35-2026") se resuelve el uuid y se
// dispara `onChange`. Mientras el texto no matchea ninguna semana
// completa, no cambia nada (el usuario sigue escribiendo).
function BuscadorSemana({ semanas, value, onChange, placeholder = "Todas", className = "", style }) {
  const datalistId = useId();
  const [texto, setTexto] = useState("");
  const semanaSeleccionada = semanas.find((s) => s.uuid === value) || null;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTexto(semanaSeleccionada?.codigo || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleChange(e) {
    const val = e.target.value;
    setTexto(val);
    if (val === "") {
      onChange("");
      return;
    }
    const match = semanas.find((s) => s.codigo.toLowerCase() === val.trim().toLowerCase());
    if (match) onChange(match.uuid);
  }

  return (
    <>
      <input
        type="text"
        list={datalistId}
        className={className}
        style={style}
        placeholder={placeholder}
        value={texto}
        onChange={handleChange}
      />
      <datalist id={datalistId}>
        {semanas.map((s) => (
          <option key={s.uuid} value={s.codigo} />
        ))}
      </datalist>
    </>
  );
}

export default function ProgramacionCortePage() {
  const [fincas, setFincas] = useState([]);
  const [semanas, setSemanas] = useState([]);
  const [fincaUuid, setFincaUuid] = useState("");
  const [semanaUuid, setSemanaUuid] = useState("");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);

  const [syncModal, setSyncModal] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState(null); // { registros, titulo }

  // Toda la programación con los filtros actuales (todas las páginas) y el título del informe.
  async function traerTodos() {
    const params = new URLSearchParams({ limit: "100" });
    if (fincaUuid) params.set("fincaUuid", fincaUuid);
    if (semanaUuid) params.set("semanaUuid", semanaUuid);
    let todos = [];
    for (let p = 1; ; p++) {
      params.set("page", String(p));
      const r = await apiFetch(`/programacion-corte?${params.toString()}`);
      todos = todos.concat(r.items || []);
      if (p >= (r.totalPages || 1)) break;
    }
    if (!todos.length) throw new Error("No hay programación para estos filtros");
    const finca = fincas.find((f) => f.uuid === fincaUuid);
    const semana = semanas.find((s) => s.uuid === semanaUuid);
    const titulo = ["Programación de corte", finca ? finca.nombre : "Todas las fincas", semana?.codigo].filter(Boolean).join(" · ");
    return { registros: todos, titulo };
  }

  // Excel con el formato de «Proyección semanal · Cajas por producto»; `previa`: abre la tabla en pantalla en vez de descargar.
  async function descargarExcel(previa = false) {
    setDescargando(true);
    setError("");
    try {
      const datos = await traerTodos();
      if (previa) setVistaPrevia(datos);
      else await descargarProgramacionCorteExcel(datos.registros, { titulo: datos.titulo });
    } catch (err) {
      setError(err.message);
    } finally {
      setDescargando(false);
    }
  }
  const [rechazos, setRechazos] = useState([]);

  useEffect(() => {
    apiFetch("/fincas?limit=100")
      .then((data) => setFincas(data.items))
      .catch(() => {});
    apiFetch("/semanas?limit=100")
      .then((data) => setSemanas(data.items))
      .catch(() => {});
  }, []);

  async function loadReporte(paginaNueva) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "40", page: String(paginaNueva || 1) });
      if (fincaUuid) params.set("fincaUuid", fincaUuid);
      if (semanaUuid) params.set("semanaUuid", semanaUuid);
      const { items: rows, page, totalPages } = await apiFetch(`/programacion-corte?${params.toString()}`);
      setItems(rows);
      setPagina(page ?? 1);
      setTotalPaginas(totalPages ?? 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }

    // Resumen de rechazos (fruta producida pero no exportada) solo tiene
    // sentido con una semana puntual seleccionada — es un agregado por
    // finca, no una fila por registro como la tabla de arriba.
    if (semanaUuid) {
      apiFetch(`/rechazos-corte/resumen?semanaUuid=${semanaUuid}`)
        .then((data) => setRechazos(data))
        .catch(() => setRechazos([]));
    } else {
      setRechazos([]);
    }
  }

  useEffect(() => {
    loadReporte(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete(registro) {
    if (!confirm(`¿Eliminar la programación de ${registro.finca?.nombre} — ${registro.fecha}?`)) return;
    try {
      await apiFetch(`/programacion-corte/${registro.uuid}`, { method: "DELETE" });
      loadReporte(pagina);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <RequirePermission code="menu.programacion_corte">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
              <FiCalendar className="text-primary" /> Programación de Corte
            </h1>
            <p className="text-secondary mb-0">Cajas programadas por finca y fecha (cargue masivo o sincronización con Logística).</p>
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-3 text-nowrap d-flex align-items-center gap-1"
              disabled={descargando}
              onClick={() => descargarExcel(true)}
              title="Ver la tabla de cajas por producto antes de descargarla"
            >
              <FiEye /> Vista previa
            </button>
            <button
              type="button"
              className="btn btn-outline-success btn-sm rounded-3 text-nowrap d-flex align-items-center gap-1"
              disabled={descargando}
              onClick={() => descargarExcel(false)}
              title="Cajas por producto y semana (y por mes) con los filtros actuales"
            >
              <FiDownload /> {descargando ? "Generando…" : "Descargar Excel"}
            </button>
            {hasPermission("programacion_corte.crear") && (
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm rounded-3 text-nowrap d-flex align-items-center gap-1"
                onClick={() => setSyncModal(true)}
              >
                <FiRefreshCw /> Sincronización con Logística
              </button>
            )}
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-6 col-md-4">
              <label className="form-label small fw-medium">Finca</label>
              <select className="form-select rounded-3" value={fincaUuid} onChange={(e) => setFincaUuid(e.target.value)}>
                <option value="">Todas</option>
                {fincas.map((f) => (
                  <option key={f.uuid} value={f.uuid}>
                    {f.codigo} — {f.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-4">
              <label className="form-label small fw-medium">Semana</label>
              <select className="form-select rounded-3" value={semanaUuid} onChange={(e) => setSemanaUuid(e.target.value)}>
                <option value="">Todas</option>
                {semanas.map((s) => (
                  <option key={s.uuid} value={s.uuid}>
                    {s.codigo}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-4">
              <button type="button" className="btn btn-brand btn-sm rounded-3 w-100 d-flex align-items-center justify-content-center gap-1" onClick={() => loadReporte(1)}>
                <FiFilter /> Filtrar
              </button>
            </div>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        {rechazos.length > 0 && (
          <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
            <p className="fw-medium small mb-2">
              Rechazado en la semana (fruta producida pero no exportada, sincronizado desde Logística)
            </p>
            <div className="d-flex flex-wrap gap-2">
              {rechazos.map((r) => {
                const finca = fincas.find((f) => f.id === r.fincaId);
                return (
                  <span key={r.fincaId} className="badge bg-warning-subtle text-warning-emphasis rounded-3 py-2 px-3">
                    {finca ? `${finca.codigo} — ${finca.nombre}` : `Finca #${r.fincaId}`}: {r.totalCajas.toLocaleString("es")} cajas
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle small">
              <thead className="table-light">
                <tr>
                  <th>Fecha</th>
                  <th>Finca</th>
                  <th>Semana</th>
                  <th>Producto</th>
                  <th>Proceso</th>
                  <th className="text-end">Cajas programadas</th>
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
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-secondary py-4">
                      No hay registros para estos filtros.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((r) => (
                    <tr key={r.uuid}>
                      <td>{r.fecha}</td>
                      <td>{r.finca?.codigo} — {r.finca?.nombre}</td>
                      <td>{r.semana?.codigo}</td>
                      <td>{r.producto?.nombre || "—"}</td>
                      <td>{r.procesoEmpaque || "—"}</td>
                      <td className="text-end fw-medium">{r.cajasProgramadas?.toLocaleString("es")}</td>
                      <td className="text-end">
                        {hasPermission("programacion_corte.eliminar") && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            title="Eliminar"
                            onClick={() => handleDelete(r)}
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
        </div>

        <div className="d-flex justify-content-between align-items-center mt-2">
          <span className="small text-secondary">
            Página {pagina} de {totalPaginas}
          </span>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-3"
              disabled={pagina <= 1 || loading}
              onClick={() => loadReporte(pagina - 1)}
            >
              Anterior
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-3"
              disabled={pagina >= totalPaginas || loading}
              onClick={() => loadReporte(pagina + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>

        {vistaPrevia && (
          <VistaPreviaModal
            datos={vistaPrevia}
            onClose={() => setVistaPrevia(null)}
            onDescargar={() => descargarProgramacionCorteExcel(vistaPrevia.registros, { titulo: vistaPrevia.titulo })}
          />
        )}
        {syncModal && (
          <SyncModal
            semanas={semanas}
            onClose={() => setSyncModal(false)}
            onSynced={() => loadReporte(pagina)}
          />
        )}
      </div>
    </RequirePermission>
  );
}

// ─── Modal: elegir la semana a sincronizar con Logística ───
// La semana es obligatoria a propósito: sin filtro, Logística devuelve TODO
// su histórico y cada clic reprocesaría miles de filas de semanas ya
// cerradas — ver programacionCorteService.syncFromBanarica en el backend.
function SyncModal({ semanas, onClose, onSynced }) {
  const [semanaUuid, setSemanaUuid] = useState("");
  const [sincronizando, setSincronizando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);

  // Por defecto selecciona la ÚLTIMA semana que ya tiene programación
  // cargada (no la semana actual) — pedido explícito. El backend devuelve
  // /programacion-corte ordenado por fecha DESC, así que la primera fila
  // de un GET sin filtros es el registro más reciente — se toma su semana.
  useEffect(() => {
    let cancelado = false;
    apiFetch("/programacion-corte?limit=1")
      .then(({ items }) => {
        if (cancelado) return;
        const ultimaSemanaUuid = items?.[0]?.semana?.uuid;
        if (ultimaSemanaUuid) setSemanaUuid(ultimaSemanaUuid);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);

  async function handleSincronizar() {
    if (!semanaUuid) {
      setError("Selecciona la semana a sincronizar.");
      return;
    }
    setSincronizando(true);
    setError("");
    try {
      const data = await apiFetch("/programacion-corte/sync-banarica", {
        method: "POST",
        body: JSON.stringify({ semanaUuid }),
      });
      setResultado(data);
      onSynced();
    } catch (err) {
      setError(err.message);
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <ModalShell title="Sincronización con Logística" onClose={onClose}>
      {!resultado ? (
        <>
          <div className="mb-3">
            <label className="form-label small fw-medium">
              Semana <span className="text-danger">*</span>
            </label>
            <BuscadorSemana
              semanas={semanas}
              value={semanaUuid}
              onChange={setSemanaUuid}
              placeholder="Escribe o elige una semana..."
              className="form-control rounded-3"
            />
            <p className="form-text small">Solo se trae y procesa la programación de esa semana.</p>
          </div>

          {error && <div className="alert alert-danger py-2 small">{error}</div>}

          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1" onClick={onClose}>
              <FiX /> Cancelar
            </button>
            <button
              type="button"
              className="btn btn-brand btn-sm rounded-3 flex-grow-1 d-flex align-items-center justify-content-center gap-1"
              disabled={sincronizando || !semanaUuid}
              onClick={handleSincronizar}
            >
              <FiRefreshCw /> {sincronizando ? "Sincronizando..." : "Sincronizar"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="alert alert-success py-2 small">
            Se reemplazó toda la programación de esa semana: <strong>{resultado.borrados ?? 0}</strong> registro(s)
            anterior(es) borrado(s), <strong>{resultado.creados}</strong> nuevo(s) creado(s) de{" "}
            {resultado.totalFilas} fila(s) recibidas de Logística.
          </div>
          {resultado.errores?.length > 0 && (
            <div className="alert alert-warning py-2 small">
              <p className="mb-1">{resultado.errores.length} fila(s) con error:</p>
              <ul className="mb-0 ps-3">
                {Object.entries(
                  resultado.errores.reduce((acc, e) => {
                    acc[e.error] = (acc[e.error] || 0) + 1;
                    return acc;
                  }, {}),
                ).map(([mensaje, cantidad]) => (
                  <li key={mensaje}>
                    {mensaje} ({cantidad})
                  </li>
                ))}
              </ul>
            </div>
          )}
          {resultado.advertencias?.length > 0 && (
            <div className="alert alert-warning py-2 small">
              <p className="mb-1 fw-medium">Atención — hay productos sin peso neto configurado:</p>
              <ul className="mb-0 ps-3">
                {resultado.advertencias.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="d-flex justify-content-end">
            <button type="button" className="btn btn-brand btn-sm rounded-3" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

// ─── Vista previa: la misma tabla del Excel (cajas por producto, por semana con el total de cada mes, o por mes) ───
function VistaPreviaModal({ datos, onClose, onDescargar }) {
  const [periodo, setPeriodo] = useState("semana");
  const { cols, grupos, kilosDe, sinPeso } = armarTablaProgramacion(datos.registros);
  const filas = grupos(periodo);
  const total = {};
  for (const f of filas) if (!f.esSubtotal) for (const p of cols) total[p.uuid] = (total[p.uuid] || 0) + (f.productos[p.uuid] || 0);
  const suma = (m) => cols.reduce((t, p) => t + (m[p.uuid] || 0), 0);
  const n = (v) => (v ? Math.round(v).toLocaleString("es-CO") : "");
  const verde = "#166534";
  const celda = { textAlign: "center", whiteSpace: "nowrap" };
  return (
    <ModalShell
      title={`${datos.titulo} · Cajas por producto`}
      onClose={onClose}
      width="min(1200px, 96vw)"
      acciones={
        <button type="button" className="btn btn-sm btn-success d-flex align-items-center gap-1" onClick={onDescargar}>
          <FiDownload /> Descargar Excel
        </button>
      }
    >
      <div className="d-flex align-items-center gap-2 mb-2">
        <div className="btn-group btn-group-sm">
          <button type="button" className={`btn ${periodo === "semana" ? "btn-success" : "btn-outline-success"}`} onClick={() => setPeriodo("semana")}>
            Por semana
          </button>
          <button type="button" className={`btn ${periodo === "mes" ? "btn-success" : "btn-outline-success"}`} onClick={() => setPeriodo("mes")}>
            Total por mes
          </button>
        </div>
        <span className="small text-secondary">Cajas programadas por producto; kilos = cajas × peso neto del producto.</span>
      </div>
      <div className="table-responsive" style={{ maxHeight: "65vh" }}>
        <table className="table table-sm table-bordered align-middle mb-0 small">
          <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
            <tr>
              {[periodo === "semana" ? "Semana" : "Mes", ...cols.map((p) => p.nombre), "Total cajas", "Kilos"].map((t, i) => (
                <th key={i} style={{ ...celda, background: verde, color: "#fff", whiteSpace: "normal", minWidth: i === 0 ? 120 : 90, ...(i === 0 ? { position: "sticky", left: 0 } : {}) }}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => {
              const fondo = f.esSubtotal ? "#cfe5d6" : undefined;
              return (
                <tr key={i} style={f.esSubtotal ? { fontWeight: 600, borderTop: "2px solid #14532d" } : undefined}>
                  <td style={{ ...celda, fontWeight: 600, color: "#14532d", background: f.esSubtotal ? "#b7d8c2" : "#e8f6ee", position: "sticky", left: 0 }}>{f.titulo}</td>
                  {cols.map((p) => (
                    <td key={p.uuid} style={{ ...celda, background: fondo }}>
                      {n(f.productos[p.uuid])}
                    </td>
                  ))}
                  <td style={{ ...celda, fontWeight: 600, background: fondo || "#d1ecdc" }}>{n(suma(f.productos))}</td>
                  <td style={{ ...celda, background: fondo }}>{n(kilosDe(f.productos))}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot style={{ position: "sticky", bottom: 0 }}>
            <tr>
              <td style={{ ...celda, background: verde, color: "#fff", fontWeight: 700, position: "sticky", left: 0 }}>Total</td>
              {cols.map((p) => (
                <td key={p.uuid} style={{ ...celda, background: verde, color: "#fff", fontWeight: 700 }}>
                  {n(total[p.uuid])}
                </td>
              ))}
              <td style={{ ...celda, background: verde, color: "#fff", fontWeight: 700 }}>{n(suma(total))}</td>
              <td style={{ ...celda, background: verde, color: "#fff", fontWeight: 700 }}>{n(kilosDe(total))}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {sinPeso.length > 0 && <div className="small text-secondary mt-2">* Sin peso neto (no suman kilos): {sinPeso.join(", ")}.</div>}
    </ModalShell>
  );
}
