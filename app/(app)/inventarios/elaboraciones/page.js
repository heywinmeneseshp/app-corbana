"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiPlus, FiEye, FiX, FiInfo } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";
import { construirGrafoUnidades, convertirCantidad } from "@/lib/unidadConversion";

// Mezclas: maestro de recetas ya convertidas — creadas directo ("Nueva
// mezcla", sin prueba de laboratorio) o a partir de una prueba de
// laboratorio exitosa — cada una con su propio consecutivo MEZ-000X y su
// artículo elaborado activo. Pedido explícito: "eso no debe ser una tabla
// de historial, debe ser solo un maestro de mezclas". Clic en una fila
// (o el ícono de ojo) lleva al detalle de la receta, la misma pantalla que
// usa Mezclas — Pruebas de laboratorio.
function emptyForm() {
  return { mezclaUuid: "", cantidadElaborada: "1", almacenUuid: "", fecha: "", observaciones: "" };
}

function emptyDirectaForm() {
  return { articuloNombre: "", articuloCodigo: "", articuloCategoriaUuid: "", articuloUnidadMedidaUuid: "" };
}

// Sugerencia de código: continúa el correlativo "MEZ-000N" de la última
// mezcla/producto elaborado ya creado, con prefijo "ELAB-" — mismo criterio
// "sugerido pero editable" que ya se usa en mezclas/[uuid]/page.js
// (mezcla.codigo.replace(/^MEZ/, "ELAB")). Como acá la mezcla todavía no
// existe (se crea recién al guardar), se calcula a partir del código MEZ-
// más alto que ya haya en la lista de mezclas cargada.
function siguienteCodigoSugerido(mezclas) {
  let maximo = 0;
  for (const m of mezclas) {
    const match = /^MEZ-(\d+)$/.exec(m.codigo || "");
    if (match) maximo = Math.max(maximo, parseInt(match[1], 10));
  }
  return `ELAB-${String(maximo + 1).padStart(4, "0")}`;
}

function emptyInsumoRow() {
  return { key: Math.random().toString(36).slice(2), articuloUuid: "", cantidad: "1", unidadUuid: "" };
}

export default function ElaboracionesPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loadingMezclas, setLoadingMezclas] = useState(true);

  // Maestro de mezclas: una fila por mezcla — creada directo ("Nueva
  // mezcla") o a partir de una prueba de laboratorio exitosa (Mezclas —
  // Pruebas de laboratorio) — que ya tiene su artículo elaborado activo.
  // Pedido explícito: "eso no debe ser una tabla de historial, debe ser
  // solo un maestro de mezclas". Clic en una fila lleva al detalle de la
  // receta (misma pantalla que usa Mezclas — Pruebas de laboratorio).
  const [mezclasDisponibles, setMezclasDisponibles] = useState([]); // solo las que ya tienen articuloElaborado activo
  const [todasLasMezclas, setTodasLasMezclas] = useState([]); // sin filtrar, para sugerir el próximo código
  const [almacenes, setAlmacenes] = useState([]);
  const [categoriasElaborado, setCategoriasElaborado] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [conversiones, setConversiones] = useState([]);

  const [filtros, setFiltros] = useState({ search: "", almacenUuid: "" });

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [directaForm, setDirectaForm] = useState(emptyDirectaForm());
  const [insumoRows, setInsumoRows] = useState([emptyInsumoRow()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Detalle de una mezcla: insumos de la receta + costo — se pide en el
  // momento (GET /inventarios/mezclas/:uuid no viene incluido en el
  // listado, que solo trae lo necesario para la tabla).
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [detalleMezcla, setDetalleMezcla] = useState(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [dosisEditando, setDosisEditando] = useState("");
  const [dosisUnidadEditando, setDosisUnidadEditando] = useState("");
  const [guardandoDosis, setGuardandoDosis] = useState(false);

  async function loadCombos() {
    setLoadingMezclas(true);
    setError("");
    try {
      const [mezclas, alms, categorias, arts, unis, convs] = await Promise.all([
        apiFetch("/inventarios/mezclas?limit=100"),
        apiFetch("/inventarios/almacenes?limit=100&estado=true"),
        apiFetch("/inventarios/categorias?limit=100&tipo=ELABORADO&estado=true"),
        apiFetch("/inventarios/articulos?limit=100&estado=true"),
        apiFetch("/inventarios/unidades?limit=100&estado=true"),
        apiFetch("/inventarios/unidades/conversiones"),
      ]);
      const mezclasItems = mezclas.items || [];
      setMezclasDisponibles(mezclasItems.filter((m) => m.articuloElaborado?.estado));
      setTodasLasMezclas(mezclasItems);
      setAlmacenes(alms.items || []);
      setCategoriasElaborado(categorias.items || []);
      setArticulos(arts.items || []);
      setUnidades(unis.items || []);
      setConversiones(Array.isArray(convs) ? convs : convs.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMezclas(false);
    }
  }

  useEffect(() => {
    loadCombos();
  }, []);

  const mezclasFiltradas = mezclasDisponibles.filter((m) => {
    const texto = filtros.search.trim().toLowerCase();
    const coincideTexto =
      !texto || m.nombre?.toLowerCase().includes(texto) || m.codigo?.toLowerCase().includes(texto);
    const coincideAlmacen = !filtros.almacenUuid || m.versiones?.[0]?.almacen?.uuid === filtros.almacenUuid;
    return coincideTexto && coincideAlmacen;
  });

  function limpiarFiltros() {
    setFiltros({ search: "", almacenUuid: "" });
  }

  function openCreate() {
    setForm(emptyForm());
    setDirectaForm({ ...emptyDirectaForm(), articuloCodigo: siguienteCodigoSugerido(todasLasMezclas) });
    setInsumoRows([emptyInsumoRow()]);
    setFormError("");
    setModalOpen(true);
  }

  function updateInsumoRow(key, patch) {
    setInsumoRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addInsumoRow() {
    setInsumoRows((rows) => [...rows, emptyInsumoRow()]);
  }

  function removeInsumoRow(key) {
    setInsumoRows((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  }

  async function handleCrearDirecta() {
    const componentes = insumoRows
      .filter((r) => r.articuloUuid && r.cantidad)
      .map((r) => ({ articuloUuid: r.articuloUuid, cantidad: Number(r.cantidad), unidadUuid: r.unidadUuid || null }));
    if (!componentes.length) {
      setFormError("Agrega al menos un insumo a la receta.");
      return;
    }
    const resultado = await apiFetch("/inventarios/mezclas/directo", {
      method: "POST",
      body: JSON.stringify({
        articuloNombre: directaForm.articuloNombre,
        articuloCodigo: directaForm.articuloCodigo || null,
        articuloCategoriaUuid: directaForm.articuloCategoriaUuid,
        articuloUnidadMedidaUuid: directaForm.articuloUnidadMedidaUuid || null,
        almacenUuid: form.almacenUuid,
        rendimiento: Number(form.cantidadElaborada),
        componentes,
        observaciones: form.observaciones || null,
      }),
    });
    const pendiente = resultado.version?.estadoPrueba === "PENDIENTE_APROBACION";
    setModalOpen(false);
    loadCombos();
    alert(
      pendiente
        ? `Receta creada: "${directaForm.articuloNombre}" queda pendiente de aprobación antes de poder usarse o producirse.`
        : `Receta creada y activa: "${directaForm.articuloNombre}".`,
    );
  }

  async function handleCrearMezcla(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await handleCrearDirecta();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function abrirDetalleMezcla(mezcla) {
    setDetalleOpen(true);
    setDetalleLoading(true);
    setDetalleMezcla(null);
    try {
      const data = await apiFetch(`/inventarios/mezclas/${mezcla.uuid}`);
      setDetalleMezcla(data);
      setDosisEditando(data.dosisPorHectarea != null ? String(data.dosisPorHectarea) : "");
      setDosisUnidadEditando(data.dosisPorHectareaUnidad?.uuid || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setDetalleLoading(false);
    }
  }

  async function guardarDosisPorHectarea() {
    if (!detalleMezcla) return;
    setGuardandoDosis(true);
    try {
      const dosisPorHectarea = dosisEditando === "" ? null : Number(dosisEditando);
      const dosisPorHectareaUnidadUuid = dosisUnidadEditando || null;
      const unidadElegida = unidades.find((u) => u.uuid === dosisPorHectareaUnidadUuid);
      await apiFetch(`/inventarios/mezclas/${detalleMezcla.uuid}`, {
        method: "PUT",
        body: JSON.stringify({ dosisPorHectarea, dosisPorHectareaUnidadUuid }),
      });
      setDetalleMezcla((m) => ({
        ...m,
        dosisPorHectarea,
        dosisPorHectareaUnidad: unidadElegida
          ? { uuid: unidadElegida.uuid, nombre: unidadElegida.nombre, simbolo: unidadElegida.simbolo }
          : null,
      }));
      loadCombos();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoDosis(false);
    }
  }

  return (
    <RequirePermission code="menu.inventarios.elaboraciones">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Mezclas</h1>
            <p className="text-secondary mb-0">
              Maestro de mezclas: cada una tiene su propio consecutivo y su artículo elaborado. El artículo elaborado
              nunca tiene saldo propio — cada vez que se produce un lote se valida stock y se descuentan los insumos
              de la receta.
            </p>
          </div>
          {hasPermission("inventario.mezclas.elaborar") && (
            <button type="button" className="btn btn-brand rounded-3 d-flex align-items-center gap-2" onClick={openCreate}>
              <FiPlus /> Nueva mezcla
            </button>
          )}
        </div>

        <div className="card border-0 rounded-4 mb-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="card-body p-3">
            <div className="row g-2">
              <div className="col-12 col-md-6">
                <label className="form-label small mb-1">Buscar por nombre o código</label>
                <input
                  type="text"
                  className="form-control form-control-sm rounded-3"
                  value={filtros.search}
                  onChange={(e) => setFiltros((f) => ({ ...f, search: e.target.value }))}
                />
              </div>
              <div className="col-12 col-md-6">
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
            </div>
            {(filtros.search || filtros.almacenUuid) && (
              <div className="d-flex gap-2 mt-3">
                <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={limpiarFiltros}>
                  Limpiar
                </button>
              </div>
            )}
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 rounded-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle">
              <thead>
                <tr className="table-light small text-secondary" style={{ borderBottom: "1px solid #e9ecef" }}>
                  <th className="fw-medium">Código</th>
                  <th className="fw-medium">Nombre</th>
                  <th className="fw-medium">Artículo elaborado</th>
                  <th className="fw-medium">Almacén</th>
                  <th className="fw-medium">Rinde</th>
                  <th className="fw-medium text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loadingMezclas && (
                  <tr>
                    <td colSpan={6} className="text-center text-secondary py-3 small">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loadingMezclas && mezclasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-secondary py-3 small">
                      No hay mezclas registradas todavía.
                    </td>
                  </tr>
                )}
                {!loadingMezclas &&
                  mezclasFiltradas.map((m) => (
                    <tr key={m.uuid} style={{ cursor: "pointer" }} onClick={() => abrirDetalleMezcla(m)}>
                      <td className="small fw-medium">{m.codigo}</td>
                      <td className="small">{m.nombre || <span className="text-secondary fst-italic">Sin nombre</span>}</td>
                      <td className="small text-secondary">{m.articuloElaborado?.nombre || "—"}</td>
                      <td className="small text-secondary">{m.versiones?.[0]?.almacen?.nombre || "—"}</td>
                      <td className="small text-secondary">
                        {Number(m.rendimiento ?? 1).toFixed(2)} {m.articuloElaborado?.unidadMedida?.simbolo || ""}
                      </td>
                      <td onClick={(ev) => ev.stopPropagation()}>
                        <div className="d-flex justify-content-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-1 d-inline-flex text-secondary"
                            title="Ver insumos y costo"
                            onClick={() => abrirDetalleMezcla(m)}
                          >
                            <FiEye size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {modalOpen && (
          <ModalShell title="Nueva mezcla" onClose={() => setModalOpen(false)} size="xl">
            <form onSubmit={handleCrearMezcla}>
              <p className="small text-secondary">
                Elegí los insumos y creá el artículo elaborado directamente, sin pasar por la prueba de laboratorio
                (pH/CE). No se descuenta ningún insumo al crear la receta — la cantidad de acá abajo es solo el
                rendimiento de la receta (cuánto produce un lote).
              </p>
              <div className="row g-3 mb-3">
                <div className="col-8">
                  <label className="form-label small fw-medium">
                    Nombre del producto <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={150}
                    className="form-control rounded-3"
                    value={directaForm.articuloNombre}
                    onChange={(e) => setDirectaForm((f) => ({ ...f, articuloNombre: e.target.value }))}
                  />
                </div>
                <div className="col-4">
                  <label className="form-label small fw-medium d-flex align-items-center gap-1">
                    Código
                    <FiInfo size={13} className="text-secondary" title="Sugerido continuando el correlativo — lo podés editar." />
                  </label>
                  <input
                    type="text"
                    maxLength={50}
                    className="form-control rounded-3"
                    value={directaForm.articuloCodigo}
                    onChange={(e) => setDirectaForm((f) => ({ ...f, articuloCodigo: e.target.value }))}
                  />
                </div>
                <div className="col-4">
                  <label className="form-label small fw-medium">
                    Categoría <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select rounded-3"
                    required
                    value={directaForm.articuloCategoriaUuid}
                    onChange={(e) => setDirectaForm((f) => ({ ...f, articuloCategoriaUuid: e.target.value }))}
                  >
                    <option value="">Selecciona...</option>
                    {categoriasElaborado.map((c) => (
                      <option key={c.uuid} value={c.uuid}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-4">
                  <label className="form-label small fw-medium">Unidad</label>
                  <select
                    className="form-select rounded-3"
                    value={directaForm.articuloUnidadMedidaUuid}
                    onChange={(e) => setDirectaForm((f) => ({ ...f, articuloUnidadMedidaUuid: e.target.value }))}
                  >
                    <option value="">Sin unidad</option>
                    {unidades.map((u) => (
                      <option key={u.uuid} value={u.uuid}>
                        {u.nombre} ({u.simbolo})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-4">
                  <label className="form-label small fw-medium">
                    Cantidad a producir
                    {(() => {
                      const unidadElegida = unidades.find((u) => u.uuid === directaForm.articuloUnidadMedidaUuid);
                      return unidadElegida ? ` (${unidadElegida.nombre})` : " (rinde la receta)";
                    })()}
                  </label>
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
              </div>

              <p className="small fw-medium mb-2">Insumos de la receta</p>
              <div className="table-responsive mb-2">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr className="small text-secondary">
                      <th>Artículo</th>
                      <th style={{ minWidth: "8rem" }}>Unidad</th>
                      <th style={{ width: "7rem" }}>Cantidad</th>
                      <th style={{ width: "2.5rem" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {insumoRows.map((row) => (
                      <tr key={row.key}>
                        <td>
                          <select
                            className="form-select form-select-sm rounded-3"
                            value={row.articuloUuid}
                            onChange={(e) => updateInsumoRow(row.key, { articuloUuid: e.target.value })}
                          >
                            <option value="">Selecciona...</option>
                            {articulos.map((a) => (
                              <option key={a.uuid} value={a.uuid}>
                                {a.codigo ? `${a.codigo} — ${a.nombre}` : a.nombre}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm rounded-3"
                            value={row.unidadUuid}
                            onChange={(e) => updateInsumoRow(row.key, { unidadUuid: e.target.value })}
                          >
                            <option value="">Sin unidad</option>
                            {unidades.map((u) => (
                              <option key={u.uuid} value={u.uuid}>
                                {u.simbolo}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className="form-control form-control-sm rounded-3"
                            value={row.cantidad}
                            onChange={(e) => updateInsumoRow(row.key, { cantidad: e.target.value })}
                          />
                        </td>
                        <td>
                          {insumoRows.length > 1 && (
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex text-danger"
                              onClick={() => removeInsumoRow(row.key)}
                            >
                              <FiX size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                className="btn btn-link text-decoration-none d-inline-flex align-items-center gap-1 px-0 mb-3"
                onClick={addInsumoRow}
              >
                <FiPlus size={14} /> Agregar insumo
              </button>

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
                  {saving ? "Creando..." : "Crear receta"}
                </button>
              </div>
            </form>
          </ModalShell>
        )}

        {detalleOpen && (
          <ModalShell
            title={`Insumos y costo — ${detalleMezcla?.nombre || detalleMezcla?.codigo || ""}`}
            onClose={() => setDetalleOpen(false)}
            size="lg"
          >
            {detalleLoading ? (
              <p className="text-secondary small mb-0">Cargando...</p>
            ) : !detalleMezcla ? (
              <p className="text-secondary small mb-0">No se pudo cargar el detalle.</p>
            ) : (
              (() => {
                const version = detalleMezcla.versiones?.[0];
                const componentes = version?.componentes || [];
                // Costo en VIVO, con el costoCompra actual de cada insumo —
                // el mismo criterio que usa de verdad elaboracion.service.js
                // al producir (no el snapshot guardado al cargar la receta,
                // que puede quedar desactualizado si el costo del insumo
                // cambió después). costoCompra está expresado en la unidad
                // BASE del artículo (articulo.unidadMedidaId) — si el
                // insumo se cargó en la receta con OTRA unidad (ej. la
                // receta mide en ml pero el artículo cuesta por L), hay que
                // convertir la cantidad a esa unidad base antes de
                // multiplicar, si no el costo queda inflado/reducido por el
                // factor de conversión (ej. 100 ml tratados como si fueran
                // 100 L). Mismo grafo BFS bidireccional que usa la
                // calculadora de Unidades (lib/unidadConversion.js) y que
                // usa el backend para descontar stock.
                const grafoUnidades = construirGrafoUnidades(conversiones);
                const unidadUuidPorId = new Map(unidades.map((u) => [u.id, u.uuid]));
                const cantidadEnUnidadBase = (c) => {
                  const cantidad = Number(c.cantidad);
                  const origenUuid = c.unidad?.uuid;
                  const destinoUuid = unidadUuidPorId.get(c.articulo?.unidadMedidaId);
                  if (!origenUuid || !destinoUuid || origenUuid === destinoUuid) return cantidad;
                  const convertida = convertirCantidad(grafoUnidades, origenUuid, destinoUuid, cantidad);
                  return convertida ?? cantidad;
                };
                // Para MOSTRAR la columna Cantidad: si dos insumos son del
                // mismo tipo de magnitud (ej. volumen) pero se cargaron en
                // unidades distintas (ml vs L), mezclar ambas en la tabla
                // confunde ("100 ml" al lado de "0,9 L"). Se normalizan
                // todas a la unidad del artículo elaborado (la que ya se
                // muestra en "Rinde") cuando la conversión existe; si un
                // insumo es de otra magnitud sin conversión registrada
                // (ej. Kg de un sólido en una mezcla que rinde en L), esa
                // fila se deja en su unidad original en vez de forzar un
                // número sin sentido.
                const unidadMostrarUuid = detalleMezcla.articuloElaborado?.unidadMedida?.uuid;
                const unidadMostrarSimbolo = detalleMezcla.articuloElaborado?.unidadMedida?.simbolo || "";
                const cantidadParaMostrar = (c) => {
                  const cantidad = Number(c.cantidad);
                  const origenUuid = c.unidad?.uuid;
                  if (!origenUuid || !unidadMostrarUuid || origenUuid === unidadMostrarUuid) {
                    return { valor: cantidad, simbolo: c.unidad?.simbolo || "" };
                  }
                  const convertida = convertirCantidad(grafoUnidades, origenUuid, unidadMostrarUuid, cantidad);
                  if (convertida == null) return { valor: cantidad, simbolo: c.unidad?.simbolo || "" };
                  return { valor: convertida, simbolo: unidadMostrarSimbolo };
                };
                const rendimiento = Number(detalleMezcla.rendimiento ?? 1) || 1;
                const costoTotal = componentes.reduce(
                  (acc, c) => acc + cantidadEnUnidadBase(c) * Number(c.articulo?.costoCompra || 0),
                  0,
                );
                return (
                  <div>
                    <p className="small text-secondary mb-3">
                      {detalleMezcla.codigo} — Artículo elaborado:{" "}
                      <strong>{detalleMezcla.articuloElaborado?.nombre || "—"}</strong> — Rinde{" "}
                      {rendimiento.toFixed(2)} {detalleMezcla.articuloElaborado?.unidadMedida?.simbolo || ""}
                    </p>
                    <div className="d-flex align-items-end gap-2 mb-3">
                      <div>
                        <label className="form-label small fw-medium d-flex align-items-center gap-1 mb-1">
                          Dosis por hectárea
                          <FiInfo
                            size={13}
                            className="text-secondary"
                            title="La usa Sanidad Vegetal → Programación de Aspersiones para calcular cuánto preparar según las hectáreas — elegí en qué unidad de volumen se mide (puede ser distinta a la del artículo elaborado, ej. dosis en Galones aunque la mezcla rinda en Litros). Vacío = esta mezcla no se puede usar en una aspersión todavía."
                          />
                        </label>
                        <div className="input-group input-group-sm" style={{ width: "14rem" }}>
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            className="form-control border-end-0"
                            style={{ minWidth: "5rem" }}
                            value={dosisEditando}
                            onChange={(e) => setDosisEditando(e.target.value)}
                          />
                          <select
                            className="form-select border-start-0 border-end-0 flex-grow-0 text-secondary"
                            style={{ width: "5.5rem" }}
                            value={dosisUnidadEditando}
                            onChange={(e) => setDosisUnidadEditando(e.target.value)}
                          >
                            <option value="">Sin unidad</option>
                            {unidades
                              .filter((u) => u.tipo === "VOLUMEN")
                              .map((u) => (
                                <option key={u.uuid} value={u.uuid}>
                                  {u.simbolo}
                                </option>
                              ))}
                          </select>
                          <span className="input-group-text bg-white text-secondary">/ha</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm rounded-3"
                        disabled={
                          guardandoDosis ||
                          (dosisEditando === String(detalleMezcla.dosisPorHectarea ?? "") &&
                            dosisUnidadEditando === (detalleMezcla.dosisPorHectareaUnidad?.uuid || ""))
                        }
                        onClick={guardarDosisPorHectarea}
                      >
                        {guardandoDosis ? "Guardando..." : "Guardar"}
                      </button>
                    </div>
                    <div className="table-responsive mb-3">
                      <table className="table table-sm mb-0">
                        <thead>
                          <tr className="small text-secondary">
                            <th>Insumo</th>
                            <th>Cantidad</th>
                            <th>Costo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {componentes.length === 0 && (
                            <tr>
                              <td colSpan={3} className="text-center text-secondary small py-3">
                                Sin insumos registrados.
                              </td>
                            </tr>
                          )}
                          {componentes.map((c) => {
                            const { valor: cantidadMostrada, simbolo: simboloMostrado } = cantidadParaMostrar(c);
                            return (
                              <tr key={c.uuid}>
                                <td className="small">{c.articulo?.nombre || "—"}</td>
                                <td className="small text-secondary">
                                  {cantidadMostrada.toLocaleString("es-CO", { maximumFractionDigits: 4 })} {simboloMostrado}
                                </td>
                                <td className="small text-secondary">
                                  {(cantidadEnUnidadBase(c) * Number(c.articulo?.costoCompra || 0)).toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="card border-0 rounded-3" style={{ backgroundColor: "#f0fdf4" }}>
                      <div className="card-body p-3">
                        <p className="mb-0 small text-secondary">
                          Costo total de la receta: <strong>{costoTotal.toFixed(2)}</strong> — Costo por{" "}
                          {detalleMezcla.articuloElaborado?.unidadMedida?.simbolo || "unidad"}:{" "}
                          <strong>{(costoTotal / rendimiento).toFixed(2)}</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
            <div className="d-flex justify-content-end gap-2 mt-3">
              {/* Solo tiene sentido para mezclas que sí pasaron por la prueba
                  de laboratorio (esDirecta: false) — una receta creada con
                  "Nueva mezcla" (crearDirecta) nunca generó una prueba, no
                  hay nada que ver en /inventarios/mezclas/[uuid]. */}
              {detalleMezcla?.versiones?.[0]?.esDirecta === false && (
                <button
                  type="button"
                  className="btn btn-outline-secondary rounded-3"
                  onClick={() => router.push(`/inventarios/mezclas/${detalleMezcla.uuid}`)}
                >
                  Ver prueba de laboratorio
                </button>
              )}
              <button type="button" className="btn btn-brand rounded-3" onClick={() => setDetalleOpen(false)}>
                Cerrar
              </button>
            </div>
          </ModalShell>
        )}
      </div>
    </RequirePermission>
  );
}

