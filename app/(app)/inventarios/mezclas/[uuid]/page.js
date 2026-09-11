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

function fmtFechaHora(v) {
  if (!v) return null;
  return new Date(v).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
}

function nombreUsuario(u) {
  if (!u) return "—";
  return `${u.nombre || ""} ${u.apellido || ""}`.trim() || u.usuario || "—";
}

// Nombre + "cargo" (roles del usuario) + opcionalmente la fecha/hora del
// hito (finalización / aprobación).
function TrazaItem({ titulo, usuario, fecha, pendiente }) {
  const cargo = (usuario?.roles || []).map((r) => r.nombre).join(", ");
  return (
    <div className="col-12 col-md-4">
      <div className="small text-secondary text-uppercase fw-semibold" style={{ fontSize: "0.68rem", letterSpacing: "0.03em" }}>
        {titulo}
      </div>
      {pendiente ? (
        <div className="small fw-medium" style={{ color: "#b45309" }}>
          Pendiente
        </div>
      ) : (
        <>
          {fecha !== undefined && <div className="small fw-medium">{fmtFechaHora(fecha) || "—"}</div>}
          <div className="small">{nombreUsuario(usuario)}</div>
          {cargo && <div className="small text-secondary">{cargo}</div>}
        </>
      )}
    </div>
  );
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
  const [etapaFotos, setEtapaFotos] = useState([]); // [{file, previewUrl}] — evidencia de la etapa que se está por registrar
  const [savingEtapa, setSavingEtapa] = useState(false);
  const [etapaError, setEtapaError] = useState("");
  // Subida de fotos a una etapa YA registrada — key: etapaUuid en curso
  const [subiendoFotoEtapa, setSubiendoFotoEtapa] = useState("");
  // Etapa cuyo modal de evidencia está abierto (ver/agregar/eliminar fotos)
  const [fotosModalEtapaUuid, setFotosModalEtapaUuid] = useState(null);
  // Foto abierta a pantalla completa (lightbox) — { src, alt } o null
  const [fotoAmpliada, setFotoAmpliada] = useState(null);

  // ─── Fotos ───
  const [pendingFotos, setPendingFotos] = useState([]); // [{file, previewUrl}]
  const [uploadingFotos, setUploadingFotos] = useState(false);
  const [fotosError, setFotosError] = useState("");
  const [fotoUrls, setFotoUrls] = useState({}); // { [fotoUuid]: blobUrl }

  // ─── Finalizar / Crear elaborado / Aprobar ───
  const [finalizando, setFinalizando] = useState(false);
  const [finalizarError, setFinalizarError] = useState("");
  const [aprobando, setAprobando] = useState(false);
  const [aprobarError, setAprobarError] = useState("");
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
      const versionActualizada = await apiFetch(
        `/inventarios/mezclas/${uuid}/versiones/${version.uuid}/etapas`,
        {
          method: "POST",
          body: JSON.stringify({
            componenteUuid: etapaForm.componenteUuid || null,
            ph: Number(etapaForm.ph),
            ce: Number(etapaForm.ce),
            observaciones: etapaForm.observaciones || null,
          }),
        },
      );

      // Sube la evidencia fotográfica adjunta a ESTA etapa recién creada
      // (la de mayor `numero` en la versión devuelta).
      if (etapaFotos.length) {
        const nuevaEtapa = (versionActualizada.etapas || []).reduce(
          (max, e) => (!max || e.numero > max.numero ? e : max),
          null,
        );
        if (nuevaEtapa) {
          const formData = new FormData();
          formData.append("etapaUuid", nuevaEtapa.uuid);
          etapaFotos.forEach(({ file }) => formData.append("fotos", file));
          await apiFetchFormData(
            `/inventarios/mezclas/${uuid}/versiones/${version.uuid}/fotos`,
            formData,
          );
        }
      }

      etapaFotos.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      setEtapaFotos([]);
      setEtapaForm({ componenteUuid: "", ph: "", ce: "", observaciones: "" });
      await load();
    } catch (err) {
      setEtapaError(err.message);
    } finally {
      setSavingEtapa(false);
    }
  }

  function handleSelectEtapaFiles(e) {
    const files = Array.from(e.target.files || []);
    setEtapaFotos((prev) => [...prev, ...files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))]);
    e.target.value = "";
  }

  function limpiarEtapaFotos() {
    setEtapaFotos((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return [];
    });
  }

  // Agrega fotos a una etapa que YA fue registrada.
  async function handleSubirFotosAEtapa(etapaUuid, fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setEtapaError("");
    setSubiendoFotoEtapa(etapaUuid);
    try {
      const formData = new FormData();
      formData.append("etapaUuid", etapaUuid);
      files.forEach((file) => formData.append("fotos", file));
      await apiFetchFormData(`/inventarios/mezclas/${uuid}/versiones/${version.uuid}/fotos`, formData);
      await load();
    } catch (err) {
      setEtapaError(err.message);
    } finally {
      setSubiendoFotoEtapa("");
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

  async function handleAprobar() {
    if (
      !confirm(
        "¿Aprobar esta prueba? Se registrará la entrada del artículo elaborado al inventario y quedará habilitado para usarse.",
      )
    )
      return;
    setAprobarError("");
    setAprobando(true);
    try {
      const resultado = await apiFetch(`/inventarios/mezclas/${uuid}/versiones/${version.uuid}/aprobar`, { method: "POST" });
      if (resultado?.requiereConfirmacion) {
        const detalle = resultado.advertencias.map((a) => a.mensaje).join("\n\n");
        if (!confirm(`${detalle}\n\n¿Aprobar de todas formas? El inventario quedará en negativo para el/los artículo(s) listados.`)) return;
        await apiFetch(`/inventarios/mezclas/${uuid}/versiones/${version.uuid}/aprobar`, {
          method: "POST",
          body: JSON.stringify({ forzarSaldoNegativo: true }),
        });
      }
      await load();
    } catch (err) {
      setAprobarError(err.message);
    } finally {
      setAprobando(false);
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
            {version.estadoPrueba === "PENDIENTE_APROBACION" && (
              <button
                type="button"
                className="btn btn-brand rounded-3 d-flex align-items-center gap-2"
                disabled={aprobando}
                onClick={handleAprobar}
              >
                <FiCheckCircle /> {aprobando ? "Aprobando..." : "Aprobar prueba"}
              </button>
            )}
          </div>
        </div>

        {finalizarError && <div className="alert alert-danger py-2 small">{finalizarError}</div>}
        {aprobarError && <div className="alert alert-danger py-2 small">{aprobarError}</div>}
        {version.estadoPrueba === "PENDIENTE_APROBACION" && (
          <div className="alert alert-warning py-2 small">
            El artículo elaborado <strong>{mezcla.articuloElaborado?.nombre}</strong> ya fue creado pero está
            <strong> inactivo</strong> y <strong>todavía no entró al inventario</strong>: la entrada de stock se genera
            recién al aprobar. Hasta entonces no se puede usar en movimientos, elaboraciones ni proformas — necesita la
            aprobación de un usuario de un rol autorizado.
          </div>
        )}

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

        {(version.finalizadaEn || version.aprobadaEn || version.operador) && (
          <div className="card border-0 rounded-4 mb-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
            <div className="card-body p-3">
              <h2 className="h6 fw-bold mb-2">Trazabilidad</h2>
              <div className="row g-3">
                <TrazaItem titulo="Creada por" usuario={version.operador} />
                <TrazaItem
                  titulo="Prueba finalizada"
                  fecha={version.finalizadaEn}
                  usuario={version.finalizadaPor}
                />
                <TrazaItem
                  titulo="Aprobación"
                  fecha={version.aprobadaEn}
                  usuario={version.aprobadaPor}
                  pendiente={version.estadoPrueba === "PENDIENTE_APROBACION"}
                />
              </div>
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
                    <th className="text-center">#</th>
                    <th>Componente incorporado</th>
                    <th className="text-center">pH</th>
                    <th className="text-center">CE</th>
                    <th className="text-center">Resultado</th>
                    <th className="text-center">Fecha</th>
                    <th>Observaciones</th>
                    <th className="text-center">Evidencia</th>
                    {editable && puedeCrear && <th style={{ width: "2.5rem" }} />}
                  </tr>
                </thead>
                <tbody>
                  {(version.etapas || []).length === 0 && (
                    <tr>
                      <td colSpan={editable && puedeCrear ? 9 : 8} className="text-center text-secondary small py-2">
                        Sin etapas registradas todavía.
                      </td>
                    </tr>
                  )}
                  {(version.etapas || []).map((et) => (
                    <tr key={et.uuid}>
                      <td className="small text-center">{et.numero}</td>
                      <td className="small">{et.componente?.articulo?.nombre || "—"}</td>
                      <td className="small text-center">{Number(et.ph).toFixed(2)}</td>
                      <td className="small text-center">{Number(et.ce).toFixed(2)}</td>
                      <td className="small text-center">
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
                      <td className="small text-secondary text-center">
                        {et.medidoEn ? new Date(et.medidoEn).toLocaleString("es-CO", { timeZone: "America/Bogota" }) : "—"}
                      </td>
                      <td className="small text-secondary">{et.observaciones || "—"}</td>
                      <td className="text-center">
                        {(() => {
                          const nFotos = (et.fotos || []).length;
                          const subiendo = subiendoFotoEtapa === et.uuid;
                          // Con la prueba ya guardada (no editable) el botón es
                          // solo de consulta: sin fondo verde, solo el ícono.
                          const claseBoton = editable
                            ? `btn btn-sm rounded-3 px-2 ${nFotos > 0 ? "btn-brand" : "btn-outline-secondary"}`
                            : "btn btn-sm btn-link p-0 text-decoration-none";
                          return (
                            <button
                              type="button"
                              className={`${claseBoton} d-inline-flex align-items-center justify-content-center gap-1`}
                              style={{ minHeight: 31 }}
                              title={nFotos > 0 ? `Ver ${nFotos} evidencia(s)` : "Sin evidencia" + (editable && puedeCrear ? " — agregar" : "")}
                              onClick={() => setFotosModalEtapaUuid(et.uuid)}
                            >
                              {subiendo ? (
                                <span className="spinner-border spinner-border-sm" />
                              ) : (
                                <FiCamera
                                  size={16}
                                  style={!editable ? { color: nFotos > 0 ? "#16a34a" : "#9ca3af" } : undefined}
                                />
                              )}
                              {nFotos > 0 && (
                                <span
                                  className="fw-bold"
                                  style={{ fontSize: 12, lineHeight: 1, color: editable ? "#fff" : "#16a34a" }}
                                >
                                  {nFotos}
                                </span>
                              )}
                            </button>
                          );
                        })()}
                      </td>
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
                <div className="d-flex flex-wrap flex-md-nowrap align-items-end gap-2">
                  <div className="flex-grow-1" style={{ minWidth: "12rem" }}>
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
                  <div style={{ width: "5.5rem" }} className="flex-shrink-0">
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
                  <div style={{ width: "5.5rem" }} className="flex-shrink-0">
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
                  <div className="flex-grow-1" style={{ minWidth: "10rem" }}>
                    <label className="form-label small mb-1">Observaciones</label>
                    <input
                      type="text"
                      className="form-control form-control-sm rounded-3"
                      value={etapaForm.observaciones}
                      onChange={(e) => setEtapaForm((f) => ({ ...f, observaciones: e.target.value }))}
                    />
                  </div>
                  <label
                    className={`btn btn-sm rounded-3 d-inline-flex align-items-center justify-content-center gap-1 flex-shrink-0 px-2 mb-0 ${
                      etapaFotos.length ? "btn-brand" : "btn-outline-secondary"
                    }`}
                    style={{ minHeight: 31 }}
                    title={
                      etapaFotos.length
                        ? `${etapaFotos.length} evidencia(s) adjunta(s) — clic para quitar`
                        : "Adjuntar evidencia fotográfica (galería o cámara, opcional)"
                    }
                    onClick={etapaFotos.length ? (e) => { e.preventDefault(); limpiarEtapaFotos(); } : undefined}
                  >
                    <FiCamera size={16} />
                    {etapaFotos.length > 0 && (
                      <span className="fw-bold" style={{ fontSize: 12, lineHeight: 1, color: "#fff" }}>
                        {etapaFotos.length}
                      </span>
                    )}
                    {!etapaFotos.length && (
                      <input type="file" accept="image/*" multiple className="d-none" onChange={handleSelectEtapaFiles} />
                    )}
                  </label>
                  <button
                    type="submit"
                    className="btn btn-brand btn-sm rounded-3 d-inline-flex align-items-center justify-content-center flex-shrink-0 p-0"
                    style={{ width: 31, height: 31 }}
                    disabled={savingEtapa}
                    title="Registrar etapa"
                  >
                    {savingEtapa ? <span className="spinner-border spinner-border-sm" /> : <FiPlus size={18} />}
                  </button>
                </div>
                {etapaError && <div className="alert alert-danger py-2 small mt-2">{etapaError}</div>}
              </form>
            )}
          </div>
        </div>

        {/* ─── Evidencia fotográfica ─── */}
        <div className="card border-0 rounded-4 mb-4" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="card-body p-3">
            <h2 className="h6 fw-bold mb-1">Evidencia fotográfica general</h2>
            <p className="text-secondary small mb-2">La evidencia por etapa se agrega en la tabla de arriba.</p>

            <div className="d-flex flex-wrap gap-2 mb-3">
              {(version.fotos || []).map((foto, idxFoto) => (
                <div key={foto.uuid} className="position-relative" style={{ width: 96, height: 96 }}>
                  {fotoUrls[foto.uuid] ? (
                    <img
                      src={fotoUrls[foto.uuid]}
                      alt={foto.nombreOriginal}
                      className="rounded-3 border"
                      style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "zoom-in" }}
                      onClick={() =>
                        setFotoAmpliada({
                          fotos: (version.fotos || []).map((f) => ({
                            src: fotoUrls[f.uuid],
                            alt: f.nombreOriginal || "evidencia",
                          })),
                          idx: idxFoto,
                        })
                      }
                    />
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
                    <input type="file" accept="image/*" multiple className="d-none" onChange={handleSelectFiles} />
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

        {(() => {
          const etapaModal = (version?.etapas || []).find((e) => e.uuid === fotosModalEtapaUuid);
          if (!etapaModal) return null;
          const fotosEtapa = etapaModal.fotos || [];
          const subiendo = subiendoFotoEtapa === etapaModal.uuid;
          return (
            <ModalShell
              title={`Evidencia — Etapa ${etapaModal.numero}`}
              onClose={() => setFotosModalEtapaUuid(null)}
              size="lg"
            >
              {fotosEtapa.length === 0 && (
                <p className="text-secondary small mb-3">Esta etapa no tiene evidencia fotográfica todavía.</p>
              )}
              <div className="d-flex flex-wrap gap-2 mb-3">
                {fotosEtapa.map((foto, idxFoto) => (
                  <div key={foto.uuid} className="position-relative" style={{ width: 140, height: 140 }}>
                    {fotoUrls[foto.uuid] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={fotoUrls[foto.uuid]}
                        alt={foto.nombreOriginal || "evidencia"}
                        className="rounded-3 border"
                        style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "zoom-in" }}
                        onClick={() =>
                          setFotoAmpliada({
                            fotos: fotosEtapa.map((f) => ({
                              src: fotoUrls[f.uuid],
                              alt: f.nombreOriginal || "evidencia",
                            })),
                            idx: idxFoto,
                          })
                        }
                      />
                    ) : (
                      <div
                        className="rounded-3 border d-flex align-items-center justify-content-center text-secondary small"
                        style={{ width: "100%", height: "100%" }}
                      >
                        Cargando…
                      </div>
                    )}
                    {editable && puedeEditar && (
                      <button
                        type="button"
                        className="btn btn-sm btn-danger rounded-circle position-absolute d-flex align-items-center justify-content-center p-0"
                        style={{ width: 24, height: 24, top: -8, right: -8 }}
                        title="Eliminar foto"
                        onClick={() => handleEliminarFoto(foto.uuid)}
                      >
                        <FiX size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {editable && puedeCrear && (
                <label className="btn btn-outline-secondary btn-sm rounded-3 d-inline-flex align-items-center gap-1 mb-0">
                  {subiendo ? <span className="spinner-border spinner-border-sm" /> : <FiCamera size={14} />}
                  {subiendo ? "Subiendo..." : "Agregar evidencia (galería o cámara)"}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="d-none"
                    disabled={subiendo}
                    onChange={(e) => handleSubirFotosAEtapa(etapaModal.uuid, e.target.files)}
                  />
                </label>
              )}
              {etapaError && <div className="alert alert-danger py-2 small mt-2">{etapaError}</div>}
            </ModalShell>
          );
        })()}

        {fotoAmpliada && (() => {
          const { fotos: fotosLb, idx } = fotoAmpliada;
          const total = fotosLb.length;
          const actual = fotosLb[idx];
          const ir = (delta) => setFotoAmpliada((prev) => ({ ...prev, idx: (prev.idx + delta + total) % total }));
          return (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setFotoAmpliada(null)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setFotoAmpliada(null);
                else if (e.key === "ArrowLeft" && total > 1) { e.preventDefault(); ir(-1); }
                else if (e.key === "ArrowRight" && total > 1) { e.preventDefault(); ir(1); }
              }}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 1080,
                background: "rgba(0,0,0,.85)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                cursor: "zoom-out",
              }}
            >
              <button
                type="button"
                className="btn btn-light rounded-circle position-absolute d-flex align-items-center justify-content-center p-0"
                style={{ width: 36, height: 36, top: 16, right: 16 }}
                title="Cerrar"
                onClick={(e) => { e.stopPropagation(); setFotoAmpliada(null); }}
              >
                <FiX size={18} />
              </button>

              {total > 1 && (
                <>
                  <button
                    type="button"
                    className="btn btn-light rounded-circle position-absolute d-flex align-items-center justify-content-center p-0 fw-bold"
                    style={{ width: 44, height: 44, left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 22, lineHeight: 1 }}
                    title="Anterior"
                    onClick={(e) => { e.stopPropagation(); ir(-1); }}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="btn btn-light rounded-circle position-absolute d-flex align-items-center justify-content-center p-0 fw-bold"
                    style={{ width: 44, height: 44, right: 16, top: "50%", transform: "translateY(-50%)", fontSize: 22, lineHeight: 1 }}
                    title="Siguiente"
                    onClick={(e) => { e.stopPropagation(); ir(1); }}
                  >
                    ›
                  </button>
                  <span
                    className="position-absolute text-white small"
                    style={{ bottom: 20, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,.5)", padding: "4px 10px", borderRadius: 999 }}
                  >
                    {idx + 1} / {total}
                  </span>
                </>
              )}

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={idx}
                src={actual?.src}
                alt={actual?.alt}
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8 }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          );
        })()}
      </div>
    </RequirePermission>
  );
}
