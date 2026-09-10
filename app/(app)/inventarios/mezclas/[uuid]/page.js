"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FiPlus, FiX, FiCamera, FiTrash2, FiArrowLeft, FiCheckCircle, FiXCircle, FiPackage } from "react-icons/fi";
import { apiFetch, apiFetchFormData, apiFetchBlob } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import { estadoPruebaInfo, ESTADOS_PRUEBA_EDITABLES } from "@/lib/mezclaEstados";
import { construirGrafoUnidades, unidadesAlcanzables, convertirCantidad } from "@/lib/unidadConversion";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

function emptyComponenteRow() {
  return { articuloUuid: "", cantidad: "1", unidadUuid: "" };
}

export default function MezclaPruebaDetallePage() {
  const { uuid } = useParams();
  const router = useRouter();

  const [mezcla, setMezcla] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [articulos, setArticulos] = useState([]);
  const [categoriasElaborado, setCategoriasElaborado] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [conversiones, setConversiones] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const grafoUnidades = useMemo(() => construirGrafoUnidades(conversiones), [conversiones]);

  const version = mezcla?.versiones?.[0] || null;
  const editable = version ? ESTADOS_PRUEBA_EDITABLES.includes(version.estadoPrueba) : false;

  const puedeCrear = hasPermission("inventario.mezclas.crear");
  const puedeEditar = hasPermission("inventario.mezclas.editar");
  const puedeElaborar = hasPermission("inventario.mezclas.elaborar");

  // ─── Información general (solo el nombre se asigna acá — el artículo
  // elaborado NO se selecciona: nace de la prueba exitosa en "Crear
  // elaborado", ver más abajo). El rendimiento/unidad de la receta YA NO
  // se pide acá: se establece solo, la primera vez, con la "Cantidad a
  // elaborar" que se ingresa en "Crear elaborado" — pedirlo dos veces
  // (acá y ahí) confundía al operador.
  const [infoForm, setInfoForm] = useState({ nombre: "" });
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoError, setInfoError] = useState("");
  const infoCompleta = Boolean(mezcla?.nombre);

  // ─── Componentes ───
  const [componentesForm, setComponentesForm] = useState([emptyComponenteRow()]);
  const [savingComponentes, setSavingComponentes] = useState(false);
  const [componentesError, setComponentesError] = useState("");

  // ─── Etapas ───
  const [etapaForm, setEtapaForm] = useState({ componenteUuid: "", ph: "", ce: "", observaciones: "" });
  const [savingEtapa, setSavingEtapa] = useState(false);
  const [etapaError, setEtapaError] = useState("");

  // ─── Fotos ───
  const [pendingFotos, setPendingFotos] = useState([]); // [{file, previewUrl}]
  const [uploadingFotos, setUploadingFotos] = useState(false);
  const [fotosError, setFotosError] = useState("");
  const [fotoUrls, setFotoUrls] = useState({}); // { [fotoUuid]: blobUrl }

  // ─── Finalizar / Crear elaborado ───
  const [finalizando, setFinalizando] = useState(false);
  const [finalizarError, setFinalizarError] = useState("");
  const [elaboradoModalOpen, setElaboradoModalOpen] = useState(false);
  const [elaboradoForm, setElaboradoForm] = useState({
    cantidadElaborada: "1",
    almacenUuid: "",
    fecha: "",
    observaciones: "",
    articuloNombre: "",
    articuloCodigo: "",
    articuloCategoriaUuid: "",
    articuloUnidadMedidaUuid: "",
    articuloPrecioVenta: "",
  });
  const [creandoElaborado, setCreandoElaborado] = useState(false);
  const [elaboradoError, setElaboradoError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const detalle = await apiFetch(`/inventarios/mezclas/${uuid}`);
      setMezcla(detalle);
      setInfoForm({ nombre: detalle.nombre || "" });
      const v = detalle.versiones?.[0];
      setComponentesForm(
        v?.componentes?.length
          ? v.componentes.map((c) => ({
              // uuid: marca esta fila como YA GUARDADA — se usa para
              // bloquear su eliminación (ver removeComponenteRow). Una fila
              // agregada en esta misma sesión sin guardar todavía no tiene
              // uuid, y esa sí se puede quitar libremente.
              uuid: c.uuid,
              articuloUuid: c.articulo?.uuid || "",
              cantidad: String(c.cantidad ?? 1),
              unidadUuid: c.unidad?.uuid || "",
            }))
          : [emptyComponenteRow()],
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCombos() {
    try {
      const [todos, categorias, uni, conv, alms] = await Promise.all([
        apiFetch("/inventarios/articulos?limit=100&estado=true"),
        apiFetch("/inventarios/categorias?limit=100&tipo=ELABORADO&estado=true"),
        apiFetch("/inventarios/unidades?limit=100&estado=true"),
        apiFetch("/inventarios/unidades/conversiones"),
        apiFetch("/inventarios/almacenes?limit=100&estado=true"),
      ]);
      setArticulos(todos.items || []);
      setCategoriasElaborado(categorias.items || []);
      setUnidades(uni.items || []);
      setConversiones(Array.isArray(conv) ? conv : conv.items || []);
      setAlmacenes(alms.items || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    loadCombos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid]);

  // Todas las fotos de la prueba: las generales (fotos de la versión) más
  // las asociadas a cada etapa — se piden autenticadas vía blob (mismo
  // patrón que VisitaLaborModal, el <img src> normal no puede mandar el
  // Bearer/cookie del panel a un endpoint protegido).
  const todasLasFotos = useMemo(() => {
    if (!version) return [];
    const generales = version.fotos || [];
    const deEtapas = (version.etapas || []).flatMap((e) => e.fotos || []);
    return [...generales, ...deEtapas];
  }, [version]);

  useEffect(() => {
    if (!todasLasFotos.length) return;
    let cancelado = false;
    const urls = {};
    Promise.all(
      todasLasFotos.map((foto) =>
        apiFetchBlob(`/inventarios/mezclas/fotos/${foto.uuid}/archivo`)
          .then((blob) => {
            urls[foto.uuid] = URL.createObjectURL(blob);
          })
          .catch(() => {}),
      ),
    ).then(() => {
      if (!cancelado) setFotoUrls(urls);
    });
    return () => {
      cancelado = true;
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todasLasFotos.map((f) => f.uuid).join(",")]);

  // ─── Información general ───

  async function guardarInfoGeneral() {
    setInfoError("");
    if (!infoForm.nombre.trim()) {
      setInfoError("Completa el nombre de la prueba.");
      return;
    }
    setSavingInfo(true);
    try {
      // El validador de actualización no acepta nombre vacío (solo se puede
      // asignar, no volver a limpiar) — por eso acá siempre va con valor.
      await apiFetch(`/inventarios/mezclas/${uuid}`, {
        method: "PUT",
        body: JSON.stringify({ nombre: infoForm.nombre.trim() }),
      });
      await load();
    } catch (err) {
      setInfoError(err.message);
    } finally {
      setSavingInfo(false);
    }
  }

  // ─── Componentes ───

  // Unidades "compatibles" con un artículo: la suya propia + las
  // alcanzables por conversión (directa o encadenada) desde esa unidad
  // base — para no ofrecer en el selector unidades que no tienen ninguna
  // forma de convertirse a la del artículo (ver unidadConversion.js). Si
  // el artículo no tiene unidad base configurada, o todavía no se eligió
  // artículo, no se filtra: se muestran todas.
  function unidadesCompatiblesPara(articuloUuid) {
    const articulo = articulos.find((a) => a.uuid === articuloUuid);
    const unidadBaseUuid = articulo?.unidadMedida?.uuid;
    if (!unidadBaseUuid) return unidades;
    const alcanzables = unidadesAlcanzables(grafoUnidades, unidadBaseUuid);
    return unidades.filter((u) => alcanzables.has(u.uuid));
  }

  function updateComponente(idx, field, value) {
    setComponentesForm((rows) => {
      const next = [...rows];
      next[idx] = { ...next[idx], [field]: value };
      // Al cambiar el artículo, si la unidad ya elegida dejó de ser
      // compatible con el nuevo artículo, se limpia en vez de dejar una
      // combinación inválida seleccionada sin que se note.
      if (field === "articuloUuid" && next[idx].unidadUuid) {
        const compatibles = unidadesCompatiblesPara(value);
        if (!compatibles.some((u) => u.uuid === next[idx].unidadUuid)) {
          next[idx] = { ...next[idx], unidadUuid: "" };
        }
      }
      return next;
    });
  }

  function addComponenteRow() {
    setComponentesForm((rows) => [...rows, emptyComponenteRow()]);
  }

  // Solo se pueden quitar filas que todavía NO se hayan guardado (sin
  // uuid) — una vez guardado un componente, ya no se puede eliminar
  // (pedido explícito: evita perder trazabilidad si una etapa ya lo
  // referencia).
  function removeComponenteRow(idx) {
    setComponentesForm((rows) => (rows[idx]?.uuid ? rows : rows.filter((_, i) => i !== idx)));
  }

  async function guardarComponentes() {
    setComponentesError("");
    const validos = componentesForm.filter((c) => c.articuloUuid && c.cantidad);
    if (!validos.length) {
      setComponentesError("Agrega al menos un componente con artículo y cantidad.");
      return;
    }
    setSavingComponentes(true);
    try {
      await apiFetch(`/inventarios/mezclas/${uuid}/versiones/${version.uuid}/componentes`, {
        method: "PUT",
        body: JSON.stringify({
          componentes: validos.map((c) => ({ articuloUuid: c.articuloUuid, cantidad: Number(c.cantidad), unidadUuid: c.unidadUuid || null })),
        }),
      });
      await load();
    } catch (err) {
      setComponentesError(err.message);
    } finally {
      setSavingComponentes(false);
    }
  }

  // ─── Etapas ───

  async function handleAgregarEtapa(e) {
    e.preventDefault();
    setEtapaError("");
    if (etapaForm.ph === "" || etapaForm.ce === "") {
      setEtapaError("Ingresa pH y CE medidos.");
      return;
    }
    setSavingEtapa(true);
    try {
      await apiFetch(`/inventarios/mezclas/${uuid}/versiones/${version.uuid}/etapas`, {
        method: "POST",
        body: JSON.stringify({
          componenteUuid: etapaForm.componenteUuid || null,
          ph: Number(etapaForm.ph),
          ce: Number(etapaForm.ce),
          observaciones: etapaForm.observaciones || null,
        }),
      });
      setEtapaForm({ componenteUuid: "", ph: "", ce: "", observaciones: "" });
      await load();
    } catch (err) {
      setEtapaError(err.message);
    } finally {
      setSavingEtapa(false);
    }
  }

  async function handleEliminarEtapa(etapaUuid) {
    if (!confirm("¿Eliminar esta etapa? Las etapas siguientes se renumeran automáticamente.")) return;
    setEtapaError("");
    try {
      await apiFetch(`/inventarios/mezclas/etapas/${etapaUuid}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setEtapaError(err.message);
    }
  }

  // ─── Fotos ───

  function handleSelectFiles(e) {
    const files = Array.from(e.target.files || []);
    setPendingFotos((prev) => [...prev, ...files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))]);
    e.target.value = "";
  }

  function removePendingFoto(idx) {
    setPendingFotos((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx].previewUrl);
      next.splice(idx, 1);
      return next;
    });
  }

  async function handleUploadFotos() {
    if (!pendingFotos.length) return;
    setFotosError("");
    setUploadingFotos(true);
    try {
      const formData = new FormData();
      pendingFotos.forEach(({ file }) => formData.append("fotos", file));
      await apiFetchFormData(`/inventarios/mezclas/${uuid}/versiones/${version.uuid}/fotos`, formData);
      pendingFotos.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      setPendingFotos([]);
      await load();
    } catch (err) {
      setFotosError(err.message);
    } finally {
      setUploadingFotos(false);
    }
  }

  async function handleEliminarFoto(fotoUuid) {
    if (!confirm("¿Eliminar esta foto?")) return;
    try {
      await apiFetch(`/inventarios/mezclas/fotos/${fotoUuid}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setFotosError(err.message);
    }
  }

  // ─── Finalizar / Crear elaborado ───

  async function handleFinalizar() {
    if (!confirm("¿Finalizar esta prueba? Se generará la salida de inventario por los componentes usados y ya no se podrá editar.")) return;
    setFinalizarError("");
    setFinalizando(true);
    try {
      const resultado = await apiFetch(`/inventarios/mezclas/${uuid}/versiones/${version.uuid}/finalizar`, { method: "POST" });
      if (resultado.requiereConfirmacion) {
        // Stock insuficiente en uno o más componentes — no se escribió
        // nada todavía. Se le muestra al operador cómo quedaría el saldo
        // (puede ir en negativo) y, si confirma, se reenvía la misma
        // solicitud con forzarSaldoNegativo: true.
        const detalle = resultado.advertencias.map((a) => a.mensaje).join("\n\n");
        const confirmarNegativo = confirm(
          `${detalle}\n\n¿Confirmás finalizar de todas formas? El inventario quedará en negativo para el/los artículo(s) listados.`,
        );
        if (!confirmarNegativo) return;
        await apiFetch(`/inventarios/mezclas/${uuid}/versiones/${version.uuid}/finalizar`, {
          method: "POST",
          body: JSON.stringify({ forzarSaldoNegativo: true }),
        });
      }
      await load();
    } catch (err) {
      setFinalizarError(err.message);
    } finally {
      setFinalizando(false);
    }
  }

  function openElaboradoModal() {
    setElaboradoForm({
      cantidadElaborada: "1",
      almacenUuid: version?.almacen?.uuid || "",
      fecha: new Date().toISOString().slice(0, 10),
      observaciones: "",
      // El nombre de la prueba suele calzar con el del producto — se
      // precarga como punto de partida, pero el operador lo puede cambiar.
      articuloNombre: mezcla?.nombre || "",
      articuloCodigo: "",
      articuloCategoriaUuid: "",
      articuloUnidadMedidaUuid: "",
      articuloPrecioVenta: "",
    });
    setElaboradoError("");
    setElaboradoModalOpen(true);
  }

  async function handleCrearElaborado(e) {
    e.preventDefault();
    setElaboradoError("");
    setCreandoElaborado(true);
    try {
      const body = {
        cantidadElaborada: Number(elaboradoForm.cantidadElaborada),
        almacenUuid: elaboradoForm.almacenUuid,
        fecha: elaboradoForm.fecha,
        observaciones: elaboradoForm.observaciones || null,
        articuloNombre: elaboradoForm.articuloNombre,
        articuloCodigo: elaboradoForm.articuloCodigo || null,
        articuloCategoriaUuid: elaboradoForm.articuloCategoriaUuid,
        articuloUnidadMedidaUuid: elaboradoForm.articuloUnidadMedidaUuid || null,
        articuloPrecioVenta: elaboradoForm.articuloPrecioVenta === "" ? null : Number(elaboradoForm.articuloPrecioVenta),
      };
      const resultado = await apiFetch(`/inventarios/mezclas/${uuid}/versiones/${version.uuid}/crear-elaborado`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (resultado.requiereConfirmacion) {
        // Stock insuficiente en uno o más componentes — no se escribió
        // nada todavía (mismo patrón que "Finalizar prueba").
        const detalle = resultado.advertencias.map((a) => a.mensaje).join("\n\n");
        const confirmarNegativo = confirm(
          `${detalle}\n\n¿Confirmás crear el elaborado de todas formas? El inventario quedará en negativo para el/los artículo(s) listados.`,
        );
        if (!confirmarNegativo) return;
        await apiFetch(`/inventarios/mezclas/${uuid}/versiones/${version.uuid}/crear-elaborado`, {
          method: "POST",
          body: JSON.stringify({ ...body, forzarSaldoNegativo: true }),
        });
      }
      setElaboradoModalOpen(false);
      await load();
    } catch (err) {
      setElaboradoError(err.message);
    } finally {
      setCreandoElaborado(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 p-md-5">
        <p className="text-secondary small">Cargando...</p>
      </div>
    );
  }

  if (error || !mezcla || !version) {
    return (
      <div className="p-4 p-md-5">
        <div className="alert alert-danger py-2 small">{error || "Prueba no encontrada."}</div>
        <button type="button" className="btn btn-outline-secondary rounded-3" onClick={() => router.push("/inventarios/mezclas")}>
          <FiArrowLeft className="me-1" /> Volver
        </button>
      </div>
    );
  }

  const info = estadoPruebaInfo(version.estadoPrueba);

  return (
    <RequirePermission code="menu.inventarios.mezclas">
      <div className="p-4 p-md-5">
        <button
          type="button"
          className="btn btn-sm btn-link p-0 mb-3 text-secondary d-inline-flex align-items-center gap-1"
          onClick={() => router.push("/inventarios/mezclas")}
        >
          <FiArrowLeft /> Volver a Mezclas
        </button>

        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
              {mezcla.nombre || <span className="text-secondary fst-italic">Sin nombre asignado</span>}
              <span className="badge rounded-pill small" style={{ backgroundColor: info.bg, color: info.color }}>
                {info.label}
              </span>
            </h1>
            <p className="text-secondary mb-0">
              {mezcla.codigo} — Almacén: <strong>{version.almacen?.nombre || "—"}</strong>
            </p>
          </div>
          <div className="d-flex gap-2">
            {editable && puedeCrear && (
              <button
                type="button"
                className="btn btn-brand rounded-3"
                disabled={finalizando || !infoCompleta}
                title={!infoCompleta ? "Completa el nombre de la prueba en Información general" : undefined}
                onClick={handleFinalizar}
              >
                {finalizando ? "Finalizando..." : "Finalizar prueba"}
              </button>
            )}
            {version.estadoPrueba === "OPTIMA" && !version.elaboracionGenerada && puedeElaborar && (
              <button type="button" className="btn btn-success rounded-3 d-flex align-items-center gap-2" onClick={openElaboradoModal}>
                <FiPackage /> Crear elaborado
              </button>
            )}
          </div>
        </div>

        {finalizarError && <div className="alert alert-danger py-2 small">{finalizarError}</div>}

        {/* ─── Información general ─── */}
        <div className="card border-0 rounded-4 mb-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="card-body p-3">
            <h2 className="h6 fw-bold mb-2">Información general</h2>
            {editable && puedeCrear ? (
              <>
                {!infoCompleta && (
                  <p className="small text-secondary mb-2">
                    El nombre se asigna acá — hace falta completarlo antes de poder finalizar la prueba. El artículo
                    elaborado (producto) todavía no existe: se crea más adelante, a partir de la prueba exitosa, al
                    usar &quot;Crear elaborado&quot;.
                  </p>
                )}
                <div className="row g-3 align-items-end mb-2">
                  <div className="col-12 col-md-8">
                    <label className="form-label small fw-medium">
                      Nombre <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control rounded-3"
                      maxLength={150}
                      value={infoForm.nombre}
                      onChange={(e) => setInfoForm((f) => ({ ...f, nombre: e.target.value }))}
                    />
                  </div>
                  <div className="col-12 col-md-2">
                    <button type="button" className="btn btn-brand btn-sm rounded-3 w-100" disabled={savingInfo} onClick={guardarInfoGeneral}>
                      {savingInfo ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </div>
                {infoError && <div className="alert alert-danger py-2 small mb-0">{infoError}</div>}
              </>
            ) : (
              <p className="small text-secondary mb-0">
                Producto elaborado:{" "}
                <strong>{mezcla.articuloElaborado?.nombre || "Aún no generado"}</strong>
              </p>
            )}
          </div>
        </div>

        {version.estadoPrueba === "CONVERTIDA" && version.elaboracionGenerada && (
          <div className="alert alert-primary py-2 small">
            Esta prueba ya generó el elaborado <strong>{version.elaboracionGenerada.documento}</strong>.
          </div>
        )}

        {!editable && version.estadoPrueba !== "CONVERTIDA" && (
          <div className="alert alert-secondary py-2 small">
            Esta prueba ya fue finalizada ({info.label}) y quedó de solo lectura — el consumo de inventario ya se
            registró y no se puede editar.
          </div>
        )}

        {(version.estadoPrueba === "OPTIMA" || version.estadoPrueba === "NO_VALIDA" || version.estadoPrueba === "CONVERTIDA") && (
          <div className="card border-0 rounded-4 mb-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
            <div className="card-body p-3 d-flex flex-wrap gap-4 align-items-center">
              <span className="small fw-medium d-flex align-items-center gap-1">
                {version.estadoPrueba === "NO_VALIDA" ? (
                  <FiXCircle className="text-danger" />
                ) : (
                  <FiCheckCircle style={{ color: "#047857" }} />
                )}
                Resultado final
              </span>
              <span className="small text-secondary">
                pH final: <strong>{version.phFinal ?? "—"}</strong>
              </span>
              <span className="small text-secondary">
                CE final: <strong>{version.ceFinal ?? "—"}</strong>
              </span>
              <span className="small text-secondary">
                Rango usado: pH {version.parametrosUsados?.phMinimo}–{version.parametrosUsados?.phMaximo}, CE &lt;{" "}
                {version.parametrosUsados?.ceMaxima}
              </span>
              <span className="small text-secondary">
                Documento inventario: <strong>{version.movimientoDocumento || "—"}</strong>
              </span>
            </div>
          </div>
        )}

        {/* ─── Componentes ─── */}
        <div className="card border-0 rounded-4 mb-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="card-body p-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h2 className="h6 fw-bold mb-0">Componentes</h2>
              {editable && puedeCrear && (
                <button type="button" className="btn btn-sm btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-1" onClick={addComponenteRow}>
                  <FiPlus size={14} /> Agregar
                </button>
              )}
            </div>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-2">
                <thead>
                  <tr className="table-light small text-secondary">
                    <th style={{ minWidth: "14rem" }}>Artículo</th>
                    <th style={{ minWidth: "10rem" }}>Unidad</th>
                    <th style={{ width: "8rem" }}>Cantidad</th>
                    <th style={{ minWidth: "8rem" }}>Equivale a</th>
                    {editable && puedeCrear && <th style={{ width: "2.5rem" }} />}
                  </tr>
                </thead>
                <tbody>
                  {(editable ? componentesForm : version.componentes || []).map((c, idx) => {
                    if (!editable) {
                      return (
                        <tr key={c.uuid || idx}>
                          <td className="small">{c.articulo?.nombre || "—"}</td>
                          <td className="small text-secondary">{c.unidad?.simbolo || ""}</td>
                          <td className="small">{Number(c.cantidad).toFixed(2)}</td>
                          <td className="small text-secondary">—</td>
                        </tr>
                      );
                    }
                    const unidadesFila = unidadesCompatiblesPara(c.articuloUuid);
                    const articuloFila = articulos.find((a) => a.uuid === c.articuloUuid);
                    const unidadBaseUuid = articuloFila?.unidadMedida?.uuid;
                    const cantidadNum = Number(c.cantidad);
                    // Preview en vivo de a cuánto equivale lo que se está
                    // midiendo, en la unidad BASE del artículo — la misma
                    // conversión que el backend aplica de verdad al
                    // descontar inventario (ver unidadConversion.js en la
                    // API), acá solo se muestra antes de guardar.
                    const mostrarConversion =
                      c.unidadUuid && unidadBaseUuid && c.unidadUuid !== unidadBaseUuid && Number.isFinite(cantidadNum) && cantidadNum > 0;
                    const cantidadConvertida = mostrarConversion
                      ? convertirCantidad(grafoUnidades, c.unidadUuid, unidadBaseUuid, cantidadNum)
                      : null;
                    const unidadBaseSimbolo = articuloFila?.unidadMedida?.simbolo;
                    return (
                      <tr key={idx}>
                        <td>
                          <select className="form-select form-select-sm rounded-3" value={c.articuloUuid} onChange={(e) => updateComponente(idx, "articuloUuid", e.target.value)}>
                            <option value="">Selecciona...</option>
                            {articulos.map((a) => (
                              <option key={a.uuid} value={a.uuid}>
                                {a.codigo ? `${a.codigo} — ${a.nombre}` : a.nombre}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select className="form-select form-select-sm rounded-3" value={c.unidadUuid} onChange={(e) => updateComponente(idx, "unidadUuid", e.target.value)}>
                            <option value="">Sin unidad</option>
                            {unidadesFila.map((u) => (
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
                            value={c.cantidad}
                            onChange={(e) => updateComponente(idx, "cantidad", e.target.value)}
                          />
                        </td>
                        <td className="small text-secondary text-nowrap">
                          {mostrarConversion &&
                            (cantidadConvertida === null
                              ? "sin conversión registrada"
                              : `= ${cantidadConvertida.toLocaleString("es-CO", { maximumFractionDigits: 4 })} ${unidadBaseSimbolo || ""}`)}
                        </td>
                        <td>
                          {!c.uuid && componentesForm.length > 1 && (
                            <button type="button" className="btn btn-sm btn-link p-1 d-inline-flex text-danger" onClick={() => removeComponenteRow(idx)}>
                              <FiX size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {(editable ? componentesForm : version.componentes || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-secondary small py-2">
                        Sin componentes registrados todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {componentesError && <div className="alert alert-danger py-2 small">{componentesError}</div>}
            {editable && puedeCrear && (
              <button type="button" className="btn btn-brand btn-sm rounded-3" disabled={savingComponentes} onClick={guardarComponentes}>
                {savingComponentes ? "Guardando..." : "Guardar componentes"}
              </button>
            )}
          </div>
        </div>

        {/* ─── Etapas de medición ─── */}
        <div className="card border-0 rounded-4 mb-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="card-body p-3">
            <h2 className="h6 fw-bold mb-2">Etapas de medición</h2>
            <div className="table-responsive mb-3">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr className="table-light small text-secondary">
                    <th>#</th>
                    <th>Componente incorporado</th>
                    <th>pH</th>
                    <th>CE</th>
                    <th>Resultado</th>
                    <th>Fecha</th>
                    <th>Observaciones</th>
                    {editable && puedeCrear && <th style={{ width: "2.5rem" }} />}
                  </tr>
                </thead>
                <tbody>
                  {(version.etapas || []).length === 0 && (
                    <tr>
                      <td colSpan={editable && puedeCrear ? 8 : 7} className="text-center text-secondary small py-2">
                        Sin etapas registradas todavía.
                      </td>
                    </tr>
                  )}
                  {(version.etapas || []).map((et) => (
                    <tr key={et.uuid}>
                      <td className="small">{et.numero}</td>
                      <td className="small">{et.componente?.articulo?.nombre || "—"}</td>
                      <td className="small">{Number(et.ph).toFixed(2)}</td>
                      <td className="small">{Number(et.ce).toFixed(2)}</td>
                      <td className="small">
                        <span
                          className="badge rounded-pill small"
                          style={
                            et.resultado === "CUMPLE"
                              ? { backgroundColor: "#d1fae5", color: "#047857" }
                              : { backgroundColor: "#fee2e2", color: "#b91c1c" }
                          }
                        >
                          {et.resultado === "CUMPLE" ? "Cumple" : "No cumple"}
                        </span>
                      </td>
                      <td className="small text-secondary">
                        {et.medidoEn ? new Date(et.medidoEn).toLocaleString("es-CO", { timeZone: "America/Bogota" }) : "—"}
                      </td>
                      <td className="small text-secondary">{et.observaciones || "—"}</td>
                      {editable && puedeCrear && (
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-1 d-inline-flex text-danger"
                            title="Eliminar etapa"
                            onClick={() => handleEliminarEtapa(et.uuid)}
                          >
                            <FiX size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editable && puedeCrear && (
              <form onSubmit={handleAgregarEtapa} className="border-top pt-3">
                <p className="small fw-medium mb-2">Registrar nueva etapa</p>
                <div className="row g-2 align-items-end">
                  <div className="col-12 col-md-3">
                    <label className="form-label small mb-1">Componente incorporado</label>
                    <select
                      className="form-select form-select-sm rounded-3"
                      value={etapaForm.componenteUuid}
                      onChange={(e) => setEtapaForm((f) => ({ ...f, componenteUuid: e.target.value }))}
                    >
                      <option value="">Solo medición (sin componente nuevo)</option>
                      {(version.componentes || []).map((c) => (
                        <option key={c.uuid} value={c.uuid}>
                          {c.articulo?.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6 col-md-2">
                    <label className="form-label small mb-1">pH</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="14"
                      required
                      className="form-control form-control-sm rounded-3"
                      value={etapaForm.ph}
                      onChange={(e) => setEtapaForm((f) => ({ ...f, ph: e.target.value }))}
                    />
                  </div>
                  <div className="col-6 col-md-2">
                    <label className="form-label small mb-1">CE</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      className="form-control form-control-sm rounded-3"
                      value={etapaForm.ce}
                      onChange={(e) => setEtapaForm((f) => ({ ...f, ce: e.target.value }))}
                    />
                  </div>
                  <div className="col-12 col-md-3">
                    <label className="form-label small mb-1">Observaciones</label>
                    <input
                      type="text"
                      className="form-control form-control-sm rounded-3"
                      value={etapaForm.observaciones}
                      onChange={(e) => setEtapaForm((f) => ({ ...f, observaciones: e.target.value }))}
                    />
                  </div>
                  <div className="col-12 col-md-2">
                    <button type="submit" className="btn btn-brand btn-sm rounded-3 w-100" disabled={savingEtapa}>
                      {savingEtapa ? "Guardando..." : "Registrar"}
                    </button>
                  </div>
                </div>
                {etapaError && <div className="alert alert-danger py-2 small mt-2">{etapaError}</div>}
              </form>
            )}
          </div>
        </div>

        {/* ─── Evidencia fotográfica ─── */}
        <div className="card border-0 rounded-4 mb-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="card-body p-3">
            <h2 className="h6 fw-bold mb-2">Evidencia fotográfica</h2>

            <div className="d-flex flex-wrap gap-2 mb-3">
              {(version.fotos || []).map((foto) => (
                <div key={foto.uuid} className="position-relative" style={{ width: 96, height: 96 }}>
                  {fotoUrls[foto.uuid] ? (
                    <img src={fotoUrls[foto.uuid]} alt={foto.nombreOriginal} className="rounded-3 border" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div className="rounded-3 border d-flex align-items-center justify-content-center small text-secondary" style={{ width: "100%", height: "100%" }}>
                      ...
                    </div>
                  )}
                  {editable && puedeEditar && (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger rounded-circle position-absolute d-flex align-items-center justify-content-center p-0"
                      style={{ width: 22, height: 22, top: -6, right: -6 }}
                      title="Eliminar foto"
                      onClick={() => handleEliminarFoto(foto.uuid)}
                    >
                      <FiX size={13} />
                    </button>
                  )}
                </div>
              ))}
              {(version.fotos || []).length === 0 && pendingFotos.length === 0 && (
                <p className="text-secondary small mb-0">Sin fotos registradas todavía.</p>
              )}
            </div>

            {editable && puedeCrear && (
              <>
                {pendingFotos.length > 0 && (
                  <div className="d-flex flex-wrap gap-2 mb-3">
                    {pendingFotos.map((p, idx) => (
                      <div key={idx} className="position-relative" style={{ width: 96, height: 96 }}>
                        <img src={p.previewUrl} alt="" className="rounded-3 border" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.75 }} />
                        <button
                          type="button"
                          className="btn btn-sm btn-danger rounded-circle position-absolute d-flex align-items-center justify-content-center p-0"
                          style={{ width: 22, height: 22, top: -6, right: -6 }}
                          title="Quitar (todavía no se ha subido)"
                          onClick={() => removePendingFoto(idx)}
                        >
                          <FiX size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <label className="btn btn-outline-secondary btn-sm rounded-3 d-inline-flex align-items-center gap-1 mb-0">
                    <FiCamera size={14} /> Cámara / Galería
                    <input type="file" accept="image/*" multiple capture="environment" className="d-none" onChange={handleSelectFiles} />
                  </label>
                  {pendingFotos.length > 0 && (
                    <button type="button" className="btn btn-brand btn-sm rounded-3" disabled={uploadingFotos} onClick={handleUploadFotos}>
                      {uploadingFotos ? "Subiendo..." : `Subir ${pendingFotos.length} foto(s)`}
                    </button>
                  )}
                </div>
                {fotosError && <div className="alert alert-danger py-2 small mt-2">{fotosError}</div>}
              </>
            )}
          </div>
        </div>

        {elaboradoModalOpen && (
          <ModalShell title="Crear elaborado desde esta prueba" onClose={() => setElaboradoModalOpen(false)} size="lg">
            <form onSubmit={handleCrearElaborado}>
              <p className="small text-secondary">
                Se usan automáticamente los componentes, cantidades y unidades de esta prueba — no hace falta
                volver a digitarlos.
              </p>

              {mezcla.articuloElaborado ? (
                <div className="alert alert-secondary py-2 small">
                  El artículo elaborado ya fue creado en un intento anterior: <strong>{mezcla.articuloElaborado.nombre}</strong>. Se
                  va a usar ese mismo, no se crea uno nuevo.
                </div>
              ) : (
                <>
                  <p className="small fw-medium mb-2">Artículo elaborado (producto nuevo)</p>
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
                        value={elaboradoForm.articuloNombre}
                        onChange={(e) => setElaboradoForm((f) => ({ ...f, articuloNombre: e.target.value }))}
                      />
                    </div>
                    <div className="col-4">
                      <label className="form-label small fw-medium">Código</label>
                      <input
                        type="text"
                        maxLength={50}
                        className="form-control rounded-3"
                        value={elaboradoForm.articuloCodigo}
                        onChange={(e) => setElaboradoForm((f) => ({ ...f, articuloCodigo: e.target.value }))}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-medium">
                        Categoría <span className="text-danger">*</span>
                      </label>
                      <select
                        className="form-select rounded-3"
                        required
                        value={elaboradoForm.articuloCategoriaUuid}
                        onChange={(e) => setElaboradoForm((f) => ({ ...f, articuloCategoriaUuid: e.target.value }))}
                      >
                        <option value="">Selecciona...</option>
                        {categoriasElaborado.map((c) => (
                          <option key={c.uuid} value={c.uuid}>
                            {c.nombre}
                          </option>
                        ))}
                      </select>
                      <p className="form-text small mb-0">Solo categorías de tipo Elaborado.</p>
                    </div>
                    <div className="col-3">
                      <label className="form-label small fw-medium">Unidad</label>
                      <select
                        className="form-select rounded-3"
                        value={elaboradoForm.articuloUnidadMedidaUuid}
                        onChange={(e) => setElaboradoForm((f) => ({ ...f, articuloUnidadMedidaUuid: e.target.value }))}
                      >
                        <option value="">Sin unidad</option>
                        {unidades.map((u) => (
                          <option key={u.uuid} value={u.uuid}>
                            {u.nombre} ({u.simbolo})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-3">
                      <label className="form-label small fw-medium">Precio de venta</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control rounded-3"
                        value={elaboradoForm.articuloPrecioVenta}
                        onChange={(e) => setElaboradoForm((f) => ({ ...f, articuloPrecioVenta: e.target.value }))}
                      />
                    </div>
                  </div>
                  <hr />
                </>
              )}

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-medium">Cantidad a elaborar</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    className="form-control rounded-3"
                    value={elaboradoForm.cantidadElaborada}
                    onChange={(e) => setElaboradoForm((f) => ({ ...f, cantidadElaborada: e.target.value }))}
                  />
                  {!mezcla.articuloElaborado && (
                    <p className="form-text small mb-0">
                      Esta cantidad queda como el rendimiento de la receta — de acá en más, producir más se escala
                      a partir de este número.
                    </p>
                  )}
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Fecha</label>
                  <input
                    type="date"
                    required
                    className="form-control rounded-3"
                    value={elaboradoForm.fecha}
                    onChange={(e) => setElaboradoForm((f) => ({ ...f, fecha: e.target.value }))}
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label small fw-medium">Almacén</label>
                <select
                  className="form-select rounded-3"
                  required
                  value={elaboradoForm.almacenUuid}
                  onChange={(e) => setElaboradoForm((f) => ({ ...f, almacenUuid: e.target.value }))}
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
                  value={elaboradoForm.observaciones}
                  onChange={(e) => setElaboradoForm((f) => ({ ...f, observaciones: e.target.value }))}
                />
              </div>
              {elaboradoError && <div className="alert alert-danger py-2 small">{elaboradoError}</div>}
              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary rounded-3" onClick={() => setElaboradoModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-brand rounded-3" disabled={creandoElaborado}>
                  {creandoElaborado ? "Creando..." : "Crear elaborado"}
                </button>
              </div>
            </form>
          </ModalShell>
        )}
      </div>
    </RequirePermission>
  );
}
