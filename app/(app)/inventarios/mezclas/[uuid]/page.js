"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FiPlus, FiX, FiCamera, FiTrash2, FiArrowLeft, FiCheckCircle, FiXCircle, FiPackage, FiInfo, FiClock } from "react-icons/fi";
import { apiFetch, apiFetchFormData, apiFetchBlob } from "@/lib/api";
import { hasPermission, getCurrentUser } from "@/lib/auth";
import { estadoPruebaInfo, ESTADOS_PRUEBA_EDITABLES } from "@/lib/mezclaEstados";
import { construirGrafoUnidades, unidadesAlcanzables, convertirCantidad } from "@/lib/unidadConversion";
import { sellarFotos } from "@/lib/fotoSello";
import { parseFechaUTC } from "@/lib/fecha";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

function emptyEtapaForm() {
  return { modo: "NUEVO_INSUMO", componenteUuid: "", articuloUuid: "", cantidad: "1", unidadUuid: "", ph: "", ce: "", observaciones: "" };
}

const INTERVALOS_HOMOGENEIDAD = [
  ["15MIN", "15 minutos"],
  ["30MIN", "30 minutos"],
  ["60MIN", "1 hora"],
];

function fmtFechaHora(v) {
  const d = parseFechaUTC(v);
  if (!d) return null;
  return d.toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
}

function nombreUsuario(u) {
  if (!u) return "—";
  return `${u.nombre || ""} ${u.apellido || ""}`.trim() || u.usuario || "—";
}

// Nombre + "cargo" (roles del usuario) + opcionalmente la fecha/hora del
// hito (finalización / aprobación).
function TrazaItem({ titulo, usuario, fecha, pendiente, mostrarUsuario = true }) {
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
          {mostrarUsuario && (
            <>
              <div className="small">{nombreUsuario(usuario)}</div>
              {cargo && <div className="small text-secondary">{cargo}</div>}
            </>
          )}
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
  // Si la última medición no cumple los parámetros, no tiene sentido
  // seguir sumando insumos de la receta como si nada — se bloquea "Agregar
  // insumo" (pedido explícito). "Corrección de pH" solo sirve si lo que
  // falló fue el pH: si la CE es la que no cumple (con o sin el pH),
  // corregir el pH no la arregla — no hay forma de corregir CE en esta
  // prueba, así que ahí se bloquea todo y solo queda finalizar.
  const ultimaEtapa = version?.etapas?.length ? version.etapas[version.etapas.length - 1] : null;
  const bloqueadoPorNoCumple = ultimaEtapa?.resultado === "NO_CUMPLE";
  // !== true (no solo === false): si por algún motivo no se sabe con
  // certeza que la CE está bien (ej. una etapa vieja sin este dato), se
  // bloquea por las dudas en vez de asumir que solo falló el pH.
  const ceSinCorregir = bloqueadoPorNoCumple && ultimaEtapa?.cumpleCe !== true;
  // Si algún punto de control de homogeneidad dio "no homogénea" (se
  // separó), no hay forma de corregir eso ajustando pH/insumos — se
  // bloquea seguir registrando etapas Y más puntos de homogeneidad,
  // solo queda finalizar la prueba (pedido explícito).
  const homogeneidadFalla = (version?.homogeneidad || []).some((h) => h.homogenea === false);
  const reguladorPhUuid = articulos.find((a) => a.nombre === "Regulador de pH")?.uuid;

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
  const [componentesForm, setComponentesForm] = useState([]);
  const [savingComponentes, setSavingComponentes] = useState(false);
  const [componentesError, setComponentesError] = useState("");

  // ─── Etapas ───
  // modo: "NUEVO_INSUMO" (agrega el insumo a la receta Y mide, en un solo
  // paso — antes había que guardarlo en "Componentes" aparte antes de
  // poder elegirlo acá), "SOLO_MEDICION" (mide sin agregar insumo) o
  // "CORRECCION_PH" (insumo puntual, ej. regulador de pH, que NO se agrega
  // a la receta). articuloUuid/cantidad/unidadUuid se reutilizan para
  // NUEVO_INSUMO y CORRECCION_PH — son el mismo tipo de campo, solo cambia
  // a dónde va el insumo elegido.
  const [etapaForm, setEtapaForm] = useState(emptyEtapaForm());
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
  const [fotoUrls, setFotoUrls] = useState({}); // { [fotoUuid]: blobUrl }

  // ─── Prueba de homogeneidad (15/30/60 min) ───
  // Estado por intervalo: { [intervalo]: { homogenea: "si"|"no"|"", fotos: [{file, previewUrl}] } }
  const [homogForm, setHomogForm] = useState({});
  const [savingHomog, setSavingHomog] = useState(""); // intervalo en curso, o ""
  const [homogError, setHomogError] = useState({});

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
        (v?.componentes || []).map((c) => ({
          uuid: c.uuid,
          articuloUuid: c.articulo?.uuid || "",
          cantidad: String(c.cantidad ?? 1),
          unidadUuid: c.unidad?.uuid || "",
        })),
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
    const deHomogeneidad = (version.homogeneidad || []).flatMap((h) => h.fotos || []);
    return [...generales, ...deEtapas, ...deHomogeneidad];
  }, [version]);

  // Si la última medición no cumple, "Agregar insumo" queda deshabilitado
  // (ver bloqueadoPorNoCumple) — si el formulario justo quedó en ese modo
  // (ej. recién se reseteó tras registrar la etapa que no cumplió), lo
  // pasa solo a "Corrección de pH".
  useEffect(() => {
    if (bloqueadoPorNoCumple && etapaForm.modo === "NUEVO_INSUMO") {
      setEtapaForm((f) => ({ ...f, modo: "CORRECCION_PH", componenteUuid: "", articuloUuid: "", cantidad: "1", unidadUuid: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloqueadoPorNoCumple]);

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

  // La unidad "más chica" compatible con un artículo (ej. ml en vez de L,
  // gramo en vez de Kg) — pedido explícito: en la prueba de laboratorio,
  // los insumos se dosifican en cantidades chicas, así que conviene
  // arrancar en la unidad más fina en vez de la unidad base del artículo.
  // Se mide el "tamaño" de cada unidad compatible convirtiendo 1 unidad a
  // la unidad base del artículo — la que da el número más chico es la más
  // fina (ej. 1 ml = 0.001 L, contra 1 L = 1 L).
  function unidadMasPequenaPara(articuloUuid) {
    const articulo = articulos.find((a) => a.uuid === articuloUuid);
    const unidadBaseUuid = articulo?.unidadMedida?.uuid;
    if (!unidadBaseUuid) return "";
    const compatibles = unidadesCompatiblesPara(articuloUuid);
    let mejor = unidadBaseUuid;
    let mejorTamano = 1;
    for (const u of compatibles) {
      const tamano = convertirCantidad(grafoUnidades, u.uuid, unidadBaseUuid, 1);
      if (tamano != null && tamano < mejorTamano) {
        mejorTamano = tamano;
        mejor = u.uuid;
      }
    }
    return mejor;
  }

  function computeNextComponentes(rows, idx, field, value) {
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
  }

  function updateComponente(idx, field, value) {
    setComponentesForm((rows) => computeNextComponentes(rows, idx, field, value));
  }

  // Guarda ediciones a insumos YA agregados a la receta (cantidad/unidad) —
  // agregar un insumo NUEVO ya no pasa por acá: se hace desde "Registrar
  // nueva etapa" (ver handleAgregarEtapa), en un solo paso junto con su
  // medición. Un insumo guardado tampoco se puede eliminar de la receta
  // (pedido explícito: evita perder trazabilidad si una etapa ya lo
  // referencia).
  // Cambiar cantidad o unidad guarda solo (sin botón aparte — pedido
  // explícito: "si se cambia, ya se sabe que cambió y debe actualizar").
  // La cantidad guarda al salir del campo (onBlur), no en cada tecleada.
  // PATCH puntual sobre ESA fila (por su uuid) — nunca destruye/recrea
  // toda la lista, para no invalidar el componenteId que ya pueda tener
  // guardado una etapa anterior apuntando a esta misma fila (bug real
  // reportado: reemplazar toda la lista le cambiaba el id por debajo y la
  // etapa vieja quedaba mostrando "—" en vez del insumo).
  async function updateComponenteYGuardar(idx, field, value) {
    const next = computeNextComponentes(componentesForm, idx, field, value);
    setComponentesForm(next);
    const fila = next[idx];
    if (!fila.uuid || !fila.cantidad) return;
    setComponentesError("");
    setSavingComponentes(true);
    try {
      await apiFetch(`/inventarios/mezclas/${uuid}/versiones/${version.uuid}/componentes/${fila.uuid}`, {
        method: "PATCH",
        body: JSON.stringify({ cantidad: Number(fila.cantidad), unidadUuid: fila.unidadUuid || null }),
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
    if (etapaForm.modo === "CORRECCION_PH" && (!etapaForm.cantidad || !etapaForm.unidadUuid)) {
      setEtapaError("Ingresa la cantidad y la unidad usadas para corregir el pH.");
      return;
    }
    if (etapaForm.modo === "NUEVO_INSUMO" && (!etapaForm.articuloUuid || !etapaForm.cantidad || !etapaForm.unidadUuid)) {
      setEtapaError("Selecciona el insumo, la cantidad y la unidad a agregar.");
      return;
    }
    if (etapaFotos.length === 0) {
      setEtapaError("Adjunta una foto de evidencia antes de registrar la etapa.");
      return;
    }
    setSavingEtapa(true);
    try {
      let componenteUuid = etapaForm.componenteUuid || null;

      if (etapaForm.modo === "NUEVO_INSUMO") {
        // Agrega el insumo a la receta (componentes) y, en el mismo paso,
        // registra la etapa que lo mide — antes había que guardarlo en
        // "Componentes de la receta" aparte antes de poder elegirlo acá.
        // INSERT puntual (no reemplaza toda la lista): así el
        // componenteId que las etapas anteriores ya tenían guardado sigue
        // apuntando a la misma fila (bug real reportado: con el PUT que
        // reemplazaba toda la lista, la primera etapa quedaba mostrando
        // "—" apenas se agregaba un segundo insumo).
        const resultado = await apiFetch(
          `/inventarios/mezclas/${uuid}/versiones/${version.uuid}/componentes/agregar`,
          {
            method: "POST",
            body: JSON.stringify({
              articuloUuid: etapaForm.articuloUuid,
              cantidad: Number(etapaForm.cantidad),
              unidadUuid: etapaForm.unidadUuid || null,
            }),
          },
        );
        componenteUuid = resultado.componenteUuid || null;
      }

      const versionActualizada = await apiFetch(
        `/inventarios/mezclas/${uuid}/versiones/${version.uuid}/etapas`,
        {
          method: "POST",
          body: JSON.stringify(
            etapaForm.modo === "CORRECCION_PH"
              ? {
                  // El artículo NO se manda: el backend siempre usa/crea
                  // "Regulador de pH" (ver mezcla.service.js#agregarEtapa).
                  tipoEtapa: "CORRECCION_PH",
                  cantidadCorreccion: Number(etapaForm.cantidad),
                  unidadCorreccionUuid: etapaForm.unidadUuid,
                  ph: Number(etapaForm.ph),
                  ce: Number(etapaForm.ce),
                  observaciones: etapaForm.observaciones || null,
                }
              : {
                  componenteUuid,
                  ph: Number(etapaForm.ph),
                  ce: Number(etapaForm.ce),
                  observaciones: etapaForm.observaciones || null,
                },
          ),
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
      setEtapaForm(emptyEtapaForm());
      await load();
    } catch (err) {
      setEtapaError(err.message);
    } finally {
      setSavingEtapa(false);
    }
  }

  // Nombre a estampar en las fotos de evidencia (fecha/hora + GPS + este
  // usuario) — pedido explícito, ver lib/fotoSello.js.
  const usuarioSello = nombreUsuario(getCurrentUser());

  async function handleSelectEtapaFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const selladas = await sellarFotos(files, { usuario: usuarioSello });
    setEtapaFotos((prev) => [...prev, ...selladas.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))]);
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
      const selladas = await sellarFotos(files, { usuario: usuarioSello });
      const formData = new FormData();
      formData.append("etapaUuid", etapaUuid);
      selladas.forEach((file) => formData.append("fotos", file));
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

  // Usada desde la evidencia por etapa y por punto de control de
  // homogeneidad — ya no hay una sección de "Evidencia fotográfica
  // general" con su propio slot de error, así que se avisa con alert().
  async function handleEliminarFoto(fotoUuid) {
    if (!confirm("¿Eliminar esta foto?")) return;
    try {
      await apiFetch(`/inventarios/mezclas/fotos/${fotoUuid}`, { method: "DELETE" });
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  // ─── Prueba de homogeneidad ───

  async function handleSelectHomogFiles(intervalo, e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const selladas = await sellarFotos(files, { usuario: usuarioSello });
    setHomogForm((prev) => ({
      ...prev,
      [intervalo]: {
        homogenea: prev[intervalo]?.homogenea ?? "",
        fotos: [...(prev[intervalo]?.fotos || []), ...selladas.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))],
      },
    }));
  }

  // Registra el punto de control (Sí/No homogénea) y, si hay fotos
  // adjuntas, las sube en el mismo paso — mismo patrón de dos llamadas que
  // ya usa "Agregar insumo" en Etapas.
  async function handleRegistrarHomogeneidad(intervalo) {
    const form = homogForm[intervalo] || { homogenea: "", fotos: [] };
    if (form.homogenea === "") {
      setHomogError((prev) => ({ ...prev, [intervalo]: "Indica si la mezcla sigue homogénea." }));
      return;
    }
    if (form.fotos.length === 0) {
      setHomogError((prev) => ({ ...prev, [intervalo]: "Adjunta una foto de evidencia antes de registrar." }));
      return;
    }
    setHomogError((prev) => ({ ...prev, [intervalo]: "" }));
    setSavingHomog(intervalo);
    try {
      const versionConPunto = await apiFetch(`/inventarios/mezclas/${uuid}/versiones/${version.uuid}/homogeneidad`, {
        method: "POST",
        body: JSON.stringify({ intervalo, homogenea: form.homogenea === "si" }),
      });
      if (form.fotos.length) {
        const punto = (versionConPunto.homogeneidad || []).find((h) => h.intervalo === intervalo);
        if (punto) {
          const formData = new FormData();
          formData.append("homogeneidadUuid", punto.uuid);
          form.fotos.forEach(({ file }) => formData.append("fotos", file));
          await apiFetchFormData(`/inventarios/mezclas/${uuid}/versiones/${version.uuid}/fotos`, formData);
        }
      }
      form.fotos.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      setHomogForm((prev) => ({ ...prev, [intervalo]: { homogenea: "", fotos: [] } }));
      await load();
    } catch (err) {
      setHomogError((prev) => ({ ...prev, [intervalo]: err.message }));
    } finally {
      setSavingHomog("");
    }
  }

  // ─── Finalizar / Crear elaborado ───

  // Guarda el nombre y finaliza la prueba en un solo paso (el botón de
  // "Información general" pasó a ser esto — antes eran dos acciones
  // separadas: "Guardar" el nombre y, aparte, "Finalizar prueba").
  async function handleGuardarYFinalizar() {
    if (!infoForm.nombre.trim()) {
      setInfoError("Completa el nombre de la prueba.");
      return;
    }
    if (!confirm("¿Finalizar esta prueba? Se generará la salida de inventario por los componentes usados y ya no se podrá editar.")) return;
    setInfoError("");
    setFinalizarError("");
    setSavingInfo(true);
    try {
      await apiFetch(`/inventarios/mezclas/${uuid}`, {
        method: "PUT",
        body: JSON.stringify({ nombre: infoForm.nombre.trim() }),
      });
    } catch (err) {
      setInfoError(err.message);
      setSavingInfo(false);
      return;
    }
    setSavingInfo(false);

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
        if (confirmarNegativo) {
          await apiFetch(`/inventarios/mezclas/${uuid}/versiones/${version.uuid}/finalizar`, {
            method: "POST",
            body: JSON.stringify({ forzarSaldoNegativo: true }),
          });
        }
      }
      await load();
    } catch (err) {
      setFinalizarError(err.message);
      // El nombre ya se guardó aunque falle finalizar — refresca para que
      // no quede desactualizado en pantalla.
      await load();
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
    // Unidad por defecto: Litro, si existe en el catálogo — el operador la
    // puede cambiar igual.
    const unidadLitro = unidades.find((u) => u.nombre?.toLowerCase() === "litro" || u.simbolo?.toLowerCase() === "l");
    setElaboradoForm({
      cantidadElaborada: "1",
      almacenUuid: version?.almacen?.uuid || "",
      // No se pide en el formulario — la fecha real del elaborado se fija a
      // la fecha de aprobación (ver mezcla.service.js#aprobar); esto solo
      // completa el campo requerido mientras tanto.
      fecha: new Date().toISOString().slice(0, 10),
      observaciones: "",
      // El nombre de la prueba suele calzar con el del producto — se
      // precarga como punto de partida, pero el operador lo puede cambiar.
      articuloNombre: mezcla?.nombre || "",
      // Sugerencia de código a partir del código de la prueba (MEZ-0007 →
      // ELAB-0007) — el operador la puede editar libremente antes de crear.
      articuloCodigo: mezcla?.codigo ? mezcla.codigo.replace(/^MEZ/, "ELAB") : "",
      articuloCategoriaUuid: "",
      articuloUnidadMedidaUuid: unidadLitro?.uuid || "",
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

        {/* ─── Encabezado tipo reporte — misma banda verde y banda clara de
            datos que el PDF (ver lib/mezclaReporteExport.js), para que la
            pantalla se vea como el mismo documento. ─── */}
        <div
          className="rounded-4 p-4 mb-3 d-flex flex-wrap align-items-center justify-content-between gap-3"
          style={{ backgroundColor: "#166534" }}
        >
          <div>
            <h1 className="fw-bold h4 mb-1 text-white text-uppercase" style={{ letterSpacing: "0.02em" }}>
              CORBANA ZOMAC S.A.S.
            </h1>
            <p className="small mb-0" style={{ color: "rgba(255,255,255,.85)" }}>
              REPORTE DE PRUEBA DE LABORATORIO — MEZCLAS
            </p>
          </div>
          <div className="text-white text-md-end">
            <div className="small" style={{ color: "rgba(255,255,255,.7)" }}>
              SGC-FO-PM-V1
            </div>
            <div className="fw-bold">{mezcla.codigo}</div>
          </div>
        </div>

        <div className="card border-0 rounded-4 mb-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="card-body p-3">
            <div className="row g-3 text-center">
              <div className="col-6 col-md-3">
                <div className="small text-uppercase fw-semibold" style={{ color: "#166534", fontSize: "0.68rem", letterSpacing: "0.03em" }}>
                  Nombre
                </div>
                <div className="fw-bold small mt-1">{mezcla.nombre || "Sin nombre asignado"}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="small text-uppercase fw-semibold" style={{ color: "#166534", fontSize: "0.68rem", letterSpacing: "0.03em" }}>
                  Código
                </div>
                <div className="small mt-1">{mezcla.codigo}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="small text-uppercase fw-semibold" style={{ color: "#166534", fontSize: "0.68rem", letterSpacing: "0.03em" }}>
                  Estado
                </div>
                <div className="small mt-1 fw-semibold" style={{ color: info.color }}>
                  {info.label.toUpperCase()}
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="small text-uppercase fw-semibold" style={{ color: "#166534", fontSize: "0.68rem", letterSpacing: "0.03em" }}>
                  Almacén
                </div>
                <div className="small mt-1">{version.almacen?.nombre || "—"}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 d-flex justify-content-end gap-2">
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

        {aprobarError && <div className="alert alert-danger py-2 small">{aprobarError}</div>}
        {version.estadoPrueba === "PENDIENTE_APROBACION" && (
          <div className="alert alert-warning py-2 small">
            El artículo elaborado <strong>{mezcla.articuloElaborado?.nombre}</strong> ya fue creado pero está
            <strong> inactivo</strong>: se activa recién al aprobar. Un elaborado nunca tiene saldo propio — al
            usarse, descuenta automáticamente los insumos de su receta. Hasta que se apruebe no se puede usar en
            movimientos, elaboraciones ni proformas — necesita la aprobación de un usuario de un rol autorizado.
          </div>
        )}

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
          <div
            className="mb-4 rounded-3 overflow-hidden"
            style={{ border: `1px solid ${version.estadoPrueba === "NO_VALIDA" ? "#fecaca" : "#a7f3d0"}` }}
          >
            <div
              className="px-3 py-2 d-flex align-items-center gap-2"
              style={{
                backgroundColor: version.estadoPrueba === "NO_VALIDA" ? "#fee2e2" : "#d1fae5",
                color: version.estadoPrueba === "NO_VALIDA" ? "#b91c1c" : "#047857",
              }}
            >
              {version.estadoPrueba === "NO_VALIDA" ? <FiXCircle /> : <FiCheckCircle />}
              <span className="fw-bold text-uppercase small" style={{ letterSpacing: "0.06em" }}>
                {version.estadoPrueba === "NO_VALIDA" ? "No cumple parámetros" : "Cumple parámetros"}
              </span>
            </div>
            <div className="card-body p-3 bg-white">
              <div className="row g-4">
                <div className="col-6 col-md-3">
                  <div className="small text-secondary text-uppercase fw-semibold" style={{ fontSize: "0.68rem", letterSpacing: "0.03em" }}>
                    pH final
                  </div>
                  <div className="fw-bold" style={{ fontSize: "1.5rem", lineHeight: 1.2 }}>
                    {version.phFinal ?? "—"}
                  </div>
                  <div className="small text-secondary">
                    rango {version.parametrosUsados?.phMinimo}–{version.parametrosUsados?.phMaximo}
                  </div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="small text-secondary text-uppercase fw-semibold" style={{ fontSize: "0.68rem", letterSpacing: "0.03em" }}>
                    CE final
                  </div>
                  <div className="fw-bold" style={{ fontSize: "1.5rem", lineHeight: 1.2 }}>
                    {version.ceFinal ?? "—"}
                  </div>
                  <div className="small text-secondary">máx {version.parametrosUsados?.ceMaxima}</div>
                </div>
                <div className="col-12 col-md-6 border-start-md ps-md-4">
                  <div className="small text-secondary text-uppercase fw-semibold" style={{ fontSize: "0.68rem", letterSpacing: "0.03em" }}>
                    Documento de inventario
                  </div>
                  <div className="small fw-medium mt-1">{version.movimientoDocumento || "—"}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Insumos y mediciones ───
            Un solo contenedor: agregar un insumo a la receta y registrar
            su medición de pH/CE es UNA sola acción (ver handleAgregarEtapa)
            — antes había que guardar "Componentes de la receta" aparte
            antes de poder elegirlo en la medición. */}
        <div className="card border-0 rounded-4 mb-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="px-3 py-1" style={{ backgroundColor: "#166534" }}>
            <h2 className="h6 fw-bold mb-0 text-white text-uppercase" style={{ fontSize: "0.8rem", letterSpacing: "0.03em" }}>
              Insumos y mediciones
            </h2>
          </div>
          <div className="p-3">
            {editable && puedeCrear && (
              <form onSubmit={handleAgregarEtapa} className="pt-3 pb-3 mb-3 border-top">
                <div className="mb-2">
                  <p className="small fw-medium mb-1">Registrar nueva etapa</p>
                  <div className="btn-group btn-group-sm" role="group">
                    {[
                      ["NUEVO_INSUMO", "Agregar insumo"],
                      ["CORRECCION_PH", "Corrección de pH"],
                    ].map(([valor, label]) => {
                      const deshabilitado =
                        homogeneidadFalla || (valor === "NUEVO_INSUMO" && bloqueadoPorNoCumple) || (valor === "CORRECCION_PH" && ceSinCorregir);
                      return (
                        <button
                          key={valor}
                          type="button"
                          className={`btn ${etapaForm.modo === valor ? "btn-brand" : "btn-outline-secondary"}`}
                          disabled={deshabilitado}
                          title={
                            homogeneidadFalla
                              ? "La mezcla no dio homogénea — hay que finalizar la prueba"
                              : valor === "CORRECCION_PH" && ceSinCorregir
                                ? "La CE no cumple — corregir el pH no la arregla, hay que finalizar la prueba"
                                : deshabilitado
                                  ? "La última medición no cumple — corrige el pH o finaliza la prueba"
                                  : undefined
                          }
                          onClick={() =>
                            setEtapaForm((f) => ({
                              ...f,
                              modo: valor,
                              componenteUuid: "",
                              articuloUuid: "",
                              cantidad: "1",
                              // Precarga la unidad más chica compatible con
                              // el Regulador de pH (ej. gramo en vez de Kg)
                              // — se dosifica en cantidades chicas.
                              unidadUuid: valor === "CORRECCION_PH" ? unidadMasPequenaPara(reguladorPhUuid) : "",
                            }))
                          }
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  {homogeneidadFalla ? (
                    <p className="small mb-0 mt-2" style={{ color: "#b91c1c" }}>
                      La mezcla no dio homogénea en la prueba de homogeneidad (se separó) — no hay forma de
                      corregirlo ajustando pH o insumos. Finaliza la prueba (quedará como no válida).
                    </p>
                  ) : ceSinCorregir ? (
                    <p className="small mb-0 mt-2" style={{ color: "#b91c1c" }}>
                      La conductividad eléctrica (CE) no cumple — no hay forma de corregirla en esta prueba. Finaliza
                      la prueba (quedará como no válida).
                    </p>
                  ) : (
                    bloqueadoPorNoCumple && (
                      <p className="small mb-0 mt-2" style={{ color: "#b91c1c" }}>
                        La última medición no cumple los parámetros de pH/CE — corrige el pH o finaliza la prueba.
                      </p>
                    )
                  )}
                </div>
                {!ceSinCorregir && !homogeneidadFalla && (
                <div className="d-flex flex-wrap flex-md-nowrap align-items-end gap-2">
                  {etapaForm.modo === "CORRECCION_PH" ? (
                    <>
                      <div style={{ minWidth: "8rem" }} className="flex-shrink-0">
                        <label className="form-label small mb-1">Insumo usado</label>
                        {/* Fijo: la corrección de pH siempre usa "Regulador
                            de pH" — el backend lo resuelve/crea solo (ver
                            mezcla.service.js#agregarEtapa), no se elige acá. */}
                        <input type="text" disabled className="form-control form-control-sm rounded-3" value="Regulador de pH" />
                      </div>
                      <div style={{ width: "7rem" }} className="flex-shrink-0">
                        <label className="form-label small mb-1">Unidad</label>
                        <select
                          className="form-select form-select-sm rounded-3"
                          required
                          value={etapaForm.unidadUuid}
                          onChange={(e) => setEtapaForm((f) => ({ ...f, unidadUuid: e.target.value }))}
                        >
                          <option value="">—</option>
                          {unidades.map((u) => (
                            <option key={u.uuid} value={u.uuid}>
                              {u.simbolo || u.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={{ width: "5.5rem" }} className="flex-shrink-0">
                        <label className="form-label small mb-1">Cantidad</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          className="form-control form-control-sm rounded-3"
                          value={etapaForm.cantidad}
                          onChange={(e) => setEtapaForm((f) => ({ ...f, cantidad: e.target.value }))}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-grow-1" style={{ minWidth: "10rem" }}>
                        <label className="form-label small mb-1">Insumo a agregar</label>
                        <select
                          className="form-select form-select-sm rounded-3"
                          required
                          value={etapaForm.articuloUuid}
                          onChange={(e) =>
                            setEtapaForm((f) => ({ ...f, articuloUuid: e.target.value, unidadUuid: unidadMasPequenaPara(e.target.value) }))
                          }
                        >
                          <option value="">Selecciona un insumo</option>
                          {articulos
                            .filter((a) => !componentesForm.some((c) => c.articuloUuid === a.uuid))
                            .map((a) => (
                              <option key={a.uuid} value={a.uuid}>
                                {a.nombre}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div style={{ width: "7rem" }} className="flex-shrink-0">
                        <label className="form-label small mb-1">Unidad</label>
                        <select
                          className="form-select form-select-sm rounded-3"
                          required
                          value={etapaForm.unidadUuid}
                          onChange={(e) => setEtapaForm((f) => ({ ...f, unidadUuid: e.target.value }))}
                        >
                          <option value="">—</option>
                          {unidadesCompatiblesPara(etapaForm.articuloUuid).map((u) => (
                            <option key={u.uuid} value={u.uuid}>
                              {u.simbolo || u.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={{ width: "5.5rem" }} className="flex-shrink-0">
                        <label className="form-label small mb-1">Cantidad</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          required
                          className="form-control form-control-sm rounded-3"
                          value={etapaForm.cantidad}
                          onChange={(e) => setEtapaForm((f) => ({ ...f, cantidad: e.target.value }))}
                        />
                      </div>
                    </>
                  )}
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
                        : "Adjuntar evidencia fotográfica (galería o cámara, obligatoria)"
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
                    disabled={savingEtapa || etapaFotos.length === 0}
                    title={etapaFotos.length === 0 ? "Adjunta una foto antes de registrar" : "Registrar etapa"}
                  >
                    {savingEtapa ? <span className="spinner-border spinner-border-sm" /> : <FiPlus size={18} />}
                  </button>
                </div>
                )}
                {etapaError && <div className="alert alert-danger py-2 small mt-2">{etapaError}</div>}
              </form>
            )}

            <div className="table-responsive mb-3">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr className="small" style={{ backgroundColor: "#f0fdf4" }}>
                    <th className="text-center" style={{ color: "#166534" }}>#</th>
                    <th style={{ color: "#166534" }}>Componente incorporado</th>
                    <th className="text-center" style={{ color: "#166534" }}>pH</th>
                    <th className="text-center" style={{ color: "#166534" }}>CE</th>
                    <th className="text-center" style={{ color: "#166534" }}>Resultado</th>
                    <th className="text-center" style={{ color: "#166534" }}>Fecha</th>
                    <th style={{ color: "#166534" }}>Observaciones</th>
                    <th className="text-center" style={{ color: "#166534" }}>Evidencia</th>
                    {editable && puedeCrear && <th style={{ width: "2.5rem", backgroundColor: "#f0fdf4" }} />}
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
                      <td className="small">
                        {et.tipoEtapa === "CORRECCION_PH" ? (
                          <div className="d-flex align-items-center gap-1 flex-wrap">
                            <span
                              className="badge rounded-pill small"
                              style={{ backgroundColor: "#fef3c7", color: "#b45309" }}
                            >
                              Corrección pH
                            </span>
                            <span className="text-secondary">
                              {et.articuloCorreccion?.nombre}
                              {et.cantidadCorreccion != null &&
                                ` — ${Number(et.cantidadCorreccion).toLocaleString("es-CO", { maximumFractionDigits: 2 })} ${
                                  et.unidadCorreccion?.simbolo || ""
                                }`}
                            </span>
                          </div>
                        ) : et.componente ? (
                          <>
                            {et.componente.articulo?.nombre}
                            <span className="text-secondary">
                              {" — "}
                              {Number(et.componente.cantidad).toLocaleString("es-CO", { maximumFractionDigits: 2 })}{" "}
                              {et.componente.unidad?.simbolo || ""}
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
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
                        {et.medidoEn ? parseFechaUTC(et.medidoEn).toLocaleString("es-CO", { timeZone: "America/Bogota" }) : "—"}
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
          </div>
        </div>

        {/* ─── Receta actual ─── */}
        <div className="card border-0 rounded-4 mb-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="px-3 py-1" style={{ backgroundColor: "#166534" }}>
            <h2 className="h6 fw-bold mb-0 text-white text-uppercase" style={{ fontSize: "0.8rem", letterSpacing: "0.03em" }}>
              Receta actual
            </h2>
          </div>
          <div className="p-3">
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-2">
                <thead>
                  <tr className="small" style={{ backgroundColor: "#f0fdf4" }}>
                    <th className="text-start" style={{ minWidth: "14rem", color: "#166534" }}>Artículo</th>
                    <th className="text-center" style={{ width: "8rem", color: "#166534" }}>Cantidad</th>
                    <th className="text-center" style={{ minWidth: "8rem", color: "#166534" }}>Unidad</th>
                  </tr>
                </thead>
                <tbody>
                  {(editable ? componentesForm : version.componentes || []).map((c, idx) => {
                    if (!editable) {
                      // Conversión a la unidad BASE del artículo (para
                      // consumirStockConReceta) — ya no se muestra en la
                      // tabla (el PDF/reporte no la incluye), pero se sigue
                      // calculando acá por si en el futuro hace falta.
                      return (
                        <tr key={c.uuid || idx}>
                          <td className="small">{c.articulo?.nombre || "—"}</td>
                          <td className="small text-center">{Number(c.cantidad).toFixed(2)}</td>
                          <td className="small text-center text-secondary">{c.unidad?.simbolo || "—"}</td>
                        </tr>
                      );
                    }
                    const unidadesFila = unidadesCompatiblesPara(c.articuloUuid);
                    // El artículo de una fila ya guardada no se cambia
                    // (pedido explícito) — solo cantidad/unidad son
                    // editables acá.
                    const articuloFila = articulos.find((a) => a.uuid === c.articuloUuid);
                    return (
                      <tr key={idx}>
                        <td className="small">{articuloFila ? (articuloFila.codigo ? `${articuloFila.codigo} — ${articuloFila.nombre}` : articuloFila.nombre) : "—"}</td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            className="form-control form-control-sm rounded-3 text-center"
                            value={c.cantidad}
                            onChange={(e) => updateComponente(idx, "cantidad", e.target.value)}
                            onBlur={(e) => updateComponenteYGuardar(idx, "cantidad", e.target.value)}
                          />
                        </td>
                        <td>
                          <select className="form-select form-select-sm rounded-3" value={c.unidadUuid} onChange={(e) => updateComponenteYGuardar(idx, "unidadUuid", e.target.value)}>
                            <option value="">Sin unidad</option>
                            {unidadesFila.map((u) => (
                              <option key={u.uuid} value={u.uuid}>
                                {u.simbolo}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                  {(editable ? componentesForm : version.componentes || []).length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center text-secondary small py-2">
                        Sin insumos agregados todavía — agrégalos desde &quot;Registrar nueva etapa&quot;, arriba.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {componentesError && <div className="alert alert-danger py-2 small">{componentesError}</div>}
            {savingComponentes && <p className="small text-secondary mb-0">Guardando...</p>}
          </div>
        </div>

        {/* ─── Prueba de homogeneidad ───
            A los 15 min, 30 min y 1 hora de mezclada se confirma que sigue
            homogénea (no se separó), con foto de evidencia en cada punto. */}
        <div className="card border-0 rounded-4 mb-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="px-3 py-1" style={{ backgroundColor: "#166534" }}>
            <h2 className="h6 fw-bold mb-0 text-white text-uppercase" style={{ fontSize: "0.8rem", letterSpacing: "0.03em" }}>
              Prueba de homogeneidad
            </h2>
          </div>
          <div className="p-3">
            <p className="text-secondary small mb-3">
              Verifica, con foto, que la mezcla sigue homogénea (no se separó) a los 15 minutos, 30 minutos y 1 hora.
            </p>
            <div className="row g-3">
              {INTERVALOS_HOMOGENEIDAD.map(([intervalo, label], idx) => {
                const punto = (version.homogeneidad || []).find((h) => h.intervalo === intervalo);
                const form = homogForm[intervalo] || { homogenea: "", fotos: [] };
                // Se registra en orden: no se puede cargar 30 min sin
                // haber registrado 15 min antes (y que haya dado
                // homogénea) — evita que, como pasó, se cargue un punto
                // posterior mientras uno anterior todavía no se guardó o
                // ya falló (ver homogeneidadFalla, más arriba).
                const anteriores = INTERVALOS_HOMOGENEIDAD.slice(0, idx).map(([i]) => i);
                const faltaAnterior = anteriores.some((i) => {
                  const p = (version.homogeneidad || []).find((h) => h.intervalo === i);
                  return !p || p.homogenea !== true;
                });
                return (
                  <div key={intervalo} className="col-12 col-md-4">
                    <div
                      className="rounded-4 p-3 h-100"
                      style={{
                        border: "1px solid #e5e7eb",
                        backgroundColor: punto ? (punto.homogenea ? "#f0fdf4" : "#fef2f2") : "#fff",
                      }}
                    >
                      <div className="d-flex align-items-center gap-2 mb-3">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{ width: 30, height: 30, backgroundColor: "#f0fdf4", color: "#166534" }}
                        >
                          <FiClock size={15} />
                        </div>
                        <p className="small fw-bold mb-0">{label}</p>
                      </div>

                      {punto ? (
                        <>
                          <div
                            className="d-inline-flex align-items-center gap-1 rounded-pill px-2 py-1 small fw-medium mb-2"
                            style={
                              punto.homogenea
                                ? { backgroundColor: "#d1fae5", color: "#047857" }
                                : { backgroundColor: "#fee2e2", color: "#b91c1c" }
                            }
                          >
                            {punto.homogenea ? <FiCheckCircle size={13} /> : <FiXCircle size={13} />}
                            {punto.homogenea ? "Homogénea" : "No homogénea"}
                          </div>
                          <div className="small text-secondary mb-2">
                            {punto.medidoEn ? parseFechaUTC(punto.medidoEn).toLocaleString("es-CO", { timeZone: "America/Bogota" }) : "—"}
                          </div>
                          <div className="d-flex flex-wrap gap-2">
                            {(punto.fotos || []).map((foto) => (
                              <div key={foto.uuid} className="position-relative" style={{ width: 64, height: 64 }}>
                                {fotoUrls[foto.uuid] ? (
                                  <img
                                    src={fotoUrls[foto.uuid]}
                                    alt={foto.nombreOriginal}
                                    className="rounded-3 border"
                                    style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "zoom-in" }}
                                    onClick={() =>
                                      setFotoAmpliada({
                                        fotos: (punto.fotos || []).map((f) => ({ src: fotoUrls[f.uuid], alt: f.nombreOriginal || "evidencia" })),
                                        idx: (punto.fotos || []).findIndex((f) => f.uuid === foto.uuid),
                                      })
                                    }
                                  />
                                ) : (
                                  <div className="rounded-3 border d-flex align-items-center justify-content-center small text-secondary" style={{ width: "100%", height: "100%" }}>
                                    ...
                                  </div>
                                )}
                              </div>
                            ))}
                            {(punto.fotos || []).length === 0 && <p className="text-secondary small mb-0">Sin foto adjunta.</p>}
                          </div>
                        </>
                      ) : editable && puedeCrear && !homogeneidadFalla && !faltaAnterior ? (
                        <>
                          <div className="d-flex gap-2 mb-3">
                            {[
                              ["si", "Sí", FiCheckCircle, "#d1fae5", "#047857", "#a7f3d0"],
                              ["no", "No", FiXCircle, "#fee2e2", "#b91c1c", "#fecaca"],
                            ].map(([valor, texto, Icono, bg, color, borde]) => {
                              const activo = form.homogenea === valor;
                              return (
                                <button
                                  key={valor}
                                  type="button"
                                  className="btn btn-sm rounded-3 flex-fill d-flex align-items-center justify-content-center gap-1 fw-medium"
                                  style={
                                    activo
                                      ? { backgroundColor: bg, color, border: `1px solid ${borde}` }
                                      : { backgroundColor: "#fff", color: "#6b7280", border: "1px solid #d1d5db" }
                                  }
                                  onClick={() => setHomogForm((prev) => ({ ...prev, [intervalo]: { ...form, homogenea: valor } }))}
                                >
                                  <Icono size={14} /> {texto}
                                </button>
                              );
                            })}
                          </div>

                          <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
                            <label
                              className="rounded-3 d-flex align-items-center justify-content-center flex-shrink-0"
                              style={{ width: 40, height: 40, border: "1px dashed #9ca3af", color: "#6b7280", cursor: "pointer" }}
                              title="Adjuntar foto"
                            >
                              <FiCamera size={16} />
                              <input type="file" accept="image/*" multiple className="d-none" onChange={(e) => handleSelectHomogFiles(intervalo, e)} />
                            </label>
                            {form.fotos.map((p, idx) => (
                              <img
                                key={idx}
                                src={p.previewUrl}
                                alt=""
                                className="rounded-3 border flex-shrink-0"
                                style={{ width: 40, height: 40, objectFit: "cover" }}
                              />
                            ))}
                            {form.fotos.length === 0 && <span className="small text-secondary">Sin foto todavía (obligatoria)</span>}
                          </div>

                          <button
                            type="button"
                            className="btn btn-brand btn-sm rounded-3 w-100 d-flex align-items-center justify-content-center gap-1"
                            disabled={savingHomog === intervalo || form.fotos.length === 0}
                            title={form.fotos.length === 0 ? "Adjunta una foto antes de registrar" : undefined}
                            onClick={() => handleRegistrarHomogeneidad(intervalo)}
                          >
                            {savingHomog === intervalo ? (
                              <span className="spinner-border spinner-border-sm" />
                            ) : (
                              <FiCheckCircle size={14} />
                            )}
                            {savingHomog === intervalo ? "Guardando..." : "Registrar"}
                          </button>
                          {homogError[intervalo] && <div className="alert alert-danger py-1 px-2 small mt-2 mb-0">{homogError[intervalo]}</div>}
                        </>
                      ) : homogeneidadFalla ? (
                        <p className="small mb-0" style={{ color: "#b91c1c" }}>
                          La prueba ya no dio homogénea — finaliza la prueba.
                        </p>
                      ) : faltaAnterior ? (
                        <p className="text-secondary small mb-0">Registra primero el punto anterior.</p>
                      ) : (
                        <p className="text-secondary small mb-0">Sin registrar.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── Información general ───
            Al final: acá se asigna el nombre y, en el mismo paso, se
            finaliza la prueba (antes eran dos acciones separadas). */}
        <div className="card border-0 rounded-4 mb-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="px-3 py-2" style={{ backgroundColor: "#166534" }}>
            <h2 className="h6 fw-bold mb-0 text-white text-uppercase" style={{ fontSize: "0.8rem", letterSpacing: "0.03em" }}>
              Información general
            </h2>
          </div>
          <div className="p-3">
            {editable && puedeCrear ? (
              <>
                {!infoCompleta && (
                  <p className="small text-secondary mb-2">
                    Al completar el nombre y finalizar, se generará la salida de inventario por los componentes
                    usados y la prueba ya no se podrá editar. El artículo elaborado (producto) todavía no existe: se
                    crea más adelante, a partir de la prueba exitosa, al usar &quot;Crear elaborado&quot;.
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
                  <div className="col-12 col-md-4">
                    <button
                      type="button"
                      className="btn btn-brand btn-sm rounded-3 w-100"
                      disabled={savingInfo || finalizando}
                      onClick={handleGuardarYFinalizar}
                    >
                      {savingInfo ? "Guardando..." : finalizando ? "Finalizando..." : "Guardar y finalizar prueba"}
                    </button>
                  </div>
                </div>
                {infoError && <div className="alert alert-danger py-2 small mb-0">{infoError}</div>}
                {finalizarError && <div className="alert alert-danger py-2 small mb-0">{finalizarError}</div>}
              </>
            ) : (
              <p className="small text-secondary mb-0">
                Producto elaborado:{" "}
                <strong>{mezcla.articuloElaborado?.nombre || "Aún no generado"}</strong>
              </p>
            )}
          </div>
        </div>

        {/* ─── Trazabilidad ─── último contenedor visible de la página. */}
        {(version.finalizadaEn || version.aprobadaEn || version.operador) && (
          <div className="card border-0 rounded-4 mb-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
            <div className="px-3 py-1" style={{ backgroundColor: "#166534" }}>
              <h2 className="h6 fw-bold mb-0 text-white text-uppercase" style={{ fontSize: "0.8rem", letterSpacing: "0.03em" }}>
                Trazabilidad
              </h2>
            </div>
            <div className="p-3">
              <div className="row g-3">
                <TrazaItem titulo="Iniciado por" fecha={version.created_at} usuario={version.operador} />
                <TrazaItem titulo="Finalizado" fecha={version.finalizadaEn} mostrarUsuario={false} />
                <TrazaItem
                  titulo="Aprobado por"
                  fecha={version.aprobadaEn}
                  usuario={version.aprobadaPor}
                  pendiente={version.estadoPrueba === "PENDIENTE_APROBACION"}
                />
              </div>
            </div>
          </div>
        )}

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
                      <label className="form-label small fw-medium d-flex align-items-center gap-1">
                        Código
                        <FiInfo size={13} className="text-secondary" title="Sugerido automáticamente a partir del código de la prueba — lo puedes editar." />
                      </label>
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
                      <label className="form-label small fw-medium">Cantidad</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        className="form-control rounded-3"
                        value={elaboradoForm.cantidadElaborada}
                        onChange={(e) => setElaboradoForm((f) => ({ ...f, cantidadElaborada: e.target.value }))}
                      />
                   
                    </div>
                  </div>
                  <hr />
                </>
              )}

              {mezcla.articuloElaborado && (
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
                  </div>
                </div>
              )}
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
