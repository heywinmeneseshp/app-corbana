"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FiPlus, FiX, FiCamera, FiTrash2, FiArrowLeft, FiCheckCircle, FiXCircle, FiInfo, FiClock, FiSend, FiMenu } from "react-icons/fi";
import { apiFetch, apiFetchFormData, apiFetchBlob } from "@/lib/api";
import { hasPermission, getCurrentUser } from "@/lib/auth";
import { estadoPruebaInfo, ESTADOS_PRUEBA_EDITABLES } from "@/lib/mezclaEstados";
import { construirGrafoUnidades, unidadesAlcanzables, convertirCantidad } from "@/lib/unidadConversion";
import { sellarFotos } from "@/lib/fotoSello";
import { parseFechaUTC } from "@/lib/fecha";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

// Solo para la corrección de pH (ACONDICIONADOR) — el flujo de "Agregar
// insumo" ya no pasa por este form, ver `insumoSeleccionadoUuid`.
function emptyEtapaForm() {
  return { cantidad: "1", unidadUuid: "", litrosAgua: "", ph: "", ce: "", observaciones: "" };
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
  const [parametros, setParametros] = useState(null);
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
  const reguladorPhUuid = articulos.find((a) => a.nombre === "ACONDICIONADOR")?.uuid;

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
  // Mientras el nombre no se haya tocado a mano, se sugiere solo
  // concatenando los insumos de la receta (sin Agua ni ACONDICIONADOR,
  // que no son insumos "de fórmula") — pedido explícito. Igual criterio
  // que dosis/cantidad en Aspersiones: se deja de auto-sugerir en cuanto
  // el operador edita el campo.
  const [nombreEditadoManualmente, setNombreEditadoManualmente] = useState(false);

  // ─── Componentes ───
  const [componentesForm, setComponentesForm] = useState([]);
  const [savingComponentes, setSavingComponentes] = useState(false);
  const [componentesError, setComponentesError] = useState("");

  // ─── Etapas ───
  // "Agregar insumo" y "Corrección de pH" ya no comparten un único
  // formulario (pedido explícito: separar "agregar el insumo" de "medir su
  // pH/CE" en dos pasos/contenedores). `etapaForm` queda solo para
  // CORRECCION_PH (sigue siendo un solo paso: mide Y corrige a la vez, no
  // agrega nada a la receta). Agregar un insumo nuevo es ahora
  // `insumoSeleccionadoUuid` + `handleAgregarInsumo` (abajo); medir un
  // insumo ya agregado es `medicionesForm` + `handleRegistrarMedicion`.
  const [etapaForm, setEtapaForm] = useState(emptyEtapaForm());
  const [etapaFotos, setEtapaFotos] = useState([]); // [{file, previewUrl}] — evidencia de la corrección de pH que se está por registrar

  // "Agregar insumo": solo el select — la cantidad/unidad se calculan solas
  // (sugeridas por dosis, ver sugerirCantidadPorDosis) al agregar, y quedan
  // editables después en "Insumos pendientes de medir"/"Receta actual".
  const [insumoSeleccionadoUuid, setInsumoSeleccionadoUuid] = useState("");
  const [agregandoInsumo, setAgregandoInsumo] = useState(false);

  // Medición en progreso por cada insumo pendiente de medir (ver
  // `pendientesDeMedir` más abajo) — clave: uuid del componente.
  // { [componenteUuid]: { ph, ce, observaciones, fotos: [{file, previewUrl}] } }
  const [medicionesForm, setMedicionesForm] = useState({});
  const [registrandoMedicionUuid, setRegistrandoMedicionUuid] = useState(null);
  // Arrastrar para reordenar los insumos AÚN SIN MEDIR (uuid del que se
  // arrastra y de la fila sobre la que está). Uno ya medido es inamovible.
  const [arrastrandoUuid, setArrastrandoUuid] = useState(null);
  const [sobreUuid, setSobreUuid] = useState(null);

  function medicionDe(componenteUuid) {
    return medicionesForm[componenteUuid] || { ph: "", ce: "", observaciones: "", fotos: [] };
  }

  function updateMedicion(componenteUuid, patch) {
    setMedicionesForm((prev) => ({ ...prev, [componenteUuid]: { ...medicionDe(componenteUuid), ...patch } }));
  }

  // "Pendiente de medir": un componente de la receta que todavía NINGUNA
  // etapa mide — se deriva de datos reales (receta + historial de etapas),
  // no de un estado local efímero, así sobrevive a recargar la página.
  const componentesUuidsMedidos = new Set((version?.etapas || []).map((et) => et.componente?.uuid).filter(Boolean));
  const pendientesDeMedir = componentesForm.filter((c) => c.uuid && !componentesUuidsMedidos.has(c.uuid));

  // Nombre sugerido: insumos YA guardados en la receta + el que se está
  // eligiendo ahora mismo en "Agregar insumo" (aunque todavía no se haya
  // agregado) — pedido explícito: "debería mostrar desde el momento que
  // ingreso el primer insumo", no recién cuando ya quedó guardado y la
  // página se volvió a cargar.
  const nombreSugerido = [
    ...componentesForm.map((c) => c.articuloUuid),
    ...(insumoSeleccionadoUuid ? [insumoSeleccionadoUuid] : []),
  ]
    .map((articuloUuid) => articulos.find((a) => a.uuid === articuloUuid)?.nombre)
    .filter((nombre) => nombre && nombre !== "Agua" && nombre !== "ACONDICIONADOR")
    .join(" + ");
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
  const [fotoErrores, setFotoErrores] = useState({}); // { [fotoUuid]: true } — falló la descarga

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

  // Mini-modal "Nueva categoría" — para crear una categoría de tipo
  // Elaborado sin salir del modal de aprobar (antes había que ir a
  // Inventarios → Categorías, perder el formulario que ya se estaba
  // llenando, y volver a empezar).
  const [categoriaModalOpen, setCategoriaModalOpen] = useState(false);
  const [categoriaNombre, setCategoriaNombre] = useState("");
  const [guardandoCategoria, setGuardandoCategoria] = useState(false);
  const [categoriaError, setCategoriaError] = useState("");

  async function handleCrearCategoriaRapida(e) {
    e.preventDefault();
    if (!categoriaNombre.trim()) return;
    setCategoriaError("");
    setGuardandoCategoria(true);
    try {
      const nueva = await apiFetch("/inventarios/categorias", {
        method: "POST",
        body: JSON.stringify({ nombre: categoriaNombre.trim(), descripcion: null, tipo: "ELABORADO", estado: true }),
      });
      setCategoriasElaborado((prev) => [...prev, nueva]);
      setElaboradoForm((f) => ({ ...f, articuloCategoriaUuid: nueva.uuid }));
      setCategoriaModalOpen(false);
      setCategoriaNombre("");
    } catch (err) {
      setCategoriaError(err.message);
    } finally {
      setGuardandoCategoria(false);
    }
  }

  // Devuelve los componentes recién cargados — lo necesitan las funciones
  // que encadenan una sincronización inmediatamente después (ver
  // `sincronizarAgua`): leer `componentesForm` del estado justo después de
  // `await load()`, dentro del mismo closure, da el valor VIEJO (React
  // no lo actualiza de forma síncrona), así que hay que devolverlo.
  // Un borrador (p. ej. creado con "Nueva mezcla", con cantidades de un lote
  // de varios litros) se lleva SOLO a 1 litro con las dosis exactas al
  // abrirlo por primera vez (ver mezcla.service.js#llevarAUnLitro). Una sola
  // vez por receta (el backend lo marca) y solo si todavía no se midió nada.
  const autoNormalizadoIntentado = useRef(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      let detalle = await apiFetch(`/inventarios/mezclas/${uuid}`);
      const vAuto = detalle.versiones?.[0];
      if (
        !autoNormalizadoIntentado.current &&
        puedeCrear &&
        vAuto &&
        ESTADOS_PRUEBA_EDITABLES.includes(vAuto.estadoPrueba) &&
        !vAuto.recetaNormalizada &&
        !(vAuto.etapas || []).length &&
        (vAuto.componentes || []).length
      ) {
        autoNormalizadoIntentado.current = true;
        try {
          await apiFetch(`/inventarios/mezclas/${uuid}/versiones/${vAuto.uuid}/llevar-a-un-litro`, { method: "POST", body: JSON.stringify({}) });
          detalle = await apiFetch(`/inventarios/mezclas/${uuid}`);
        } catch (errAuto) {
          setComponentesError(`No se pudo llevar la receta a 1 litro automáticamente: ${errAuto.message}`);
        }
      }
      setMezcla(detalle);
      setInfoForm({ nombre: detalle.nombre || "" });
      // Si ya tiene un nombre guardado, se respeta (no se pisa con la
      // sugerencia automática) — solo se auto-sugiere mientras el campo
      // sigue vacío/sin tocar.
      setNombreEditadoManualmente(Boolean(detalle.nombre));
      const v = detalle.versiones?.[0];
      const nuevosComponentes = (v?.componentes || []).map((c) => ({
        uuid: c.uuid,
        articuloUuid: c.articulo?.uuid || "",
        cantidad: String(c.cantidad ?? 1),
        unidadUuid: c.unidad?.uuid || "",
        esPrincipal: Boolean(c.esPrincipal),
      }));
      setComponentesForm(nuevosComponentes);
      return nuevosComponentes;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function loadCombos() {
    try {
      const [todos, categorias, uni, conv, alms, params] = await Promise.all([
        apiFetch("/inventarios/articulos?limit=100&estado=true"),
        apiFetch("/inventarios/categorias?limit=100&tipo=ELABORADO&estado=true"),
        apiFetch("/inventarios/unidades?limit=100&estado=true"),
        apiFetch("/inventarios/unidades/conversiones"),
        apiFetch("/inventarios/almacenes?limit=100&estado=true"),
        apiFetch("/inventarios/mezclas/parametros"),
      ]);
      setArticulos(todos.items || []);
      setCategoriasElaborado(categorias.items || []);
      setUnidades(uni.items || []);
      setConversiones(Array.isArray(conv) ? conv : conv.items || []);
      setAlmacenes(alms.items || []);
      setParametros(params);
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

  // Sugiere el nombre solo mientras el operador no lo haya tocado a mano
  // (mismo criterio que dosis/cantidad en Aspersiones) — se recalcula cada
  // vez que cambia la lista de insumos de la receta.
  useEffect(() => {
    if (!nombreEditadoManualmente) {
      setInfoForm((f) => (f.nombre === nombreSugerido ? f : { ...f, nombre: nombreSugerido }));
    }
  }, [nombreSugerido, nombreEditadoManualmente]);


  // Carga las fotos de forma INCREMENTAL — antes, cualquier acción que
  // agregara una sola foto nueva (registrar una etapa, un punto de
  // homogeneidad, etc.) volvía a descargar TODAS las fotos de la prueba
  // desde cero (se armaba un objeto `urls` nuevo y se revocaban los blobs
  // ya cargados), lo que se sentía lento a medida que la prueba acumulaba
  // evidencia. Ahora solo se piden las fotos que todavía no están en
  // `fotoUrls`, y las que ya se cargaron se conservan tal cual.
  const fotoUrlsRef = useRef({});
  useEffect(() => {
    fotoUrlsRef.current = fotoUrls;
  }, [fotoUrls]);

  useEffect(() => {
    if (!todasLasFotos.length) return;
    const idsActuales = new Set(todasLasFotos.map((f) => f.uuid));
    const pendientes = todasLasFotos.filter((f) => !fotoUrlsRef.current[f.uuid]);

    // Suelta los blobs de fotos que ya no están en la prueba (ej. se
    // eliminó una) — evita que `fotoUrls` crezca para siempre con URLs de
    // objetos huérfanos.
    setFotoUrls((prev) => {
      const aEliminar = Object.keys(prev).filter((uuid) => !idsActuales.has(uuid));
      if (!aEliminar.length) return prev;
      const next = { ...prev };
      aEliminar.forEach((uuid) => {
        URL.revokeObjectURL(next[uuid]);
        delete next[uuid];
      });
      return next;
    });
    setFotoErrores((prev) => {
      const next = {};
      idsActuales.forEach((uuid) => {
        if (prev[uuid]) next[uuid] = true;
      });
      return next;
    });

    if (!pendientes.length) return;

    let cancelado = false;
    Promise.all(
      pendientes.map((foto) =>
        apiFetchBlob(`/inventarios/mezclas/fotos/${foto.uuid}/archivo`)
          .then((blob) => ({ uuid: foto.uuid, url: URL.createObjectURL(blob), error: false }))
          .catch(() => ({ uuid: foto.uuid, url: null, error: true })),
      ),
    ).then((resultados) => {
      if (cancelado) return;
      setFotoUrls((prev) => {
        const next = { ...prev };
        resultados.forEach((r) => {
          if (r.url) next[r.uuid] = r.url;
        });
        return next;
      });
      const fallidas = resultados.filter((r) => r.error);
      if (fallidas.length) {
        setFotoErrores((prev) => {
          const next = { ...prev };
          fallidas.forEach((r) => {
            next[r.uuid] = true;
          });
          return next;
        });
      }
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todasLasFotos.map((f) => f.uuid).join(",")]);

  // Al desmontar la pantalla, sí hay que soltar todos los blobs cargados.
  useEffect(
    () => () => {
      Object.values(fotoUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

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

  // Sugiere cuánto de este insumo corresponde a 1 litro de mezcla, según su
  // dosis por hectárea registrada, asumiendo el rendimiento por defecto de
  // una mezcla (6 galones/ha, convertidos a Litros — mismo valor que usa
  // mezcla.service.js#DOSIS_POR_HECTAREA_DEFAULT_GALONES al aprobar). Es solo
  // una sugerencia en `unidadDestinoUuid` (la que ya se autoselecciona al
  // elegir el insumo) — si falta cualquier dato para calcularla (el insumo no
  // tiene dosis configurada, o no hay conversión posible), devuelve null y no
  // se sugiere nada (el operador sigue pudiendo escribir la cantidad a mano).
  function sugerirCantidadPorDosis(articuloUuid, unidadDestinoUuid) {
    const articulo = articulos.find((a) => a.uuid === articuloUuid);
    const dosis = articulo?.dosisPorHectarea;
    const dosisUnidadUuid = articulo?.dosisUnidad?.uuid;
    if (dosis == null || !dosisUnidadUuid || !unidadDestinoUuid) return null;

    const galon = unidades.find((u) => u.nombre === "Galón");
    const litro = unidades.find((u) => u.nombre === "Litro");
    if (!galon || !litro) return null;

    const litrosPorHectarea = convertirCantidad(grafoUnidades, galon.uuid, litro.uuid, 6);
    if (!litrosPorHectarea) return null;

    const dosisEnUnidadDestino = convertirCantidad(grafoUnidades, dosisUnidadUuid, unidadDestinoUuid, Number(dosis));
    if (dosisEnUnidadDestino == null) return null;

    const cantidad = dosisEnUnidadDestino / litrosPorHectarea;
    return Number.isFinite(cantidad) && cantidad > 0 ? Math.round(cantidad * 100) / 100 : null;
  }

  // La receta se calcula siempre en dosis llevada a 1 litro de mezcla
  // (asumiendo el rendimiento de 6 galones de mezcla por hectárea, igual
  // criterio que `sugerirCantidadPorDosis`) — pedido explícito: "el agua
  // siempre debe ser el restante de contenido para completar el litro". Se
  // suman TODOS los insumos que NO sean Agua, convertidos a litros, y el
  // Agua completa lo que falta para llegar a 1 litro. Si algún insumo no
  // se puede convertir a litros (unidad incompatible), no se puede
  // calcular: devuelve null y el Agua se deja tal cual está (no se fuerza
  // a 0 con un dato posiblemente incorrecto).
  // `rows`: por defecto usa el estado actual (para el cálculo que se
  // muestra en pantalla), pero acepta una lista explícita — la necesita
  // `sincronizarAgua` justo después de un `load()`, cuando el estado de
  // React todavía no refleja lo recién guardado dentro del mismo closure.
  function litrosRestantesParaAgua(rows = componentesForm) {
    const litro = unidades.find((u) => u.nombre === "Litro");
    if (!litro) return null;
    let suma = 0;
    for (const c of rows) {
      const articuloC = articulos.find((a) => a.uuid === c.articuloUuid);
      if (articuloC?.nombre === "Agua") continue;
      const cantidad = Number(c.cantidad);
      if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
      const enLitros = convertirCantidad(grafoUnidades, c.unidadUuid, litro.uuid, cantidad);
      if (enLitros == null) return null;
      suma += enLitros;
    }
    return Math.max(0, 1 - suma);
  }

  // Recalcula y guarda el Agua a partir de una lista de componentes YA
  // confirmada por el servidor — nunca se dispara por cada tecla (ese fue
  // un bug real: un useEffect reactivo a `componentesForm` completo
  // guardaba — y su `load()` interno ponía `loading=true`, tapando toda
  // la pantalla con el spinner — en CADA tecla que se escribía en
  // cualquier campo). Se llama solo después de un cambio realmente
  // confirmado: blur de cantidad/unidad de OTRO insumo, o agregar uno
  // nuevo.
  async function sincronizarAgua(rows) {
    const idxAgua = rows.findIndex((c) => articulos.find((a) => a.uuid === c.articuloUuid)?.nombre === "Agua");
    if (idxAgua === -1) return;
    const agua = rows[idxAgua];
    if (!agua.uuid) return;
    const litro = unidades.find((u) => u.nombre === "Litro");
    if (!litro) return;
    const litrosRestantes = litrosRestantesParaAgua(rows);
    // Sin restante (los demás insumos ya suman 1 litro o más) la receta no está
    // llevada a 1 litro: no se toca el Agua (se pondría en 0) — para eso está
    // "Llevar a 1 litro".
    if (litrosRestantes == null || litrosRestantes <= 0) return;
    const unidadAguaUuid = agua.unidadUuid || litro.uuid;
    const cantidadEnUnidadAgua = convertirCantidad(grafoUnidades, litro.uuid, unidadAguaUuid, litrosRestantes);
    if (cantidadEnUnidadAgua == null) return;
    const nuevaCantidad = Math.round(cantidadEnUnidadAgua * 100) / 100;
    const actual = Number(agua.cantidad);
    if (Number.isFinite(actual) && Math.abs(actual - nuevaCantidad) < 0.005) return;
    try {
      await apiFetch(`/inventarios/mezclas/${uuid}/versiones/${version.uuid}/componentes/${agua.uuid}`, {
        method: "PATCH",
        body: JSON.stringify({ cantidad: nuevaCantidad, unidadUuid: unidadAguaUuid || null }),
      });
      await load();
    } catch (err) {
      setComponentesError(err.message);
    }
  }

  // Cuánto de este insumo hay realmente en la receta, llevado a dosis por
  // hectárea (la cantidad de la fila, expresada en 1 litro de mezcla,
  // multiplicada por los litros de 6 galones/ha) — para comparar contra la
  // dosis de referencia registrada en el artículo (pedido explícito: "debe
  // ser exacta"). Devuelve null si el insumo no tiene dosis configurada o
  // si no hay conversión posible entre unidades.
  // Compara la CANTIDAD de la fila contra la cantidad exacta que le
  // correspondería según la dosis por hectárea de referencia — pedido
  // explícito: "esta debe ser exacta", así que la comparación es a 2
  // decimales, sin margen de tolerancia por porcentaje (un margen de 1%
  // dejaba pasar como "Exacta" diferencias reales, ej. 8.87 ml cargados
  // contra 8.81 ml exactos — bug reportado). Misma fórmula que
  // `sugerirCantidadPorDosis`, solo que acá se compara en vez de solo
  // sugerir.
  function evaluarDosisPorHectarea(articulo, cantidad, unidadUuid) {
    const dosis = articulo?.dosisPorHectarea;
    const dosisUnidadUuid = articulo?.dosisUnidad?.uuid;
    if (dosis == null || !dosisUnidadUuid || !unidadUuid) return null;

    const galon = unidades.find((u) => u.nombre === "Galón");
    const litro = unidades.find((u) => u.nombre === "Litro");
    if (!galon || !litro) return null;

    const litrosPorHectarea = convertirCantidad(grafoUnidades, galon.uuid, litro.uuid, 6);
    if (!litrosPorHectarea) return null;

    const dosisEnUnidadDestino = convertirCantidad(grafoUnidades, dosisUnidadUuid, unidadUuid, Number(dosis));
    if (dosisEnUnidadDestino == null) return null;

    const cantidadEsperada = Math.round((dosisEnUnidadDestino / litrosPorHectarea) * 100) / 100;
    const cantidadActual = Math.round(Number(cantidad) * 100) / 100;

    let estado = "EXACTA";
    if (cantidadActual > cantidadEsperada) estado = "POR_ENCIMA";
    else if (cantidadActual < cantidadEsperada) estado = "POR_DEBAJO";

    return { cantidadEsperada, unidadSimbolo: unidades.find((u) => u.uuid === unidadUuid)?.simbolo || "", estado };
  }

  // Badge de "Receta actual" — compara la dosis real de la fila (la
  // cantidad ya cargada, llevada a por-hectárea) contra la dosis de
  // referencia del artículo. `evaluacion` es lo que devuelve
  // `evaluarDosisPorHectarea` (o null si no hay dosis configurada o no se
  // puede convertir entre unidades).
  function renderEstadoDosisBadge(evaluacion) {
    if (!evaluacion) return <span className="text-secondary small">—</span>;
    const { cantidadEsperada, unidadSimbolo, estado } = evaluacion;
    const config = {
      EXACTA: { texto: "Exacta", bg: "#d1fae5", color: "#047857" },
      POR_DEBAJO: { texto: "Por debajo", bg: "#fef3c7", color: "#b45309" },
      POR_ENCIMA: { texto: "Por encima", bg: "#fee2e2", color: "#b91c1c" },
    }[estado];
    return (
      <span
        className="badge rounded-pill small"
        style={{ backgroundColor: config.bg, color: config.color }}
        title={`La cantidad exacta según la dosis por hectárea sería ${cantidadEsperada.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unidadSimbolo}`}
      >
        {config.texto}
      </span>
    );
  }

  // El artículo de una fila ya guardada no se edita (es de solo lectura en
  // "Receta actual") — esta función solo recibe field="cantidad" o
  // "unidadUuid".
  function computeNextComponentes(rows, idx, field, value) {
    const next = [...rows];
    next[idx] = { ...next[idx], [field]: value };
    return next;
  }

  function updateComponente(idx, field, value) {
    setComponentesForm((rows) => computeNextComponentes(rows, idx, field, value));
  }

  // Guarda ediciones a insumos YA agregados a la receta (cantidad/unidad) —
  // agregar un insumo NUEVO ya no pasa por acá: se hace desde "Agregar
  // insumo" (ver handleAgregarInsumo), separado de su medición (ver
  // handleRegistrarMedicion). Un insumo guardado tampoco se puede eliminar
  // de la receta (pedido explícito: evita perder trazabilidad si una etapa
  // ya lo referencia).
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
      const recargados = await load();
      // Si lo que se acaba de guardar NO es el Agua, puede haber quedado
      // desactualizada (tiene que completar 1 litro) — se sincroniza acá,
      // con los datos YA confirmados por el servidor.
      const articuloFila = articulos.find((a) => a.uuid === fila.articuloUuid);
      if (recargados && articuloFila?.nombre !== "Agua") {
        await sincronizarAgua(recargados);
      }
    } catch (err) {
      setComponentesError(err.message);
    } finally {
      setSavingComponentes(false);
    }
  }

  // Radio de selección única: marca este insumo como "principal" —
  // desmarca cualquier otro automáticamente (lo resuelve el backend, ver
  // mezcla.service.js#marcarComponentePrincipal).
  async function handleMarcarPrincipal(componenteUuid) {
    setComponentesError("");
    setSavingComponentes(true);
    try {
      await apiFetch(`/inventarios/mezclas/${uuid}/versiones/${version.uuid}/componentes/${componenteUuid}/principal`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await load();
    } catch (err) {
      setComponentesError(err.message);
    } finally {
      setSavingComponentes(false);
    }
  }

  // ─── Etapas ───

  // Sube fotos a una etapa recién creada — extraída porque ahora la usan
  // tanto la corrección de pH como el registro de medición de un insumo.
  async function subirFotosDeEtapaNueva(versionActualizada, fotos) {
    if (!fotos.length) return;
    const nuevaEtapa = (versionActualizada.etapas || []).reduce(
      (max, e) => (!max || e.numero > max.numero ? e : max),
      null,
    );
    if (!nuevaEtapa) return;
    const formData = new FormData();
    formData.append("etapaUuid", nuevaEtapa.uuid);
    fotos.forEach(({ file }) => formData.append("fotos", file));
    await apiFetchFormData(`/inventarios/mezclas/${uuid}/versiones/${version.uuid}/fotos`, formData);
  }

  // "Corrección de pH": sigue siendo un solo paso (mide Y corrige a la
  // vez) — no agrega nada a la receta, usa el ACONDICIONADOR fijo (ver
  // mezcla.service.js#agregarEtapa).
  async function handleCorregirPh(e) {
    e.preventDefault();
    setEtapaError("");
    if (etapaForm.ph === "" || etapaForm.ce === "") {
      setEtapaError("Ingresa pH y CE medidos.");
      return;
    }
    // El select de Unidad muestra un valor sugerido (unidadMasPequenaPara)
    // aunque el operador nunca lo haya tocado — hay que resolver ACÁ el
    // mismo fallback, si no `etapaForm.unidadUuid` queda vacío en el
    // estado aunque el select ya se vea con "g" elegido (bug real: el
    // submit rechazaba con "Ingresa la cantidad y la unidad..." aunque se
    // viera una unidad seleccionada).
    const unidadCorreccionUuid = etapaForm.unidadUuid || unidadMasPequenaPara(reguladorPhUuid);
    if (!etapaForm.cantidad || !unidadCorreccionUuid) {
      setEtapaError("Ingresa la cantidad y la unidad usadas para corregir el pH.");
      return;
    }
    if (etapaFotos.length === 0) {
      setEtapaError("Adjunta una foto de evidencia antes de registrar la etapa.");
      return;
    }
    setSavingEtapa(true);
    try {
      const versionActualizada = await apiFetch(
        `/inventarios/mezclas/${uuid}/versiones/${version.uuid}/etapas`,
        {
          method: "POST",
          body: JSON.stringify({
            // El artículo NO se manda: el backend siempre usa/crea
            // "ACONDICIONADOR" (ver mezcla.service.js#agregarEtapa).
            tipoEtapa: "CORRECCION_PH",
            cantidadCorreccion: Number(etapaForm.cantidad),
            unidadCorreccionUuid,
            ph: Number(etapaForm.ph),
            ce: Number(etapaForm.ce),
            observaciones: etapaForm.observaciones || null,
          }),
        },
      );

      // La etapa YA quedó creada en el servidor en este punto — si la
      // subida de la foto falla de acá en adelante, igual hay que
      // refrescar y limpiar el formulario.
      try {
        await subirFotosDeEtapaNueva(versionActualizada, etapaFotos);
      } catch (errFoto) {
        setEtapaError(`La etapa se registró, pero falló la subida de la evidencia: ${errFoto.message}`);
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

  // Paso 1: solo agrega el insumo a la receta (componentes) — pedido
  // explícito de separarlo de la medición. Cantidad/unidad se calculan
  // solas (sugeridas por dosis, ver sugerirCantidadPorDosis) y quedan
  // editables después en "Insumos pendientes de medir"/"Receta actual"
  // (mismo `updateComponenteYGuardar` que ya usa esa tabla). INSERT
  // puntual (no reemplaza toda la lista): así el componenteId que las
  // etapas anteriores ya tenían guardado sigue apuntando a la misma fila
  // (bug real reportado: con el PUT que reemplazaba toda la lista, la
  // primera etapa quedaba mostrando "—" apenas se agregaba un segundo
  // insumo).
  async function handleAgregarInsumo() {
    if (!insumoSeleccionadoUuid) return;
    setEtapaError("");
    setAgregandoInsumo(true);
    try {
      const unidadUuid = unidadMasPequenaPara(insumoSeleccionadoUuid);
      const cantidad = sugerirCantidadPorDosis(insumoSeleccionadoUuid, unidadUuid) ?? 1;
      await apiFetch(`/inventarios/mezclas/${uuid}/versiones/${version.uuid}/componentes/agregar`, {
        method: "POST",
        body: JSON.stringify({ articuloUuid: insumoSeleccionadoUuid, cantidad, unidadUuid: unidadUuid || null }),
      });
      setInsumoSeleccionadoUuid("");
      const recargados = await load();
      const articuloAgregado = articulos.find((a) => a.uuid === insumoSeleccionadoUuid);
      if (recargados && articuloAgregado?.nombre !== "Agua") {
        await sincronizarAgua(recargados);
      }
    } catch (err) {
      setEtapaError(err.message);
    } finally {
      setAgregandoInsumo(false);
    }
  }

  // Mueve `origenUuid` a la posición de `destinoUuid` entre los insumos
  // pendientes de medir y guarda el nuevo orden. El principal siempre va
  // primero (no se arrastra ni se puede pasar por encima).
  async function handleReordenarPendientes(origenUuid, destinoUuid) {
    if (!origenUuid || !destinoUuid || origenUuid === destinoUuid) return;
    const uuids = pendientesDeMedir.map((c) => c.uuid);
    const desde = uuids.indexOf(origenUuid);
    const hasta = uuids.indexOf(destinoUuid);
    if (desde === -1 || hasta === -1) return;
    uuids.splice(hasta, 0, uuids.splice(desde, 1)[0]);
    setEtapaError("");
    try {
      await apiFetch(`/inventarios/mezclas/${uuid}/versiones/${version.uuid}/componentes/orden`, {
        method: "PUT",
        body: JSON.stringify({ componenteUuids: uuids }),
      });
      await load();
    } catch (err) {
      setEtapaError(err.message);
    }
  }

  // Paso 2: registra la medición de pH/CE de un insumo YA agregado a la
  // receta (fila de "Insumos pendientes de medir") — mismas validaciones
  // que antes tenía el formulario combinado.
  async function handleRegistrarMedicion(componenteUuid) {
    const medicion = medicionDe(componenteUuid);
    setEtapaError("");
    if (medicion.ph === "" || medicion.ce === "") {
      setEtapaError("Ingresa pH y CE medidos.");
      return;
    }
    if (medicion.fotos.length === 0) {
      setEtapaError("Adjunta una foto de evidencia antes de registrar la medición.");
      return;
    }
    setRegistrandoMedicionUuid(componenteUuid);
    try {
      const versionActualizada = await apiFetch(
        `/inventarios/mezclas/${uuid}/versiones/${version.uuid}/etapas`,
        {
          method: "POST",
          body: JSON.stringify({
            componenteUuid,
            ph: Number(medicion.ph),
            ce: Number(medicion.ce),
            observaciones: medicion.observaciones || null,
          }),
        },
      );

      try {
        await subirFotosDeEtapaNueva(versionActualizada, medicion.fotos);
      } catch (errFoto) {
        setEtapaError(`La medición se registró, pero falló la subida de la evidencia: ${errFoto.message}`);
      }

      medicion.fotos.forEach(({ previewUrl }) => URL.revokeObjectURL(previewUrl));
      setMedicionesForm((prev) => {
        const next = { ...prev };
        delete next[componenteUuid];
        return next;
      });
      await load();
    } catch (err) {
      setEtapaError(err.message);
    } finally {
      setRegistrandoMedicionUuid(null);
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

  // Mismo patrón que handleSelectEtapaFiles/limpiarEtapaFotos de arriba,
  // pero por fila de medición (varias filas pendientes pueden tener cada
  // una su propia foto en curso a la vez).
  async function handleSelectMedicionFiles(componenteUuid, e) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const selladas = await sellarFotos(files, { usuario: usuarioSello });
    const nuevas = selladas.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    updateMedicion(componenteUuid, { fotos: [...medicionDe(componenteUuid).fotos, ...nuevas] });
  }

  function limpiarFotosMedicion(componenteUuid) {
    medicionDe(componenteUuid).fotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    updateMedicion(componenteUuid, { fotos: [] });
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
    // Cantidad por defecto: la suma real de las cantidades de "Receta
    // actual" (todas convertidas a Litros), no un "1" fijo — pedido
    // explícito. En teoría siempre da ~1 (la receta se calcula sobre 1
    // litro y el Agua completa el resto), pero así refleja el total real
    // en vez de asumirlo, por si hay algún insumo con unidad sin
    // conversión a litros o alguna diferencia de redondeo.
    let cantidadSugerida = "1";
    if (unidadLitro) {
      let suma = 0;
      let convertible = true;
      for (const c of componentesForm) {
        const cantidad = Number(c.cantidad);
        if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
        const enLitros = convertirCantidad(grafoUnidades, c.unidadUuid, unidadLitro.uuid, cantidad);
        if (enLitros == null) {
          convertible = false;
          break;
        }
        suma += enLitros;
      }
      if (convertible && suma > 0) {
        cantidadSugerida = String(Math.round(suma * 100) / 100);
      }
    }
    setElaboradoForm({
      cantidadElaborada: cantidadSugerida,
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

  // Fusiona "Crear elaborado" + "Aprobar" en una sola acción (pedido
  // explícito: antes eran dos botones/pasos separados). Al confirmar este
  // modal se llama primero a crear-elaborado y, si sale bien, de inmediato
  // a aprobar — ambos ya eran endpoints separados por diseño (el elaborado
  // puede quedar creado-pero-inactivo mientras espera aprobación) así que
  // acá solo se encadenan, sin tocar esa lógica de negocio. Si el segundo
  // paso falla (ej. el usuario logueado no tiene un rol autorizado para
  // aprobar), el elaborado igual queda creado y la prueba visible en
  // PENDIENTE_APROBACION con el botón "Aprobar prueba" como reintento para
  // que otro usuario autorizado la retome sin tener que rehacer el
  // formulario.
  async function handleCrearYAprobar(e) {
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

      const resultadoAprobar = await apiFetch(`/inventarios/mezclas/${uuid}/versiones/${version.uuid}/aprobar`, { method: "POST" });
      if (resultadoAprobar?.requiereConfirmacion) {
        const detalleAprobar = resultadoAprobar.advertencias.map((a) => a.mensaje).join("\n\n");
        const confirmarNegativoAprobar = confirm(
          `${detalleAprobar}\n\n¿Aprobar de todas formas? El inventario quedará en negativo para el/los artículo(s) listados.`,
        );
        if (confirmarNegativoAprobar) {
          await apiFetch(`/inventarios/mezclas/${uuid}/versiones/${version.uuid}/aprobar`, {
            method: "POST",
            body: JSON.stringify({ forzarSaldoNegativo: true }),
          });
        }
      }

      setElaboradoModalOpen(false);
      await load();
    } catch (err) {
      // El elaborado puede haber quedado creado igual (si el error vino del
      // paso de aprobar) — se refresca para reflejar el estado real: la
      // prueba queda en PENDIENTE_APROBACION con su botón de reintento.
      setElaboradoError(err.message);
      await load();
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

        {/* ─── Agregar insumo ───
            Sin toggle de modo (pedido explícito: se quitaron los botones
            "Agregar insumo"/"Corrección de pH"). Acá solo se elige el
            insumo y se agrega a la receta — cantidad/unidad se calculan
            solas (ver sugerirCantidadPorDosis) y quedan editables después
            en "Mediciones" y en "Receta actual". La corrección de pH ya no
            es un modo que se elige a mano: aparece sola, como una opción
            puntual, justo cuando la última medición (típicamente la del
            Agua) no dio el pH correcto (ver más abajo). */}
        <div className="card border-0 rounded-4 mb-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="px-3 py-1" style={{ backgroundColor: "#166534" }}>
            <h2 className="h6 fw-bold mb-0 text-white text-uppercase" style={{ fontSize: "0.8rem", letterSpacing: "0.03em" }}>
              Agregar insumo
            </h2>
          </div>
          <div className="p-3">
            {editable && puedeCrear && (
              <div>
                <div className="d-flex flex-wrap align-items-end gap-2">
                  <div className="flex-grow-1" style={{ minWidth: "14rem" }}>
                    <select
                      className="form-select form-select-sm rounded-3"
                      value={insumoSeleccionadoUuid}
                      disabled={homogeneidadFalla || bloqueadoPorNoCumple}
                      onChange={(e) => setInsumoSeleccionadoUuid(e.target.value)}
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
                  <button
                    type="button"
                    className="btn btn-brand btn-sm rounded-3 d-inline-flex align-items-center gap-2"
                    disabled={homogeneidadFalla || bloqueadoPorNoCumple || !insumoSeleccionadoUuid || agregandoInsumo}
                    title={
                      homogeneidadFalla
                        ? "La mezcla no dio homogénea — hay que finalizar la prueba"
                        : bloqueadoPorNoCumple
                          ? "La última medición no cumple — corrige el pH o finaliza la prueba"
                          : undefined
                    }
                    onClick={handleAgregarInsumo}
                  >
                    {agregandoInsumo ? <span className="spinner-border spinner-border-sm" /> : <FiPlus size={16} />}
                    Agregar
                  </button>
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
                      La última medición no dio el pH correcto — corrígelo con ACONDICIONADOR acá abajo.
                    </p>
                  )
                )}

                {/* Opción puntual: solo aparece cuando la última medición
                    falló específicamente por pH (no por CE) — no es un modo
                    que se elige a mano, se ofrece sola cuando hace falta. */}
                {bloqueadoPorNoCumple && !ceSinCorregir && !homogeneidadFalla && (
                  <form onSubmit={handleCorregirPh} className="d-flex flex-wrap flex-md-nowrap align-items-end gap-2 pt-3 mt-2 border-top">
                    <div style={{ minWidth: "8rem" }} className="flex-shrink-0">
                      <label className="form-label small mb-1">Corregir con</label>
                      {/* Fijo: la corrección de pH siempre usa "Regulador
                          de pH" — el backend lo resuelve/crea solo (ver
                          mezcla.service.js#agregarEtapa), no se elige acá. */}
                      <input type="text" disabled className="form-control form-control-sm rounded-3" value="ACONDICIONADOR" />
                    </div>
                    <div style={{ width: "6rem" }} className="flex-shrink-0">
                      <label className="form-label small mb-1" title="Solo para sugerir la cantidad — no se guarda">
                        Litros de agua
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        className="form-control form-control-sm rounded-3"
                        value={etapaForm.litrosAgua}
                        onChange={(e) => {
                          const litrosAgua = e.target.value;
                          const dosis = Number(parametros?.reguladorPhDosisGL ?? 0.8);
                          const litros = Number(litrosAgua);
                          setEtapaForm((f) => ({
                            ...f,
                            litrosAgua,
                            // Solo sugiere — el operador puede corregir la
                            // cantidad a mano después de esto.
                            cantidad: Number.isFinite(litros) && litros > 0 ? String(Math.round(dosis * litros * 100) / 100) : f.cantidad,
                          }));
                        }}
                      />
                    </div>
                    <div style={{ width: "7rem" }} className="flex-shrink-0">
                      <label className="form-label small mb-1">Unidad</label>
                      <select
                        className="form-select form-select-sm rounded-3"
                        required
                        value={etapaForm.unidadUuid || unidadMasPequenaPara(reguladorPhUuid)}
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
                      title={etapaFotos.length === 0 ? "Adjunta una foto antes de registrar" : "Registrar corrección"}
                    >
                      {savingEtapa ? <span className="spinner-border spinner-border-sm" /> : <FiSend size={16} />}
                    </button>
                  </form>
                )}
                {etapaError && <div className="alert alert-danger py-2 small mt-2">{etapaError}</div>}
              </div>
            )}
          </div>
        </div>

        {/* ─── Mediciones ───
            Una sola tabla (pedido explícito: fusionar el historial de
            etapas con las filas de insumos pendientes de medir): primero
            las etapas ya registradas, después una fila editable por cada
            insumo agregado que todavía no tiene medición. Solo la PRIMERA
            fila pendiente está habilitada (pedido explícito: "hasta no
            completar el primero, no habilitar el segundo") — las demás se
            desbloquean en orden, una vez registrada la anterior.
            "Pendiente" se deriva de la receta + las etapas ya registradas
            (no es estado local efímero): sobrevive a recargar la página. */}
        <div className="card border-0 rounded-4 mb-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="px-3 py-1" style={{ backgroundColor: "#166534" }}>
            <h2 className="h6 fw-bold mb-0 text-white text-uppercase" style={{ fontSize: "0.8rem", letterSpacing: "0.03em" }}>
              Mediciones
            </h2>
          </div>
          <div className="p-3">
            {editable && puedeCrear && pendientesDeMedir.length > 0 && (homogeneidadFalla || ceSinCorregir) && (
              <p className="small mb-2" style={{ color: "#b91c1c" }}>
                {homogeneidadFalla
                  ? "La mezcla no dio homogénea — finaliza la prueba en vez de seguir midiendo."
                  : "La CE no cumple y no se puede corregir — finaliza la prueba."}
              </p>
            )}
            {etapaError && <div className="alert alert-danger py-2 small mb-3">{etapaError}</div>}

            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0" style={{ minWidth: "52rem" }}>
                <thead>
                  <tr className="small" style={{ backgroundColor: "#f0fdf4" }}>
                    <th className="text-center" style={{ color: "#166534", width: "2rem" }}>#</th>
                    <th style={{ color: "#166534", minWidth: "8rem" }}>Insumo</th>
                    <th className="text-center" style={{ color: "#166534", width: "5rem", whiteSpace: "nowrap" }}>Dosis/ha.</th>
                    <th className="text-center" style={{ color: "#166534", width: "4.5rem" }}>Unidad</th>
                    <th className="text-center" style={{ color: "#166534", width: "5rem" }}>Cantidad</th>
                    <th className="text-center" style={{ color: "#166534", width: "3.5rem" }}>pH</th>
                    <th className="text-center" style={{ color: "#166534", width: "3.5rem" }}>CE</th>
                    <th className="text-center" style={{ color: "#166534", width: "5.5rem" }}>Resultado</th>
                    <th className="text-center" style={{ color: "#166534", width: "6.5rem", whiteSpace: "nowrap" }}>Fecha</th>
                    <th style={{ color: "#166534", minWidth: "7rem" }}>Observaciones</th>
                    <th className="text-center" style={{ color: "#166534", width: "3.5rem" }}>Evidencia</th>
                    {editable && puedeCrear && <th className="text-center" style={{ width: "2.75rem", backgroundColor: "#f0fdf4" }}>Acción</th>}
                  </tr>
                </thead>
                <tbody>
                  {(version.etapas || []).length === 0 && pendientesDeMedir.length === 0 && (
                    <tr>
                      <td colSpan={editable && puedeCrear ? 12 : 11} className="text-center text-secondary small py-2">
                        Sin etapas registradas todavía.
                      </td>
                    </tr>
                  )}
                  {(version.etapas || []).map((et) => {
                    const esCorreccion = et.tipoEtapa === "CORRECCION_PH";
                    const articuloEtapa = !esCorreccion
                      ? articulos.find((a) => a.uuid === et.componente?.articulo?.uuid)
                      : null;
                    const dosisEtapa = articuloEtapa?.dosisPorHectarea;
                    const dosisSimboloEtapa = articuloEtapa?.dosisUnidad?.simbolo || "";
                    return (
                      <tr key={et.uuid}>
                        <td className="small text-center">{et.numero}</td>
                        <td className="small">
                          {esCorreccion ? (
                            <span
                              className="badge rounded-pill small"
                              style={{ backgroundColor: "#fef3c7", color: "#b45309" }}
                            >
                              Corrección pH
                            </span>
                          ) : (
                            et.componente?.articulo?.nombre || "—"
                          )}
                        </td>
                        <td className="small text-secondary text-center">
                          {!esCorreccion && dosisEtapa != null ? `${Number(dosisEtapa)} ${dosisSimboloEtapa}/ha` : "—"}
                        </td>
                        <td className="small text-secondary text-center">
                          {esCorreccion ? et.unidadCorreccion?.simbolo || "—" : et.componente?.unidad?.simbolo || "—"}
                        </td>
                        <td className="small text-center">
                          {esCorreccion
                            ? et.cantidadCorreccion != null
                              ? Number(et.cantidadCorreccion).toLocaleString("es-CO", { maximumFractionDigits: 2 })
                              : "—"
                            : et.componente?.cantidad != null
                              ? Number(et.componente.cantidad).toLocaleString("es-CO", { maximumFractionDigits: 2 })
                              : "—"}
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
                    );
                  })}
                  {editable && puedeCrear && !homogeneidadFalla && !ceSinCorregir && pendientesDeMedir.map((c, idx) => {
                    // Solo la primera fila pendiente está activa — el resto
                    // queda deshabilitado hasta que le toque el turno
                    // (pedido explícito).
                    const activo = idx === 0;
                    // Se puede arrastrar mientras no se haya medido (aquí solo
                    // hay pendientes) y salvo el principal, que va primero.
                    const arrastrable = !c.esPrincipal && pendientesDeMedir.length > 1;
                    const idxComponentes = componentesForm.findIndex((cc) => cc.uuid === c.uuid);
                    const articuloFila = articulos.find((a) => a.uuid === c.articuloUuid);
                    const dosis = articuloFila?.dosisPorHectarea;
                    const dosisSimbolo = articuloFila?.dosisUnidad?.simbolo || "";
                    const unidadesFila = unidadesCompatiblesPara(c.articuloUuid);
                    const medicion = medicionDe(c.uuid);
                    const registrando = registrandoMedicionUuid === c.uuid;
                    return (
                      <tr
                        key={c.uuid}
                        className={!activo ? "opacity-50" : undefined}
                        draggable={arrastrable}
                        onDragStart={(e) => {
                          if (!arrastrable) return;
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", c.uuid);
                          setArrastrandoUuid(c.uuid);
                        }}
                        onDragOver={(e) => {
                          if (!arrastrandoUuid || c.esPrincipal || c.uuid === arrastrandoUuid) return;
                          e.preventDefault();
                          if (sobreUuid !== c.uuid) setSobreUuid(c.uuid);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const origen = arrastrandoUuid;
                          setArrastrandoUuid(null);
                          setSobreUuid(null);
                          if (!c.esPrincipal) handleReordenarPendientes(origen, c.uuid);
                        }}
                        onDragEnd={() => {
                          setArrastrandoUuid(null);
                          setSobreUuid(null);
                        }}
                        style={{
                          cursor: arrastrable ? "grab" : undefined,
                          boxShadow: sobreUuid === c.uuid && arrastrandoUuid ? "inset 0 2px 0 #166534" : undefined,
                          opacity: arrastrandoUuid === c.uuid ? 0.4 : undefined,
                        }}
                      >
                        <td
                          className="small text-center text-secondary"
                          title={arrastrable ? "Arrastra para cambiar el orden — se puede mover hasta que se mida" : "El principal va siempre primero"}
                        >
                          {arrastrable ? <FiMenu size={14} /> : "—"}
                        </td>
                        <td className="small">
                          {articuloFila?.nombre || "—"}
                        </td>
                        <td className="small text-secondary text-center">
                          {dosis != null ? `${Number(dosis)} ${dosisSimbolo}/ha` : "Sin dosis"}
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm rounded-3"
                            value={c.unidadUuid}
                            disabled={!activo}
                            onChange={(e) => updateComponenteYGuardar(idxComponentes, "unidadUuid", e.target.value)}
                          >
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
                            className="form-control form-control-sm rounded-3 text-center"
                            value={c.cantidad}
                            disabled={!activo}
                            onChange={(e) => updateComponente(idxComponentes, "cantidad", e.target.value)}
                            onBlur={(e) => updateComponenteYGuardar(idxComponentes, "cantidad", e.target.value)}
                          />
                        </td>
                        <td style={{ width: "5rem" }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="14"
                            className="form-control form-control-sm rounded-3"
                            value={medicion.ph}
                            disabled={!activo}
                            onChange={(e) => updateMedicion(c.uuid, { ph: e.target.value })}
                          />
                        </td>
                        <td style={{ width: "5rem" }}>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="form-control form-control-sm rounded-3"
                            value={medicion.ce}
                            disabled={!activo}
                            onChange={(e) => updateMedicion(c.uuid, { ce: e.target.value })}
                          />
                        </td>
                        <td className="small text-center">
                          <span className="badge rounded-pill small text-bg-secondary">Pendiente</span>
                        </td>
                        <td className="small text-secondary text-center">—</td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm rounded-3"
                            value={medicion.observaciones}
                            disabled={!activo}
                            onChange={(e) => updateMedicion(c.uuid, { observaciones: e.target.value })}
                          />
                        </td>
                        <td className="text-center">
                          <label
                            className={`btn btn-sm btn-link p-1 d-inline-flex align-items-center gap-1 mb-0 ${!activo ? "disabled" : ""}`}
                            style={{
                              color: medicion.fotos.length ? "#166534" : "#6c757d",
                              pointerEvents: activo ? undefined : "none",
                            }}
                            title={
                              medicion.fotos.length
                                ? `${medicion.fotos.length} evidencia(s) adjunta(s) — clic para quitar`
                                : "Adjuntar evidencia fotográfica (obligatoria)"
                            }
                            onClick={activo && medicion.fotos.length ? (e) => { e.preventDefault(); limpiarFotosMedicion(c.uuid); } : undefined}
                          >
                            <FiCamera size={16} />
                            {medicion.fotos.length > 0 && (
                              <span className="fw-bold" style={{ fontSize: 12, lineHeight: 1 }}>
                                {medicion.fotos.length}
                              </span>
                            )}
                            {!medicion.fotos.length && (
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                disabled={!activo}
                                className="d-none"
                                onChange={(e) => handleSelectMedicionFiles(c.uuid, e)}
                              />
                            )}
                          </label>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-1 d-inline-flex"
                            style={{ color: !activo || registrando || medicion.fotos.length === 0 ? "#adb5bd" : "#166534" }}
                            disabled={!activo || registrando || medicion.fotos.length === 0}
                            title={
                              !activo
                                ? "Completa primero el insumo anterior"
                                : medicion.fotos.length === 0
                                  ? "Adjunta una foto antes de registrar"
                                  : "Registrar medición"
                            }
                            onClick={() => handleRegistrarMedicion(c.uuid)}
                          >
                            {registrando ? <span className="spinner-border spinner-border-sm" /> : <FiSend size={16} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mb-4 d-flex justify-content-end gap-2">
            {version.estadoPrueba === "OPTIMA" && !version.elaboracionGenerada && puedeElaborar && (
              <button type="button" className="btn btn-success rounded-3 d-flex align-items-center gap-2" onClick={openElaboradoModal}>
                <FiCheckCircle /> Aprobar
              </button>
            )}
            {/* PENDIENTE_APROBACION: solo queda visible como reintento — pasa
                por acá si "Aprobar" (arriba) ya creó el elaborado pero el
                segundo paso (aprobar en sí) falló, ej. porque quien lo hizo
                no tiene un rol autorizado para aprobar y hace falta que otro
                usuario retome desde acá. */}
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

        {/* ─── Receta actual ─── */}
        <div className="card border-0 rounded-4 mb-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="px-3 py-1" style={{ backgroundColor: "#166534" }}>
            <h2 className="h6 fw-bold mb-0 text-white text-uppercase" style={{ fontSize: "0.8rem", letterSpacing: "0.03em" }}>
              Receta actual
            </h2>
          </div>
          <div className="p-3">
            <p className="small text-secondary mb-3">
              La receta se calcula en dosis llevada a <strong>1 litro de mezcla</strong>, asumiendo un rendimiento
              de <strong>6 galones de mezcla por hectárea</strong>. El <strong>Agua</strong> siempre completa lo que
              falta para llegar a ese litro — se calcula sola en cuanto cambia algún otro insumo, no se edita a mano.
            </p>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-2">
                <thead>
                  <tr className="small" style={{ backgroundColor: "#f0fdf4" }}>
                    <th className="text-center" style={{ width: "3.5rem", color: "#166534" }}>Principal</th>
                    <th className="text-start" style={{ minWidth: "14rem", color: "#166534" }}>Artículo</th>
                    <th className="text-center" style={{ width: "8rem", color: "#166534" }}>Cantidad</th>
                    <th className="text-center" style={{ minWidth: "8rem", color: "#166534" }}>Unidad</th>
                    <th className="text-center" style={{ minWidth: "7rem", color: "#166534" }}>Dosis por ha.</th>
                    <th className="text-center" style={{ minWidth: "7rem", color: "#166534" }}>Dosis real</th>
                  </tr>
                </thead>
                <tbody>
                  {(editable ? componentesForm : version.componentes || []).map((c, idx) => {
                    if (!editable) {
                      // Conversión a la unidad BASE del artículo (para
                      // consumirStockConReceta) — ya no se muestra en la
                      // tabla (el PDF/reporte no la incluye), pero se sigue
                      // calculando acá por si en el futuro hace falta.
                      const evaluacion = evaluarDosisPorHectarea(c.articulo, c.cantidad, c.unidad?.uuid);
                      return (
                        <tr key={c.uuid || idx}>
                          <td className="text-center">
                            {c.esPrincipal && <FiCheckCircle size={14} style={{ color: "#166534" }} title="Insumo principal" />}
                          </td>
                          <td className="small">{c.articulo?.nombre || "—"}</td>
                          <td className="small text-center">{Number(c.cantidad).toFixed(2)}</td>
                          <td className="small text-center text-secondary">{c.unidad?.simbolo || "—"}</td>
                          <td className="small text-center text-secondary">
                            {c.articulo?.dosisPorHectarea != null
                              ? `${Number(c.articulo.dosisPorHectarea)} ${c.articulo?.dosisUnidad?.simbolo || ""}/ha`
                              : "—"}
                          </td>
                          <td className="text-center">{renderEstadoDosisBadge(evaluacion)}</td>
                        </tr>
                      );
                    }
                    const unidadesFila = unidadesCompatiblesPara(c.articuloUuid);
                    // El artículo de una fila ya guardada no se cambia
                    // (pedido explícito) — solo cantidad/unidad son
                    // editables acá.
                    const articuloFila = articulos.find((a) => a.uuid === c.articuloUuid);
                    // El Agua nunca se edita a mano — ver
                    // `litrosRestantesParaAgua` y el useEffect que la
                    // recalcula sola cada vez que cambia otro insumo.
                    const esAgua = articuloFila?.nombre === "Agua";
                    return (
                      <tr key={idx}>
                        <td className="text-center">
                          {c.uuid && (
                            <input
                              type="radio"
                              className="form-check-input"
                              name="mezcla-componente-principal"
                              checked={c.esPrincipal}
                              onChange={() => handleMarcarPrincipal(c.uuid)}
                              title="Marcar como insumo principal"
                            />
                          )}
                        </td>
                        <td className="small">{articuloFila?.nombre || "—"}</td>
                        <td>
                          {esAgua ? (
                            <input
                              type="text"
                              disabled
                              title="Se calcula sola — completa lo que falta para llegar a 1 litro de mezcla"
                              className="form-control form-control-sm rounded-3 text-center text-secondary"
                              value={Number(c.cantidad).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            />
                          ) : (
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              className="form-control form-control-sm rounded-3 text-center"
                              value={c.cantidad}
                              onChange={(e) => updateComponente(idx, "cantidad", e.target.value)}
                              onBlur={(e) => updateComponenteYGuardar(idx, "cantidad", e.target.value)}
                            />
                          )}
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
                        <td className="small text-center text-secondary">
                          {articuloFila?.dosisPorHectarea != null
                            ? `${Number(articuloFila.dosisPorHectarea)} ${articuloFila?.dosisUnidad?.simbolo || ""}/ha`
                            : "—"}
                        </td>
                        <td className="text-center">
                          {renderEstadoDosisBadge(evaluarDosisPorHectarea(articuloFila, c.cantidad, c.unidadUuid))}
                        </td>
                      </tr>
                    );
                  })}
                  {(editable ? componentesForm : version.componentes || []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-secondary small py-2">
                        Sin insumos agregados todavía — agrégalos desde &quot;Agregar insumo&quot;, arriba.
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
                                    {fotoErrores[foto.uuid] ? (
                                      <FiXCircle className="text-danger" title="No se pudo cargar la foto" />
                                    ) : (
                                      <span className="spinner-border spinner-border-sm text-secondary" role="status" aria-label="Cargando foto" />
                                    )}
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
                      onChange={(e) => {
                        setNombreEditadoManualmente(true);
                        setInfoForm((f) => ({ ...f, nombre: e.target.value }));
                      }}
                    />
                    {nombreEditadoManualmente && nombreSugerido && infoForm.nombre !== nombreSugerido && (
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 mt-1"
                        onClick={() => {
                          setNombreEditadoManualmente(false);
                          setInfoForm((f) => ({ ...f, nombre: nombreSugerido }));
                        }}
                      >
                        usar sugerido: {nombreSugerido}
                      </button>
                    )}
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
          <ModalShell title="Aprobar prueba y crear elaborado" onClose={() => setElaboradoModalOpen(false)} size="xl">
            <form onSubmit={handleCrearYAprobar}>
              <p className="small text-secondary">
                Se usan automáticamente los componentes, cantidades y unidades de esta prueba — no hace falta
                volver a digitarlos. Al confirmar se crea el artículo elaborado y se aprueba la prueba en un
                solo paso: queda activo y disponible para usarse de inmediato.
              </p>

              {mezcla.articuloElaborado ? (
                <div className="alert alert-secondary py-2 small">
                  El artículo elaborado ya fue creado en un intento anterior: <strong>{mezcla.articuloElaborado.nombre}</strong>. Se
                  va a usar ese mismo, no se crea uno nuevo.
                </div>
              ) : (
                <>
                  <p className="small fw-medium mb-2">Artículo elaborado (producto nuevo)</p>
                  {categoriasElaborado.length === 0 && (
                    <div className="alert alert-warning py-2 small">
                      Todavía no existe ninguna categoría de tipo <strong>Elaborado</strong> — hace falta crear
                      al menos una antes de poder aprobar. Usa el enlace &quot;+ Nueva categoría&quot; junto al
                      campo Categoría, acá abajo.
                    </div>
                  )}
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
                      <label className="form-label small fw-medium d-flex align-items-center justify-content-between">
                        <span>
                          Categoría <span className="text-danger">*</span>
                        </span>
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0"
                          onClick={() => {
                            setCategoriaNombre("");
                            setCategoriaError("");
                            setCategoriaModalOpen(true);
                          }}
                        >
                          + Nueva categoría
                        </button>
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
                      {/* Fija en Litro — la receta siempre se calcula sobre
                          1 litro de mezcla (ver "Receta actual"), no tiene
                          sentido elegir otra unidad acá. */}
                      <input type="text" disabled className="form-control rounded-3" value="Litro (L)" />
                    </div>
                    <div className="col-3">
                      <label className="form-label small fw-medium">Cantidad</label>
                      {/* Fija: es la suma real de "Receta actual" (todas las
                          cantidades convertidas a Litros) — no se edita a
                          mano, así siempre coincide con la receta. */}
                      <input
                        type="text"
                        disabled
                        className="form-control rounded-3"
                        value={Number(elaboradoForm.cantidadElaborada).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                <button
                  type="submit"
                  className="btn btn-brand rounded-3"
                  disabled={creandoElaborado || (!mezcla.articuloElaborado && categoriasElaborado.length === 0)}
                >
                  {creandoElaborado ? "Aprobando..." : "Crear elaborado y aprobar"}
                </button>
              </div>
            </form>
          </ModalShell>
        )}

        {categoriaModalOpen && (
          <ModalShell title="Nueva categoría (Elaborado)" onClose={() => setCategoriaModalOpen(false)}>
            <form onSubmit={handleCrearCategoriaRapida}>
              <div className="mb-3">
                <label className="form-label small fw-medium">
                  Nombre <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={100}
                  className="form-control rounded-3"
                  value={categoriaNombre}
                  onChange={(e) => setCategoriaNombre(e.target.value)}
                />
                <div className="form-text small">
                  Se crea directamente con tipo &quot;Elaborado&quot; — queda disponible de inmediato en el
                  campo Categoría de este formulario.
                </div>
              </div>
              {categoriaError && <div className="alert alert-danger py-2 small">{categoriaError}</div>}
              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary rounded-3" onClick={() => setCategoriaModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-brand rounded-3" disabled={guardandoCategoria}>
                  {guardandoCategoria ? "Creando..." : "Crear categoría"}
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
                        className="rounded-3 border d-flex align-items-center justify-content-center text-secondary small flex-column gap-1"
                        style={{ width: "100%", height: "100%" }}
                      >
                        {fotoErrores[foto.uuid] ? (
                          <>
                            <FiXCircle className="text-danger" />
                            <span>Error</span>
                          </>
                        ) : (
                          <>
                            <span className="spinner-border spinner-border-sm text-secondary" role="status" aria-label="Cargando foto" />
                            <span>Cargando…</span>
                          </>
                        )}
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
