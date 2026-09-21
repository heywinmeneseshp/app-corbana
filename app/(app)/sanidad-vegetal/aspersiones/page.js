"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { FiPlus, FiTrash2, FiX, FiCheck, FiMail, FiDownload, FiEye, FiChevronLeft, FiChevronRight, FiCalendar, FiClock, FiCheckCircle, FiXCircle, FiSettings, FiSend, FiAlertTriangle } from "react-icons/fi";
import { apiFetch, apiFetchFormData } from "@/lib/api";
import { hasPermission, getCurrentUser } from "@/lib/auth";
import { esAdministrador } from "@/lib/laborEstados";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";
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
    // Se precarga con la dosis configurada en la mezcla, pero el operador
    // la puede corregir a mano para esta aspersión puntual (ej. una
    // recomendación distinta para esa finca) — ver el useEffect de
    // sincronización más abajo.
    dosisPorHectarea: "",
    dosisEditadaManualmente: false,
    hectareas: "",
    // Se sugiere sola (dosis × hectáreas) apenas se elige mezcla/hectáreas,
    // pero el operador la puede corregir a mano (ej. redondear al tamaño
    // real del tanque) — ver el useEffect de sincronización más abajo.
    cantidad: "",
    cantidadEditadaManualmente: false,
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
  const [usuariosFinca, setUsuariosFinca] = useState([]);
  const [cargandoUsuariosFinca, setCargandoUsuariosFinca] = useState(false);
  const [semanaPreview, setSemanaPreview] = useState(null);

  const [enviandoCorreoUuid, setEnviandoCorreoUuid] = useState(null);
  const [enviandoSemana, setEnviandoSemana] = useState(false);
  const [procesandoTexto, setProcesandoTexto] = useState("");

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
      const [fincasRes, mezclasRes, almacenesRes, semanasRes, conversionesRes, unidadesVolumenRes] = await Promise.all([
        apiFetch("/fincas?limit=100&soloOperativas=true"),
        apiFetch("/inventarios/mezclas?limit=100"),
        apiFetch("/inventarios/almacenes?limit=100&estado=true"),
        apiFetch(`/semanas?anio=${anioActual}&limit=100`),
        apiFetch("/inventarios/unidades/conversiones"),
        apiFetch("/inventarios/unidades?tipo=VOLUMEN&estado=true&limit=100"),
      ]);
      setConversiones(Array.isArray(conversionesRes) ? conversionesRes : conversionesRes.items || []);
      setUnidadesVolumen(unidadesVolumenRes.items || []);
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
        const anterior = ultimas.items?.[0];
        if (anterior?.administradorFincaNombre) {
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

  function openCreate() {
    setForm(emptyForm());
    setUsuariosFinca([]);
    setSemanaPreview(null);
    setMezclaDetalle(null);
    setExistenciasInsumos({});
    setFormError("");
    setModalOpen(true);
  }

  const mezclaSeleccionada = mezclas.find((m) => m.uuid === form.mezclaUuid);
  const hectareasNum = Number(form.hectareas) || 0;
  // La cantidad "real" que espera el backend (y con la que se escala la
  // receta) va SIEMPRE en la unidad de RENDIMIENTO de la mezcla — es la
  // misma que usa aspersionProgramacion.service.js#ejecutar
  // (factor = cantidadCalculada / rendimiento). Acá se calcula esa base
  // (convirtiendo desde la unidad de la dosis si hace falta, igual que el
  // backend en #calcularCantidad) y LUEGO se convierte a la unidad que el
  // operador prefiere ver/editar (ver unidadPreferidaUuid más abajo) — el
  // campo del formulario siempre queda expresado en esa unidad "mostrada".
  // La dosis por hectárea usada para el cálculo es la del FORMULARIO (se
  // precarga con la de la mezcla, pero el operador la puede editar para
  // esta aspersión puntual) — ver el useEffect de sincronización más abajo.
  const dosisPorHectareaNum = form.dosisPorHectarea !== "" ? Number(form.dosisPorHectarea) : Number(mezclaSeleccionada?.dosisPorHectarea || 0);
  const cantidadEnUnidadDosis = mezclaSeleccionada ? dosisPorHectareaNum * hectareasNum : 0;
  const unidadDosisUuid = mezclaSeleccionada?.dosisPorHectareaUnidad?.uuid;
  const unidadRendimientoUuid = mezclaSeleccionada?.unidadRendimiento?.uuid;
  const cantidadSugeridaEnRendimiento =
    mezclaSeleccionada && unidadDosisUuid && unidadRendimientoUuid && unidadDosisUuid !== unidadRendimientoUuid
      ? convertirCantidad(grafoUnidades, unidadDosisUuid, unidadRendimientoUuid, cantidadEnUnidadDosis) ?? cantidadEnUnidadDosis
      : cantidadEnUnidadDosis;

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

  const cantidadSugerida =
    unidadMostradaUuid && unidadRendimientoUuid && unidadMostradaUuid !== unidadRendimientoUuid
      ? convertirCantidad(grafoUnidades, unidadRendimientoUuid, unidadMostradaUuid, cantidadSugeridaEnRendimiento) ?? cantidadSugeridaEnRendimiento
      : cantidadSugeridaEnRendimiento;

  // Lo que el operador ve/edita en "Cantidad a preparar" está en
  // `unidadMostradaUuid` — para escalar la receta y para mandarlo al
  // backend hace falta reconvertirlo a la unidad de rendimiento.
  const cantidadFormEnRendimiento =
    form.cantidad !== "" && unidadMostradaUuid && unidadRendimientoUuid && unidadMostradaUuid !== unidadRendimientoUuid
      ? convertirCantidad(grafoUnidades, unidadMostradaUuid, unidadRendimientoUuid, Number(form.cantidad)) ?? Number(form.cantidad)
      : Number(form.cantidad || 0);

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
  // Factor de escala: se prioriza la cantidad a preparar que quedó en el
  // formulario (puede haber sido editada a mano, y reconvertida arriba a
  // la unidad de rendimiento) sobre la sugerida — el desglose de insumos
  // siempre debe reflejar lo que realmente se va a preparar.
  const cantidadParaFactor = form.cantidad !== "" ? cantidadFormEnRendimiento : cantidadSugeridaEnRendimiento;
  const factorReceta = cantidadParaFactor > 0 ? cantidadParaFactor / rendimientoSeleccionado : 0;

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

  // Precarga "Dosis por hectárea" con la de la mezcla elegida — mientras el
  // operador no la haya editado a mano, cambiar de mezcla la reemplaza por
  // la nueva; si la edita, queda fija hasta elegir otra mezcla.
  useEffect(() => {
    if (!mezclaSeleccionada) return;
    setForm((f) =>
      f.dosisEditadaManualmente ? f : { ...f, dosisPorHectarea: Number(mezclaSeleccionada.dosisPorHectarea).toFixed(2) },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.mezclaUuid]);

  // Mientras el operador no haya tocado el campo a mano, la cantidad se
  // recalcula sola (dosis × hectáreas, convertida a la unidad de
  // rendimiento) cada vez que cambia la mezcla, las hectáreas, o termina de
  // cargar el grafo de conversiones (si se resolvía ANTES de tener las
  // conversiones disponibles, quedaba congelada sin convertir — por eso
  // también depende de `conversiones.length`) — apenas la edita
  // directamente, deja de auto-completarse hasta que abra un formulario
  // nuevo.
  useEffect(() => {
    if (form.cantidadEditadaManualmente) return;
    if (!mezclaSeleccionada || hectareasNum <= 0) return;
    setForm((f) => (f.cantidadEditadaManualmente ? f : { ...f, cantidad: cantidadSugerida.toFixed(2) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.mezclaUuid, form.hectareas, form.dosisPorHectarea, conversiones.length, unidadMostradaUuid]);

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
      // Cada insumo se manda con la cantidad que realmente se va a
      // consumir: la que el operador ajustó a mano en esa línea, o si no
      // tocó nada, la sugerida (receta × lo que se va a preparar) — mismo
      // criterio que "Cantidad a preparar", nunca queda desalineado con lo
      // que se ve en pantalla (ver componentesRecetaSeleccionada).
      const componentesPayload = componentesRecetaSeleccionada
        .filter((c) => c.articulo?.uuid)
        .map((c) => {
          const necesariaSugerida = Number(c.cantidad) * factorReceta;
          const ajusteStr = form.componentesAjustados[c.articulo.uuid];
          const cantidadInsumo = ajusteStr !== undefined && ajusteStr !== "" ? Number(ajusteStr) : necesariaSugerida;
          return { articuloUuid: c.articulo.uuid, cantidad: cantidadInsumo };
        });

      await apiFetch("/aspersiones", {
        method: "POST",
        body: JSON.stringify({
          fincaUuid: form.fincaUuid,
          fecha: form.fecha,
          tipo,
          medio: form.medio,
          mezclaUuid: form.mezclaUuid,
          almacenUuid: form.almacenUuid,
          hectareas: Number(form.hectareas),
          // El backend guarda la cantidad en la unidad de RENDIMIENTO de la
          // mezcla — si el operador la editó/vio en su unidad preferida
          // (ver unidadMostradaUuid), acá se reconvierte antes de mandarla.
          cantidad: form.cantidad !== "" ? cantidadFormEnRendimiento : undefined,
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
  async function handleEjecutar(aspersion, forzarSaldoNegativo = false) {
    setProcesandoTexto("Ejecutando y descontando insumos...");
    try {
      const resultado = await apiFetch(`/aspersiones/${aspersion.uuid}/ejecutar`, {
        method: "POST",
        body: JSON.stringify({ forzarSaldoNegativo }),
      });
      if (resultado.requiereConfirmacion) {
        setProcesandoTexto("");
        const mensaje = resultado.advertencias.map((a) => a.mensaje).join("\n");
        if (confirm(`${mensaje}\n\n¿Continuar de todas formas y dejar el saldo en negativo?`)) {
          await handleEjecutar(aspersion, true);
        }
        return;
      }
      actualizarFila(resultado.aspersion);
      recargarCalendario();
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
            <div className="row g-2">
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
                  <button type="button" className="btn btn-brand btn-sm rounded-3 flex-shrink-0" onClick={aplicarFiltros}>
                    Filtrar
                  </button>
                  {(filtros.fincaUuid || filtros.semanaUuid || filtros.mezclaUuid || filtros.estado || filtros.fecha) && (
                    <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 flex-shrink-0" onClick={limpiarFiltros}>
                      Limpiar
                    </button>
                  )}
                </div>
              </div>
            </div>
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
                            {a.estado === "PROGRAMADA" && hasPermission("sanidad_vegetal.aspersiones.ejecutar") && (
                              <button
                                type="button"
                                className="btn btn-sm btn-link p-1 d-inline-flex"
                                style={{ color: "#166534" }}
                                title="Marcar como ejecutada (descuenta insumos)"
                                onClick={() => handleEjecutar(a)}
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
          <ModalShell title="Programar aspersión" onClose={() => setModalOpen(false)} width="90vw">
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
                <div className="col-5">
                  <label className="form-label small fw-medium mb-1">
                    Mezcla <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select form-select-sm rounded-3"
                    required
                    value={form.mezclaUuid}
                    onChange={(e) => setForm((f) => ({ ...f, mezclaUuid: e.target.value, dosisEditadaManualmente: false, componentesAjustados: {} }))}
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
                      No hay mezclas con dosis por hectárea configurada — edítala en Mezclas.
                    </p>
                  )}
                </div>
                <div className="col-2">
                  <label className="form-label small fw-medium mb-1">Dosis / ha</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-control rounded-start-3"
                      disabled={!mezclaSeleccionada}
                      value={form.dosisPorHectarea}
                      onChange={(e) => setForm((f) => ({ ...f, dosisPorHectarea: e.target.value, dosisEditadaManualmente: true }))}
                    />
                    {mezclaSeleccionada && (
                      <span className="input-group-text small">{mezclaSeleccionada.dosisPorHectareaUnidad?.simbolo}</span>
                    )}
                  </div>
                  {mezclaSeleccionada && Number(form.dosisPorHectarea) !== Number(mezclaSeleccionada.dosisPorHectarea) && (
                    <p className="form-text small mb-0">
                      De la mezcla: {Number(mezclaSeleccionada.dosisPorHectarea).toFixed(2)}{" "}
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 align-baseline"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            dosisPorHectarea: Number(mezclaSeleccionada.dosisPorHectarea).toFixed(2),
                            dosisEditadaManualmente: false,
                          }))
                        }
                      >
                        usar de la mezcla
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
                    onChange={(e) => setForm((f) => ({ ...f, hectareas: e.target.value }))}
                  />
                </div>
                <div className="col-3">
                  <label className="form-label small fw-medium mb-1">Cantidad a preparar</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      className="form-control rounded-start-3"
                      value={form.cantidad}
                      onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value, cantidadEditadaManualmente: true }))}
                    />
                    {unidadesVolumen.length > 0 ? (
                      <select
                        className="form-select flex-grow-0 flex-shrink-0 w-auto"
                        title="Unidad de volumen preferida — se guarda en este computador"
                        value={unidadMostradaUuid || ""}
                        onChange={(e) => {
                          cambiarUnidadPreferida(e.target.value);
                          // Al cambiar la unidad, se vuelve a sugerir en la
                          // unidad nueva en vez de dejar el número viejo con
                          // la unidad equivocada.
                          setForm((f) => ({ ...f, cantidadEditadaManualmente: false }));
                        }}
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
                  {mezclaSeleccionada && hectareasNum > 0 && Number(form.cantidad) !== Number(cantidadSugerida.toFixed(2)) && (
                    <p className="form-text small mb-0">
                      Sugerido: {cantidadSugerida.toFixed(2)}{" "}
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 align-baseline"
                        onClick={() => setForm((f) => ({ ...f, cantidad: cantidadSugerida.toFixed(2), cantidadEditadaManualmente: false }))}
                      >
                        usar sugerido
                      </button>
                    </p>
                  )}
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
                // INSUMO, ver articulo.model.js#dosisMaximaPorHectarea) para
                // poder compararlas.
                const filas = componentesRecetaSeleccionada.map((c) => {
                  const articuloUuid = c.articulo?.uuid;
                  const necesariaTeorica = Number(c.cantidad) * factorTeorico;
                  const necesariaSugerida = Number(c.cantidad) * factorReceta;
                  const ajusteStr = form.componentesAjustados[articuloUuid];
                  const necesaria = ajusteStr !== undefined && ajusteStr !== "" ? Number(ajusteStr) : necesariaSugerida;

                  const disponible = existenciasInsumos[articuloUuid];
                  const insuficiente = disponible != null && disponible < necesaria;

                  const dosisMaxima = c.articulo?.dosisMaximaPorHectarea != null ? Number(c.articulo.dosisMaximaPorHectarea) : null;
                  const unidadDosisMaximaUuid = c.articulo?.dosisMaximaUnidad?.uuid;
                  const unidadRecetaUuid = c.unidad?.uuid;
                  const dosisAplicadaEnUnidadReceta = hectareasNum > 0 ? necesaria / hectareasNum : 0;
                  const dosisAplicada =
                    dosisMaxima != null && unidadDosisMaximaUuid && unidadRecetaUuid && unidadDosisMaximaUuid !== unidadRecetaUuid
                      ? convertirCantidad(grafoUnidades, unidadRecetaUuid, unidadDosisMaximaUuid, dosisAplicadaEnUnidadReceta) ?? dosisAplicadaEnUnidadReceta
                      : dosisAplicadaEnUnidadReceta;
                  const excedeDosis = dosisMaxima != null && hectareasNum > 0 && dosisAplicada > dosisMaxima;

                  return {
                    c,
                    articuloUuid,
                    necesaria,
                    necesariaTeorica,
                    necesariaSugerida,
                    disponible,
                    insuficiente,
                    dosisMaxima,
                    unidadDosisMaximaSimbolo: c.articulo?.dosisMaximaUnidad?.simbolo,
                    dosisAplicada,
                    excedeDosis,
                  };
                });
                const insumosConExceso = filas.filter((f) => f.excedeDosis);

                // Totales de "Receta" y "Cantidad necesaria" — agrupados por
                // unidad (los insumos de una mezcla no siempre comparten la
                // misma), para no sumar litros con kilos por error.
                const totalesPorUnidad = new Map();
                for (const f of filas) {
                  const simbolo = f.c.unidad?.simbolo || "";
                  const acc = totalesPorUnidad.get(simbolo) || { teorica: 0, ajustada: 0 };
                  acc.teorica += f.necesariaTeorica;
                  acc.ajustada += f.necesaria;
                  totalesPorUnidad.set(simbolo, acc);
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
                            <th className="text-end" style={{ backgroundColor: "var(--brand-900)", color: "#fff" }}>Dosis máxima / ha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filas.map(({ c, articuloUuid, necesaria, necesariaTeorica, necesariaSugerida, disponible, insuficiente, dosisMaxima, unidadDosisMaximaSimbolo, dosisAplicada, excedeDosis }) => (
                            <tr key={c.uuid}>
                              <td className="small">{c.articulo?.nombre || "—"}</td>
                              <td className="small text-secondary">
                                {necesariaTeorica.toLocaleString("es-CO", { maximumFractionDigits: 2 })} {c.unidad?.simbolo || ""}
                                {Number(necesaria.toFixed(2)) !== Number(necesariaTeorica.toFixed(2)) && (
                                  <>
                                    {" "}
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm p-0 align-baseline"
                                      onClick={() =>
                                        setForm((f) => ({
                                          ...f,
                                          componentesAjustados: { ...f.componentesAjustados, [articuloUuid]: necesariaTeorica.toFixed(2) },
                                        }))
                                      }
                                    >
                                      usar receta
                                    </button>
                                  </>
                                )}
                              </td>
                              <td className="small">
                                <div className="input-group input-group-sm" style={{ width: "5.5rem" }}>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    className="form-control rounded-start-3 px-1"
                                    style={{ minWidth: 0 }}
                                    value={form.componentesAjustados[articuloUuid] ?? necesariaSugerida.toFixed(2)}
                                    onChange={(e) =>
                                      setForm((f) => ({
                                        ...f,
                                        componentesAjustados: { ...f.componentesAjustados, [articuloUuid]: e.target.value },
                                      }))
                                    }
                                  />
                                  <span className="input-group-text small px-1">{c.unidad?.simbolo || ""}</span>
                                </div>
                              </td>
                              <td className={`small text-end ${insuficiente ? "text-danger fw-medium" : "text-secondary"}`}>
                                {disponible != null ? disponible.toLocaleString("es-CO", { maximumFractionDigits: 2 }) : "—"}
                              </td>
                              <td className={`small text-end ${excedeDosis ? "text-danger fw-medium" : "text-secondary"}`}>
                                {dosisMaxima != null ? (
                                  <>
                                    {dosisAplicada.toLocaleString("es-CO", { maximumFractionDigits: 2 })} / {dosisMaxima.toLocaleString("es-CO", { maximumFractionDigits: 2 })} {unidadDosisMaximaSimbolo}
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
                          {[...totalesPorUnidad.entries()].map(([simbolo, { teorica, ajustada }]) => (
                            <tr key={simbolo || "sin-unidad"} className="small fw-medium">
                              <td style={{ backgroundColor: "var(--brand-900)", color: "#fff" }}>Total{simbolo ? ` (${simbolo})` : ""}</td>
                              <td style={{ backgroundColor: "var(--brand-900)", color: "#fff" }}>{teorica.toLocaleString("es-CO", { maximumFractionDigits: 2 })} {simbolo}</td>
                              <td style={{ backgroundColor: "var(--brand-900)", color: "#fff" }}>{ajustada.toLocaleString("es-CO", { maximumFractionDigits: 2 })} {simbolo}</td>
                              <td style={{ backgroundColor: "var(--brand-900)" }} />
                              <td style={{ backgroundColor: "var(--brand-900)" }} />
                            </tr>
                          ))}
                        </tfoot>
                      </table>
                    </div>
                    {insumosConExceso.length > 0 && (
                      <div className="alert alert-danger py-2 px-3 small d-flex align-items-start gap-2 mt-2 mb-0">
                        <FiAlertTriangle className="mt-1 flex-shrink-0" />
                        <span>
                          Supera la dosis máxima recomendada por hectárea en:{" "}
                          {insumosConExceso.map((f) => f.c.articulo?.nombre).join(", ")}.
                        </span>
                      </div>
                    )}
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
                      value={form.administradorFincaUuid}
                      onChange={(e) => {
                        const uuid = e.target.value;
                        const usuario = usuariosFinca.find((u) => u.uuid === uuid);
                        setForm((f) => ({ ...f, administradorFincaUuid: uuid, administradorFincaNombre: usuario ? nombreUsuario(usuario) : "" }));
                      }}
                    >
                      <option value="">Selecciona...</option>
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
                      placeholder={cargandoUsuariosFinca ? "Cargando..." : form.fincaUuid ? "Sin usuarios asignados a esta finca" : "Elegí primero la finca"}
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
                  {saving ? "Guardando..." : "Programar"}
                </button>
              </div>
            </form>
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
