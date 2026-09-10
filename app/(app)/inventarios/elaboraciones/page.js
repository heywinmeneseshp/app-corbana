"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiEye, FiPackage } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

// Elaboraciones: cada fila es una corrida de producción real (salida de
// componentes + entrada del artículo elaborado), generada a partir de una
// prueba de mezcla ya ÓPTIMA. La primera siempre nace desde "Crear
// elaborado" en Mezclas (que además crea el artículo) — este módulo es el
// historial/kardex de esas corridas, y permite producir MÁS del mismo
// artículo ya establecido (mezclas que ya tienen articuloElaborado
// asignado) sin volver a pasar por todo el flujo de laboratorio.
function emptyForm() {
  return { mezclaUuid: "", cantidadElaborada: "1", almacenUuid: "", fecha: "", observaciones: "" };
}

export default function ElaboracionesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });

  const [mezclasDisponibles, setMezclasDisponibles] = useState([]); // solo las que ya tienen articuloElaborado
  const [almacenes, setAlmacenes] = useState([]);

  const [filtros, setFiltros] = useState({ mezclaUuid: "", almacenUuid: "", fechaDesde: "", fechaHasta: "" });

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  // Detalle completo (con componentes de la receta) de la mezcla elegida
  // en el formulario — la lista de mezclasDisponibles no trae
  // componentes, solo GET /inventarios/mezclas/:uuid los trae.
  const [mezclaDetalle, setMezclaDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [detalleOpen, setDetalleOpen] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [detalleLoading, setDetalleLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "50" });
      Object.entries(filtros).forEach(([k, v]) => {
        if (v) qs.set(k, v);
      });
      const { items: rows, meta: m } = await apiFetch(`/inventarios/elaboraciones?${qs}`);
      setItems(rows);
      setMeta(m);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCombos() {
    try {
      const [mezclas, alms] = await Promise.all([
        apiFetch("/inventarios/mezclas?limit=100"),
        apiFetch("/inventarios/almacenes?limit=100&estado=true"),
      ]);
      setMezclasDisponibles((mezclas.items || []).filter((m) => m.articuloElaborado));
      setAlmacenes(alms.items || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    loadCombos();
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function aplicarFiltros() {
    if (page === 1) load();
    else setPage(1);
  }

  function limpiarFiltros() {
    setFiltros({ mezclaUuid: "", almacenUuid: "", fechaDesde: "", fechaHasta: "" });
    setPage(1);
    setTimeout(load, 0);
  }

  function openCreate() {
    setForm({ ...emptyForm(), fecha: new Date().toISOString().slice(0, 10) });
    setMezclaDetalle(null);
    setFormError("");
    setModalOpen(true);
  }

  async function handleSelectMezcla(mezclaUuid) {
    setForm((f) => ({ ...f, mezclaUuid }));
    if (!mezclaUuid) {
      setMezclaDetalle(null);
      return;
    }
    setCargandoDetalle(true);
    try {
      const detalle = await apiFetch(`/inventarios/mezclas/${mezclaUuid}`);
      setMezclaDetalle(detalle);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setCargandoDetalle(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    const mezclaVersionUuid = mezclaDetalle?.versiones?.[0]?.uuid;
    if (!mezclaVersionUuid) {
      setFormError("Selecciona una mezcla válida.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        mezclaVersionUuid,
        cantidadElaborada: Number(form.cantidadElaborada),
        almacenUuid: form.almacenUuid,
        fecha: form.fecha,
        observaciones: form.observaciones || null,
      };
      const resultado = await apiFetch("/inventarios/elaboraciones", { method: "POST", body: JSON.stringify(body) });
      if (resultado.requiereConfirmacion) {
        // Stock insuficiente en uno o más componentes — no se escribió
        // nada todavía.
        const detalle = resultado.advertencias.map((a) => a.mensaje).join("\n\n");
        const confirmarNegativo = confirm(
          `${detalle}\n\n¿Confirmás crear la elaboración de todas formas? El inventario quedará en negativo para el/los artículo(s) listados.`,
        );
        if (!confirmarNegativo) return;
        await apiFetch("/inventarios/elaboraciones", {
          method: "POST",
          body: JSON.stringify({ ...body, forzarSaldoNegativo: true }),
        });
      }
      setModalOpen(false);
      setPage(1);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function abrirDetalle(elab) {
    setDetalleOpen(true);
    setDetalleLoading(true);
    setDetalle(null);
    try {
      const data = await apiFetch(`/inventarios/elaboraciones/${elab.uuid}`);
      setDetalle(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetalleLoading(false);
    }
  }

  return (
    <RequirePermission code="menu.inventarios.elaboraciones">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Elaboraciones</h1>
            <p className="text-secondary mb-0">
              Cada corrida de producción: valida stock de componentes, descuenta los insumos y da entrada al
              artículo elaborado en un solo documento.
            </p>
          </div>
          {hasPermission("inventario.mezclas.elaborar") && (
            <button type="button" className="btn btn-brand rounded-3 d-flex align-items-center gap-2" onClick={openCreate}>
              <FiPlus /> Nueva elaboración
            </button>
          )}
        </div>

        <div className="card border-0 rounded-4 mb-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="card-body p-3">
            <div className="row g-2">
              <div className="col-6 col-md-3">
                <label className="form-label small mb-1">Mezcla</label>
                <select
                  className="form-select form-select-sm rounded-3"
                  value={filtros.mezclaUuid}
                  onChange={(e) => setFiltros((f) => ({ ...f, mezclaUuid: e.target.value }))}
                >
                  <option value="">Todas</option>
                  {mezclasDisponibles.map((m) => (
                    <option key={m.uuid} value={m.uuid}>
                      {m.nombre || m.codigo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small mb-1">Almacén</label>
                <select
                  className="form-select form-select-sm rounded-3"
                  value={filtros.almacenUuid}
                  onChange={(e) => setFiltros((f) => ({ ...f, almacenUuid: e.target.value }))}
                >
                  <option value="">Todos</option>
                  {almacenes.map((a) => (
                    <option key={a.uuid} value={a.uuid}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small mb-1">Desde</label>
                <input
                  type="date"
                  className="form-control form-control-sm rounded-3"
                  value={filtros.fechaDesde}
                  onChange={(e) => setFiltros((f) => ({ ...f, fechaDesde: e.target.value }))}
                />
              </div>
              <div className="col-6 col-md-3">
                <label className="form-label small mb-1">Hasta</label>
                <input
                  type="date"
                  className="form-control form-control-sm rounded-3"
                  value={filtros.fechaHasta}
                  onChange={(e) => setFiltros((f) => ({ ...f, fechaHasta: e.target.value }))}
                />
              </div>
            </div>
            <div className="d-flex gap-2 mt-3">
              <button type="button" className="btn btn-brand btn-sm rounded-3" onClick={aplicarFiltros}>
                Filtrar
              </button>
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={limpiarFiltros}>
                Limpiar
              </button>
            </div>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 rounded-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle">
              <thead>
                <tr className="table-light small text-secondary" style={{ borderBottom: "1px solid #e9ecef" }}>
                  <th className="fw-medium">Documento</th>
                  <th className="fw-medium">Fecha</th>
                  <th className="fw-medium">Artículo elaborado</th>
                  <th className="fw-medium">Mezcla origen</th>
                  <th className="fw-medium">Cantidad</th>
                  <th className="fw-medium">Costo unit.</th>
                  <th className="fw-medium">Costo total</th>
                  <th className="fw-medium">Almacén</th>
                  <th className="fw-medium">Usuario</th>
                  <th className="fw-medium text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} className="text-center text-secondary py-3 small">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center text-secondary py-3 small">
                      No hay elaboraciones registradas todavía.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((e) => {
                    const mezcla = e.version?.mezcla;
                    return (
                      <tr key={e.uuid} style={{ cursor: "pointer" }} onClick={() => abrirDetalle(e)}>
                        <td className="small fw-medium">{e.documento}</td>
                        <td className="small text-secondary">{e.fecha}</td>
                        <td className="small">{mezcla?.articuloElaborado?.nombre || "—"}</td>
                        <td className="small text-secondary">{mezcla?.nombre || mezcla?.codigo || "—"}</td>
                        <td className="small">
                          {Number(e.cantidadElaborada).toFixed(2)} {mezcla?.articuloElaborado?.unidadMedida?.simbolo || ""}
                        </td>
                        <td className="small text-secondary">{Number(e.costoUnitario).toFixed(2)}</td>
                        <td className="small text-secondary">{Number(e.costoTotal).toFixed(2)}</td>
                        <td className="small text-secondary">{e.almacen?.nombre || "—"}</td>
                        <td className="small text-secondary">{e.usuario?.usuario || "—"}</td>
                        <td onClick={(ev) => ev.stopPropagation()}>
                          <div className="d-flex justify-content-end">
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex text-secondary"
                              title="Ver detalle"
                              onClick={() => abrirDetalle(e)}
                            >
                              <FiEye size={15} />
                            </button>
                          </div>
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
            Mostrando página {meta.page} de {meta.totalPages} ({meta.total} elaboración(es))
          </span>
          {meta.totalPages > 1 && (
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary rounded-3"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
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

        {modalOpen && (
          <ModalShell title="Nueva elaboración" onClose={() => setModalOpen(false)} size="lg">
            <form onSubmit={handleCreate}>
              <p className="small text-secondary">
                Produce más del mismo artículo elaborado a partir de una mezcla que ya tiene su prueba de laboratorio
                validada y convertida — usa automáticamente los mismos componentes y proporciones.
              </p>
              <div className="mb-3">
                <label className="form-label small fw-medium">
                  Mezcla <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select rounded-3"
                  required
                  value={form.mezclaUuid}
                  onChange={(e) => handleSelectMezcla(e.target.value)}
                >
                  <option value="">Selecciona...</option>
                  {mezclasDisponibles.map((m) => (
                    <option key={m.uuid} value={m.uuid}>
                      {(m.nombre || m.codigo) + " — " + (m.articuloElaborado?.nombre || "")}
                    </option>
                  ))}
                </select>
                {mezclasDisponibles.length === 0 && (
                  <p className="form-text small mb-0">
                    Todavía no hay ninguna mezcla con un artículo elaborado creado — primero convertí una prueba
                    ÓPTIMA desde el módulo de Mezclas.
                  </p>
                )}
              </div>
              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-medium">Cantidad a elaborar</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    className="form-control rounded-3"
                    value={form.cantidadElaborada}
                    onChange={(e) => setForm((f) => ({ ...f, cantidadElaborada: e.target.value }))}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Fecha</label>
                  <input
                    type="date"
                    required
                    className="form-control rounded-3"
                    value={form.fecha}
                    onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label small fw-medium">Almacén</label>
                <select
                  className="form-select rounded-3"
                  required
                  value={form.almacenUuid}
                  onChange={(e) => setForm((f) => ({ ...f, almacenUuid: e.target.value }))}
                >
                  <option value="">Selecciona...</option>
                  {almacenes.map((a) => (
                    <option key={a.uuid} value={a.uuid}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {cargandoDetalle && <p className="small text-secondary">Cargando componentes de la receta...</p>}
              <PreviewComponentes mezclaDetalle={mezclaDetalle} cantidadElaborada={form.cantidadElaborada} almacenUuid={form.almacenUuid} />

              <div className="mb-3">
                <label className="form-label small fw-medium">Observaciones</label>
                <textarea
                  className="form-control rounded-3"
                  rows={2}
                  value={form.observaciones}
                  onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
                />
              </div>
              {formError && <div className="alert alert-danger py-2 small">{formError}</div>}
              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary rounded-3" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-brand rounded-3" disabled={saving}>
                  {saving ? "Creando..." : "Crear elaboración"}
                </button>
              </div>
            </form>
          </ModalShell>
        )}

        {detalleOpen && (
          <ModalShell title="Detalle de elaboración" onClose={() => setDetalleOpen(false)} size="lg">
            {detalleLoading ? (
              <p className="text-secondary small mb-0">Cargando...</p>
            ) : !detalle ? (
              <p className="text-secondary small mb-0">No se pudo cargar el detalle.</p>
            ) : (
              <div>
                <div className="d-flex flex-wrap gap-4 mb-3">
                  <span className="small">
                    Documento: <strong>{detalle.documento}</strong>
                  </span>
                  <span className="small text-secondary">Fecha: {detalle.fecha}</span>
                  <span className="small text-secondary">Almacén: {detalle.almacen?.nombre || "—"}</span>
                  <span className="small text-secondary">Usuario: {detalle.usuario?.usuario || "—"}</span>
                </div>

                <div className="card border-0 rounded-3 mb-3" style={{ backgroundColor: "#f0fdf4" }}>
                  <div className="card-body p-3 d-flex align-items-center gap-3">
                    <FiPackage size={22} style={{ color: "#047857" }} />
                    <div>
                      <p className="mb-0 fw-medium">
                        {detalle.version?.mezcla?.articuloElaborado?.nombre || "—"} — {Number(detalle.cantidadElaborada).toFixed(2)}{" "}
                        {detalle.version?.mezcla?.articuloElaborado?.unidadMedida?.simbolo || ""}
                      </p>
                      <p className="mb-0 small text-secondary">
                        Costo unitario: {Number(detalle.costoUnitario).toFixed(2)} — Costo total:{" "}
                        {Number(detalle.costoTotal).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="small fw-medium mb-2">
                  Mezcla origen: {detalle.version?.mezcla?.nombre || detalle.version?.mezcla?.codigo || "—"}
                </p>

                {(() => {
                  // factor = misma "regla de tres" que aplica de verdad
                  // elaboracion.service.js#create al descontar — sin esto,
                  // esta tabla mostraba la cantidad de la RECETA (sin
                  // escalar), no la que realmente correspondía a este
                  // documento puntual (solo coincidían quienes tenían
                  // cantidadElaborada === rendimiento).
                  const rendimiento = Number(detalle.version?.mezcla?.rendimiento ?? 1) || 1;
                  const factor = Number(detalle.cantidadElaborada) / rendimiento;
                  return (
                    <>
                      <p className="small fw-medium mb-2">Componentes consumidos (a esta escala de producción)</p>
                      <div className="table-responsive mb-3">
                        <table className="table table-sm mb-0">
                          <thead>
                            <tr className="small text-secondary">
                              <th>Artículo</th>
                              <th>Cantidad usada</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(detalle.version?.componentes || []).map((c) => (
                              <tr key={c.uuid}>
                                <td className="small">{c.articulo?.nombre || "—"}</td>
                                <td className="small text-secondary">
                                  {(Number(c.cantidad) * factor).toLocaleString("es-CO", { maximumFractionDigits: 4 })}{" "}
                                  {c.unidad?.simbolo || ""}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  );
                })()}

                {detalle.observaciones && (
                  <div className="alert alert-secondary py-2 small mb-0">{detalle.observaciones}</div>
                )}
              </div>
            )}
            <div className="d-flex justify-content-end mt-3">
              <button type="button" className="btn btn-outline-secondary rounded-3" onClick={() => setDetalleOpen(false)}>
                Cerrar
              </button>
            </div>
          </ModalShell>
        )}
      </div>
    </RequirePermission>
  );
}

// Regla de tres en vivo: por cada componente de la receta, cuánto hace
// falta para la cantidad que se está por elaborar (mismo cálculo que
// aplica de verdad elaboracion.service.js#create al guardar: factor =
// cantidadElaborada/rendimiento, cantidadNecesaria = comp.cantidad ×
// factor) — acá solo para mostrarlo ANTES de confirmar. Si además ya se
// eligió almacén, muestra el saldo disponible de cada componente ahí
// (en rojo si no alcanza) usando el mismo endpoint de existencias que ya
// usa el módulo de Movimientos.
function PreviewComponentes({ mezclaDetalle, cantidadElaborada, almacenUuid }) {
  const [existencias, setExistencias] = useState({}); // { articuloUuid: saldo }

  const componentes = mezclaDetalle?.versiones?.[0]?.componentes || [];
  const rendimiento = Number(mezclaDetalle?.rendimiento ?? 1) || 1;
  const cantidadNum = Number(cantidadElaborada);
  const factor = Number.isFinite(cantidadNum) && cantidadNum > 0 ? cantidadNum / rendimiento : 0;

  useEffect(() => {
    let cancelado = false;
    const consultar =
      !almacenUuid || componentes.length === 0
        ? Promise.resolve({})
        : Promise.all(
            componentes.map((c) =>
              apiFetch(`/inventarios/movimientos/existencias?almacenUuid=${almacenUuid}&articuloUuid=${c.articulo.uuid}`)
                .then((rows) => ({ uuid: c.articulo.uuid, saldo: rows?.[0]?.saldo ?? 0 }))
                .catch(() => ({ uuid: c.articulo.uuid, saldo: null })),
            ),
          ).then((resultados) => {
            const mapa = {};
            resultados.forEach((r) => {
              mapa[r.uuid] = r.saldo;
            });
            return mapa;
          });

    consultar.then((mapa) => {
      if (!cancelado) setExistencias(mapa);
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [almacenUuid, componentes.map((c) => c.articulo?.uuid).join(",")]);

  if (!mezclaDetalle || componentes.length === 0 || factor === 0) return null;

  return (
    <div className="mb-3">
      <p className="small fw-medium mb-1">
        Insumos necesarios para {cantidadNum} {mezclaDetalle.articuloElaborado?.unidadMedida?.simbolo || ""} (receta
        rinde {rendimiento} {mezclaDetalle.articuloElaborado?.unidadMedida?.simbolo || ""} por lote)
      </p>
      <div className="table-responsive">
        <table className="table table-sm mb-0">
          <thead>
            <tr className="small text-secondary">
              <th>Artículo</th>
              <th>Cantidad necesaria</th>
              {almacenUuid && <th>Disponible</th>}
            </tr>
          </thead>
          <tbody>
            {componentes.map((c) => {
              const necesaria = Number(c.cantidad) * factor;
              const saldo = existencias[c.articulo?.uuid];
              const alcanza = saldo === null || saldo === undefined ? null : saldo >= necesaria;
              return (
                <tr key={c.uuid}>
                  <td className="small">{c.articulo?.nombre || "—"}</td>
                  <td className="small fw-medium">
                    {necesaria.toLocaleString("es-CO", { maximumFractionDigits: 4 })} {c.unidad?.simbolo || ""}
                  </td>
                  {almacenUuid && (
                    <td className={`small ${alcanza === false ? "text-danger fw-medium" : "text-secondary"}`}>
                      {saldo === null || saldo === undefined ? "…" : `${Number(saldo).toFixed(2)} ${c.unidad?.simbolo || ""}`}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
