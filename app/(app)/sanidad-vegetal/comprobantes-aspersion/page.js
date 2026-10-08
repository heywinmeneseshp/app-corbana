"use client";

import { useEffect, useState } from "react";
import { FiEye, FiDownload, FiEdit2, FiCheck, FiTrash2, FiSearch, FiFileText } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";
import { descargarComprobanteAspersionPdf, verComprobanteAspersionPdf } from "@/lib/comprobanteAspersionExport";

const MEDIO_LABEL = { AVION: "Avión", DRON: "Dron" };

function fmtFecha(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
}

const num = (v) => (v === null || v === undefined || v === "" ? "—" : Number(v).toLocaleString("es-CO", { maximumFractionDigits: 2 }));

function EstadoBadge({ estado }) {
  const emitido = estado === "EMITIDO";
  return (
    <span
      className="badge rounded-pill"
      style={{ backgroundColor: emitido ? "#d1fae5" : "#fef3c7", color: emitido ? "#047857" : "#b45309" }}
    >
      {emitido ? "Emitido" : "Borrador"}
    </span>
  );
}

export default function ComprobantesAspersionPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fincas, setFincas] = useState([]);

  // `filtros` es lo que se escribe; `aplicados` lo que realmente se consulta
  // (se aplican con el botón Filtrar o con Enter).
  const [filtros, setFiltros] = useState({ search: "", estado: "", fincaUuid: "" });
  const [aplicados, setAplicados] = useState({ search: "", estado: "", fincaUuid: "" });

  const [edicion, setEdicion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [procesandoUuid, setProcesandoUuid] = useState("");

  const puedeEditar = hasPermission("sanidad_vegetal.comprobantes_aspersion.editar");
  const puedeEmitir = hasPermission("sanidad_vegetal.comprobantes_aspersion.emitir");
  const puedeEliminar = hasPermission("sanidad_vegetal.comprobantes_aspersion.eliminar");

  async function load(f = aplicados, p = page) {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ page: String(p), limit: "20" });
      if (f.search) qs.set("search", f.search);
      if (f.estado) qs.set("estado", f.estado);
      if (f.fincaUuid) qs.set("fincaUuid", f.fincaUuid);
      const { items: rows, meta: m } = await apiFetch(`/comprobantes-aspersion?${qs}`);
      setItems(rows);
      setMeta(m);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    apiFetch("/fincas?limit=100&soloOperativas=true")
      .then((r) => setFincas(r.items || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function aplicarFiltros(e) {
    e?.preventDefault();
    setAplicados(filtros);
    if (page === 1) load(filtros, 1);
    else setPage(1);
  }

  function limpiarFiltros() {
    const vacios = { search: "", estado: "", fincaUuid: "" };
    setFiltros(vacios);
    setAplicados(vacios);
    if (page === 1) load(vacios, 1);
    else setPage(1);
  }

  // El listado NO trae los insumos de la mezcla (por rendimiento): para el
  // PDF y la edición se pide el detalle completo del comprobante.
  async function obtenerDetalle(c) {
    try {
      return await apiFetch(`/comprobantes-aspersion/${c.uuid}`);
    } catch (err) {
      setError(err.message);
      return null;
    }
  }

  async function verPdf(c) {
    const detalle = await obtenerDetalle(c);
    if (detalle) verComprobanteAspersionPdf(detalle);
  }

  async function descargarPdf(c) {
    const detalle = await obtenerDetalle(c);
    if (detalle) descargarComprobanteAspersionPdf(detalle);
  }

  async function abrirEdicionConDetalle(c) {
    const detalle = await obtenerDetalle(c);
    if (detalle) abrirEdicion(detalle);
  }

  function abrirEdicion(c) {
    setEdicion({
      comprobante: c,
      piloto: c.piloto || "",
      medio: c.medio || c.aspersion?.medio || "",
      hectareasAplicadas: c.hectareasAplicadas !== null && c.hectareasAplicadas !== undefined ? String(Number(c.hectareasAplicadas)) : "",
      galonesTotales: c.galonesTotales !== null && c.galonesTotales !== undefined ? String(Number(c.galonesTotales)) : "",
      observaciones: c.observaciones || "",
      aeronave: c.aeronave || "",
      volumenAplicacionHa: c.volumenAplicacionHa != null ? String(Number(c.volumenAplicacionHa)) : "",
      temperaturaInicial: c.temperaturaInicial != null ? String(Number(c.temperaturaInicial)) : "",
      temperaturaFinal: c.temperaturaFinal != null ? String(Number(c.temperaturaFinal)) : "",
      velocidadViento: c.velocidadViento != null ? String(Number(c.velocidadViento)) : "",
      humedadRelativaFinal: c.humedadRelativaFinal != null ? String(Number(c.humedadRelativaFinal)) : "",
      horaInicio: c.horaInicio || "",
      horaFinal: c.horaFinal || "",
      error: "",
    });
  }

  async function guardarEdicion(emitirDespues) {
    const m = edicion;
    if (emitirDespues && (!m.piloto.trim() || !(Number(m.hectareasAplicadas) > 0))) {
      setEdicion({ ...m, error: "Para emitir completa el piloto y las hectáreas aplicadas." });
      return;
    }
    setGuardando(true);
    try {
      const body = {
        piloto: m.piloto.trim() || null,
        medio: m.medio || null,
        observaciones: m.observaciones.trim() || null,
        aeronave: m.aeronave.trim() || null,
        horaInicio: m.horaInicio || null,
        horaFinal: m.horaFinal || null,
        volumenAplicacionHa: m.volumenAplicacionHa !== "" ? Number(m.volumenAplicacionHa) : null,
        temperaturaInicial: m.temperaturaInicial !== "" ? Number(m.temperaturaInicial) : null,
        temperaturaFinal: m.temperaturaFinal !== "" ? Number(m.temperaturaFinal) : null,
        velocidadViento: m.velocidadViento !== "" ? Number(m.velocidadViento) : null,
        humedadRelativaFinal: m.humedadRelativaFinal !== "" ? Number(m.humedadRelativaFinal) : null,
        ...(m.hectareasAplicadas !== "" ? { hectareasAplicadas: Number(m.hectareasAplicadas) } : {}),
        ...(m.galonesTotales !== "" ? { galonesTotales: Number(m.galonesTotales) } : {}),
      };
      let actualizado = await apiFetch(`/comprobantes-aspersion/${m.comprobante.uuid}`, { method: "PUT", body: JSON.stringify(body) });
      if (emitirDespues) {
        actualizado = await apiFetch(`/comprobantes-aspersion/${m.comprobante.uuid}/emitir`, { method: "POST", body: JSON.stringify({}) });
      }
      setItems((prev) => prev.map((it) => (it.uuid === actualizado.uuid ? actualizado : it)));
      setEdicion(null);
    } catch (err) {
      setEdicion({ ...m, error: err.message });
    } finally {
      setGuardando(false);
    }
  }

  async function emitir(c) {
    if (!c.piloto || !(Number(c.hectareasAplicadas) > 0)) {
      abrirEdicionConDetalle(c);
      return;
    }
    if (!confirm(`¿Emitir el comprobante ${c.numero}? Después ya no se podrá editar.`)) return;
    setProcesandoUuid(c.uuid);
    try {
      const actualizado = await apiFetch(`/comprobantes-aspersion/${c.uuid}/emitir`, { method: "POST", body: JSON.stringify({}) });
      setItems((prev) => prev.map((it) => (it.uuid === actualizado.uuid ? actualizado : it)));
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesandoUuid("");
    }
  }

  async function eliminar(c) {
    if (!confirm(`¿Eliminar el borrador ${c.numero}? La aspersión seguirá ejecutada, pero quedará sin comprobante.`)) return;
    setProcesandoUuid(c.uuid);
    try {
      await apiFetch(`/comprobantes-aspersion/${c.uuid}`, { method: "DELETE" });
      setItems((prev) => prev.filter((it) => it.uuid !== c.uuid));
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesandoUuid("");
    }
  }

  return (
    <RequirePermission code="menu.sanidad_vegetal.comprobantes_aspersion">
      <div className="p-3 p-md-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <div>
            <h1 className="fw-bold h4 mb-1 d-flex align-items-center gap-2">
              <FiFileText /> Comprobante de aspersiones
            </h1>
            <p className="text-secondary small mb-0">
              Se genera en borrador al ejecutar una aspersión. Complétalo y emítelo; el PDF muestra la mezcla, las hectáreas, el
              piloto, los galones y quién ejecutó.
            </p>
          </div>
        </div>

        <div className="card border-0 rounded-2 mb-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <form className="card-body p-3 row g-2 align-items-end" onSubmit={aplicarFiltros}>
            <div className="col-12 col-md-4">
              <label className="form-label small mb-1">Buscar</label>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-white">
                  <FiSearch />
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="N.°, piloto, finca o mezcla"
                  value={filtros.search}
                  onChange={(e) => setFiltros((f) => ({ ...f, search: e.target.value }))}
                />
              </div>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small mb-1">Finca</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={filtros.fincaUuid}
                onChange={(e) => setFiltros((f) => ({ ...f, fincaUuid: e.target.value }))}
              >
                <option value="">Todas</option>
                {fincas.map((f) => (
                  <option key={f.uuid} value={f.uuid}>
                    {f.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small mb-1">Estado</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={filtros.estado}
                onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}
              >
                <option value="">Todos</option>
                <option value="BORRADOR">Borrador</option>
                <option value="EMITIDO">Emitido</option>
              </select>
            </div>
            <div className="col-12 col-md-3 d-flex gap-2">
              <button type="submit" className="btn btn-brand btn-sm rounded-3">
                Filtrar
              </button>
              {(aplicados.search || aplicados.estado || aplicados.fincaUuid || filtros.search || filtros.estado || filtros.fincaUuid) && (
                <button type="button" className="btn btn-sm btn-link text-secondary text-decoration-none" onClick={limpiarFiltros}>
                  Limpiar
                </button>
              )}
            </div>
          </form>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 rounded-2" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr className="small" style={{ backgroundColor: "#f0fdf4", color: "#166534" }}>
                  <th>N.°</th>
                  <th>Ejecutada</th>
                  <th>Finca</th>
                  <th>Mezcla</th>
                  <th>Con</th>
                  <th className="text-end">Ha aplic.</th>
                  <th className="text-end">Galones</th>
                  <th>Estado</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="text-center text-secondary small py-4">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-secondary small py-4">
                      No hay comprobantes. Se crean automáticamente al ejecutar una aspersión.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((c) => {
                    const borrador = c.estado === "BORRADOR";
                    const ocupado = procesandoUuid === c.uuid;
                    return (
                      <tr key={c.uuid} className="small">
                        <td className="fw-semibold">{c.numero}</td>
                        <td className="text-nowrap">{fmtFecha(c.ejecutadoEn)}</td>
                        <td>{c.aspersion?.finca?.nombre || "—"}</td>
                        <td>{c.aspersion?.mezcla?.nombre || c.aspersion?.mezcla?.codigo || "—"}</td>
                        <td>{MEDIO_LABEL[c.medio] || "—"}</td>
                        <td className="text-end">{num(c.hectareasAplicadas)}</td>
                        <td className="text-end">{num(c.galonesTotales)}</td>
                        <td>
                          <EstadoBadge estado={c.estado} />
                        </td>
                        <td className="text-end text-nowrap">
                          <button type="button" className="btn btn-sm btn-link p-1 text-secondary" title="Ver PDF" onClick={() => verPdf(c)}>
                            <FiEye size={15} />
                          </button>
                          <button type="button" className="btn btn-sm btn-link p-1 text-secondary" title="Descargar PDF" onClick={() => descargarPdf(c)}>
                            <FiDownload size={15} />
                          </button>
                          {borrador && puedeEditar && (
                            <button type="button" className="btn btn-sm btn-link p-1 text-secondary" title="Editar" onClick={() => abrirEdicionConDetalle(c)}>
                              <FiEdit2 size={15} />
                            </button>
                          )}
                          {borrador && puedeEmitir && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1"
                              style={{ color: "#166534" }}
                              title="Emitir"
                              disabled={ocupado}
                              onClick={() => emitir(c)}
                            >
                              <FiCheck size={16} />
                            </button>
                          )}
                          {borrador && puedeEliminar && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1"
                              style={{ color: "#dc2626" }}
                              title="Eliminar borrador"
                              disabled={ocupado}
                              onClick={() => eliminar(c)}
                            >
                              <FiTrash2 size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mt-3">
          <span className="small text-secondary">
            Página {meta.page} de {meta.totalPages} ({meta.total} comprobante(s))
          </span>
          {meta.totalPages > 1 && (
            <div className="d-flex gap-2">
              <button type="button" className="btn btn-sm btn-outline-secondary rounded-3" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Anterior
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-3"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>

        {edicion && (
          <ModalShell title={`Editar comprobante ${edicion.comprobante.numero}`} onClose={() => setEdicion(null)} width="34rem">
            <div className="rounded-3 p-2 mb-3 small" style={{ backgroundColor: "#f0fdf4" }}>
              <div>
                <strong>{edicion.comprobante.aspersion?.finca?.nombre}</strong> ·{" "}
                {edicion.comprobante.aspersion?.mezcla?.nombre || edicion.comprobante.aspersion?.mezcla?.codigo}
              </div>
              <div className="text-secondary">
                {num(edicion.comprobante.hectareasProgramadas)} ha programadas · aspersión {edicion.comprobante.aspersion?.numero}
              </div>
              <div className="text-secondary mt-1">
                Insumos: {(edicion.comprobante.insumos || []).map((i) => i.nombre).join(" · ") || "—"}
              </div>
            </div>
            {edicion.error && <div className="alert alert-danger py-2 small">{edicion.error}</div>}
            <div className="row g-2">
              <div className="col-8">
                <label className="form-label small fw-medium mb-1">Piloto *</label>
                <input
                  type="text"
                  className="form-control form-control-sm rounded-3"
                  maxLength={150}
                  value={edicion.piloto}
                  onChange={(e) => setEdicion((m) => ({ ...m, piloto: e.target.value }))}
                />
              </div>
              <div className="col-4">
                <label className="form-label small fw-medium mb-1">Aplicado con</label>
                <select
                  className="form-select form-select-sm rounded-3"
                  value={edicion.medio}
                  onChange={(e) => setEdicion((m) => ({ ...m, medio: e.target.value }))}
                >
                  <option value="">—</option>
                  <option value="AVION">Avión</option>
                  <option value="DRON">Dron</option>
                </select>
              </div>
              <div className="col-6">
                <label className="form-label small fw-medium mb-1">Hectáreas aplicadas *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  className="form-control form-control-sm rounded-3"
                  value={edicion.hectareasAplicadas}
                  onChange={(e) => setEdicion((m) => ({ ...m, hectareasAplicadas: e.target.value }))}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-medium mb-1">Galones totales</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control form-control-sm rounded-3"
                  value={edicion.galonesTotales}
                  onChange={(e) => setEdicion((m) => ({ ...m, galonesTotales: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label small fw-medium mb-1">Aeronave</label>
                <input
                  type="text"
                  maxLength={150}
                  className="form-control form-control-sm rounded-3"
                  value={edicion.aeronave}
                  onChange={(e) => setEdicion((m) => ({ ...m, aeronave: e.target.value }))}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-medium mb-1">Volumen de aplicación por hectárea (gal/ha)</label>
                <input
                  type="number"
                  step="0.01" min="0"
                  className="form-control form-control-sm rounded-3"
                  value={edicion.volumenAplicacionHa}
                  onChange={(e) => setEdicion((m) => ({ ...m, volumenAplicacionHa: e.target.value }))}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-medium mb-1">Velocidad del viento (km/h)</label>
                <input
                  type="number"
                  step="0.1" min="0"
                  className="form-control form-control-sm rounded-3"
                  value={edicion.velocidadViento}
                  onChange={(e) => setEdicion((m) => ({ ...m, velocidadViento: e.target.value }))}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-medium mb-1">Temperatura inicial (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-control form-control-sm rounded-3"
                  value={edicion.temperaturaInicial}
                  onChange={(e) => setEdicion((m) => ({ ...m, temperaturaInicial: e.target.value }))}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-medium mb-1">Temperatura final (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-control form-control-sm rounded-3"
                  value={edicion.temperaturaFinal}
                  onChange={(e) => setEdicion((m) => ({ ...m, temperaturaFinal: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label small fw-medium mb-1">Humedad relativa final (%)</label>
                <input
                  type="number"
                  step="0.1" min="0" max="100"
                  className="form-control form-control-sm rounded-3"
                  value={edicion.humedadRelativaFinal}
                  onChange={(e) => setEdicion((m) => ({ ...m, humedadRelativaFinal: e.target.value }))}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-medium mb-1">Hora inicio</label>
                <input
                  type="time"
                  
                  className="form-control form-control-sm rounded-3"
                  value={edicion.horaInicio}
                  onChange={(e) => setEdicion((m) => ({ ...m, horaInicio: e.target.value }))}
                />
              </div>
              <div className="col-6">
                <label className="form-label small fw-medium mb-1">Hora final</label>
                <input
                  type="time"
                  
                  className="form-control form-control-sm rounded-3"
                  value={edicion.horaFinal}
                  onChange={(e) => setEdicion((m) => ({ ...m, horaFinal: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label small fw-medium mb-1">Observaciones</label>
                <textarea
                  className="form-control form-control-sm rounded-3"
                  rows={2}
                  maxLength={1000}
                  value={edicion.observaciones}
                  onChange={(e) => setEdicion((m) => ({ ...m, observaciones: e.target.value }))}
                />
              </div>
            </div>
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button type="button" className="btn btn-sm btn-link text-secondary text-decoration-none" onClick={() => setEdicion(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-outline-success btn-sm rounded-3" disabled={guardando} onClick={() => guardarEdicion(false)}>
                {guardando ? "Guardando..." : "Guardar borrador"}
              </button>
              {puedeEmitir && (
                <button type="button" className="btn btn-brand btn-sm rounded-3" disabled={guardando} onClick={() => guardarEdicion(true)}>
                  Guardar y emitir
                </button>
              )}
            </div>
          </ModalShell>
        )}
      </div>
    </RequirePermission>
  );
}
