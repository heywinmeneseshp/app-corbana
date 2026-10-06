"use client";

import { useEffect, useId, useMemo, useState, useRef } from "react";
import ExcelJS from "exceljs";
import { FiPlus, FiEdit2, FiTrash2, FiX, FiCheck, FiMail, FiDownload, FiUploadCloud, FiEye, FiChevronLeft, FiChevronRight, FiCalendar, FiClock, FiCheckCircle, FiXCircle, FiSettings, FiSend, FiAlertTriangle, FiInfo } from "react-icons/fi";
import { apiFetch, apiFetchFormData, apiUpload } from "@/lib/api";
import { hasPermission, getCurrentUser } from "@/lib/auth";
import { esAdministrador } from "@/lib/laborEstados";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";
import StockInsuficienteModal from "@/components/StockInsuficienteModal";
import TagPicker from "@/components/TagPicker";
import { generarAvisoAspersionPdfBlob, verAvisoAspersionPdf } from "@/lib/aspersionExport";
import { ubicarSemana, formatRangoSemana } from "@/lib/laborCalendarBuilder";
import { descargarExcelProgramador, descargarExcelCalendario, generarExcelCalendarioBlob } from "@/lib/aspersionesExcelExport";
import { construirGrafoUnidades, convertirCantidad } from "@/lib/unidadConversion";

const NOMBRES_DIA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MES_ABREV = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalDate(fechaIso) {
  const [y, m, d] = fechaIso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Une cada aspersión con la finca+día a la que pertenece, para que el grid
// del calendario haga lookups O(1) por celda en vez de filtrar el arreglo
// completo en cada render (mismo espíritu que
// laborCalendarBuilder.js#agruparPorSemanaYLote).
function agruparPorFincaYDia(items) {
  const mapa = new Map();
  for (const it of items) {
    if (!it.finca) continue;
    const key = `${it.finca.uuid}:${it.fecha}`;
    if (!mapa.has(key)) mapa.set(key, []);
    mapa.get(key).push(it);
  }
  return mapa;
}

const TIPO_LABEL = { SIGATOKA_NEGRA: "Sigatoka Negra", DEFOLIADOR: "Defoliador", FERTILIZACION: "Fertilización" };
// Mismos colores de siempre (azul/verde/gris) pero en un tono más saturado
// para que se lean bien tanto en el ícono chico de la tabla como en la
// leyenda — los pastel originales (#1e40af/#166534) quedaban apagados a
// tamaño 11-14px.
const ESTADO_INFO = {
  PROGRAMADA: { label: "Programada", bg: "#dbeafe", color: "#2563eb", Icono: FiClock },
  EJECUTADA: { label: "Ejecutada", bg: "#dcfce7", color: "#16a34a", Icono: FiCheckCircle },
  CANCELADA: { label: "Cancelada", bg: "#f3f4f6", color: "#dc2626", Icono: FiXCircle },
};


function nombreUsuarioActual() {
  const u = getCurrentUser();
  if (!u) return "";
  return `${u.nombre || ""} ${u.apellido || ""}`.trim() || u.usuario || "";
}

function nombreUsuario(u) {
  if (!u) return "";
  return `${u.nombre || ""} ${u.apellido || ""}`.trim() || u.usuario || "";
}

// Buscador dinámico de semana (input + <datalist>) — pedido explícito:
// "de ahora en adelante todos los filtros de semana en este estilo".
// Reemplaza el <select> plano: el usuario escribe y el navegador filtra
// las opciones en vivo; al elegir/escribir un código exacto (ej.
// "S35-2026") se resuelve el uuid y se dispara `onChange`. Mientras el
// texto no matchea ninguna semana completa, no cambia nada (el usuario
// sigue escribiendo).
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

function emptyForm() {
  return {
    fincaUuid: "",
    fecha: "",
    // Array: se puede marcar más de un tipo a la vez (ej. Sigatoka Negra +
    // Defoliador), igual que en el formato en papel.
    tipo: ["SIGATOKA_NEGRA"],
    // Selección única — nunca los dos a la vez (pedido explícito).
    medio: "",
    mezclaUuid: "",
    almacenUuid: "",
    hectareas: "",
    // Volumen por hectárea editable — vacío = usar el configurado en la
    // mezcla. Se limpia al cambiar de mezcla.
    volumenHaManual: "",
    // El "% Aumento" se sugiere solo (ver porcentajeAumentoAutomatico más
    // abajo), pero el operador lo puede subir/bajar a mano para esta
    // aspersión puntual — vacío = usar el sugerido automático. Se limpia
    // al cambiar de mezcla (el sugerido puede cambiar por completo).
    aumentoManual: "",
    // Ajuste manual por insumo puntual — mapa { [articuloUuid]: cantidad
    // string editada }, vacío por defecto (todas nacen en el valor
    // calculado de la receta). Se limpia al cambiar de mezcla.
    componentesAjustados: {},
    // El representante Corbana es quien está programando — se autocompleta
    // con el usuario de la sesión, no se digita a mano (pedido explícito).
    representanteCorbanaNombre: nombreUsuarioActual(),
    administradorFincaUuid: "",
    administradorFincaNombre: "",
    observaciones: "",
  };
}

export default function AspersionesPage() {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [fincas, setFincas] = useState([]);
  const [mezclas, setMezclas] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [semanas, setSemanas] = useState([]);
  // Detalle completo (con componentes) de la mezcla elegida en "Programar
  // aspersión" — la lista de /inventarios/mezclas no trae componentes, hace
  // falta pedir el detalle puntual para mostrar los insumos de la receta.
  const [mezclaDetalle, setMezclaDetalle] = useState(null);
  const [existenciasInsumos, setExistenciasInsumos] = useState({});
  // Texto crudo que el operador está tecleando en "Cantidad necesaria", por
  // articuloUuid — se muestra tal cual mientras escribe, en vez de forzar
  // siempre el valor derivado (.toFixed(2)), que "peleaba" con el usuario y
  // no dejaba borrar dígitos (ver bug reportado: al borrar quedaba igual).
  const [textosCantidadAjustada, setTextosCantidadAjustada] = useState({});
  // Unidad en la que se MUESTRA/EDITA "Cantidad necesaria" por insumo —
  // pedido explícito: por defecto cada insumo respeta su propia unidad de
  // receta (no la unidad global de "Cantidad a preparar"), pero el usuario
  // puede cambiarla por fila. La cantidad NATIVA que realmente se guarda y
  // se descuenta de inventario (necesariaFinalNativa) no cambia por esto.
  const [unidadesPorFila, setUnidadesPorFila] = useState({});
  // Conversiones de unidades — la dosis por hectárea puede estar en una
  // unidad distinta a la de rendimiento de la mezcla (ej. dosis en
  // Galones/ha, rendimiento en Litros); hace falta convertir antes de
  // calcular la cantidad a preparar, igual que hace el backend (ver
  // aspersionProgramacion.service.js#calcularCantidad).
  const [conversiones, setConversiones] = useState([]);
  const grafoUnidades = useMemo(() => construirGrafoUnidades(conversiones), [conversiones]);
  // Unidades de volumen disponibles para mostrar "Cantidad a preparar" —
  // independiente de la unidad de rendimiento de cada mezcla, para que el
  // operador vea siempre la misma unidad que prefiere (ej. Galones), con
  // conversión automática.
  const [unidadesVolumen, setUnidadesVolumen] = useState([]);
  // Solo para resolver "Kilogramo" al recalcular el ACONDICIONADOR (0.8 g
  // por litro de Agua) — ver necesariaFinalNativa más abajo.
  const [unidadesPeso, setUnidadesPeso] = useState([]);
  // Preferencia guardada en ESTE computador (localStorage, no en el
  // servidor) — pedido explícito: "dejarlo guardado en local para que
  // siempre muestre la misma medida a no ser que la cambie".
  const UNIDAD_PREFERIDA_KEY = "corbana_aspersion_unidad_volumen_preferida";
  const [unidadPreferidaUuid, setUnidadPreferidaUuid] = useState("");
  useEffect(() => {
    try {
      const guardada = localStorage.getItem(UNIDAD_PREFERIDA_KEY);
      if (guardada) setUnidadPreferidaUuid(guardada);
    } catch {}
  }, []);
  function cambiarUnidadPreferida(uuid) {
    setUnidadPreferidaUuid(uuid);
    try {
      if (uuid) localStorage.setItem(UNIDAD_PREFERIDA_KEY, uuid);
      else localStorage.removeItem(UNIDAD_PREFERIDA_KEY);
    } catch {}
  }
  const [filtros, setFiltros] = useState({ fincaUuid: "", semanaUuid: "", mezclaUuid: "", estado: "", fecha: "" });

  // "programador" (lista con filtros) o "calendario" (grilla semanal
  // finca × día) — dos vistas del mismo módulo, pedido explícito.
  const [vista, setVista] = useState("programador");
  const [modalDestinatarios, setModalDestinatarios] = useState(false);
  const esAdmin = esAdministrador();
  const [semanaActivaUuid, setSemanaActivaUuid] = useState(null);
  const [calendarioItems, setCalendarioItems] = useState([]);
  const [calendarioLoading, setCalendarioLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  // uuid de la aspersión que se está editando — null = "Programar" (crear).
  const [editingUuid, setEditingUuid] = useState(null);
  const [usuariosFinca, setUsuariosFinca] = useState([]);
  const [cargandoUsuariosFinca, setCargandoUsuariosFinca] = useState(false);
  const [semanaPreview, setSemanaPreview] = useState(null);

  const [enviandoCorreoUuid, setEnviandoCorreoUuid] = useState(null);
  const [enviandoSemana, setEnviandoSemana] = useState(false);
  const [procesandoTexto, setProcesandoTexto] = useState("");

  // Cargue masivo de aspersiones desde Excel/CSV — cada fila indica la
  // mezcla por código o nombre (ver bulkCrear en el backend).
  const inputCargueRef = useRef(null);
  const [cargueModalOpen, setCargueModalOpen] = useState(false);
  const [cargueArchivo, setCargueArchivo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [cargueError, setCargueError] = useState("");
  const [cargueResultado, setCargueResultado] = useState(null);

  // Acepta un `filtrosOverride` opcional para cuando se llama en el mismo
  // evento en que se acaba de resetear el filtro (ej. "Limpiar") — el
  // estado `filtros` todavía no se actualizó en este closure (React no
  // re-renderiza sincrónicamente), así que confiar en el `filtros` de
  // arriba mandaría la query vieja.
  async function load(filtrosOverride) {
    const f = filtrosOverride || filtros;
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ page: String(page), limit: "50" });
      if (f.fincaUuid) qs.set("fincaUuid", f.fincaUuid);
      if (f.semanaUuid) qs.set("semanaUuid", f.semanaUuid);
      if (f.mezclaUuid) qs.set("mezclaUuid", f.mezclaUuid);
      if (f.estado) qs.set("estado", f.estado);
      // "Fecha" es un único filtro (no rango) — se manda como
      // fechaDesde=fechaHasta=el mismo día para que el backend acote
      // exactamente a esa fecha.
      if (f.fecha) {
        qs.set("fechaDesde", f.fecha);
        qs.set("fechaHasta", f.fecha);
      }
      const { items: rows, meta: m } = await apiFetch(`/aspersiones?${qs}`);
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
      const anioActual = new Date().getFullYear();
      const [fincasRes, mezclasRes, almacenesRes, semanasRes, conversionesRes, unidadesVolumenRes, unidadesPesoRes] = await Promise.all([
        apiFetch("/fincas?limit=100&soloOperativas=true"),
        apiFetch("/inventarios/mezclas?limit=100"),
        apiFetch("/inventarios/almacenes?limit=100&estado=true"),
        apiFetch(`/semanas?anio=${anioActual}&limit=100`),
        apiFetch("/inventarios/unidades/conversiones"),
        apiFetch("/inventarios/unidades?tipo=VOLUMEN&estado=true&limit=100"),
        // Solo para resolver "Kilogramo" al recalcular el ACONDICIONADOR
        // (0.8 g por litro de Agua) — el Regulador se mide en unidades de
        // MASA, no de volumen.
        apiFetch("/inventarios/unidades?tipo=MASA&estado=true&limit=100"),
      ]);
      setConversiones(Array.isArray(conversionesRes) ? conversionesRes : conversionesRes.items || []);
      setUnidadesVolumen(unidadesVolumenRes.items || []);
      setUnidadesPeso(unidadesPesoRes.items || []);
      setFincas(fincasRes.items || []);
      // Solo mezclas activas y con dosis por hectárea configurada — sin eso
      // no hay forma de calcular cuánto preparar (ver
      // aspersionProgramacion.service.js#resolveMezclaConDosis).
      setMezclas((mezclasRes.items || []).filter((m) => m.articuloElaborado?.estado && m.dosisPorHectarea != null));
      setAlmacenes(almacenesRes.items || []);
      // El backend las devuelve más reciente primero — se reordenan
      // ascendente para que "anterior/siguiente" en el calendario avancen
      // en el sentido intuitivo del tiempo.
      setSemanas((semanasRes.items || []).slice().sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio)));
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

  // Filtro de Semana por defecto: la ÚLTIMA semana que tiene aspersiones
  // registradas (no la semana actual ni "Todas") — pedido explícito. El
  // backend ya devuelve /aspersiones ordenado por fecha DESC (ver
  // aspersionProgramacion.repository.js), así que la primera fila de un
  // GET sin filtros es la aspersión más reciente — se toma su semana. Se
  // resuelve aparte del `load()` inicial (que corre en paralelo, sin
  // filtro) y luego se re-consulta ya filtrada.
  useEffect(() => {
    let cancelado = false;
    apiFetch("/aspersiones?limit=1")
      .then(({ items: ultimos }) => {
        if (cancelado) return;
        const semanaUuid = ultimos?.[0]?.semana?.uuid;
        if (!semanaUuid) return;
        setFiltros((f) => ({ ...f, semanaUuid }));
        load({ fincaUuid: "", semanaUuid, mezclaUuid: "", estado: "", fecha: "" });
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Semana por defecto del calendario: la que contiene "hoy", entre las ya
  // generadas (Configuración → Semanas) — mismo criterio que el resto del
  // módulo agrícola (ver laborCalendarBuilder.js#ubicarSemana), no un
  // cálculo de semana ISO aparte. Si "hoy" queda fuera de las semanas
  // cargadas (ej. cambio de año sin generar), cae a la última disponible.
  useEffect(() => {
    if (semanaActivaUuid || semanas.length === 0) return;
    const hoyIso = toLocalDateStr(new Date());
    const semanaHoy = ubicarSemana(hoyIso, semanas);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSemanaActivaUuid((semanaHoy || semanas[semanas.length - 1]).uuid);
  }, [semanas, semanaActivaUuid]);

  const semanaActiva = semanas.find((s) => s.uuid === semanaActivaUuid) || null;

  async function recargarCalendario() {
    if (!semanaActiva) return;
    setCalendarioLoading(true);
    try {
      const { items: rows } = await apiFetch(`/aspersiones?fechaDesde=${semanaActiva.fechaInicio}&fechaHasta=${semanaActiva.fechaFin}&limit=100`);
      setCalendarioItems(rows || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCalendarioLoading(false);
    }
  }

  useEffect(() => {
    if (vista !== "calendario" || !semanaActiva) return;
    let cancelado = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCalendarioLoading(true);
    apiFetch(`/aspersiones?fechaDesde=${semanaActiva.fechaInicio}&fechaHasta=${semanaActiva.fechaFin}&limit=100`)
      .then(({ items: rows }) => {
        if (!cancelado) setCalendarioItems(rows || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        if (!cancelado) setCalendarioLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [vista, semanaActiva]);

  const mapaCalendario = useMemo(() => agruparPorFincaYDia(calendarioItems), [calendarioItems]);

  // Regla de visibilidad del calendario: una finca solo aparece si tiene
  // al menos una programación (activa o cancelada) en la semana
  // seleccionada — NUNCA se parte del catálogo completo de fincas. Se
  // deriva de `calendarioItems` (ya acotado a la semana por el fetch), no
  // del combo `fincas` que sí trae todas las fincas operativas.
  const fincasConProgramacion = useMemo(() => {
    const mapa = new Map();
    for (const it of calendarioItems) {
      if (it.finca && !mapa.has(it.finca.uuid)) mapa.set(it.finca.uuid, it.finca);
    }
    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [calendarioItems]);

  const diasSemana = useMemo(() => {
    if (!semanaActiva) return [];
    const lunes = parseLocalDate(semanaActiva.fechaInicio);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes);
      d.setDate(lunes.getDate() + i);
      return { iso: toLocalDateStr(d), nombre: NOMBRES_DIA[i], numero: d.getDate(), mes: d.getMonth() };
    });
  }, [semanaActiva]);

  function irSemana(delta) {
    const idx = semanas.findIndex((s) => s.uuid === semanaActivaUuid);
    if (idx === -1) return;
    const nuevoIdx = idx + delta;
    if (nuevoIdx < 0 || nuevoIdx >= semanas.length) return;
    setSemanaActivaUuid(semanas[nuevoIdx].uuid);
  }

  function irSemanaActual() {
    const hoyIso = toLocalDateStr(new Date());
    const semanaHoy = ubicarSemana(hoyIso, semanas);
    if (semanaHoy) setSemanaActivaUuid(semanaHoy.uuid);
  }

  // Administrador guardado que ya no aparece entre los usuarios de la finca
  // (ej. le quitaron la asignación): se muestra igual para no perderlo.
  const guardadoFueraDeLista =
    Boolean(form.administradorFincaNombre) &&
    !form.administradorFincaUuid &&
    !usuariosFinca.some((u) => nombreUsuario(u) === form.administradorFincaNombre);

  function aplicarFiltros() {
    if (page === 1) load();
    else setPage(1);
  }

  function limpiarFiltros() {
    const vacios = { fincaUuid: "", semanaUuid: "", mezclaUuid: "", estado: "", fecha: "" };
    setFiltros(vacios);
    if (page === 1) load(vacios);
    else setPage(1);
  }

  // Al elegir la finca: trae los usuarios asignados a ella (Configuración →
  // Usuarios → Fincas) para el selector de "Administrador de finca", y
  // sugiere el último usado en una programación anterior de esa misma finca
  // (pedido explícito: "para la próxima programación de esa finca ese
  // usuario quedará como sugerido").
  useEffect(() => {
    if (!modalOpen || !form.fincaUuid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUsuariosFinca([]);
      return;
    }
    let cancelado = false;
    setCargandoUsuariosFinca(true);
    Promise.all([
      apiFetch(`/aspersiones/fincas/${form.fincaUuid}/usuarios`),
      apiFetch(`/aspersiones?fincaUuid=${form.fincaUuid}&limit=1`),
    ])
      .then(([usuarios, ultimas]) => {
        if (cancelado) return;
        setUsuariosFinca(usuarios || []);
        // Al editar, se vuelve a seleccionar en la lista el administrador ya
        // guardado (el formulario solo precarga su nombre).
        if (editingUuid) {
          setForm((f) => {
            const guardado = (usuarios || []).find((u) => nombreUsuario(u) === f.administradorFincaNombre);
            return guardado ? { ...f, administradorFincaUuid: guardado.uuid } : f;
          });
        }
        const anterior = ultimas.items?.[0];
        // Al editar se respeta el administrador ya guardado; la sugerencia
        // del último usado solo aplica al programar una nueva.
        if (!editingUuid && anterior?.administradorFincaNombre) {
          const sugerido = (usuarios || []).find(
            (u) => nombreUsuario(u) === anterior.administradorFincaNombre,
          );
          setForm((f) => ({
            ...f,
            administradorFincaUuid: sugerido?.uuid || "",
            administradorFincaNombre: anterior.administradorFincaNombre,
          }));
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        if (!cancelado) setCargandoUsuariosFinca(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.fincaUuid, modalOpen]);

  // Vista previa de la semana: mismo criterio que el backend
  // (semanaRepository.findByFecha) — busca la semana ya generada
  // (Configuración → Semanas) cuyo rango contiene la fecha elegida. Solo
  // informativo: la semana real se resuelve de nuevo en el servidor al
  // guardar.
  useEffect(() => {
    if (!modalOpen || !form.fecha) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSemanaPreview(null);
      return;
    }
    let cancelado = false;
    const anio = Number(form.fecha.slice(0, 4));
    apiFetch(`/semanas?anio=${anio}&limit=100`)
      .then(({ items: semanas }) => {
        if (cancelado) return;
        const encontrada = (semanas || []).find((s) => form.fecha >= s.fechaInicio && form.fecha <= s.fechaFin);
        setSemanaPreview(encontrada || false);
      })
      .catch(() => {
        if (!cancelado) setSemanaPreview(false);
      });
    return () => {
      cancelado = true;
    };
  }, [form.fecha, modalOpen]);

  // Edita una aspersión PROGRAMADA: trae el detalle, precarga el formulario
  // y deja como ajustes manuales las cantidades ya guardadas por insumo (así
  // la tabla muestra lo guardado y no lo recalcula desde cero). El % de
  // Aumento se deduce de la cantidad guardada cuando las unidades de dosis y
  // rendimiento de la mezcla coinciden; si no, queda el sugerido automático.
  async function openEdit(aspersion) {
    try {
      const d = await apiFetch(`/aspersiones/${aspersion.uuid}`);
      const base = Number(d.mezcla?.dosisPorHectarea || 0) * Number(d.hectareas || 0);
      const mismaUnidad =
        d.mezcla?.dosisPorHectareaUnidad?.uuid &&
        d.mezcla.dosisPorHectareaUnidad.uuid === d.mezcla?.unidadRendimiento?.uuid;
      const aumento = mismaUnidad && base > 0 ? Math.max(0, Math.round(((Number(d.cantidadCalculada) / base) - 1) * 10000) / 100) : null;
      const ajustados = {};
      const textos = {};
      for (const c of d.componentes || []) {
        if (c.articulo?.uuid) {
          ajustados[c.articulo.uuid] = String(Number(c.cantidad));
          textos[c.articulo.uuid] = String(Number(c.cantidad));
        }
      }
      setEditingUuid(d.uuid);
      setForm({
        ...emptyForm(),
        fincaUuid: d.finca?.uuid || "",
        fecha: String(d.fecha || "").slice(0, 10),
        tipo: Array.isArray(d.tipo) ? d.tipo : d.tipo ? [d.tipo] : ["SIGATOKA_NEGRA"],
        medio: d.medio || "",
        mezclaUuid: d.mezcla?.uuid || "",
        almacenUuid: d.almacen?.uuid || "",
        hectareas: String(Number(d.hectareas)),
        aumentoManual: aumento != null ? String(aumento) : "",
        componentesAjustados: ajustados,
        representanteCorbanaNombre: d.representanteCorbanaNombre || "",
        administradorFincaNombre: d.administradorFincaNombre || "",
        observaciones: d.observaciones || "",
      });
      setTextosCantidadAjustada(textos);
      setUsuariosFinca([]);
      setSemanaPreview(null);
      setMezclaDetalle(null);
      setExistenciasInsumos({});
      setFormError("");
      setModalOpen(true);
    } catch (err) {
      setError(err.message);
    }
  }

  function openCreate() {
    setEditingUuid(null);
    setTextosCantidadAjustada({});
    setForm(emptyForm());
    setUsuariosFinca([]);
    setSemanaPreview(null);
    setMezclaDetalle(null);
    setExistenciasInsumos({});
    setFormError("");
    setModalOpen(true);
  }

  // Plantilla de cargue masivo — precargada con todas las fincas activas
  // (pedido explícito) para que el operador solo tenga que completar
  // fecha/hectáreas/mezcla de cada una, sin escribir los nombres de finca a
  // mano. Con estilo de marca (ExcelJS, ya usado en esta misma página vía
  // lib/aspersionesExcelExport.js) + hoja de Instrucciones + hoja de
  // Mezclas (cada mezcla con los insumos de su receta en formato
  // "A | B | C", copiable directo a la columna "mezcla").
  async function descargarPlantillaAspersiones() {
    const BRAND_900 = "FF14532D";
    const BRAND_700 = "FF15803D";
    const LIGHT = "FFF0FDF4";
    const WHITE = "FFFFFFFF";
    const BORDER_LIGHT = "FFE2E8F0";

    let mezclasRef = [];
    try {
      // Endpoint propio de Aspersiones (no /inventarios/mezclas) — así
      // cualquiera con permiso de programar aspersiones ve esta lista de
      // referencia con la receta de cada mezcla.
      const res = await apiFetch("/aspersiones/mezclas-referencia");
      mezclasRef = Array.isArray(res) ? res : [];
    } catch {}

    const headers = ["medio", "almacen", "fecha", "finca", "observaciones", "hectareas", "tipo", "mezcla"];
    // mezcla va ancha (60): además del código cabe la lista
    // "INSUMO1 | INSUMO2 | ..." de la receta.
    const anchos = [10, 10, 13, 18, 26, 12, 20, 60];

    const wb = new ExcelJS.Workbook();
    wb.creator = "Corbana";

    const ws = wb.addWorksheet("Plantilla", { views: [{ state: "frozen", ySplit: 1, xSplit: 4 }] });
    ws.columns = headers.map((h, i) => ({ header: h, key: h, width: anchos[i] }));

    const headerRow = ws.getRow(1);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_900 } };
      cell.font = { color: { argb: WHITE }, bold: true, size: 11 };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = { bottom: { style: "thin", color: { argb: BRAND_700 } } };
    });

    const almacenDefault = almacenes[0]?.codigo || almacenes[0]?.nombre || "";
    fincas.forEach((f, i) => {
      const row = ws.addRow({
        medio: "",
        almacen: almacenDefault,
        fecha: "",
        finca: f.nombre,
        observaciones: "",
        hectareas: "",
        tipo: "",
        mezcla: "",
      });
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: "thin", color: { argb: BORDER_LIGHT } },
          bottom: { style: "thin", color: { argb: BORDER_LIGHT } },
          left: { style: "thin", color: { argb: BORDER_LIGHT } },
          right: { style: "thin", color: { argb: BORDER_LIGHT } },
        };
        if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
        if (colNumber === 4) cell.font = { bold: true };
        cell.alignment = { vertical: "middle" };
      });
    });

    // Listas desplegables para guiar al operador y evitar errores de tipeo.
    for (let r = 2; r <= fincas.length + 1; r++) {
      ws.getCell(`A${r}`).dataValidation = { type: "list", allowBlank: true, formulae: ['"AVION,DRON"'] };
      ws.getCell(`G${r}`).dataValidation = { type: "list", allowBlank: true, formulae: ['"SIGATOKA_NEGRA,DEFOLIADOR,FERTILIZACION"'] };
    }
    // Desplegable de mezclas por código (siempre existe y es corto); Excel
    // limita la lista literal a 255 caracteres, si no cabe se omite.
    const listaCodigos = mezclasRef.map((m) => m.codigo).filter(Boolean).join(",");
    if (listaCodigos && listaCodigos.length <= 250) {
      for (let r = 2; r <= fincas.length + 1; r++) {
        ws.getCell(`H${r}`).dataValidation = { type: "list", allowBlank: true, formulae: [`"${listaCodigos}"`] };
      }
    }

    // Hoja de instrucciones.
    const wsInfo = wb.addWorksheet("Instrucciones");
    wsInfo.columns = [{ width: 24 }, { width: 95 }];
    const filasInfo = [
      ["Columna", "Qué va"],
      ["medio", "AVION o DRON"],
      ["almacen", "Código o nombre del almacén de donde se descuentan los insumos"],
      ["fecha", "Fecha del vuelo (AAAA-MM-DD)"],
      ["finca", "Ya viene precargada con todas las fincas activas — no la cambies, solo completa el resto de la fila"],
      ["observaciones", "Opcional, texto libre"],
      ["hectareas", "Área a tratar (sin sobregalonaje)"],
      ["tipo", "SIGATOKA_NEGRA, DEFOLIADOR o FERTILIZACION — vacío = Sigatoka Negra"],
      [
        "mezcla",
        "Código (ej. MEZ-0017) o nombre exacto de una mezcla activa, O la lista de insumos de su receta en el MISMO formato de la hoja \"Mezclas\" (ej. \"PALADIUM 250 EC | MANCOL 430 SC | ACEITE BANOLE | HIPOTENSOR SYS | ADHERENTE SYS | Agua | ACONDICIONADOR\") — puedes copiar la celda \"Insumos de la receta\" y pegarla acá. Con la lista se usa la mezcla activa cuya receta incluya TODOS esos insumos (si varias califican, la usada más recientemente). La mezcla debe tener volumen por hectárea configurado.",
      ],
      ["", ""],
      ["Filas sin mezcla ni hectáreas", "se ignoran al cargar (déjalas vacías si esa finca no tiene aspersión programada esta semana)"],
    ];
    filasInfo.forEach((fila, i) => {
      const row = wsInfo.addRow(fila);
      if (i === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_900 } };
          cell.font = { color: { argb: WHITE }, bold: true };
        });
      } else {
        row.getCell(1).font = { bold: true };
        row.getCell(2).alignment = { wrapText: true };
      }
    });

    // Hoja de referencia: una fila por mezcla activa, con los insumos de su
    // receta unidos por " | " — el principal primero y el resto en el orden
    // en que se agregaron a la receta, sin cantidades.
    const wsMezclas = wb.addWorksheet("Mezclas", { views: [{ state: "frozen", ySplit: 1 }] });
    wsMezclas.columns = [{ width: 12 }, { width: 38 }, { width: 14 }, { width: 100 }];
    const headerMezclas = wsMezclas.addRow(["Código", "Mezcla", "Volumen / ha", "Insumos de la receta"]);
    headerMezclas.height = 22;
    headerMezclas.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_900 } };
      cell.font = { color: { argb: WHITE }, bold: true };
      cell.alignment = { vertical: "middle" };
    });
    const posicionInsumo = (ins) => (ins.esPrincipal ? 0 : 1);
    mezclasRef.forEach((m, idx) => {
      const insumosTexto = m.insumos
        .map((ins, i) => ({ ins, i }))
        .sort((a, b) => posicionInsumo(a.ins) - posicionInsumo(b.ins) || a.i - b.i)
        .map(({ ins }) => ins.nombre)
        .join(" | ");
      const row = wsMezclas.addRow([
        m.codigo,
        m.nombre || "(sin nombre)",
        m.volumenPorHectarea != null ? `${m.volumenPorHectarea} ${m.volumenPorHectareaUnidad}/ha` : "sin volumen/ha",
        insumosTexto || "(sin receta)",
      ]);
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.border = { top: { style: "thin", color: { argb: BORDER_LIGHT } }, bottom: { style: "thin", color: { argb: BORDER_LIGHT } } };
        cell.alignment = { vertical: "middle", wrapText: true };
        if (idx % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
      });
      row.getCell(1).font = { bold: true };
      row.getCell(2).font = { bold: true };
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_aspersiones.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  function openCargueModal() {
    setCargueArchivo(null);
    setCargueError("");
    setCargueResultado(null);
    setCargueModalOpen(true);
  }

  function handleElegirArchivo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCargueArchivo(file);
    setCargueError("");
    setCargueResultado(null);
  }

  async function handleSubirCargue() {
    if (!cargueArchivo) return;
    setCargando(true);
    setCargueError("");
    try {
      const resultado = await apiUpload("/aspersiones/bulk-upload", cargueArchivo);
      setCargueResultado(resultado);
      load();
    } catch (err) {
      setCargueError(err.message);
    } finally {
      setCargando(false);
    }
  }

  const mezclaSeleccionada = mezclas.find((m) => m.uuid === form.mezclaUuid);
  const hectareasNum = Number(form.hectareas) || 0;
  // "Volumen / ha" lo puede editar el operador — vacío = el configurado
  // en la mezcla (pedido explícito). Todo lo demás (cantidad a preparar,
  // % aumento automático, tabla, agua de relleno) se recalcula solo.
  const dosisPorHectareaNum =
    form.volumenHaManual !== "" ? Number(form.volumenHaManual) || 0 : Number(mezclaSeleccionada?.dosisPorHectarea || 0);
  const unidadDosisUuid = mezclaSeleccionada?.dosisPorHectareaUnidad?.uuid;
  const unidadRendimientoUuid = mezclaSeleccionada?.unidadRendimiento?.uuid;

  // Unidad "mostrada": la preferida del operador si existe conversión
  // posible hacia ella; si el operador todavía no eligió ninguna (nada
  // guardado en localStorage todavía), el default es la unidad en la que
  // está definida la dosis por hectárea de la mezcla — no la de
  // rendimiento — porque es la que el operador ya conoce de memoria (ej.
  // "6 Gal/ha").
  const unidadPreferidaConvertible =
    unidadPreferidaUuid &&
    unidadRendimientoUuid &&
    (unidadPreferidaUuid === unidadRendimientoUuid ||
      convertirCantidad(grafoUnidades, unidadRendimientoUuid, unidadPreferidaUuid, 1) !== null);
  const unidadMostradaUuid = unidadPreferidaConvertible ? unidadPreferidaUuid : unidadDosisUuid || unidadRendimientoUuid;
  const unidadCantidadSimbolo =
    unidadesVolumen.find((u) => u.uuid === unidadMostradaUuid)?.simbolo ||
    mezclaSeleccionada?.unidadRendimiento?.simbolo ||
    mezclaSeleccionada?.dosisPorHectareaUnidad?.simbolo;

  // Redondeo al 0.5 MÁS CERCANO (no hacia arriba) — pedido explícito tanto
  // para el cálculo real de "cantidad necesaria" por insumo (y la dosis del
  // principal que decide el % de Aumento automático) como para lo que se
  // muestra en pantalla al convertir a la unidad que el operador elija por
  // fila (ver aUnidadFila, más abajo, que usa este mismo criterio con paso
  // 0.1 para el ACONDICIONADOR).
  function redondearAMedios(valor) {
    if (!(valor > 0)) return valor;
    return Math.round(valor / 0.5) * 0.5;
  }

  // Unidad en la que se MUESTRA y se REDONDEA la "Cantidad necesaria" de un
  // insumo: la propia del artículo (L, Gal, Kg) y no la de la receta — tras
  // llevar una receta a 1 litro (Mezclas → Prueba de laboratorio) sus
  // cantidades quedan en ml/g, y aquí se necesitan en la unidad del insumo.
  // Si no hay conversión desde la unidad de la receta, se usa la de la receta.
  function unidadPropiaDe(componente) {
    const recetaUuid = componente.unidad?.uuid;
    if (!recetaUuid) return recetaUuid;
    // Prioridad: la unidad configurada en el insumo para su dosis (ej. Gal
    // para ACEITE BANOLE), luego su unidad de medida. Solo cuenta si es una
    // unidad que la pantalla sabe listar (volumen/peso) y hay conversión.
    const candidatas = [componente.articulo?.dosisUnidad?.uuid, componente.articulo?.unidadMedida?.uuid];
    for (const uuid of candidatas) {
      if (!uuid) continue;
      if (uuid === recetaUuid) return recetaUuid;
      const listable = unidadesVolumen.some((u) => u.uuid === uuid) || unidadesPeso.some((u) => u.uuid === uuid);
      if (listable && convertirCantidad(grafoUnidades, recetaUuid, uuid, 1) !== null) return uuid;
    }
    return recetaUuid;
  }

  // Redondea al 0.5 más cercano EN LA UNIDAD PROPIA del insumo y devuelve el
  // resultado en la unidad de la receta (la "nativa", que es la que se guarda).
  function redondearEnUnidadPropia(componente, cantidadNativa) {
    if (!(cantidadNativa > 0)) return cantidadNativa;
    const recetaUuid = componente.unidad?.uuid;
    const propiaUuid = unidadPropiaDe(componente);
    if (!recetaUuid || !propiaUuid || propiaUuid === recetaUuid) return redondearAMedios(cantidadNativa);
    const enPropia = convertirCantidad(grafoUnidades, recetaUuid, propiaUuid, cantidadNativa);
    if (enPropia === null) return redondearAMedios(cantidadNativa);
    // Un insumo diminuto (ej. 15 ml en una unidad propia de Gal) se
    // redondearía a 0 y el backend rechaza cantidades no positivas: en ese
    // caso se conserva la cantidad exacta.
    const redondeada = redondearAMedios(enPropia);
    if (!(redondeada > 0)) return cantidadNativa;
    return convertirCantidad(grafoUnidades, propiaUuid, recetaUuid, redondeada) ?? cantidadNativa;
  }

  // Convierte una cantidad NATIVA (unidad propia de ese insumo) a la
  // unidad que se está mostrando en "Cantidad a preparar"
  // (unidadMostradaUuid, ver más abajo) — si no hay conversión posible
  // (ej. un insumo sólido en Kg y la mezcla se prepara en Litros), se
  // devuelve tal cual en su unidad nativa.
  function aUnidadMostrada(cantidadNativa, unidadOrigenUuid) {
    if (!unidadOrigenUuid || !unidadMostradaUuid || unidadOrigenUuid === unidadMostradaUuid) {
      return cantidadNativa;
    }
    return convertirCantidad(grafoUnidades, unidadOrigenUuid, unidadMostradaUuid, cantidadNativa) ?? cantidadNativa;
  }
  function deUnidadMostrada(cantidadMostrada, unidadDestinoUuid) {
    if (!unidadDestinoUuid || !unidadMostradaUuid || unidadDestinoUuid === unidadMostradaUuid) {
      return cantidadMostrada;
    }
    return convertirCantidad(grafoUnidades, unidadMostradaUuid, unidadDestinoUuid, cantidadMostrada) ?? cantidadMostrada;
  }
  // Variante estricta SOLO para sumar lo que completa el Agua: si el
  // insumo no se puede convertir a la unidad mostrada (otra magnitud
  // física, ej. ANTIFOAM en gramos cuando se prepara en Galones), se
  // EXCLUYE de la suma en vez de sumar el número nativo tal cual — eso
  // sumaba 343 g como 343 Gal y dejaba el Agua en 0.
  function aUnidadMostradaSumable(cantidadNativa, unidadOrigenUuid) {
    if (cantidadNativa == null) return null;
    if (!unidadOrigenUuid || !unidadMostradaUuid || unidadOrigenUuid === unidadMostradaUuid) return cantidadNativa;
    return convertirCantidad(grafoUnidades, unidadOrigenUuid, unidadMostradaUuid, cantidadNativa);
  }

  // Al elegir una mezcla se trae su detalle completo (con los componentes
  // de la receta) — la lista de combos no los trae.
  useEffect(() => {
    if (!form.mezclaUuid) {
      setMezclaDetalle(null);
      return;
    }
    let cancelado = false;
    apiFetch(`/inventarios/mezclas/${form.mezclaUuid}`)
      .then((detalle) => {
        if (!cancelado) setMezclaDetalle(detalle);
      })
      .catch(() => {
        if (!cancelado) setMezclaDetalle(null);
      });
    return () => {
      cancelado = true;
    };
  }, [form.mezclaUuid]);

  const componentesRecetaSeleccionada = mezclaDetalle?.versiones?.[0]?.componentes || [];
  const rendimientoSeleccionado = Number(mezclaDetalle?.rendimiento || 1) || 1;
  // Insumo principal (selección única, ver marcarComponentePrincipal en
  // mezcla.service.js) — gobierna el tope del "% Aumento" automático (SOLO
  // él no debe superar el 110% de su dosis máxima por hectárea) y el % de
  // dosis resultante (principalPctSobreDosis, ver calcularEscenario) que
  // luego se aplica a TODOS los demás insumos que tengan su propia dosis
  // configurada — pedido explícito: "todos trabajan con ese mismo %".
  const componentePrincipal = componentesRecetaSeleccionada.find((c) => c.esPrincipal);
  // Dosis de referencia de un componente de la receta: la del RENGLÓN si
  // está configurada en la mezcla (manda sobre la del artículo — ej. ACEITE
  // a 2.0/ha en una mezcla y 1.5/ha en la mayoría), si no la del artículo.
  // Sin dosis no hay % sobre dosis.
  function dosisRefComponente(componente) {
    if (!componente) return null;
    if (componente.dosisPorHectarea != null && componente.dosisUnidadId) {
      const unidad = [...unidadesVolumen, ...unidadesPeso].find((u) => u.id === componente.dosisUnidadId);
      if (unidad) {
        return { dosisMaxima: Number(componente.dosisPorHectarea), unidadUuid: unidad.uuid, simbolo: unidad.simbolo, esDelRenglon: true };
      }
    }
    const dosisMaxima = componente.articulo?.dosisPorHectarea != null ? Number(componente.articulo.dosisPorHectarea) : null;
    if (dosisMaxima == null) return null;
    return {
      dosisMaxima,
      unidadUuid: componente.articulo?.dosisUnidad?.uuid,
      simbolo: componente.articulo?.dosisUnidad?.simbolo || "",
      esDelRenglon: false,
    };
  }
  const componenteAgua = componentesRecetaSeleccionada.find((c) => c.articulo?.nombre === "Agua");
  const componenteRegulador = componentesRecetaSeleccionada.find((c) => c.articulo?.nombre === "ACONDICIONADOR");
  const componenteDiluyente =
    componenteAgua ||
    componentesRecetaSeleccionada
      .filter((c) => c !== componentePrincipal && c !== componenteRegulador)
      .reduce((max, c) => (max == null || Number(c.cantidad) > Number(max.cantidad) ? c : max), null);

  // El "% Aumento" ya no lo edita el operador — pedido explícito: se parte
  // de 10% y, si el insumo PRINCIPAL se pasa de 110% de su dosis máxima
  // por hectárea (redondeando su cantidad al 0.5 más cercano), se prueba
  // bajando de a 1 punto (9%, 8%, ... 1%) hasta encontrar el más alto que
  // no se pase. Los DEMÁS insumos van en proporción al principal y NO
  // tienen tope propio — solo el principal no debe pasarse.
  const LIMITE_AUMENTO_MAX = 10;
  const LIMITE_PORCENTAJE_DOSIS_PRINCIPAL_MAX = 110;
  // Simula TODA la cadena real de cálculo (factorReceta, el % de dosis del
  // principal que se replica en el resto de insumos con dosis propia, y el
  // reparto final de Agua/ACONDICIONADOR) para un % de aumento
  // hipotético. Es la ÚNICA fuente de verdad: tanto la búsqueda del %
  // automático de abajo como el cálculo real que ve el operador (más
  // abajo, llamada con porcentajeAumentoEfectivo) pasan por acá.
  // ACONDICIONADOR: 0.8 gramos por cada litro de Agua (ver
  // configuracion.service.js#MEZCLA_PARAMETROS_DEFAULT) — extraído a función
  // porque se calcula dos veces: una dentro de cada escenario hipotético y
  // otra al final con el Agua REAL (ver necesariaRealNativa más abajo).
  function calcularReguladorNativa(aguaNativa, diluyenteUnidadUuid, reguladorUnidadUuid) {
    if (aguaNativa == null || !diluyenteUnidadUuid || !reguladorUnidadUuid) return null;
    const litro = unidadesVolumen.find((u) => u.nombre === "Litro");
    const kilogramo = unidadesPeso.find((u) => u.nombre === "Kilogramo");
    if (!litro || !kilogramo) return null;
    const aguaLitros =
      diluyenteUnidadUuid === litro.uuid
        ? aguaNativa
        : convertirCantidad(grafoUnidades, diluyenteUnidadUuid, litro.uuid, aguaNativa);
    if (aguaLitros == null) return null;
    const reguladorKg = (0.8 * aguaLitros) / 1000;
    const reguladorNativo =
      reguladorUnidadUuid === kilogramo.uuid
        ? reguladorKg
        : convertirCantidad(grafoUnidades, kilogramo.uuid, reguladorUnidadUuid, reguladorKg);
    // Siempre a un decimal en la unidad propia del insumo (pedido
    // explícito) — es el valor que se muestra Y el que se guarda/descuenta.
    return reguladorNativo === null ? null : Math.round(reguladorNativo * 10) / 10;
  }
  function calcularEscenario(aumentoPct) {
    const factorAumento = 1 + aumentoPct / 100;
    const cantidadEnUnidadDosis = mezclaSeleccionada ? dosisPorHectareaNum * hectareasNum * factorAumento : 0;
    const cantidadSugeridaEnRendimiento =
      mezclaSeleccionada && unidadDosisUuid && unidadRendimientoUuid && unidadDosisUuid !== unidadRendimientoUuid
        ? convertirCantidad(grafoUnidades, unidadDosisUuid, unidadRendimientoUuid, cantidadEnUnidadDosis) ?? cantidadEnUnidadDosis
        : cantidadEnUnidadDosis;
    const cantidadSugerida =
      unidadMostradaUuid && unidadRendimientoUuid && unidadMostradaUuid !== unidadRendimientoUuid
        ? convertirCantidad(grafoUnidades, unidadRendimientoUuid, unidadMostradaUuid, cantidadSugeridaEnRendimiento) ?? cantidadSugeridaEnRendimiento
        : cantidadSugeridaEnRendimiento;
    const cantidadAPrepararRedondeada = mezclaSeleccionada ? Math.round(cantidadSugerida) : 0;
    const cantidadAPrepararEnRendimiento =
      unidadMostradaUuid && unidadRendimientoUuid && unidadMostradaUuid !== unidadRendimientoUuid
        ? convertirCantidad(grafoUnidades, unidadMostradaUuid, unidadRendimientoUuid, cantidadAPrepararRedondeada) ?? cantidadAPrepararRedondeada
        : cantidadAPrepararRedondeada;
    const factorReceta = rendimientoSeleccionado > 0 ? cantidadAPrepararEnRendimiento / rendimientoSeleccionado : 0;

    // El redondeo a pasos de 0.5 se hace en la unidad PROPIA de cada
    // insumo (no en la unidad global de "Cantidad a preparar") — así cada
    // uno redondea con la granularidad que le corresponde (ej. 0.5 L para
    // un insumo en Litros, no 0.5 Gal, que es un salto ~3.8x más grueso y
    // dejaba muy pocas opciones de % Aumento entre 100% y 110%).
    //
    // Convierte la dosis de referencia (del renglón o del artículo, ver
    // dosisRefComponente) a la unidad de RECETA del componente, para poder
    // calcular cantidades nativas a partir de ella.
    function dosisEnUnidadComponente(componente) {
      const ref = dosisRefComponente(componente);
      if (!ref || ref.dosisMaxima == null) return null;
      const miUnidadUuid = componente.unidad?.uuid;
      return ref.unidadUuid && miUnidadUuid && ref.unidadUuid !== miUnidadUuid
        ? convertirCantidad(grafoUnidades, ref.unidadUuid, miUnidadUuid, ref.dosisMaxima) ?? ref.dosisMaxima
        : ref.dosisMaxima;
    }

    // La cantidad del PRINCIPAL se calcula respecto a su DOSIS
    // (articulo.dosisPorHectarea × hectáreas × aumento), redondeada al 0.5
    // más cercano — pedido explícito: la dosis es la referencia real de
    // cuánto debe aplicarse por hectárea. El % sobre dosis que resulta de
    // esa cantidad YA redondeada (ej. 108.42%) es el que se le aplica
    // también a TODOS los demás insumos que tengan su propia dosis
    // configurada — pedido explícito: "si el principal queda en 108.42%,
    // todos deben trabajar con ese mismo % sobre su propia dosis", en vez
    // de arrastrarlos proporcionalmente a como se armó la receta.
    let principalPctSobreDosis = null;
    if (componentePrincipal) {
      const dosisEnUnidadPrincipal = dosisEnUnidadComponente(componentePrincipal);
      if (dosisEnUnidadPrincipal != null && hectareasNum > 0) {
        const necesariaDesdeDosis = dosisEnUnidadPrincipal * hectareasNum * factorAumento;
        if (necesariaDesdeDosis > 0) {
          const redondeadaDesdeDosis = redondearEnUnidadPropia(componentePrincipal, necesariaDesdeDosis);
          const dosisAplicada = redondeadaDesdeDosis / hectareasNum;
          // Ambas en la unidad de la RECETA (dosisEnUnidadPrincipal): comparar
          // contra la dosis en la unidad del artículo inflaba el % por el
          // factor de conversión (ej. ml vs L = x1000).
          principalPctSobreDosis = (dosisAplicada / dosisEnUnidadPrincipal) * 100;
        }
      }
    }

    // Cantidad necesaria por insumo — redondeada al 0.5 MÁS CERCANO en su
    // propia unidad (pedido explícito):
    // 0. Tasa por volumen (tipoDosis POR_VOLUMEN, ej. ANTIFOAM = 1 g/Gal):
    //    tasa × total a preparar llevado a la unidad de la tasa.
    // 1. Insumos con "dosis relativa" (referenciaArticuloId/
    //    porcentajeReferencia, ej. HIPOTENSOR = 1% de ACEITE BANOLE): el
    //    X% de la cantidad YA resuelta del insumo de referencia
    //    (recursivo, por si hay cadenas).
    // 2. Insumos con dosis propia configurada (articulo.dosisPorHectarea):
    //    se calculan al MISMO % sobre dosis que terminó teniendo el
    //    principal (principalPctSobreDosis) — así todos "trabajan con el
    //    mismo aumento real". Si no hay principal con dosis, cada uno usa
    //    directamente su propia dosis × hectáreas × aumento.
    // 3. Sin dosis ni referencia (ej. Adherente sin dosis configurada):
    //    se mantiene la proporción de la receta escalada por factorReceta.
    // Agua y ACONDICIONADOR no pasan por acá (se resuelven aparte, más
    // abajo).
    const necesariaCache = new Map();
    // Tasa por volumen (tipoDosis POR_VOLUMEN, ej. ANTIFOAM = 1 g/Gal):
    // tasa × total a preparar llevado a la unidad de la tasa. La tasa va
    // en la unidad de la fila, así el resultado ya es nativo (en la unidad
    // de receta del componente).
    function basePorVolumenNativa(componente) {
      if (componente.tipoDosis !== 'POR_VOLUMEN') return null;
      const tasa = Number(componente.tasa);
      if (!(tasa > 0) || !componente.tasaUnidadId) return null;
      const tasaUnidad = [...unidadesVolumen, ...unidadesPeso].find((u) => u.id === componente.tasaUnidadId);
      const tasaUuid = tasaUnidad?.uuid;
      if (!tasaUuid || !mezclaSeleccionada || !unidadMostradaUuid) return null;
      const totalEnTasa =
        tasaUuid === unidadMostradaUuid
          ? cantidadAPrepararRedondeada
          : convertirCantidad(grafoUnidades, unidadMostradaUuid, tasaUuid, cantidadAPrepararRedondeada);
      if (totalEnTasa == null) return null;
      return totalEnTasa * tasa;
    }
    function necesariaSugeridaNativa(componente) {
      const au = componente.articulo?.uuid;
      if (au && necesariaCache.has(au)) return necesariaCache.get(au);
      let resultado;
      const baseVolumen = basePorVolumenNativa(componente);
      if (baseVolumen != null) {
        resultado = baseVolumen > 0 ? redondearEnUnidadPropia(componente, baseVolumen) : baseVolumen;
      }
      if (resultado === undefined && componente.referenciaArticuloId && componente.porcentajeReferencia != null) {
        const refComponente = componentesRecetaSeleccionada.find((x) => x.articulo?.id === componente.referenciaArticuloId);
        if (refComponente && refComponente !== componente) {
          const refNativa = necesariaSugeridaNativa(refComponente);
          const refUnidadUuid = refComponente.unidad?.uuid;
          const miUnidadUuid = componente.unidad?.uuid;
          const refEnMiUnidad =
            refUnidadUuid && miUnidadUuid && refUnidadUuid !== miUnidadUuid
              ? convertirCantidad(grafoUnidades, refUnidadUuid, miUnidadUuid, refNativa) ?? refNativa
              : refNativa;
          const valor = (refEnMiUnidad * Number(componente.porcentajeReferencia)) / 100;
          resultado = valor > 0 ? redondearEnUnidadPropia(componente, valor) : valor;
        }
      }
      if (resultado === undefined) {
        const dosisEnUnidadPropia = dosisEnUnidadComponente(componente);
        if (dosisEnUnidadPropia != null && hectareasNum > 0) {
          const pctObjetivo = principalPctSobreDosis != null ? principalPctSobreDosis : factorAumento * 100;
          const valor = (dosisEnUnidadPropia * hectareasNum * pctObjetivo) / 100;
          resultado = valor > 0 ? redondearEnUnidadPropia(componente, valor) : valor;
        } else {
          const escalada = Number(componente.cantidad) * factorReceta;
          resultado = escalada > 0 ? redondearEnUnidadPropia(componente, escalada) : escalada;
        }
      }
      if (au) necesariaCache.set(au, resultado);
      return resultado;
    }

    const sumaSinDiluyente = componentesRecetaSeleccionada
      .filter((c) => c !== componenteDiluyente && c !== componenteRegulador)
      .reduce((suma, c) => {
        const v = aUnidadMostradaSumable(necesariaSugeridaNativa(c), c.unidad?.uuid);
        return v == null ? suma : suma + v;
      }, 0);
    const cantidadDiluyenteEnMostrada = componenteDiluyente ? Math.max(0, cantidadAPrepararRedondeada - sumaSinDiluyente) : 0;
    const cantidadAguaNativa = componenteDiluyente ? deUnidadMostrada(cantidadDiluyenteEnMostrada, componenteDiluyente.unidad?.uuid) : 0;

    let cantidadReguladorNativa = null;
    if (componenteRegulador?.unidad?.uuid && componenteDiluyente) {
      cantidadReguladorNativa = calcularReguladorNativa(
        cantidadAguaNativa,
        componenteDiluyente.unidad?.uuid,
        componenteRegulador.unidad.uuid,
      );
    }

    function necesariaFinalNativa(componente) {
      if (componenteDiluyente && componente === componenteDiluyente) return cantidadAguaNativa;
      if (componenteRegulador && componente === componenteRegulador && cantidadReguladorNativa != null) return cantidadReguladorNativa;
      return necesariaSugeridaNativa(componente);
    }

    return {
      cantidadSugeridaEnRendimiento,
      cantidadAPrepararRedondeada,
      cantidadAPrepararEnRendimiento,
      necesariaFinalNativa,
    };
  }
  // % real sobre dosis máxima de UN insumo cualquiera, dado un escenario ya
  // calculado (ver calcularEscenario) — parametrizada por componente porque
  // la búsqueda del % automático la evalúa en el principal (el tope de
  // 110% rige SOLO para él — pedido explícito) y la tabla la usa para
  // mostrar la columna "% sobre dosis" de cada fila.
  function porcentajeSobreDosisConEscenario(componente, escenario) {
    if (!componente || hectareasNum <= 0) return 0;
    const ref = dosisRefComponente(componente);
    if (!ref || ref.dosisMaxima == null || ref.dosisMaxima <= 0) return 0;
    const dosisMaxima = ref.dosisMaxima;
    const unidadDosisMaximaUuid = ref.unidadUuid;
    const unidadRecetaUuid = componente.unidad?.uuid;
    const necesariaFinal = escenario.necesariaFinalNativa(componente);
    const dosisAplicadaEnUnidadReceta = necesariaFinal / hectareasNum;
    const dosisAplicada =
      unidadDosisMaximaUuid && unidadRecetaUuid && unidadDosisMaximaUuid !== unidadRecetaUuid
        ? convertirCantidad(grafoUnidades, unidadRecetaUuid, unidadDosisMaximaUuid, dosisAplicadaEnUnidadReceta) ?? dosisAplicadaEnUnidadReceta
        : dosisAplicadaEnUnidadReceta;
    return (dosisAplicada / dosisMaxima) * 100;
  }
  // % de dosis para un aumento candidato (principal, y el peor caso entre
  // TODOS los insumos con dosis máxima — este último solo se usa cuando la
  // mezcla NO tiene principal), calculados sobre el MISMO escenario (una
  // sola vez) para no desalinear ambos números.
  function evaluarCandidato(aumentoPct) {
    const escenario = calcularEscenario(aumentoPct);
    const porcentajes = componentesRecetaSeleccionada
      .filter((c) => dosisRefComponente(c) !== null)
      .map((c) => porcentajeSobreDosisConEscenario(c, escenario));
    return {
      maxPct: porcentajes.length ? Math.max(...porcentajes) : 0,
      principalPct: porcentajeSobreDosisConEscenario(componentePrincipal, escenario),
    };
  }
  let porcentajeAumentoAutomatico = LIMITE_AUMENTO_MAX;
  // Pedido explícito: se parte de 10% de aumento; si con eso el insumo
  // PRINCIPAL ya supera el 110% de su dosis por hectárea (redondeando su
  // cantidad al 0.5 más cercano, ver calcularEscenario), se va probando
  // 9%, 8%, ... hasta 1%, y se usa el porcentaje más alto (más óptimo) de
  // ese rango que SÍ deje al principal en ≤110%. Si no hay insumo
  // principal, se aplica el mismo criterio sobre el insumo más exigente
  // (el de mayor % sobre su propia dosis) entre todos los que tengan dosis
  // configurada.
  if (mezclaSeleccionada && hectareasNum > 0) {
    let mejorValido = null; // mayor aumento entero (10→1) que cumple ≤110%
    let mejorFallback = null; // si ninguno cumple: el que menos se pasa de 110%
    for (let candidato = LIMITE_AUMENTO_MAX; candidato >= 1; candidato--) {
      const { principalPct, maxPct } = evaluarCandidato(candidato);
      const pctRelevante = componentePrincipal ? principalPct : maxPct;
      if (pctRelevante <= LIMITE_PORCENTAJE_DOSIS_PRINCIPAL_MAX) {
        mejorValido = candidato;
        break;
      }
      if (mejorFallback == null || pctRelevante < mejorFallback.pct) {
        mejorFallback = { candidato, pct: pctRelevante };
      }
    }
    if (mejorValido !== null) {
      porcentajeAumentoAutomatico = mejorValido;
    } else if (mejorFallback !== null) {
      // Ni con 1% de aumento se cumple ≤110% (el principal ya parte muy
      // sobredosificado) — se usa 1%, el que menos se pasa dentro del
      // rango pedido.
      porcentajeAumentoAutomatico = mejorFallback.candidato;
    }
  }

  // El operador puede subir/bajar a mano el % Aumento sugerido — mientras
  // no lo toque, se usa el automático (ver búsqueda arriba).
  const porcentajeAumentoEfectivo = form.aumentoManual !== "" ? Number(form.aumentoManual) || 0 : porcentajeAumentoAutomatico;

  // Escenario REAL (el que ve el operador) — usa el mismo cálculo exacto
  // (calcularEscenario, ver arriba) que ya usó la búsqueda del % automático
  // para probar candidatos, así la tabla y el % mostrado por fila nunca se
  // desalinean de lo que la búsqueda consideró "seguro".
  const escenarioReal = calcularEscenario(porcentajeAumentoEfectivo);
  const {
    cantidadSugeridaEnRendimiento,
    cantidadAPrepararRedondeada,
    cantidadAPrepararEnRendimiento,
  } = escenarioReal;

  // Cantidad REAL por insumo (la que ve el operador y la que se guarda): el
  // override manual de esa fila si lo hay, si no la sugerida del escenario.
  // El Agua se recalcula AL FINAL a partir de estos valores reales (no de
  // los sugeridos) para que el total siempre complete "Cantidad a preparar"
  // — pedido explícito: lo último que se hace es rellenar con agua. El
  // ACONDICIONADOR sigue al Agua real con la misma fórmula de siempre.
  function actualNoAutoNativa(componente) {
    const ajuste = form.componentesAjustados[componente.articulo?.uuid];
    if (ajuste !== undefined && ajuste !== "") return Number(ajuste);
    return escenarioReal.necesariaFinalNativa(componente);
  }
  const sumaRealesEnMostrada = componentesRecetaSeleccionada
    .filter((c) => c !== componenteDiluyente && c !== componenteRegulador)
    .reduce((suma, c) => {
      const v = aUnidadMostradaSumable(actualNoAutoNativa(c), c.unidad?.uuid);
      return v == null ? suma : suma + v;
    }, 0);
  const aguaRealEnMostrada = componenteDiluyente ? Math.max(0, cantidadAPrepararRedondeada - sumaRealesEnMostrada) : 0;
  const aguaRealNativa = componenteDiluyente ? deUnidadMostrada(aguaRealEnMostrada, componenteDiluyente.unidad?.uuid) : 0;
  // Litros de agua reales (para renglones POR_LITRO_AGUA) — null si no hay
  // cómo convertir.
  const aguaRealLitros = (() => {
    if (!componenteDiluyente) return null;
    const litro = unidadesVolumen.find((u) => u.nombre === "Litro");
    if (!litro) return null;
    const dilUuid = componenteDiluyente.unidad?.uuid;
    if (!dilUuid) return null;
    return dilUuid === litro.uuid ? aguaRealNativa : convertirCantidad(grafoUnidades, dilUuid, litro.uuid, aguaRealNativa);
  })();
  // Renglón POR_LITRO_AGUA (ej. ACONDICIONADOR = 0.3 g/L): tasa (en la
  // unidad de la fila) × litros de agua reales, con el redondeo de siempre.
  function porLitroResueltaNativa(componente) {
    if (componente.tipoDosis !== "POR_LITRO_AGUA") return null;
    const tasa = Number(componente.tasa);
    if (!(tasa > 0) || aguaRealLitros == null) return null;
    const valor = tasa * aguaRealLitros;
    return valor > 0 ? redondearEnUnidadPropia(componente, valor) : valor;
  }
  const reguladorRealNativa =
    componenteRegulador && componenteDiluyente
      ? (() => {
          // Si el regulador trae su propia tasa por litro se usa esa; si
          // no, el 0.8 legacy de siempre.
          const propia = porLitroResueltaNativa(componenteRegulador);
          if (propia != null) return propia;
          return calcularReguladorNativa(aguaRealNativa, componenteDiluyente.unidad?.uuid, componenteRegulador.unidad?.uuid);
        })()
      : null;
  function necesariaRealNativa(componente) {
    if (componenteDiluyente && componente === componenteDiluyente) return aguaRealNativa;
    if (componenteRegulador && componente === componenteRegulador) {
      // Editado a mano manda; si no, la tasa de la receta o el 0.8 legacy.
      const ajuste = form.componentesAjustados[componente.articulo?.uuid];
      if (ajuste !== undefined && ajuste !== "") return Number(ajuste);
      if (reguladorRealNativa != null) return reguladorRealNativa;
      return actualNoAutoNativa(componente);
    }
    if (componente.tipoDosis === "POR_LITRO_AGUA") {
      const ajuste = form.componentesAjustados[componente.articulo?.uuid];
      if (ajuste !== undefined && ajuste !== "") return Number(ajuste);
      const propia = porLitroResueltaNativa(componente);
      if (propia != null) return propia;
    }
    return actualNoAutoNativa(componente);
  }

  // Dosis relativas configuradas en la receta (ej. HIPOTENSOR = 1% del
  // ACEITE): seguidorUuid -> { refUuid, pct }. Al editar la referencia a
  // mano, los seguidores se recalculan solos en proporción — pedido
  // explícito. La cantidad ya viene resuelta desde el backend, así que sin
  // ediciones manuales no hay nada que propagar.
  const reglaDosisRef = new Map();
  const unidadNativaPorArticulo = new Map();
  for (const comp of componentesRecetaSeleccionada) {
    const au = comp.articulo?.uuid;
    if (au) unidadNativaPorArticulo.set(au, comp.unidad?.uuid);
    if (comp.referenciaArticuloId && comp.porcentajeReferencia != null) {
      const refArt = componentesRecetaSeleccionada.find((x) => x.articulo?.id === comp.referenciaArticuloId)?.articulo;
      if (refArt?.uuid && au) reglaDosisRef.set(au, { refUuid: refArt.uuid, pct: Number(comp.porcentajeReferencia) });
    }
  }
  // Valor base (sugerido, sin overrides) por artículo — punto de partida
  // para resolver reglas. Agua/PH usan sus valores reales.
  const basePorArticulo = new Map(
    componentesRecetaSeleccionada.map((c) => [c.articulo?.uuid, escenarioReal.necesariaFinalNativa(c)]),
  );
  const diluyenteArticuloUuid = componenteDiluyente?.articulo?.uuid;
  const reguladorArticuloUuid = componenteRegulador?.articulo?.uuid;
  if (diluyenteArticuloUuid) basePorArticulo.set(diluyenteArticuloUuid, aguaRealNativa);
  if (reguladorArticuloUuid && reguladorRealNativa != null) basePorArticulo.set(reguladorArticuloUuid, reguladorRealNativa);
  function valorFinalArticulo(articuloUuid, overrides) {
    const ov = overrides[articuloUuid];
    if (ov !== undefined && ov !== "") return Number(ov);
    return basePorArticulo.get(articuloUuid);
  }
  // Aplica las reglas transitivamente sobre el borrador de overrides (lo
  // muta) y devuelve las uuids tocadas. `excepto` = fila editada directo
  // que es seguidora: conserva su valor, pero sus seguidores sí se mueven.
  // Agua/PH nunca son seguidores (se recalculan solos por su propia
  // lógica). Si lo recalculado coincide con la sugerida, se borra el
  // override en vez de fijarlo (queda limpio y el enlace "usar dosis" no
  // estorba).
  function propagarReglasDosis(overrides, excepto) {
    const tocadas = new Set();
    let cambio = true;
    let guard = 0;
    while (cambio && guard++ < 12) {
      cambio = false;
      for (const [fol, { refUuid, pct }] of reglaDosisRef) {
        if (fol === excepto) continue;
        if (fol === diluyenteArticuloUuid || fol === reguladorArticuloUuid) continue;
        const refVal = valorFinalArticulo(refUuid, overrides);
        if (refVal == null || !Number.isFinite(refVal)) continue;
        const deUuid = unidadNativaPorArticulo.get(refUuid);
        const aUuid = unidadNativaPorArticulo.get(fol);
        const conv =
          deUuid && aUuid && deUuid !== aUuid
            ? convertirCantidad(grafoUnidades, deUuid, aUuid, refVal) ?? refVal
            : refVal;
        if (conv == null || !Number.isFinite(conv)) continue;
        const nuevo = (conv * pct) / 100;
        if (!Number.isFinite(nuevo)) continue;
        const base = basePorArticulo.get(fol);
        if (base != null && Number.isFinite(base) && Math.abs(nuevo - base) < 1e-9) {
          if (overrides[fol] !== undefined) {
            delete overrides[fol];
            tocadas.add(fol);
            cambio = true;
          }
          continue;
        }
        const str = String(Number(nuevo.toFixed(4)));
        if (overrides[fol] !== str) {
          overrides[fol] = str;
          tocadas.add(fol);
          cambio = true;
        }
      }
    }
    return tocadas;
  }
  // Seguidores transitivos de una fila (para limpiar sus textos/overrides
  // cuando cambia su referencia).
  function seguidoresTransitivos(articuloUuid) {
    const inverso = new Map();
    for (const [fol, { refUuid }] of reglaDosisRef) {
      if (!inverso.has(refUuid)) inverso.set(refUuid, []);
      inverso.get(refUuid).push(fol);
    }
    const out = new Set();
    const pila = [articuloUuid];
    while (pila.length) {
      for (const f of inverso.get(pila.pop()) || []) {
        if (!out.has(f)) {
          out.add(f);
          pila.push(f);
        }
      }
    }
    return out;
  }
  // Overrides que el sistema derivó solo por reglas (no el operador) — a
  // esas filas no se les muestra el enlace "usar dosis" como si las
  // hubieran editado a mano.
  const derivadosRegla = (() => {
    const copia = { ...form.componentesAjustados };
    propagarReglasDosis(copia, null);
    return copia;
  })();

  // Existencias de cada insumo en el almacén elegido, para mostrar junto a
  // la cantidad que hace falta (mismo patrón que Elaboraciones).
  useEffect(() => {
    if (!form.almacenUuid || componentesRecetaSeleccionada.length === 0) {
      setExistenciasInsumos({});
      return;
    }
    let cancelado = false;
    Promise.all(
      componentesRecetaSeleccionada.map((c) =>
        apiFetch(`/inventarios/movimientos/existencias?almacenUuid=${form.almacenUuid}&articuloUuid=${c.articulo?.uuid}`)
          .then((res) => [c.articulo?.uuid, res?.[0]?.saldo != null ? Number(res[0].saldo) : 0])
          .catch(() => [c.articulo?.uuid, null]),
      ),
    ).then((pares) => {
      if (!cancelado) setExistenciasInsumos(Object.fromEntries(pares));
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.almacenUuid, mezclaDetalle]);

  async function handleCrear(e) {
    e.preventDefault();
    setFormError("");
    const tipo = Array.isArray(form.tipo) ? form.tipo : form.tipo ? [form.tipo] : [];
    if (tipo.length === 0) {
      setFormError("Marca al menos un tipo de aspersión.");
      return;
    }
    setSaving(true);
    try {
      // Cada insumo se manda con la cantidad REAL (ver necesariaRealNativa:
      // override manual o sugerida, con agua/PH recalculados al final para
      // que el total complete "Cantidad a preparar") — nunca queda
      // desalineado con lo que se ve en pantalla.
      const componentesPayload = componentesRecetaSeleccionada
        .filter((c) => c.articulo?.uuid)
        .map((c) => ({ articuloUuid: c.articulo.uuid, cantidad: necesariaRealNativa(c) }))
        .filter((c) => c.cantidad > 0);

      await apiFetch(editingUuid ? `/aspersiones/${editingUuid}` : "/aspersiones", {
        method: editingUuid ? "PUT" : "POST",
        body: JSON.stringify({
          fincaUuid: form.fincaUuid,
          fecha: form.fecha,
          tipo,
          medio: form.medio,
          mezclaUuid: form.mezclaUuid,
          almacenUuid: form.almacenUuid,
          hectareas: Number(form.hectareas),
          // El backend guarda la cantidad en la unidad de RENDIMIENTO de la
          // mezcla — "Cantidad a preparar" se ve en la unidad preferida del
          // operador (unidadMostradaUuid), acá se reconvierte antes de
          // mandarla.
          cantidad: cantidadAPrepararEnRendimiento,
          componentes: componentesPayload.length ? componentesPayload : undefined,
          representanteCorbanaNombre: form.representanteCorbanaNombre || null,
          administradorFincaNombre: form.administradorFincaNombre || null,
          observaciones: form.observaciones || null,
        }),
      });
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // Actualiza SOLO la fila correspondiente en la lista ya cargada — más
  // inmediato y confiable que refrescar toda la lista con `load()` (que
  // depende de la página/filtros actuales y de que termine antes de que el
  // usuario mire de nuevo la tabla).
  function actualizarFila(actualizada) {
    setItems((prev) => prev.map((it) => (it.uuid === actualizada.uuid ? actualizada : it)));
  }

  async function handleCancelar(aspersion) {
    if (!confirm(`¿Cancelar la aspersión ${aspersion.numero} de la finca ${aspersion.finca?.nombre}?`)) return;
    // El cancelar también manda, en el mismo request, el correo automático
    // de cancelación (ver aspersionProgramacion.service.js#cancelar) — el
    // overlay evita que parezca "colgado" mientras eso termina.
    setProcesandoTexto("Cancelando y notificando...");
    try {
      const actualizada = await apiFetch(`/aspersiones/${aspersion.uuid}/cancelar`, { method: "POST" });
      actualizarFila(actualizada);
      recargarCalendario();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesandoTexto("");
    }
  }

  async function handleEliminar(aspersion) {
    if (!confirm(`¿Eliminar la programación ${aspersion.numero}? Esta acción no se puede deshacer.`)) return;
    setProcesandoTexto("Eliminando...");
    try {
      await apiFetch(`/aspersiones/${aspersion.uuid}`, { method: "DELETE" });
      setItems((prev) => prev.filter((it) => it.uuid !== aspersion.uuid));
      recargarCalendario();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesandoTexto("");
    }
  }

  // Ejecutar: mismo patrón warn+force que el resto del módulo de inventario
  // (stock insuficiente no bloquea de una, se confirma y se reenvía con
  // forzarSaldoNegativo:true).
  // Ejecutar abre un modal para completar los datos del comprobante de
  // aplicación (piloto, hectáreas aplicadas, galones) — al confirmar se
  // ejecuta la aspersión y se guarda el comprobante en BORRADOR (ver
  // Sanidad Vegetal → Comprobante de aspersiones).
  const [ejecutarModal, setEjecutarModal] = useState(null);
  const [stockModal, setStockModal] = useState(null);

  function abrirEjecutar(aspersion) {
    setEjecutarModal({
      aspersion,
      piloto: "",
      hectareasAplicadas: String(Number(aspersion.hectareas)),
      // Galones de la programación (cantidad a preparar llevada a galones),
      // editables si en la aplicación real fueron otros.
      galonesTotales: aspersion.galonesProgramados !== null && aspersion.galonesProgramados !== undefined ? String(aspersion.galonesProgramados) : "",
      observaciones: "",
      error: "",
    });
  }

  async function confirmarEjecutar(e) {
    e.preventDefault();
    const m = ejecutarModal;
    if (!m.piloto.trim()) {
      setEjecutarModal({ ...m, error: "Escribe el nombre del piloto." });
      return;
    }
    const aplicadas = Number(m.hectareasAplicadas);
    if (!(aplicadas > 0)) {
      setEjecutarModal({ ...m, error: "Las hectáreas aplicadas deben ser mayores a 0." });
      return;
    }
    const comprobante = {
      piloto: m.piloto.trim(),
      hectareasAplicadas: aplicadas,
      ...(m.galonesTotales !== "" ? { galonesTotales: Number(m.galonesTotales) } : {}),
      ...(m.observaciones.trim() ? { observaciones: m.observaciones.trim() } : {}),
    };
    setEjecutarModal(null);
    await handleEjecutar(m.aspersion, false, comprobante);
  }

  async function handleEjecutar(aspersion, forzarSaldoNegativo = false, comprobante) {
    setProcesandoTexto("Ejecutando y descontando insumos...");
    try {
      const resultado = await apiFetch(`/aspersiones/${aspersion.uuid}/ejecutar`, {
        method: "POST",
        body: JSON.stringify({ forzarSaldoNegativo, ...(comprobante ? { comprobante } : {}) }),
      });
      if (resultado.requiereConfirmacion) {
        setProcesandoTexto("");
        // Modal amigable (tabla por insumo) en vez del texto crudo.
        setStockModal({ advertencias: resultado.advertencias, aspersion, comprobante });
        return;
      }
      actualizarFila(resultado.aspersion);
      recargarCalendario();
      if (resultado.comprobante?.numero) {
        alert(`Aspersión ejecutada. Se guardó el comprobante ${resultado.comprobante.numero} en borrador (Sanidad Vegetal → Comprobante de aspersiones).`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesandoTexto("");
    }
  }

  // El cargo del administrador de finca no se guarda aparte (ya está en el
  // perfil del usuario, ver User.cargo) — se resuelve buscando, entre los
  // usuarios asignados a esa finca, el que coincide con el nombre guardado
  // en la aspersión.
  async function resolverCargoAdministrador(detalle) {
    if (!detalle.administradorFincaNombre || !detalle.finca?.uuid) return null;
    try {
      const usuarios = await apiFetch(`/aspersiones/fincas/${detalle.finca.uuid}/usuarios`);
      const match = (usuarios || []).find((u) => nombreUsuario(u) === detalle.administradorFincaNombre);
      return match?.cargo || null;
    } catch {
      return null;
    }
  }

  async function handleVerAviso(aspersion) {
    try {
      const detalle = await apiFetch(`/aspersiones/${aspersion.uuid}`);
      const administradorFincaCargo = await resolverCargoAdministrador(detalle);
      verAvisoAspersionPdf({ ...detalle, administradorFincaCargo });
    } catch (err) {
      setError(err.message);
    }
  }

  // Envío directo (sin modal) — igual criterio que "Enviar semana" del
  // Calendario: toma los destinatarios ya configurados (Configuración →
  // Destinatarios, roles filtrados por la finca + usuarios + correos
  // sueltos) y manda de una vez, sin pedirle al operador que los escriba o
  // confirme cada vez que reenvía un aviso.
  async function handleEnviarCorreo(aspersion) {
    setEnviandoCorreoUuid(aspersion.uuid);
    try {
      const sugeridos = await apiFetch(`/aspersiones/${aspersion.uuid}/destinatarios-sugeridos`);
      if (!sugeridos.destinatarios?.length) {
        alert(
          "No hay destinatarios configurados para la finca de esta aspersión — configúralos con el botón de engranaje, arriba, antes de enviar.",
        );
        return;
      }
      const detalle = await apiFetch(`/aspersiones/${aspersion.uuid}`);
      const administradorFincaCargo = await resolverCargoAdministrador(detalle);
      const { blob, nombre } = generarAvisoAspersionPdfBlob({ ...detalle, administradorFincaCargo });
      const formData = new FormData();
      formData.append("pdf", blob, nombre);
      formData.append("destinatarios", sugeridos.destinatarios.join(", "));
      const actualizada = await apiFetchFormData(`/aspersiones/${aspersion.uuid}/correo`, formData);
      actualizarFila(actualizada);
      alert("Aviso enviado por correo correctamente.");
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviandoCorreoUuid(null);
    }
  }

  // "Enviar semana" del Calendario: manda de una sola vez el correo de cada
  // programación de la semana activa que todavía no se le haya enviado
  // (mismo criterio que el ícono de sobre en Programador — `correoEnviadoEn`
  // vacío), tanto PROGRAMADA (aviso) como CANCELADA (notificación de
  // cancelación — al cancelar, `correoEnviadoEn` se reinicia, ver
  // aspersionProgramacion.service.js#cancelar), a los destinatarios ya
  // configurados para la finca de cada una (Configuración → Destinatarios).
  // Además adjunta y manda el Excel del calendario completo a los
  // destinatarios del resumen semanal, en un correo aparte. Las EJECUTADA no
  // aplican — ya se ejecutaron, no hay nada nuevo que avisar.
  async function handleEnviarSemana() {
    if (!semanaActiva) return;
    const pendientes = calendarioItems.filter((a) => a.estado !== "EJECUTADA" && !a.correoEnviadoEn);
    if (pendientes.length === 0) {
      alert("No hay programaciones pendientes de aviso en esta semana.");
      return;
    }
    if (
      !confirm(
        `Se enviará el aviso de ${pendientes.length} programación(es) pendiente(s) de la semana ${semanaActiva.codigo}, además del resumen semanal en Excel. ¿Continuar?`,
      )
    ) {
      return;
    }

    setEnviandoSemana(true);
    const errores = [];
    let enviados = 0;
    try {
      for (const a of pendientes) {
        try {
          const detalle = await apiFetch(`/aspersiones/${a.uuid}`);
          const administradorFincaCargo = await resolverCargoAdministrador(detalle);
          const { blob, nombre } = generarAvisoAspersionPdfBlob({ ...detalle, administradorFincaCargo });
          const sugeridos = await apiFetch(`/aspersiones/${a.uuid}/destinatarios-sugeridos`).catch(() => ({ destinatarios: [] }));
          if (!sugeridos.destinatarios?.length) {
            errores.push(`${a.numero} (${a.finca?.nombre || ""}): sin destinatarios configurados para esa finca`);
            continue;
          }
          const formData = new FormData();
          formData.append("pdf", blob, nombre);
          formData.append("destinatarios", sugeridos.destinatarios.join(", "));
          await apiFetchFormData(`/aspersiones/${a.uuid}/correo`, formData);
          enviados++;
        } catch (err) {
          errores.push(`${a.numero}: ${err.message}`);
        }
      }

      try {
        const { blob, nombre } = await generarExcelCalendarioBlob({ fincasConProgramacion, diasSemana, mapaCalendario, semanaActiva });
        const formData = new FormData();
        formData.append("excel", blob, nombre);
        formData.append("semanaUuid", semanaActiva.uuid);
        await apiFetchFormData("/aspersiones/resumen-semanal/enviar", formData);
      } catch (err) {
        errores.push(`Resumen semanal: ${err.message}`);
      }

      load();
      recargarCalendario();
      const resumen = [`${enviados} aviso(s) enviado(s) correctamente.`];
      if (errores.length) resumen.push(`\nCon problemas:\n${errores.join("\n")}`);
      alert(resumen.join(" "));
    } finally {
      setEnviandoSemana(false);
    }
  }

  return (
    <RequirePermission code="menu.sanidad_vegetal.aspersiones">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1">Programación de Aspersiones</h1>
          <p className="text-secondary mb-0">
            Programa a qué finca, qué día y con qué mezcla se hace la aspersión — la semana, la cantidad a preparar
            (dosis × hectáreas) y el aviso para la finca se calculan solos.
          </p>
        </div>

        {modalDestinatarios && <ModalConfigDestinatarios onClose={() => setModalDestinatarios(false)} />}

        {(enviandoSemana || enviandoCorreoUuid || procesandoTexto) && (
          <OverlayEnviando
            texto={
              procesandoTexto || (enviandoSemana ? "Enviando los correos de la semana..." : "Enviando aviso por correo...")
            }
          />
        )}

        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="btn-group" role="group">
            <button
              type="button"
              className={`btn btn-sm rounded-start-3 ${vista === "programador" ? "btn-brand" : "btn-outline-secondary"}`}
              onClick={() => setVista("programador")}
            >
              Programador
            </button>
            <button
              type="button"
              className={`btn btn-sm rounded-end-3 ${vista === "calendario" ? "btn-brand" : "btn-outline-secondary"}`}
              onClick={() => setVista("calendario")}
            >
              Calendario
            </button>
          </div>
          {esAdmin && (
            <button
              type="button"
              className="btn btn-link p-1 d-inline-flex align-items-center justify-content-center text-secondary"
              onClick={() => setModalDestinatarios(true)}
              title="Configurar destinatarios del correo de aviso y cancelación"
            >
              <FiSettings size={18} />
            </button>
          )}
        </div>

        {vista === "programador" && (
          <>
        <div className="card border-0 rounded-4 mb-3" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="card-body p-3">
            {/* <form>: Enter en cualquier filtro hace lo mismo que el botón
                Filtrar. */}
            <form
              className="row g-2"
              onSubmit={(e) => {
                e.preventDefault();
                aplicarFiltros();
              }}
            >
              <div className="col-6 col-md">
                <label className="form-label small mb-1">Semana</label>
                <BuscadorSemana
                  semanas={semanas}
                  value={filtros.semanaUuid}
                  onChange={(uuid) => setFiltros((f) => ({ ...f, semanaUuid: uuid }))}
                  className="form-control form-control-sm rounded-3"
                />
              </div>
              <div className="col-6 col-md">
                <label className="form-label small mb-1">Día</label>
                <input
                  type="date"
                  className="form-control form-control-sm rounded-3"
                  value={filtros.fecha}
                  onChange={(e) => setFiltros((f) => ({ ...f, fecha: e.target.value }))}
                />
              </div>
              <div className="col-6 col-md">
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
              <div className="col-6 col-md">
                <label className="form-label small mb-1">Mezcla</label>
                <select
                  className="form-select form-select-sm rounded-3"
                  value={filtros.mezclaUuid}
                  onChange={(e) => setFiltros((f) => ({ ...f, mezclaUuid: e.target.value }))}
                >
                  <option value="">Todas</option>
                  {mezclas.map((m) => (
                    <option key={m.uuid} value={m.uuid}>
                      {m.nombre || m.codigo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-6 col-md">
                <label className="form-label small mb-1">Estado</label>
                <div className="d-flex gap-2">
                  <select
                    className="form-select form-select-sm rounded-3"
                    value={filtros.estado}
                    onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}
                  >
                    <option value="">Todos</option>
                    <option value="PROGRAMADA">Programada</option>
                    <option value="EJECUTADA">Ejecutada</option>
                    <option value="CANCELADA">Cancelada</option>
                  </select>
                  <button type="submit" className="btn btn-brand btn-sm rounded-3 flex-shrink-0">
                    Filtrar
                  </button>
                  {(filtros.fincaUuid || filtros.semanaUuid || filtros.mezclaUuid || filtros.estado || filtros.fecha) && (
                    <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 flex-shrink-0" onClick={limpiarFiltros}>
                      Limpiar
                    </button>
                  )}
                </div>
              </div>
            </form>
            <div className="d-flex justify-content-end gap-2 mt-3">
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary rounded-3 d-flex align-items-center gap-2"
                  disabled={items.length === 0}
                  onClick={() => descargarExcelProgramador(items)}
                >
                  <FiDownload /> Excel
                </button>
                {hasPermission("sanidad_vegetal.aspersiones.crear") && (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary rounded-3 d-flex align-items-center gap-2"
                    onClick={openCargueModal}
                    title="Programar varias aspersiones desde un archivo Excel/CSV"
                  >
                    <FiUploadCloud /> Cargue masivo
                  </button>
                )}
                {hasPermission("sanidad_vegetal.aspersiones.crear") && (
                  <button type="button" className="btn btn-sm btn-brand rounded-3 d-flex align-items-center gap-2" onClick={openCreate}>
                    <FiPlus /> Programar aspersión
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 rounded-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle">
              <thead>
                <tr className="table-light small text-secondary" style={{ borderBottom: "1px solid #e9ecef" }}>
                  <th className="fw-medium">Número</th>
                  <th className="fw-medium">Finca</th>
                  <th className="fw-medium">Fecha</th>
                  <th className="fw-medium">Semana</th>
                  <th className="fw-medium">Mezcla</th>
                  <th className="fw-medium">Hectáreas</th>
                  <th className="fw-medium">Cantidad</th>
                  <th className="fw-medium">Estado</th>
                  <th className="fw-medium text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="text-center text-secondary py-3 small">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-secondary py-3 small">
                      No hay aspersiones programadas todavía.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((a) => {
                    const info = ESTADO_INFO[a.estado] || ESTADO_INFO.PROGRAMADA;
                    return (
                      <tr key={a.uuid}>
                        <td className="small fw-medium">{a.numero}</td>
                        <td className="small">{a.finca?.nombre || "—"}</td>
                        <td className="small text-secondary">{a.fecha}</td>
                        <td className="small text-secondary">{a.semana?.codigo || "—"}</td>
                        <td className="small text-secondary">{a.mezcla?.nombre || a.mezcla?.codigo || "—"}</td>
                        <td className="small text-secondary">{Number(a.hectareas).toFixed(2)}</td>
                        <td className="small text-secondary">
                          {Number(a.cantidadCalculada).toFixed(2)} {a.mezcla?.unidadRendimiento?.simbolo || ""}
                        </td>
                        <td className="small">
                          <span className="badge rounded-pill small" style={{ backgroundColor: info.bg, color: info.color }}>
                            {info.label}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex justify-content-end gap-1 flex-nowrap">
                            <button
                              type="button"
                              className="btn btn-sm btn-link p-1 d-inline-flex text-secondary"
                              title="Ver aviso PDF"
                              onClick={() => handleVerAviso(a)}
                            >
                              <FiEye size={15} />
                            </button>
                            {hasPermission("sanidad_vegetal.aspersiones.enviar_correo") && (
                              <button
                                type="button"
                                className="btn btn-sm btn-link p-1 d-inline-flex"
                                style={{ color: a.correoEnviadoEn ? "#16a34a" : undefined }}
                                title={
                                  a.correoEnviadoEn
                                    ? `Aviso enviado el ${new Date(a.correoEnviadoEn).toLocaleString("es-CO")} — enviar de nuevo`
                                    : "Enviar aviso por correo"
                                }
                                disabled={enviandoCorreoUuid === a.uuid}
                                onClick={() => handleEnviarCorreo(a)}
                              >
                                <FiMail size={15} className={a.correoEnviadoEn ? "" : "text-secondary"} />
                              </button>
                            )}
                            {a.estado === "PROGRAMADA" && hasPermission("sanidad_vegetal.aspersiones.editar") && (
                              <button
                                type="button"
                                className="btn btn-sm btn-link p-1 d-inline-flex text-secondary"
                                title="Editar"
                                onClick={() => openEdit(a)}
                              >
                                <FiEdit2 size={15} />
                              </button>
                            )}
                            {a.estado === "PROGRAMADA" && hasPermission("sanidad_vegetal.aspersiones.ejecutar") && (
                              <button
                                type="button"
                                className="btn btn-sm btn-link p-1 d-inline-flex"
                                style={{ color: "#166534" }}
                                title="Marcar como ejecutada (descuenta insumos)"
                                onClick={() => abrirEjecutar(a)}
                              >
                                <FiCheck size={15} />
                              </button>
                            )}
                            {a.estado === "PROGRAMADA" && hasPermission("sanidad_vegetal.aspersiones.eliminar") && (
                              <button
                                type="button"
                                className="btn btn-sm btn-link p-1 d-inline-flex text-secondary"
                                title="Cancelar"
                                onClick={() => handleCancelar(a)}
                              >
                                <FiX size={15} />
                              </button>
                            )}
                            {a.estado === "PROGRAMADA" && !a.correoEnviadoEn && hasPermission("sanidad_vegetal.aspersiones.eliminar") && (
                              <button
                                type="button"
                                className="btn btn-sm btn-link p-1 d-inline-flex"
                                style={{ color: "#dc2626" }}
                                title="Eliminar"
                                onClick={() => handleEliminar(a)}
                              >
                                <FiTrash2 size={15} />
                              </button>
                            )}
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
            Mostrando página {meta.page} de {meta.totalPages} ({meta.total} programación(es))
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
          </>
        )}

        {vista === "calendario" && (
          <div className="card border rounded-4" style={{ borderColor: "#e5e7eb" }}>
            <div className="card-body p-3 p-md-4">
              {/* Navegación de semana — minimalista: flechas finas a los
                  lados del código de semana, rango de fechas debajo, "Hoy"
                  aparte a la derecha. Nada de botones grandes tipo
                  "Semana anterior"/"Semana siguiente". */}
              <div className="d-flex align-items-center justify-content-center position-relative mb-4">
                {/* Buscar una semana específica en vez de navegar de a una
                    — reusa el mismo combo de semanas ya cargado para los
                    filtros del Programador. */}
                <div className="position-absolute start-0" style={{ width: "9rem" }}>
                  <BuscadorSemana
                    semanas={semanas}
                    value={semanaActivaUuid || ""}
                    onChange={(uuid) => uuid && setSemanaActivaUuid(uuid)}
                    className="form-control form-control-sm rounded-3"
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-link text-secondary p-1"
                  disabled={!semanaActiva || semanas.findIndex((s) => s.uuid === semanaActivaUuid) <= 0}
                  onClick={() => irSemana(-1)}
                  aria-label="Semana anterior"
                >
                  <FiChevronLeft size={18} />
                </button>
                <div className="text-center mx-3">
                  <div className="fw-bold" style={{ color: "#166534" }}>
                    {semanaActiva?.codigo || "—"}
                  </div>
                  <div className="small text-secondary">
                    {semanaActiva ? formatRangoSemana(semanaActiva.fechaInicio, semanaActiva.fechaFin) : ""}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-link text-secondary p-1"
                  disabled={!semanaActiva || semanas.findIndex((s) => s.uuid === semanaActivaUuid) >= semanas.length - 1}
                  onClick={() => irSemana(1)}
                  aria-label="Semana siguiente"
                >
                  <FiChevronRight size={18} />
                </button>
                <div className="d-flex gap-2 position-absolute end-0">
                  {hasPermission("sanidad_vegetal.aspersiones.enviar_correo") && (
                    <button
                      type="button"
                      className="btn btn-sm btn-brand rounded-3 d-flex align-items-center gap-1"
                      disabled={enviandoSemana || calendarioItems.length === 0}
                      title="Envía el aviso de cada programación pendiente de esta semana y el resumen semanal en Excel"
                      onClick={handleEnviarSemana}
                    >
                      <FiSend size={14} /> {enviandoSemana ? "Enviando..." : "Enviar semana"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary rounded-3 d-flex align-items-center gap-1"
                    disabled={calendarioItems.length === 0}
                    onClick={() => descargarExcelCalendario({ fincasConProgramacion, diasSemana, mapaCalendario, semanaActiva })}
                  >
                    <FiDownload size={14} /> Excel
                  </button>
                  <button type="button" className="btn btn-sm btn-outline-secondary rounded-3" onClick={irSemanaActual}>
                    Hoy
                  </button>
                </div>
              </div>

              {!calendarioLoading && fincasConProgramacion.length === 0 ? (
                // Regla de negocio: si la semana no tiene ninguna
                // programación, no se muestra una tabla con filas vacías
                // (ni el catálogo completo de fincas) — solo un estado
                // vacío limpio.
                <div className="text-center py-5">
                  <FiCalendar className="mb-2 text-secondary" size={28} />
                  <p className="fw-medium mb-1">No hay aspersiones programadas</p>
                  <p className="small text-secondary mb-0">No existen programaciones para esta semana.</p>
                </div>
              ) : (
                <>
                  <div className="table-responsive">
                    <table className="table table-sm mb-0 align-middle" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
                      <thead>
                        {/* Mismo verde institucional que la banda del PDF
                            del aviso (ver lib/aspersionExport.js#VERDE,
                            #166534). */}
                        <tr>
                          <th
                            className="small fw-medium py-2 text-center align-middle"
                            style={{
                              position: "sticky",
                              left: 0,
                              backgroundColor: "#166534",
                              color: "#fff",
                              zIndex: 2,
                              minWidth: "10rem",
                              borderTopLeftRadius: "0.75rem",
                            }}
                          >
                            Finca
                          </th>
                          {diasSemana.map((d, i) => (
                            <th
                              key={d.iso}
                              className="py-2 text-center align-middle"
                              style={{
                                minWidth: "7.5rem",
                                backgroundColor: "#166534",
                                color: "#fff",
                                borderTopRightRadius: i === diasSemana.length - 1 ? "0.75rem" : undefined,
                              }}
                            >
                              <div className="small fw-medium">{d.nombre}</div>
                              <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.75)" }}>
                                {d.numero} {MES_ABREV[d.mes]}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {calendarioLoading && (
                          <tr>
                            <td colSpan={8} className="text-center text-secondary py-4 small">
                              Cargando...
                            </td>
                          </tr>
                        )}
                        {!calendarioLoading &&
                          fincasConProgramacion.map((finca) => (
                            <tr key={finca.uuid}>
                              <td
                                className="small fw-medium border-bottom text-center"
                                style={{ position: "sticky", left: 0, backgroundColor: "#fff", zIndex: 1 }}
                              >
                                {finca.nombre}
                              </td>
                              {diasSemana.map((d) => {
                                const items = mapaCalendario.get(`${finca.uuid}:${d.iso}`) || [];
                                const MAX_VISIBLE = 2;
                                const visibles = items.slice(0, MAX_VISIBLE);
                                const restantes = items.length - visibles.length;
                                return (
                                  <td key={d.iso} className="border-bottom text-center">
                                    {items.length > 0 && (
                                      <div className="d-flex flex-column align-items-center gap-1">
                                        {visibles.map((it) => {
                                          const nombreMezcla = it.mezcla?.nombre || it.mezcla?.codigo || "—";
                                          const cancelada = it.estado === "CANCELADA";
                                          const info = ESTADO_INFO[it.estado] || ESTADO_INFO.PROGRAMADA;
                                          return (
                                            <div
                                              key={it.uuid}
                                              className="d-flex align-items-center justify-content-center gap-1"
                                              style={{ fontSize: "0.72rem", maxWidth: "100%" }}
                                              title={`${nombreMezcla} — ${info.label}`}
                                            >
                                              <info.Icono size={11} className="flex-shrink-0" style={{ color: info.color }} />
                                              <span
                                                className={`text-truncate ${cancelada ? "text-secondary" : "text-body"}`}
                                                style={{ textDecoration: cancelada ? "line-through" : "none" }}
                                              >
                                                {nombreMezcla}
                                              </span>
                                            </div>
                                          );
                                        })}
                                        {restantes > 0 && (
                                          <div className="text-secondary" style={{ fontSize: "0.68rem" }}>
                                            +{restantes} más
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="d-flex flex-wrap align-items-center gap-3 mt-3 pt-3 border-top small text-secondary">
                    {Object.entries(ESTADO_INFO).map(([key, info]) => (
                      <span key={key} className="d-flex align-items-center gap-1">
                        <info.Icono size={13} style={{ color: info.color }} />
                        {info.label}
                      </span>
                    ))}
                    <span className="ms-auto">
                      Total programaciones en la semana: <strong className="text-body">{calendarioItems.length}</strong>
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {modalOpen && (
          <ModalShell title={editingUuid ? "Editar aspersión" : "Programar aspersión"} onClose={() => setModalOpen(false)} width="90vw">
            <form onSubmit={handleCrear}>
              <div className="row g-2 mb-2">
                <div className="col-3">
                  <label className="form-label small fw-medium mb-1">
                    Almacén de origen <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select form-select-sm rounded-3"
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
                <div className="col-3">
                  <label className="form-label small fw-medium mb-1">
                    Fecha <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control form-control-sm rounded-3"
                    required
                    value={form.fecha}
                    onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                  />
                </div>
                <div className="col-3">
                  <label className="form-label small fw-medium mb-1">Semana</label>
                  <input
                    type="text"
                    className="form-control form-control-sm rounded-3 text-secondary"
                    disabled
                    value={
                      !form.fecha
                        ? ""
                        : semanaPreview === null
                          ? "Calculando..."
                          : semanaPreview
                            ? semanaPreview.codigo
                            : "Sin semana generada"
                    }
                  />
                </div>
                <div className="col-3">
                  <label className="form-label small fw-medium mb-1">
                    Finca <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select form-select-sm rounded-3"
                    required
                    value={form.fincaUuid}
                    onChange={(e) => setForm((f) => ({ ...f, fincaUuid: e.target.value, administradorFincaUuid: "", administradorFincaNombre: "" }))}
                  >
                    <option value="">Selecciona...</option>
                    {fincas.map((f) => (
                      <option key={f.uuid} value={f.uuid}>
                        {f.nombre} ({f.codigo})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="row g-2 mb-2">
                <div className="col-4">
                  <label className="form-label small fw-medium mb-1">
                    Mezcla <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select form-select-sm rounded-3"
                    required
                    value={form.mezclaUuid}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, mezclaUuid: e.target.value, aumentoManual: "", volumenHaManual: "", componentesAjustados: {} }));
                      setTextosCantidadAjustada({});
                    }}
                  >
                    <option value="">Selecciona...</option>
                    {mezclas.map((m) => (
                      <option key={m.uuid} value={m.uuid}>
                        {m.nombre || m.codigo} ({Number(m.dosisPorHectarea).toFixed(2)} {m.dosisPorHectareaUnidad?.simbolo || m.unidadRendimiento?.simbolo}/ha)
                      </option>
                    ))}
                  </select>
                  {mezclas.length === 0 && (
                    <p className="form-text small text-warning mb-0">
                      No hay mezclas con volumen por hectárea configurado — editalo en Mezclas.
                    </p>
                  )}
                </div>
                <div className="col-2">
                  <label className="form-label small fw-medium mb-1">Volumen / ha</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-control rounded-start-3"
                      disabled={!mezclaSeleccionada}
                      placeholder={mezclaSeleccionada ? Number(mezclaSeleccionada.dosisPorHectarea || 0).toFixed(2) : ""}
                      value={form.volumenHaManual}
                      onChange={(e) => {
                        // Igual que con hectáreas: las cantidades por fila son
                        // absolutas — al cambiar el volumen se vuelve a la
                        // receta en vez de dejar valores viejos.
                        setTextosCantidadAjustada((t) => (Object.keys(t).length ? {} : t));
                        setForm((f) => ({
                          ...f,
                          volumenHaManual: e.target.value,
                          componentesAjustados: Object.keys(f.componentesAjustados).length ? {} : f.componentesAjustados,
                        }));
                      }}
                    />
                    {mezclaSeleccionada && (
                      <span className="input-group-text small">{mezclaSeleccionada.dosisPorHectareaUnidad?.simbolo}</span>
                    )}
                  </div>
                  {mezclaSeleccionada && form.volumenHaManual !== "" && (
                    <p className="form-text small mb-0">
                      De mezcla: {Number(mezclaSeleccionada.dosisPorHectarea || 0).toFixed(2)}{" "}
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 align-baseline"
                        onClick={() => setForm((f) => ({ ...f, volumenHaManual: "" }))}
                      >
                        usar de mezcla
                      </button>
                    </p>
                  )}
                </div>
                <div className="col-2">
                  <label className="form-label small fw-medium mb-1">
                    Hectáreas <span className="text-danger">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    className="form-control form-control-sm rounded-3"
                    value={form.hectareas}
                    onChange={(e) => {
                      // Al cambiar hectáreas se vuelve a la receta: los
                      // ajustes manuales por fila son cantidades ABSOLUTAS
                      // para las hectáreas anteriores y quedarían congelados
                      // (obligando a ir fila por fila a "usar dosis") —
                      // pedido explícito: cada insumo (salvo agua/PH, que se
                      // recalculan solos) sigue la receta de una vez, con el
                      // redondeo de siempre.
                      setTextosCantidadAjustada((t) => (Object.keys(t).length ? {} : t));
                      setForm((f) => ({
                        ...f,
                        hectareas: e.target.value,
                        componentesAjustados: Object.keys(f.componentesAjustados).length ? {} : f.componentesAjustados,
                      }));
                    }}
                  />
                </div>
                <div className="col-2">
                  <label className="form-label small fw-medium mb-1 d-flex align-items-center gap-1">
                    Aumento
                    <FiInfo
                      size={13}
                      className="text-secondary"
                      title="Se sugiere solo: busca que el insumo principal quede lo más cerca posible de 110% de su dosis máxima por hectárea sin pasarse (mínimo 100%, hasta un máximo de 10% de aumento); los demás insumos van en proporción al principal, sin tope. Si el redondeo no permite caer en ese rango, prioriza no quedar por debajo de 100%. El operador lo puede subir o bajar a mano."
                    />
                  </label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      className="form-control rounded-start-3"
                      disabled={!mezclaSeleccionada}
                      placeholder={mezclaSeleccionada ? Number(porcentajeAumentoAutomatico || 0).toFixed(2) : ""}
                      value={form.aumentoManual}
                      onChange={(e) => {
                        // Igual que con hectáreas: el % es relativo y los
                        // ajustes por fila son absolutos — al re-sugerir se
                        // vuelve a la receta en vez de dejar valores viejos.
                        setTextosCantidadAjustada((t) => (Object.keys(t).length ? {} : t));
                        setForm((f) => ({
                          ...f,
                          aumentoManual: e.target.value,
                          componentesAjustados: Object.keys(f.componentesAjustados).length ? {} : f.componentesAjustados,
                        }));
                      }}
                    />
                    <span className="input-group-text small">%</span>
                  </div>
                  {mezclaSeleccionada && form.aumentoManual !== "" && (
                    <p className="form-text small mb-0">
                      Sugerido: {Number(porcentajeAumentoAutomatico || 0).toFixed(2)}%{" "}
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 align-baseline"
                        onClick={() => setForm((f) => ({ ...f, aumentoManual: "" }))}
                      >
                        usar sugerido
                      </button>
                    </p>
                  )}
                </div>
                <div className="col-2">
                  <label className="form-label small fw-medium mb-1">Cantidad a preparar</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="text"
                      disabled
                      className="form-control rounded-start-3"
                      value={mezclaSeleccionada && hectareasNum > 0 ? String(cantidadAPrepararRedondeada) : ""}
                      readOnly
                    />
                    {unidadesVolumen.length > 0 ? (
                      <select
                        className="form-select flex-grow-0 flex-shrink-0 w-auto"
                        title="Unidad de volumen preferida — se guarda en este computador"
                        value={unidadMostradaUuid || ""}
                        onChange={(e) => cambiarUnidadPreferida(e.target.value)}
                      >
                        {!unidadMostradaUuid && <option value="">{unidadCantidadSimbolo || "—"}</option>}
                        {unidadesVolumen.map((u) => (
                          <option key={u.uuid} value={u.uuid}>
                            {u.simbolo}
                          </option>
                        ))}
                      </select>
                    ) : (
                      mezclaSeleccionada && <span className="input-group-text small">{unidadCantidadSimbolo}</span>
                    )}
                  </div>
                </div>
              </div>

              {mezclaSeleccionada && componentesRecetaSeleccionada.length > 0 && (() => {
                // Factor TEÓRICO puro — dosis × hectáreas sin ningún ajuste
                // manual (ni el del total "Cantidad a preparar" ni el de una
                // línea), igual que calcularComponentesReceta() en el
                // backend. Es la referencia "de fábrica" que se muestra
                // siempre, sin importar qué se haya ajustado.
                const factorTeorico = rendimientoSeleccionado > 0 ? cantidadSugeridaEnRendimiento / rendimientoSeleccionado : 0;

                // Dosis realmente aplicada por hectárea, por insumo — se
                // parte de "cantidad necesaria" (ya escalada a lo que se va
                // a preparar) y se reparte entre las hectáreas de esta
                // aspersión; se convierte a la unidad en la que está
                // configurada la dosis máxima del artículo (categoría
                // INSUMO, ver articulo.model.js#dosisPorHectarea) para
                // poder compararlas.
                // Todas las unidades (volumen + peso) hacia las que se
                // puede convertir una unidad nativa dada — para el selector
                // de unidad por fila. Siempre incluye la nativa.
                function unidadesCompatiblesCon(unidadNativaUuid) {
                  return [...unidadesVolumen, ...unidadesPeso].filter(
                    (u) => u.uuid === unidadNativaUuid || convertirCantidad(grafoUnidades, unidadNativaUuid, u.uuid, 1) !== null
                  );
                }

                // El % de dosis del principal (calculado una sola vez más
                // arriba) ya viene incluido en necesariaFinalNativa() para
                // todos los insumos con dosis propia — se comparte con lo
                // que se manda al guardar, para que la tabla y el descuento
                // de inventario nunca queden desalineados (y además ajusta
                // el diluyente para que la suma total cuadre exactamente
                // con "Cantidad a preparar").
                const filas = componentesRecetaSeleccionada.map((c) => {
                  const articuloUuid = c.articulo?.uuid;
                  const necesariaTeorica = Number(c.cantidad) * factorTeorico;
                  // Dosis relativa configurada en la receta (ej. "1% de
                  // ACEITE BANOLE") — la cantidad ya viene resuelta desde el
                  // backend; acá solo se informa con insignia.
                  const refArticuloDosisRelativa = c.referenciaArticuloId
                    ? componentesRecetaSeleccionada.find((x) => x.articulo?.id === c.referenciaArticuloId)?.articulo
                    : null;
                  const dosisRelativaTexto =
                    c.porcentajeReferencia != null && refArticuloDosisRelativa
                      ? `${Number(c.porcentajeReferencia)}% de ${refArticuloDosisRelativa.nombre}`
                      : null;
                  // Tasa por volumen configurada en la receta (ej. "1 g/Gal"):
                  // la cantidad se calcula con el total a preparar.
                  const dosisVolumenTexto = (() => {
                    if (c.tipoDosis !== "POR_VOLUMEN" || c.tasa == null) return null;
                    const tasaUnidad = [...unidadesVolumen, ...unidadesPeso].find((u) => u.id === c.tasaUnidadId);
                    if (!tasaUnidad) return null;
                    return `${Number(c.tasa)} ${c.unidad?.simbolo || ""}/${tasaUnidad.simbolo}`;
                  })();
                  // Tasa por litro de agua configurada en la receta (ej.
                  // "0,3 g/L"): la cantidad se calcula con el agua real.
                  const dosisLitroAguaTexto =
                    c.tipoDosis === "POR_LITRO_AGUA" && c.tasa != null
                      ? `${Number(c.tasa)} ${c.unidad?.simbolo || ""}/L`
                      : null;
                  // Sugerida (base de proporción, sin overrides) y REAL (con
                  // override si lo hay; agua/PH recalculados al final para
                  // que el total complete "Cantidad a preparar").
                  const necesariaSugeridaRedondeada = escenarioReal.necesariaFinalNativa(c);
                  const necesaria = necesariaRealNativa(c);
                  // Solo el Agua es intocable (rellena el total). El
                  // ACONDICIONADOR se calcula solo (tasa de la receta o 0.8
                  // g/L del agua) pero SE PUEDE editar a mano — pedido
                  // explícito; "usar dosis" lo devuelve al automático.
                  const esAutomatico = c === componenteDiluyente;
                  const esRegulador = c === componenteRegulador;

                  const disponible = existenciasInsumos[articuloUuid];
                  const insuficiente = disponible != null && disponible < necesaria;

                  const dosisRef = dosisRefComponente(c);
                  const dosisMaxima = dosisRef?.dosisMaxima ?? null;
                  const dosisEsDelRenglon = dosisRef?.esDelRenglon === true;
                  const unidadDosisMaximaUuid = dosisRef?.unidadUuid;
                  const unidadDosisMaximaSimbolo = dosisRef?.simbolo || "";
                  const unidadRecetaUuid = c.unidad?.uuid;
                  const dosisAplicadaEnUnidadReceta = hectareasNum > 0 ? necesaria / hectareasNum : 0;
                  const dosisAplicada =
                    dosisMaxima != null && unidadDosisMaximaUuid && unidadRecetaUuid && unidadDosisMaximaUuid !== unidadRecetaUuid
                      ? convertirCantidad(grafoUnidades, unidadRecetaUuid, unidadDosisMaximaUuid, dosisAplicadaEnUnidadReceta) ?? dosisAplicadaEnUnidadReceta
                      : dosisAplicadaEnUnidadReceta;
                  const excedeDosis = dosisMaxima != null && hectareasNum > 0 && dosisAplicada > dosisMaxima;

                  // Valores para MOSTRAR (y editar) en pantalla — por
                  // defecto en la unidad propia de la receta de ESTE
                  // insumo (pedido explícito: respetar la unidad de cada
                  // producto, no forzarlos todos a la unidad global de
                  // "Cantidad a preparar"), salvo que el usuario haya
                  // elegido otra unidad para esta fila en particular. El
                  // número que realmente se guarda/manda (`necesaria`,
                  // `necesariaTeorica`) sigue siempre en la unidad nativa.
                  // El Agua se muestra por defecto en galones (si hay conversión).
                  const galonAgua = c === componenteAgua ? unidadesVolumen.find((u) => u.nombre === "Galón") : null;
                  const aguaEnGalones =
                    galonAgua && unidadRecetaUuid && convertirCantidad(grafoUnidades, unidadRecetaUuid, galonAgua.uuid, 1) !== null
                      ? galonAgua.uuid
                      : null;
                  const unidadFilaUuid = unidadesPorFila[articuloUuid] || aguaEnGalones || unidadPropiaDe(c) || unidadRecetaUuid;
                  // Convierte a la unidad elegida para esta fila SIN redondear —
                  // se usa para la columna Receta (exacta con dos decimales,
                  // pedido explícito) y para que los TOTALES cuadren con
                  // "Cantidad a preparar".
                  function aUnidadFilaExacta(cantidadNativa) {
                    if (!unidadRecetaUuid || !unidadFilaUuid || unidadFilaUuid === unidadRecetaUuid) return cantidadNativa;
                    return convertirCantidad(grafoUnidades, unidadRecetaUuid, unidadFilaUuid, cantidadNativa) ?? cantidadNativa;
                  }
                  // Cantidad necesaria: misma conversión pero redondeada al
                  // paso MÁS CERCANO (0.5, 0.1 para ACONDICIONADOR) — no
                  // siempre hacia arriba (pedido explícito: 0,81 Kg no debe
                  // mostrarse como 0,90 Kg). Sin redondeo, un valor ya
                  // limpio en la unidad global dejaba de verse "limpio" al
                  // convertirlo a la unidad propia de la fila (ej. 105 Gal
                  // -> 397.47 L en vez de 397.5 L).
                  function aUnidadFila(cantidadNativa) {
                    const convertida = aUnidadFilaExacta(cantidadNativa);
                    if (!(convertida > 0)) return convertida;
                    return c === componenteRegulador ? Math.round(convertida * 10) / 10 : Math.round(convertida / 0.5) * 0.5;
                  }
                  const simboloDisplay =
                    unidadesVolumen.find((u) => u.uuid === unidadFilaUuid)?.simbolo ||
                    unidadesPeso.find((u) => u.uuid === unidadFilaUuid)?.simbolo ||
                    c.unidad?.simbolo ||
                    "";

                  return {
                    c,
                    articuloUuid,
                    necesaria,
                    necesariaSugeridaRedondeada,
                    esAutomatico,
                    esRegulador,
                    disponible,
                    insuficiente,
                    dosisMaxima,
                    unidadDosisMaximaSimbolo: dosisRef?.simbolo || "",
                    dosisEsDelRenglon,
                    dosisAplicada,
                    excedeDosis,
                    // Columna Receta: valor teórico EXACTO con dos decimales
                    // (pedido explícito) — sin el redondeo a 0.5, que solo
                    // aplica a "Cantidad necesaria".
                    teoricaDisplayValor: aUnidadFilaExacta(necesariaTeorica),
                    necesariaDisplayValor: aUnidadFila(necesaria),
                    // Valor exacto (sin redondeo de pantalla) en la unidad de
                    // la fila — solo para que los TOTALES cuadren con
                    // "Cantidad a preparar" (sumar los mostrados, ya
                    // redondeados a 0.5 por fila, dejaba descuadres como
                    // 99.96 vs 100).
                    necesariaExactaFilaValor: aUnidadFilaExacta(necesaria),
                    dosisRelativaTexto,
                    dosisVolumenTexto,
                    dosisLitroAguaTexto,
                    simboloDisplay,
                    unidadRecetaUuid,
                    unidadFilaUuid,
                    unidadesCompatiblesFila: unidadesCompatiblesCon(unidadRecetaUuid),
                  };
                });

                // Totales de "Receta" y "Cantidad necesaria" — pedido
                // explícito: los insumos de VOLUMEN (Litros, Galones...) se
                // suman TODOS juntos en una sola fila, convertidos a la
                // unidad de "Cantidad a preparar" (sin importar en qué
                // unidad esté mostrada cada fila individualmente), porque
                // son la misma magnitud física. Los de PESO (Kg) son una
                // magnitud distinta — no se pueden sumar con volumen — así
                // que se agrupan aparte, por su propio símbolo.
                const simboloVolumenTotal =
                  unidadesVolumen.find((u) => u.uuid === unidadMostradaUuid)?.simbolo || unidadCantidadSimbolo || "";
                const totalVolumen = { teorica: 0, ajustada: 0 };
                let hayFilasVolumen = false;
                const totalesPorUnidad = new Map();
                for (const f of filas) {
                  const esVolumen = unidadesVolumen.some((u) => u.uuid === f.unidadFilaUuid);
                  if (esVolumen && unidadMostradaUuid) {
                    hayFilasVolumen = true;
                    const aVolumenTotal = (valor) =>
                      f.unidadFilaUuid === unidadMostradaUuid
                        ? valor
                        : convertirCantidad(grafoUnidades, f.unidadFilaUuid, unidadMostradaUuid, valor) ?? valor;
                    totalVolumen.teorica += aVolumenTotal(f.teoricaDisplayValor);
                    totalVolumen.ajustada += aVolumenTotal(f.necesariaExactaFilaValor);
                  } else {
                    const simbolo = f.simboloDisplay;
                    const acc = totalesPorUnidad.get(simbolo) || { teorica: 0, ajustada: 0 };
                    acc.teorica += f.teoricaDisplayValor;
                    acc.ajustada += f.necesariaExactaFilaValor;
                    totalesPorUnidad.set(simbolo, acc);
                  }
                }

                return (
                  <div className="mb-2 p-2 rounded-3" style={{ backgroundColor: "#f8f9fa" }}>
                    <p className="small fw-medium mb-1">Insumos que componen la mezcla (a esta cantidad)</p>
                    <div className="table-responsive rounded-3 overflow-hidden">
                      <table className="table table-sm mb-0">
                        <thead>
                          {/* El fondo va en cada celda, no en el <tr>: Bootstrap
                              pinta background-color por celda
                              (.table > :not(caption) > * > *), que tapa
                              cualquier color puesto en el <tr> padre. */}
                          <tr className="small">
                            <th style={{ backgroundColor: "var(--brand-900)", color: "#fff" }}>Insumo</th>
                            <th style={{ minWidth: "6.5rem", backgroundColor: "var(--brand-900)", color: "#fff" }}>Receta</th>
                            <th style={{ minWidth: "6rem", backgroundColor: "var(--brand-900)", color: "#fff" }}>Cantidad necesaria</th>
                            <th className="text-end" style={{ backgroundColor: "var(--brand-900)", color: "#fff" }}>Disponible</th>
                            <th className="text-end" style={{ backgroundColor: "var(--brand-900)", color: "#fff" }}>Dosis por hectárea</th>
                            <th className="text-end" style={{ backgroundColor: "var(--brand-900)", color: "#fff" }}>% sobre dosis</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filas.map(
                            ({
                              c,
                              articuloUuid,
                              disponible,
                              insuficiente,
                              dosisMaxima,
                              unidadDosisMaximaSimbolo,
                              dosisAplicada,
                              excedeDosis,
                              teoricaDisplayValor,
                              necesariaDisplayValor,
                              dosisRelativaTexto,
                              dosisVolumenTexto,
                              dosisLitroAguaTexto,
                              dosisEsDelRenglon,
                              simboloDisplay,
                              unidadRecetaUuid,
                              unidadFilaUuid,
                              unidadesCompatiblesFila,
                              esAutomatico,
                              esRegulador,
                            }) => (
                              <tr key={c.uuid}>
                                <td className="small">
                                  {c.articulo?.nombre || "—"}
                                  {c.esPrincipal && (
                                    <span className="badge bg-brand rounded-pill ms-2" style={{ fontSize: "0.65rem" }}>
                                      Principal
                                    </span>
                                  )}
                                  {dosisRelativaTexto && (
                                    <span className="badge bg-info rounded-pill ms-2" style={{ fontSize: "0.65rem" }} title="Dosis relativa configurada en la receta: este insumo es el X% del insumo de referencia">
                                      {dosisRelativaTexto}
                                    </span>
                                  )}
                                  {dosisVolumenTexto && (
                                    <span className="badge bg-info rounded-pill ms-2" style={{ fontSize: "0.65rem" }} title="Dosis por volumen configurada en la receta: se calcula con el total a preparar">
                                      {dosisVolumenTexto}
                                    </span>
                                  )}
                                  {dosisLitroAguaTexto && (
                                    <span className="badge bg-info rounded-pill ms-2" style={{ fontSize: "0.65rem" }} title="Dosis por litro de agua configurada en la receta: se calcula con el agua real">
                                      {dosisLitroAguaTexto}
                                    </span>
                                  )}
                                </td>
                                <td className="small text-secondary">
                                  {teoricaDisplayValor.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {simboloDisplay}
                                  {/* El enlace solo sale si ESTA fila se editó a
                                      mano (tiene override) — antes salía siempre
                                      que el sugerido (con % aumento y redondeo)
                                      difiriera de la receta, así que cambiar
                                      hectáreas lo prendía en todas las filas
                                      aunque nadie hubiera tocado nada. */}
                                  {!esAutomatico &&
                                    form.componentesAjustados[articuloUuid] !== undefined &&
                                    form.componentesAjustados[articuloUuid] !== "" &&
                                    (!reglaDosisRef.has(articuloUuid) ||
                                      derivadosRegla[articuloUuid] !== form.componentesAjustados[articuloUuid]) && (
                                    <>
                                      {" "}
                                      <button
                                        type="button"
                                        className="btn btn-link btn-sm p-0 align-baseline"
                                        onClick={() => {
                                          // "usar dosis": descarta el ajuste manual
                                          // de la fila y vuelve a la dosis
                                          // sugerida (receta + % aumento +
                                          // redondeo). Si es el principal, se
                                          // resetea toda la tabla para no dejar
                                          // proporciones viejas colgadas. Los
                                          // seguidores de dosis relativa se
                                          // re-derivan de su referencia (si la
                                          // fila era seguidora, vuelve al X%
                                          // de su referencia actual).
                                          setForm((f) => {
                                            const next = { ...f.componentesAjustados };
                                            delete next[articuloUuid];
                                            if (c.esPrincipal) {
                                              for (const ff of filas) {
                                                if (!ff.esAutomatico) delete next[ff.articuloUuid];
                                              }
                                            }
                                            propagarReglasDosis(next, null);
                                            return { ...f, componentesAjustados: next };
                                          });
                                          setTextosCantidadAjustada((t) => {
                                            const next = { ...t };
                                            delete next[articuloUuid];
                                            if (c.esPrincipal) {
                                              for (const ff of filas) {
                                                if (ff.articuloUuid !== articuloUuid && !ff.esAutomatico) {
                                                  delete next[ff.articuloUuid];
                                                }
                                              }
                                            } else {
                                              for (const u of seguidoresTransitivos(articuloUuid)) delete next[u];
                                            }
                                            return next;
                                          });
                                        }}
                                      >
                                        usar dosis
                                      </button>
                                    </>
                                  )}
                                </td>
                                <td className="small">
                                  <div className="input-group input-group-sm" style={{ width: "9rem" }}>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0.01"
                                      disabled={esAutomatico}
                                      title={
                                        esAutomatico
                                          ? "Se recalcula solo (Agua completa la cantidad a preparar)"
                                          : esRegulador
                                            ? "Se calcula solo (tasa de la receta o 0.8 g por litro de agua); editable a mano"
                                            : undefined
                                      }
                                      className="form-control rounded-start-3 px-1"
                                      style={{ minWidth: "4.5rem" }}
                                      value={textosCantidadAjustada[articuloUuid] ?? necesariaDisplayValor.toFixed(2)}
                                      onChange={(e) => {
                                        const escrito = e.target.value;
                                        // Lo que escribe el operador está en la
                                        // unidad MOSTRADA (simboloDisplay) — se
                                        // convierte a la unidad nativa del
                                        // insumo antes de guardarlo, para no
                                        // desalinear lo que se ve de lo que
                                        // realmente se descuenta del inventario.
                                        const aNativo = (num) =>
                                          unidadFilaUuid && unidadFilaUuid !== unidadRecetaUuid
                                            ? convertirCantidad(grafoUnidades, unidadFilaUuid, unidadRecetaUuid, num) ?? num
                                            : num;
                                        // Si se edita el PRINCIPAL, los demás
                                        // insumos (no automáticos) se mueven en
                                        // su misma proporción — pedido
                                        // explícito. Agua y ACONDICIONADOR se
                                        // recalculan solos, no se tocan.
                                        const esEdicionPrincipal = c.esPrincipal;
                                        if (escrito === "") {
                                          // Vaciar el principal resetea toda
                                          // la tabla al sugerido (los
                                          // overrides viejos quedarían
                                          // desproporcionados).
                                          setTextosCantidadAjustada((t) => {
                                            const next = { ...t };
                                            delete next[articuloUuid];
                                            if (esEdicionPrincipal) {
                                              for (const ff of filas) {
                                                if (!ff.esAutomatico) delete next[ff.articuloUuid];
                                              }
                                            } else {
                                              // Si cambió una referencia, sus
                                              // seguidores muestran el valor
                                              // recalculado (se les borra el
                                              // texto crudo viejo).
                                              for (const u of seguidoresTransitivos(articuloUuid)) delete next[u];
                                            }
                                            return next;
                                          });
                                          setForm((f) => {
                                            if (!esEdicionPrincipal) {
                                              const next = { ...f.componentesAjustados, [articuloUuid]: "" };
                                              // La referencia vacía vuelve a la
                                              // sugerida y arrastra a sus
                                              // seguidores.
                                              propagarReglasDosis(next, articuloUuid);
                                              return { ...f, componentesAjustados: next };
                                            }
                                            const next = { ...f.componentesAjustados };
                                            for (const ff of filas) {
                                              if (!ff.esAutomatico) delete next[ff.articuloUuid];
                                            }
                                            return { ...f, componentesAjustados: next };
                                          });
                                          return;
                                        }
                                        const numEscrito = Number(escrito);
                                        if (Number.isNaN(numEscrito)) return;
                                        const nativo = aNativo(numEscrito);
                                        // Se guarda el texto tal cual se está
                                        // escribiendo (para que borrar un
                                        // dígito se vea reflejado de una vez,
                                        // en vez de que el valor derivado
                                        // ".toFixed(2)" lo reemplace de
                                        // inmediato) — se sincroniza con
                                        // componentesAjustados en paralelo.
                                        setTextosCantidadAjustada((t) => {
                                          const next = { ...t, [articuloUuid]: escrito };
                                          // Las filas arrastradas por el
                                          // principal muestran su nuevo valor
                                          // derivado (se les borra el texto
                                          // crudo viejo).
                                          if (esEdicionPrincipal) {
                                            for (const ff of filas) {
                                              if (ff.articuloUuid !== articuloUuid && !ff.esAutomatico) {
                                                delete next[ff.articuloUuid];
                                              }
                                            }
                                          } else {
                                            for (const u of seguidoresTransitivos(articuloUuid)) delete next[u];
                                          }
                                          return next;
                                        });
                                        setForm((f) => {
                                          const next = { ...f.componentesAjustados, [articuloUuid]: String(nativo) };
                                          if (esEdicionPrincipal) {
                                            const sugeridaPrincipal = filas.find(
                                              (ff) => ff.articuloUuid === articuloUuid,
                                            )?.necesariaSugeridaRedondeada;
                                            if (sugeridaPrincipal > 0) {
                                              const ratio = nativo / sugeridaPrincipal;
                                              for (const ff of filas) {
                                                if (ff.articuloUuid === articuloUuid || ff.esAutomatico || ff.esRegulador) continue;
                                                // Los por-litro siguen al agua, no al principal.
                                                if (ff.c?.tipoDosis === "POR_LITRO_AGUA") continue;
                                                if (ff.necesariaSugeridaRedondeada != null) {
                                                  next[ff.articuloUuid] = (ff.necesariaSugeridaRedondeada * ratio).toFixed(4);
                                                }
                                              }
                                            }
                                          }
                                          // Dosis relativas: los seguidores de
                                          // la fila editada se recalculan
                                          // (X% de su referencia). La fila
                                          // editada conserva su valor aunque
                                          // sea seguidora.
                                          propagarReglasDosis(next, articuloUuid);
                                          return { ...f, componentesAjustados: next };
                                        });
                                      }}
                                      onBlur={() => {
                                        // Al salir del campo se vuelve a mostrar
                                        // el valor formateado/derivado (2
                                        // decimales) en vez del texto crudo.
                                        setTextosCantidadAjustada((t) => {
                                          const next = { ...t };
                                          delete next[articuloUuid];
                                          return next;
                                        });
                                      }}
                                    />
                                    {unidadesCompatiblesFila.length > 1 ? (
                                      <select
                                        className="form-select form-select-sm px-1 rounded-end-3"
                                        style={{ minWidth: "3.5rem" }}
                                        value={unidadFilaUuid}
                                        onChange={(e) => {
                                          setUnidadesPorFila((prev) => ({ ...prev, [articuloUuid]: e.target.value }));
                                          // El texto crudo que se estaba mostrando
                                          // quedaba en la unidad anterior — se
                                          // limpia para que se recalcule en la
                                          // unidad nueva (necesariaDisplayValor).
                                          setTextosCantidadAjustada((t) => {
                                            const next = { ...t };
                                            delete next[articuloUuid];
                                            return next;
                                          });
                                        }}
                                      >
                                        {unidadesCompatiblesFila.map((u) => (
                                          <option key={u.uuid} value={u.uuid}>{u.simbolo}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className="input-group-text small px-1">{simboloDisplay}</span>
                                    )}
                                  </div>
                                </td>
                              <td className={`small text-end ${insuficiente ? "text-danger fw-medium" : "text-secondary"}`}>
                                {disponible != null ? disponible.toLocaleString("es-CO", { maximumFractionDigits: 2 }) : "—"}
                              </td>
                              <td className={`small text-end ${excedeDosis ? "text-danger fw-medium" : "text-secondary"}`}>
                                {dosisMaxima != null ? (
                                  <>
                                    {dosisAplicada.toLocaleString("es-CO", { maximumFractionDigits: 2 })} / {dosisMaxima.toLocaleString("es-CO", { maximumFractionDigits: 2 })} {unidadDosisMaximaSimbolo}
                                    {dosisEsDelRenglon && (
                                      <span className="badge bg-info rounded-pill ms-1" style={{ fontSize: "0.65rem" }} title="Dosis de referencia de ESTA receta (manda sobre la del artículo)">
                                        R
                                      </span>
                                    )}
                                    {excedeDosis && <FiAlertTriangle className="ms-1 mb-1" size={12} />}
                                  </>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className={`small text-end ${excedeDosis ? "text-danger fw-medium" : "text-secondary"}`}>
                                {dosisMaxima != null && dosisMaxima > 0 ? (
                                  <>
                                    {((dosisAplicada / dosisMaxima) * 100).toLocaleString("es-CO", { maximumFractionDigits: 0 })}%
                                    {excedeDosis && <FiAlertTriangle className="ms-1 mb-1" size={12} />}
                                  </>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          {hayFilasVolumen && (
                            <tr className="small fw-medium">
                              <td style={{ backgroundColor: "var(--brand-900)", color: "#fff" }}>
                                Total{simboloVolumenTotal ? ` (${simboloVolumenTotal})` : ""}
                              </td>
                              <td style={{ backgroundColor: "var(--brand-900)", color: "#fff" }}>
                                {totalVolumen.teorica.toLocaleString("es-CO", { maximumFractionDigits: 2 })} {simboloVolumenTotal}
                              </td>
                              <td style={{ backgroundColor: "var(--brand-900)", color: "#fff" }}>
                                {totalVolumen.ajustada.toLocaleString("es-CO", { maximumFractionDigits: 2 })} {simboloVolumenTotal}
                              </td>
                              <td style={{ backgroundColor: "var(--brand-900)" }} />
                              <td style={{ backgroundColor: "var(--brand-900)" }} />
                              <td style={{ backgroundColor: "var(--brand-900)" }} />
                            </tr>
                          )}
                          {[...totalesPorUnidad.entries()].map(([simbolo, { teorica, ajustada }]) => (
                            <tr key={simbolo || "sin-unidad"} className="small fw-medium">
                              <td style={{ backgroundColor: "var(--brand-900)", color: "#fff" }}>Total{simbolo ? ` (${simbolo})` : ""}</td>
                              <td style={{ backgroundColor: "var(--brand-900)", color: "#fff" }}>{teorica.toLocaleString("es-CO", { maximumFractionDigits: 2 })} {simbolo}</td>
                              <td style={{ backgroundColor: "var(--brand-900)", color: "#fff" }}>{ajustada.toLocaleString("es-CO", { maximumFractionDigits: 2 })} {simbolo}</td>
                              <td style={{ backgroundColor: "var(--brand-900)" }} />
                              <td style={{ backgroundColor: "var(--brand-900)" }} />
                              <td style={{ backgroundColor: "var(--brand-900)" }} />
                            </tr>
                          ))}
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })()}

              <div className="row g-2 mb-2">
                <div className="col-8">
                  <label className="form-label small fw-medium mb-1">
                    Tipo de aspersión <span className="text-danger">*</span>
                  </label>
                  {/* Checkboxes en vez de select — mismo formato que el
                      aviso en papel (SIGATOKA NEGRA / DEFOLIADOR /
                      FERTILIZACIÓN), y se puede marcar más de una casilla a
                      la vez (pedido explícito). Todas en una sola línea. */}
                  <div className="d-flex flex-nowrap align-items-center gap-4" style={{ height: "31px" }}>
                    {Object.entries(TIPO_LABEL).map(([valor, label]) => (
                      <div className="form-check mb-0" key={valor}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id={`tipo-${valor}`}
                          checked={Array.isArray(form.tipo) && form.tipo.includes(valor)}
                          onChange={(e) =>
                            setForm((f) => {
                              // Defensivo: si `tipo` llegara a ser un string
                              // (ej. estado viejo sobreviviendo un Fast
                              // Refresh de Next.js), spread sobre él lo
                              // descompondría letra por letra en vez de
                              // tratarlo como un solo valor.
                              const actuales = Array.isArray(f.tipo) ? f.tipo : f.tipo ? [f.tipo] : [];
                              return {
                                ...f,
                                tipo: e.target.checked ? [...actuales, valor] : actuales.filter((t) => t !== valor),
                              };
                            })
                          }
                        />
                        <label className="form-check-label small text-nowrap" htmlFor={`tipo-${valor}`}>
                          {label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="col-4">
                  <label className="form-label small fw-medium mb-1">
                    Medio <span className="text-danger">*</span>
                  </label>
                  {/* Radio, no checkbox — selección única, nunca los dos a
                      la vez (pedido explícito, a diferencia de "Tipo de
                      aspersión" que sí admite varios). */}
                  <div className="d-flex flex-nowrap align-items-center gap-4" style={{ height: "31px" }}>
                    {[
                      ["AVION", "Avión"],
                      ["DRON", "Dron"],
                    ].map(([valor, label]) => (
                      <div className="form-check mb-0" key={valor}>
                        <input
                          type="radio"
                          className="form-check-input"
                          name="aspersion-medio"
                          id={`medio-${valor}`}
                          required
                          checked={form.medio === valor}
                          onChange={() => setForm((f) => ({ ...f, medio: valor }))}
                        />
                        <label className="form-check-label small text-nowrap" htmlFor={`medio-${valor}`}>
                          {label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="row g-2 mb-2">
                <div className="col-6">
                  <label className="form-label small fw-medium mb-1">Representante Corbana</label>
                  <input type="text" className="form-control form-control-sm rounded-3" value={form.representanteCorbanaNombre} disabled />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium mb-1">Administrador de finca</label>
                  {usuariosFinca.length > 0 ? (
                    <select
                      className="form-select form-select-sm rounded-3"
                      value={form.administradorFincaUuid || (guardadoFueraDeLista ? "__guardado__" : "")}
                      onChange={(e) => {
                        const uuid = e.target.value;
                        if (uuid === "__guardado__") return;
                        const usuario = usuariosFinca.find((u) => u.uuid === uuid);
                        setForm((f) => ({ ...f, administradorFincaUuid: uuid, administradorFincaNombre: usuario ? nombreUsuario(usuario) : "" }));
                      }}
                    >
                      <option value="">Selecciona...</option>
                      {guardadoFueraDeLista && (
                        <option value="__guardado__">{form.administradorFincaNombre} (guardado)</option>
                      )}
                      {usuariosFinca.map((u) => (
                        <option key={u.uuid} value={u.uuid}>
                          {nombreUsuario(u)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="form-control form-control-sm rounded-3"
                      placeholder={cargandoUsuariosFinca ? "Cargando..." : form.fincaUuid ? "Sin usuarios asignados a esta finca" : "Elige primero la finca"}
                      value={form.administradorFincaNombre}
                      onChange={(e) => setForm((f) => ({ ...f, administradorFincaNombre: e.target.value }))}
                    />
                  )}
                </div>
                <div className="col-12">
                  <label className="form-label small fw-medium mb-1">Observaciones</label>
                  <textarea
                    className="form-control form-control-sm rounded-3"
                    rows={2}
                    value={form.observaciones}
                    onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
                  />
                </div>
              </div>

              {formError && <div className="alert alert-danger py-2 small mb-3">{formError}</div>}

              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary rounded-3" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-brand rounded-3" disabled={saving}>
                  {saving ? "Guardando..." : editingUuid ? "Guardar cambios" : "Programar"}
                </button>
              </div>
            </form>
          </ModalShell>
        )}

        {stockModal && (
          <StockInsuficienteModal
            advertencias={stockModal.advertencias}
            onCancelar={() => setStockModal(null)}
            onContinuar={async () => {
              const { aspersion, comprobante } = stockModal;
              setStockModal(null);
              await handleEjecutar(aspersion, true, comprobante);
            }}
            textoContinuar="Ejecutar de todas formas"
          />
        )}

        {ejecutarModal && (
          <ModalShell title="Ejecutar aspersión" onClose={() => setEjecutarModal(null)} width="32rem">
            <form onSubmit={confirmarEjecutar}>
              <p className="small text-secondary mb-3">
                Completa los datos de la aplicación. Se descontarán los insumos y se guardará el{" "}
                <strong>comprobante de aplicación en borrador</strong>.
              </p>
              <div className="rounded-3 p-2 mb-3 small" style={{ backgroundColor: "#f0fdf4" }}>
                <div><strong>{ejecutarModal.aspersion.numero}</strong> · {ejecutarModal.aspersion.finca?.nombre}</div>
                <div className="text-secondary">
                  {ejecutarModal.aspersion.mezcla?.nombre || ejecutarModal.aspersion.mezcla?.codigo} ·{" "}
                  {ejecutarModal.aspersion.medio === "DRON" ? "Dron" : ejecutarModal.aspersion.medio === "AVION" ? "Avión" : "—"} ·{" "}
                  {Number(ejecutarModal.aspersion.hectareas)} ha programadas
                </div>
              </div>
              {ejecutarModal.error && <div className="alert alert-danger py-2 small">{ejecutarModal.error}</div>}
              <div className="row g-2 mb-2">
                <div className="col-12">
                  <label className="form-label small fw-medium mb-1">
                    Piloto del {ejecutarModal.aspersion.medio === "DRON" ? "dron" : "avión"} *
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-sm rounded-3"
                    value={ejecutarModal.piloto}
                    maxLength={150}
                    autoFocus
                    onChange={(e) => setEjecutarModal((m) => ({ ...m, piloto: e.target.value }))}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium mb-1">Hectáreas aplicadas *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    className="form-control form-control-sm rounded-3"
                    value={ejecutarModal.hectareasAplicadas}
                    onChange={(e) => setEjecutarModal((m) => ({ ...m, hectareasAplicadas: e.target.value }))}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium mb-1">Galones totales de la mezcla</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control form-control-sm rounded-3"
                    placeholder="Sin conversión"
                    value={ejecutarModal.galonesTotales}
                    onChange={(e) => setEjecutarModal((m) => ({ ...m, galonesTotales: e.target.value }))}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label small fw-medium mb-1">Observaciones</label>
                  <textarea
                    className="form-control form-control-sm rounded-3"
                    rows={2}
                    maxLength={1000}
                    value={ejecutarModal.observaciones}
                    onChange={(e) => setEjecutarModal((m) => ({ ...m, observaciones: e.target.value }))}
                  />
                </div>
              </div>
              <div className="d-flex justify-content-end gap-2 mt-3">
                <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => setEjecutarModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-brand btn-sm rounded-3">
                  Ejecutar y generar comprobante
                </button>
              </div>
            </form>
          </ModalShell>
        )}

        {cargueModalOpen && (
          <ModalShell title="Cargue masivo de aspersiones" onClose={() => setCargueModalOpen(false)} width="45rem">
            <p className="small text-secondary mb-3">
              Sube un archivo .xlsx o .csv con <strong>una fila por vuelo</strong>. Columnas: <strong>medio</strong> (AVION/DRON),{" "}
              <strong>almacen</strong>, <strong>fecha</strong>, <strong>finca</strong>, <strong>observaciones</strong> (opcional),{" "}
              <strong>hectareas</strong>, <strong>tipo</strong> (opcional, SIGATOKA_NEGRA por defecto) y{" "}
              <strong>mezcla</strong> (código o nombre de una mezcla activa, o la lista de insumos de su receta en formato{" "}
              &quot;INSUMO1 | INSUMO2 | ...&quot; — igual que la columna &quot;Insumos de la receta&quot; de la pestaña de Mezclas y de la hoja
              &quot;Mezclas&quot; de la plantilla, desde donde se puede copiar y pegar). Si una fila trae una mezcla que no existe, esa fila queda reportada como
              error y el resto del archivo se procesa igual.
            </p>

            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2 mb-3"
              onClick={descargarPlantillaAspersiones}
            >
              <FiDownload /> Descargar plantilla (con todas las fincas activas)
            </button>

            <input
              ref={inputCargueRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="form-control rounded-3 mb-1"
              onChange={handleElegirArchivo}
            />
            <p className="small text-secondary mb-3">
              {cargueArchivo ? (
                <>
                  Archivo seleccionado: <strong className="text-body">{cargueArchivo.name}</strong>
                </>
              ) : (
                "Ningún archivo seleccionado."
              )}
            </p>

            {cargueError && <div className="alert alert-danger py-2 small">{cargueError}</div>}

            {cargueResultado && (
              <div className="alert alert-success py-2 small">
                Cargue terminado — aspersiones creadas: {cargueResultado.aspersionesCreadas} de {cargueResultado.totalFilas} fila(s).
                {cargueResultado.errores?.length > 0 && (
                  <>
                    <div className="mt-2 fw-medium" style={{ color: "#b45309" }}>
                      {cargueResultado.errores.length} fila(s) con error:
                    </div>
                    <ul className="mb-0 ps-3">
                      {cargueResultado.errores.map((err, idx) => (
                        <li key={idx}>
                          Fila {err.fila}: {err.mensaje}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            <div className="d-flex justify-content-end gap-2 mt-3">
              <button type="button" className="btn btn-outline-secondary rounded-3" onClick={() => setCargueModalOpen(false)}>
                Cerrar
              </button>
              <button
                type="button"
                className="btn btn-brand rounded-3"
                disabled={!cargueArchivo || cargando}
                onClick={handleSubirCargue}
              >
                {cargando ? "Cargando..." : "Subir y procesar"}
              </button>
            </div>
          </ModalShell>
        )}

      </div>
    </RequirePermission>
  );
}

function nombreCompletoUsuario(u) {
  return `${u.nombre} ${u.apellido}`.trim();
}

// Configura quién recibe el correo de Programación de Aspersiones (aviso al
// enviar y notificación al cancelar) además del destinatario puntual que se
// escoge al momento de enviar el aviso — mismo patrón que "Destinatarios de
// las alertas por correo" (sanidad-vegetal/alertas/page.js), con la
// diferencia de que acá los roles sí se filtran por finca (ver nota abajo).
function ModalConfigDestinatarios({ onClose }) {
  const [roles, setRoles] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [correosTexto, setCorreosTexto] = useState("");
  const [rolesSel, setRolesSel] = useState([]);
  const [usuariosSel, setUsuariosSel] = useState([]);
  const [correosResumenTexto, setCorreosResumenTexto] = useState("");
  const [rolesResumenSel, setRolesResumenSel] = useState([]);
  const [usuariosResumenSel, setUsuariosResumenSel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch("/roles?limit=100").catch(() => ({ items: [] })),
      apiFetch("/users?limit=100").catch(() => ({ items: [] })),
      apiFetch("/aspersiones/destinatarios"),
      apiFetch("/aspersiones/resumen-semanal/destinatarios"),
    ])
      .then(([rolesRes, usuariosRes, destRes, resumenRes]) => {
        const rolesItems = rolesRes.items || [];
        const usuariosItems = usuariosRes.items || [];
        setRoles(rolesItems);
        setUsuarios(usuariosItems);
        setCorreosTexto((destRes.correos || []).join(", "));
        setRolesSel(
          rolesItems
            .filter((r) => (destRes.rolesUuids || []).includes(r.uuid))
            .map((r) => ({ uuid: r.uuid, label: r.nombre })),
        );
        setUsuariosSel(
          usuariosItems
            .filter((u) => (destRes.usuariosUuids || []).includes(u.uuid))
            .map((u) => ({ uuid: u.uuid, label: nombreCompletoUsuario(u), sublabel: u.email })),
        );
        setCorreosResumenTexto((resumenRes.correos || []).join(", "));
        setRolesResumenSel(
          rolesItems
            .filter((r) => (resumenRes.rolesUuids || []).includes(r.uuid))
            .map((r) => ({ uuid: r.uuid, label: r.nombre })),
        );
        setUsuariosResumenSel(
          usuariosItems
            .filter((u) => (resumenRes.usuariosUuids || []).includes(u.uuid))
            .map((u) => ({ uuid: u.uuid, label: nombreCompletoUsuario(u), sublabel: u.email })),
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleGuardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError("");
    setGuardado(false);
    try {
      const correos = correosTexto
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      const correosResumen = correosResumenTexto
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      await Promise.all([
        apiFetch("/aspersiones/destinatarios", {
          method: "PUT",
          body: JSON.stringify({
            correos,
            rolesUuids: rolesSel.map((r) => r.uuid),
            usuariosUuids: usuariosSel.map((u) => u.uuid),
          }),
        }),
        apiFetch("/aspersiones/resumen-semanal/destinatarios", {
          method: "PUT",
          body: JSON.stringify({
            correos: correosResumen,
            rolesUuids: rolesResumenSel.map((r) => r.uuid),
            usuariosUuids: usuariosResumenSel.map((u) => u.uuid),
          }),
        }),
      ]);
      setGuardado(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ModalShell title="Destinatarios del correo de aspersiones" onClose={onClose} size="lg">
      <p className="small text-secondary mb-3">
        Estos destinatarios se agregan en copia cada vez que se envía el aviso de una aspersión, y reciben
        automáticamente la notificación cuando una aspersión se cancela.
      </p>
      <p className="small text-secondary mb-3">
        <strong>Los roles se filtran por finca:</strong> solo reciben el correo los usuarios de ese rol que tengan
        habilitada la finca de la programación (o que no tengan ninguna finca asignada, es decir que ven todas). Los
        correos sueltos y los usuarios puntuales siempre reciben, sin importar la finca.
      </p>

      {loading ? (
        <p className="text-secondary small mb-0">Cargando...</p>
      ) : (
        <form onSubmit={handleGuardar}>
          {error && <div className="alert alert-danger py-2 small">{error}</div>}

          <label className="form-label small fw-medium">Correos sueltos</label>
          <input
            type="text"
            className="form-control"
            placeholder="correo1@ejemplo.com, correo2@ejemplo.com"
            value={correosTexto}
            onChange={(e) => {
              setCorreosTexto(e.target.value);
              setGuardado(false);
            }}
          />
          <p className="form-text small text-secondary mb-0">Uno o varios correos separados por coma.</p>

          <div className="mt-3">
            <label className="form-label small fw-medium">Roles (filtrados por finca)</label>
            <TagPicker
              items={roles.map((r) => ({ uuid: r.uuid, label: r.nombre }))}
              selected={rolesSel}
              onChange={(nuevos) => {
                setRolesSel(nuevos);
                setGuardado(false);
              }}
              placeholder="Buscar rol para agregar..."
            />
          </div>

          <div className="mt-3">
            <label className="form-label small fw-medium">Usuarios en copia</label>
            <TagPicker
              items={usuarios.map((u) => ({ uuid: u.uuid, label: nombreCompletoUsuario(u), sublabel: u.email }))}
              selected={usuariosSel}
              onChange={(nuevos) => {
                setUsuariosSel(nuevos);
                setGuardado(false);
              }}
              placeholder="Buscar usuario para agregar..."
            />
          </div>

          <hr className="my-4" />

          <h3 className="h6 fw-bold mb-2">Resumen semanal (Excel)</h3>
          <p className="small text-secondary mb-3">
            Quién recibe, al usar el botón <strong>&ldquo;Enviar semana&rdquo;</strong> del Calendario, el Excel con
            toda la programación de la semana — sin filtrar por finca, es un solo archivo con todas las fincas.
          </p>

          <label className="form-label small fw-medium">Correos sueltos</label>
          <input
            type="text"
            className="form-control"
            placeholder="correo1@ejemplo.com, correo2@ejemplo.com"
            value={correosResumenTexto}
            onChange={(e) => {
              setCorreosResumenTexto(e.target.value);
              setGuardado(false);
            }}
          />

          <div className="mt-3">
            <label className="form-label small fw-medium">Roles</label>
            <TagPicker
              items={roles.map((r) => ({ uuid: r.uuid, label: r.nombre }))}
              selected={rolesResumenSel}
              onChange={(nuevos) => {
                setRolesResumenSel(nuevos);
                setGuardado(false);
              }}
              placeholder="Buscar rol para agregar..."
            />
          </div>

          <div className="mt-3">
            <label className="form-label small fw-medium">Usuarios</label>
            <TagPicker
              items={usuarios.map((u) => ({ uuid: u.uuid, label: nombreCompletoUsuario(u), sublabel: u.email }))}
              selected={usuariosResumenSel}
              onChange={(nuevos) => {
                setUsuariosResumenSel(nuevos);
                setGuardado(false);
              }}
              placeholder="Buscar usuario para agregar..."
            />
          </div>

          <div className="d-flex gap-2 mt-4">
            <button type="submit" className="btn btn-brand rounded-3 flex-grow-1" disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" className="btn btn-outline-secondary rounded-3" onClick={onClose}>
              Cerrar
            </button>
          </div>
          {guardado && <p className="small text-success mb-0 mt-2">Guardado.</p>}
        </form>
      )}
    </ModalShell>
  );
}

// Overlay a pantalla completa con spinner — se muestra mientras se envía un
// correo (individual o el lote de "Enviar semana"), en vez de un spinner
// chiquito dentro del botón, para que quede claro que el envío toma un rato
// (genera PDFs, sube archivos) y no se puede seguir interactuando mientras
// tanto.
function OverlayEnviando({ texto }) {
  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ background: "rgba(15, 23, 42, 0.45)", zIndex: 1080 }}
    >
      <div className="bg-white rounded-4 shadow-lg p-4 d-flex flex-column align-items-center gap-3" style={{ minWidth: 260 }}>
        <div className="spinner-border" style={{ color: "#166534" }} role="status" />
        <p className="mb-0 small fw-medium text-secondary text-center">{texto}</p>
      </div>
    </div>
  );
}
