"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiTarget, FiSave, FiEye, FiList, FiAlertTriangle, FiBarChart2, FiDownload, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, LabelList } from "recharts";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import { calcularColorSemana, COLOR_HEX, COLOR_TEXT } from "@/lib/semanaColor";
import RequirePermission from "@/components/RequirePermission";

const SEMANAS_DEFAULT = 8;

// Deriva el color de la cinta física de embolse a partir del código de
// semana ("S23-2026") — mismo cálculo que se usa en el resto de la app.
function colorDeCinta(codigoSemana) {
  const m = /^S(\d{1,2})-(\d{4})$/.exec(codigoSemana || "");
  if (!m) return null;
  const numeroSemana = Number(m[1]);
  const anio = Number(m[2]);
  const nombre = calcularColorSemana(anio, numeroSemana);
  return { nombre, bg: COLOR_HEX[nombre], text: COLOR_TEXT[nombre] };
}

const PATRON_CORTE_EDADES = [8, 9, 10, 11, 12];
const GRAFICO_REAL_COLOR = "#16a34a";
const GRAFICO_REVISION_LABELS = ["Última revisión", "2ª revisión", "3ª revisión"];
const GRAFICO_REVISION_COLORES = ["#2563eb", "#d97706", "#7c3aed"];
// Distingue el año cuando hay más de uno seleccionado (el color ya lo usa
// la revisión); el primer año siempre sólido para que se lea limpio con
// uno solo seleccionado, que es el caso más común.
const GRAFICO_ANIO_DASH = [null, "6 3", "2 2", "1 4"];

// Contenido custom de LabelList: solo dibuja 1 de cada `densidad` puntos
// (para no saturar la gráfica cuando hay muchas semanas), formateando el
// valor con `formatter`.
function etiquetaConDensidad(color, formatter, densidad) {
  function EtiquetaConDensidad(props) {
    const { x, y, value, index } = props;
    if (value === undefined || value === null) return null;
    if (densidad > 1 && index % densidad !== 0) return null;
    return (
      <text x={x} y={y - 8} fill={color} fontSize={9} textAnchor="middle">
        {formatter(value)}
      </text>
    );
  }
  return EtiquetaConDensidad;
}

// Encabezado de columna clickeable para ordenar la tabla del comparativo.
function SortableTh({ label, sortKey, orden, onSort, align }) {
  const activo = orden.key === sortKey;
  return (
    <button
      type="button"
      className={`btn btn-sm p-0 border-0 bg-transparent d-flex align-items-center gap-1 fw-semibold ${align === "end" ? "justify-content-end w-100" : ""} ${align === "center" ? "justify-content-center w-100" : ""} ${activo ? "text-dark" : "text-secondary"}`}
      onClick={() => onSort(sortKey)}
    >
      {label}
      {activo ? (
        orden.dir === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />
      ) : (
        <FiChevronDown size={12} className="opacity-25" />
      )}
    </button>
  );
}

export default function EstimacionesPage() {
  const [vista, setVista] = useState("cargar");

  // Datos del formulario (próximas semanas + fincas habilitadas + tasa)
  const [semanasAEstimar, setSemanasAEstimar] = useState([]);
  const [fincas, setFincas] = useState([]);
  const [tasaConversion, setTasaConversion] = useState(null);
  const [semanaActual, setSemanaActual] = useState(null);
  const [calendarioIncompleto, setCalendarioIncompleto] = useState(false);

  // Valores del formulario: { [fincaUuid]: { [semanaUuid]: cajas|""} }
  const [valores, setValores] = useState({});
  // Celdas de `valores` que están autocompletadas (no las tocó el usuario a
  // mano) — { "fincaUuid:semanaUuid": true }. Se usan para saber cuáles
  // puede seguir actualizando en vivo el autocompletado (ej. al cambiar el
  // ratio) sin pisar lo que el usuario sí escribió.
  const [celdasAuto, setCeldasAuto] = useState({});
  const [guardado, setGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [msgError, setMsgError] = useState("");

  // Filtro de finca en la grilla de carga ("" = todas)
  const [filtroFincaUuid, setFiltroFincaUuid] = useState("");
  // Resumen de racimos (cintas 13-17, % cosecha por edad, aprovechamiento) de la finca elegida
  const [resumenFinca, setResumenFinca] = useState(null);
  const [resumenFincaLoading, setResumenFincaLoading] = useState(false);
  // % promedio editable por edad en "Distribución por cinta" — { [edad]: valor }
  const [pctEditados, setPctEditados] = useState({});
  const [guardandoPct, setGuardandoPct] = useState(false);
  // Ratio (cajas por racimo) editable por numeroSemana en "Sugerido próximas
  // semanas" — { [numeroSemana]: valor }
  const [ratiosEditados, setRatiosEditados] = useState({});
  const [guardandoRatios, setGuardandoRatios] = useState(false);
  // Overrides manuales, celda por celda, de "Sugerido próximas semanas" —
  // { "semanaUuid:edad": valor } — igual que editar una celda de Excel.
  const [estimadoManual, setEstimadoManual] = useState({});

  // Escalera (ver)
  const [escaleraColumnas, setEscaleraColumnas] = useState([]);
  const [escaleraFilas, setEscaleraFilas] = useState([]);
  const [escaleraLoading, setEscaleraLoading] = useState(false);
  const [filtroEscaleraFincaUuid, setFiltroEscaleraFincaUuid] = useState("");
  const [filtroEscaleraAnio, setFiltroEscaleraAnio] = useState("");
  const [escaleraAniosDisponibles, setEscaleraAniosDisponibles] = useState([]);
  // Semana a enfocar (solo mueve el scroll, no vuelve a consultar el backend).
  const [filtroEscaleraSemanaUuid, setFiltroEscaleraSemanaUuid] = useState("");
  const [semanaActualEscalera, setSemanaActualEscalera] = useState(null);

  // Comparativo estimado vs. real
  const [comparativoItems, setComparativoItems] = useState([]);
  const [comparativoLoading, setComparativoLoading] = useState(false);
  const [filtroComparativoFincaUuid, setFiltroComparativoFincaUuid] = useState("");
  // Paginado por semana: se navega una semana a la vez.
  const [comparativoPaginaIdx, setComparativoPaginaIdx] = useState(0);
  // Exportar a Excel, filtrado por año (independiente de la paginación por semana).
  const [filtroComparativoAnioExportar, setFiltroComparativoAnioExportar] = useState("");
  const [exportandoComparativo, setExportandoComparativo] = useState(false);
  // Gráfica comparativa: qué años y qué fincas se superponen (checkboxes).
  const [graficoAniosSel, setGraficoAniosSel] = useState([]);
  const [graficoFincaUuidsSel, setGraficoFincaUuidsSel] = useState([]);
  const [graficoFincasColapsado, setGraficoFincasColapsado] = useState(true);
  const [graficoFincaBusqueda, setGraficoFincaBusqueda] = useState("");
  const graficoFincasRef = useRef(null);
  // "cajas" (valores absolutos) o "porcentaje" (precisión de cada revisión).
  const [graficoModo, setGraficoModo] = useState("cajas");
  // Qué líneas mostrar: Real y/o cuáles revisiones (0=última, 1=2ª, 2=3ª).
  const [graficoMostrarReal, setGraficoMostrarReal] = useState(true);
  const [graficoRevisionesSel, setGraficoRevisionesSel] = useState([0]);
  // Rango de semanas a mostrar en el eje X ("" = sin límite en ese extremo).
  const [graficoSemanaDesde, setGraficoSemanaDesde] = useState("");
  const [graficoSemanaHasta, setGraficoSemanaHasta] = useState("");
  const [graficoMostrarPuntos, setGraficoMostrarPuntos] = useState(true);
  const [graficoMostrarEtiquetas, setGraficoMostrarEtiquetas] = useState(false);
  // 1 = etiqueta en cada punto, 2 = una de cada dos, etc.
  const [graficoDensidadEtiquetas, setGraficoDensidadEtiquetas] = useState(1);
  // Orden de la tabla del comparativo (clic en encabezado).
  const [comparativoOrden, setComparativoOrden] = useState({ key: null, dir: "asc" });

  const puedeCrear = hasPermission("estimacion.crear");
  const puedeVer = hasPermission("estimacion.ver");
  // 3 niveles jerárquicos (ver el backend, permission.middleware.js resuelve
  // igual con OR): ver < guardar estimaciones < editar % distribución. El
  // nivel más alto puede hacer todo lo de los anteriores.
  const puedeEditarDistribucion = hasPermission("estimacion.editar_distribucion");
  // "Guardar" = edición avanzada dentro de Resumen de racimos (ratio
  // editable, celdas tipo Excel de "Sugerido próximas semanas") — solo
  // crear/editar_distribucion, NO el nivel básico "ver".
  const puedeGuardar = puedeCrear || puedeEditarDistribucion;
  const puedeEditarPct = puedeEditarDistribucion;
  // La grilla básica de "Cargar estimaciones" (cajas por semana, Guardar
  // estimaciones, Cargar mis estimaciones guardadas) está disponible para
  // CUALQUIERA de los 3 niveles, incluido "ver" — es la acción mínima del
  // módulo, junto con ver Escalera y Comparativo (ya alcanzables solo con
  // estimacion.ver).
  const puedeUsarGrillaBasica = puedeVer || puedeGuardar;

  // Evita que se vea el flash de "No tienes fincas habilitadas" mientras
  // todavía no volvió la primera respuesta del backend (fincas arranca en []).
  const [cargandoSemanas, setCargandoSemanas] = useState(true);

  const cargarSemanas = useCallback(async () => {
    setMsgError("");
    setCargandoSemanas(true);
    try {
      const res = await apiFetch(`/estimaciones/semanas?semanas=${SEMANAS_DEFAULT}`);
      setSemanasAEstimar(res.semanas || []);
      setFincas(res.fincas || []);
      // Si solo tiene una finca habilitada, no hace falta que elija — se
      // preselecciona sola (igual se exige elegir cuando hay más de una).
      if ((res.fincas || []).length === 1) {
        setFiltroFincaUuid(res.fincas[0].uuid);
      }
      setTasaConversion(res.tasaConversion);
      setSemanaActual(res.semanaActual || null);
      setCalendarioIncompleto(Boolean(res.calendarioIncompleto));

      // Preinicializar el grid vacío para todas las fincas y semanas
      const nuevo = {};
      for (const finca of res.fincas || []) {
        nuevo[finca.uuid] = {};
        for (const semana of res.semanas || []) {
          nuevo[finca.uuid][semana.uuid] = "";
        }
      }
      setValores(nuevo);
    } catch (err) {
      setMsgError(err.message);
    } finally {
      setCargandoSemanas(false);
    }
  }, []);

  const cargarEscalera = useCallback(async () => {
    setEscaleraLoading(true);
    setMsgError("");
    try {
      const params = new URLSearchParams();
      if (filtroEscaleraFincaUuid) params.set("fincaUuid", filtroEscaleraFincaUuid);
      if (filtroEscaleraAnio) params.set("anio", filtroEscaleraAnio);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await apiFetch(`/estimaciones/escalera${qs}`);
      setEscaleraColumnas(res.columnas || []);
      setEscaleraFilas(res.filas || []);
      setSemanaActualEscalera(res.semanaActual || null);
      setEscaleraAniosDisponibles(res.aniosDisponibles || []);
      // Preseleccionar el año que el backend terminó usando (el vigente la
      // primera vez), para que el select ya muestre el año correcto.
      if (!filtroEscaleraAnio && res.anioSeleccionado) {
        setFiltroEscaleraAnio(String(res.anioSeleccionado));
      }
    } catch (err) {
      setMsgError(err.message);
    } finally {
      setEscaleraLoading(false);
    }
  }, [filtroEscaleraFincaUuid, filtroEscaleraAnio]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarSemanas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resumen de racimos (cintas 13-17, patrón de corte, aprovechamiento)
  // de la finca elegida en "Cargar estimaciones".
  const cargarResumenFinca = useCallback(async () => {
    if (!filtroFincaUuid) {
      setResumenFinca(null);
      return;
    }
    setResumenFincaLoading(true);
    try {
      const res = await apiFetch(`/estimaciones/resumen-finca?fincaUuid=${filtroFincaUuid}`);
      setResumenFinca(res);
      setPctEditados(Object.fromEntries((res.estimadoPorCinta || []).map((e) => [e.edad, e.porcentaje])));
      setRatiosEditados(
        Object.fromEntries(
          (res.proximasSemanas || []).map((s) => {
            const valor = s.ratioGuardado ?? s.ratioHistorico;
            return [s.numeroSemana, valor != null ? Math.round(valor * 1000) / 1000 : ""];
          }),
        ),
      );
    } catch (err) {
      setMsgError(err.message);
    } finally {
      setResumenFincaLoading(false);
    }
  }, [filtroFincaUuid]);

  // Vuelve a los % promedio del patrón de corte, descartando el override
  // guardado (no lo borra en el servidor hasta que se presione "Guardar").
  function restaurarPorcentajes() {
    if (!resumenFinca) return;
    setPctEditados(
      Object.fromEntries(
        resumenFinca.estimadoPorCinta.map((e) => [
          e.edad,
          resumenFinca.promedio?.porEdad?.find((p) => p.edad === e.edad)?.porcentaje ?? e.porcentaje,
        ]),
      ),
    );
  }

  // Guarda los % actualmente editados en pctEditados como override de la
  // finca, para que no se pierdan al recargar el panel.
  async function guardarPatronCortePct() {
    if (!filtroFincaUuid) return;
    setGuardandoPct(true);
    setMsgError("");
    try {
      const porcentajes = Object.fromEntries(
        PATRON_CORTE_EDADES.filter((edad) => pctEditados[edad] !== undefined && pctEditados[edad] !== "" && !Number.isNaN(Number(pctEditados[edad]))).map(
          (edad) => [edad, Number(pctEditados[edad])],
        ),
      );
      await apiFetch("/estimaciones/patron-corte-pct", {
        method: "POST",
        body: JSON.stringify({ fincaUuid: filtroFincaUuid, porcentajes: Object.keys(porcentajes).length ? porcentajes : null }),
      });
      await cargarResumenFinca();
    } catch (err) {
      setMsgError(err.message);
    } finally {
      setGuardandoPct(false);
    }
  }

  // Guarda los ratios (cajas por racimo) actualmente editados en
  // ratiosEditados como override de la finca por numeroSemana, para que no
  // se pierdan al recargar el panel.
  async function guardarRatiosCajas() {
    if (!filtroFincaUuid) return;
    setGuardandoRatios(true);
    setMsgError("");
    try {
      const ratios = Object.fromEntries(
        Object.entries(ratiosEditados).filter(
          ([, v]) => v !== undefined && v !== "" && !Number.isNaN(Number(v)),
        ).map(([numeroSemana, v]) => [numeroSemana, Number(v)]),
      );
      await apiFetch("/estimaciones/ratio-cajas", {
        method: "POST",
        body: JSON.stringify({ fincaUuid: filtroFincaUuid, ratios: Object.keys(ratios).length ? ratios : null }),
      });
      await cargarResumenFinca();
    } catch (err) {
      setMsgError(err.message);
    } finally {
      setGuardandoRatios(false);
    }
  }

  // Distribución por cinta recalculada en vivo con los % editados por el
  // usuario (no vuelve a pedir nada al backend — el saldo ya lo tenemos).
  const estimadoPorCintaEditable = useMemo(() => {
    if (!resumenFinca) return [];
    return resumenFinca.estimadoPorCinta.map((e) => {
      const raw = pctEditados[e.edad];
      const pct = raw === "" || raw === undefined || raw === null || Number.isNaN(Number(raw)) ? null : Number(raw);
      const estimado = pct !== null && e.saldo > 0 ? Math.round(e.saldo * (pct / 100)) : 0;
      return { ...e, porcentaje: pct, estimado, saldoTeorico: e.saldo - estimado };
    });
  }, [resumenFinca, pctEditados]);

  const estimadoTotalEditable = estimadoPorCintaEditable.reduce((acc, e) => acc + e.estimado, 0);
  const saldoTeoricoTotalEditable = estimadoPorCintaEditable.reduce((acc, e) => acc + e.saldoTeorico, 0);

  // Proyección en cascada para las próximas semanas: cada cinta envejece 1
  // semana por semana, así que reutiliza el % promedio de la edad que le
  // corresponda en cada semana futura (mismos % editables de arriba) y
  // arrastra el saldo restante de una semana a la siguiente. proximasSemanas
  // ya incluye la semana ya mostrada arriba (índice 0) — acá se muestran
  // las demás.
  const proyeccionSemanas = useMemo(() => {
    if (!resumenFinca || !resumenFinca.proximasSemanas?.length) return [];
    const cohortes = resumenFinca.estimadoPorCinta.map((e) => ({ semanaEmbolse: e.semanaEmbolse, edad: e.edad, saldo: e.saldo }));
    return resumenFinca.proximasSemanas.map((semana, i) => {
      const filas = cohortes.map((c) => {
        const edadEstaSemana = c.edad + i;
        const raw = pctEditados[edadEstaSemana];
        const pct =
          edadEstaSemana >= 8 && edadEstaSemana <= 12 && raw !== undefined && raw !== "" && !Number.isNaN(Number(raw)) ? Number(raw) : null;
        const calculado = pct !== null && c.saldo > 0 ? Math.round(c.saldo * (pct / 100)) : 0;
        // Override manual celda por celda (como editar una celda de Excel) —
        // si el usuario escribió un valor para esta semana+edad, manda sobre
        // el calculado, y ese es el que se arrastra al saldo de la semana
        // siguiente.
        const manualRaw = estimadoManual[`${semana.uuid}:${edadEstaSemana}`];
        const esManual = manualRaw !== undefined && manualRaw !== "" && !Number.isNaN(Number(manualRaw));
        const estimado = esManual ? Number(manualRaw) : calculado;
        const fila = { semanaEmbolse: c.semanaEmbolse, edad: edadEstaSemana, estimado, calculado, esManual };
        c.saldo = Math.max(c.saldo - estimado, 0);
        return fila;
      });
      const total = filas.reduce((acc, f) => acc + f.estimado, 0);
      // Solo se puede confiar en el estimado de cajas de esta semana si TODAS
      // las cintas de edad 8-12 tienen embolse real (ninguna cohorte
      // "envejeció" fuera de la ventana ni quedó sin datos) — si falta
      // alguna, el estimado de racimos está incompleto y no debe usarse
      // como cajas por defecto.
      const completo = PATRON_CORTE_EDADES.every((edad) => filas.some((f) => f.edad === edad && f.semanaEmbolse));
      const ratioRaw = ratiosEditados[semana.numeroSemana];
      const ratio = ratioRaw === "" || ratioRaw === undefined || ratioRaw === null || Number.isNaN(Number(ratioRaw)) ? null : Number(ratioRaw);
      const cajas = ratio !== null ? Math.round(total * ratio) : null;
      return { semana, filas, total, completo, ratio, cajas };
    });
  }, [resumenFinca, pctEditados, ratiosEditados, estimadoManual]);

  // Datos del gráfico de ratio: histórico real (línea sólida azul) + próximas
  // 8 semanas proyectadas (línea a trazos, continuando desde el % editable
  // de "Sugerido próximas semanas" cuando aplica) + promedio histórico de
  // cada semana de calendario (línea a trazos naranja, todo el rango hasta
  // fin de año).
  const graficoRatioData = useMemo(() => {
    if (!resumenFinca) return [];
    const uuidsProximas8 = new Set((resumenFinca.proximasSemanas || []).map((s) => s.uuid));
    const historico = (resumenFinca.historicoRatio || []).map((h, i, arr) => ({
      codigo: h.semana.codigo,
      ratioReal: h.ratio,
      promedio: h.promedioHistorico,
      // El último punto real también arranca la línea proyectada, para que
      // ambos trazos se toquen en el gráfico.
      proyectado: i === arr.length - 1 ? h.ratio : null,
    }));
    const proyectado = (resumenFinca.proyeccionAnio || []).map((s) => {
      const raw = ratiosEditados[s.numeroSemana];
      const editado = raw !== undefined && raw !== "" && !Number.isNaN(Number(raw)) ? Number(raw) : null;
      const valor = uuidsProximas8.has(s.uuid) ? (editado ?? s.ratioGuardado ?? s.ratioHistorico ?? null) : null;
      return { codigo: s.codigo, ratioReal: null, promedio: s.ratioHistorico, proyectado: valor };
    });
    return [...historico, ...proyectado];
  }, [resumenFinca, ratiosEditados]);

  useEffect(() => {
    if (vista !== "cargar" || !filtroFincaUuid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResumenFinca(null);
      return;
    }
    cargarResumenFinca();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vista, filtroFincaUuid]);

  const cargarComparativo = useCallback(async () => {
    setComparativoLoading(true);
    setMsgError("");
    try {
      const qs = filtroComparativoFincaUuid ? `?fincaUuid=${filtroComparativoFincaUuid}` : "";
      const res = await apiFetch(`/estimaciones/comparativo${qs}`);
      const items = res.items || [];
      setComparativoItems(items);
      // Arrancar en la última semana con cajas reales cargadas (no la última
      // semana con estimación no más — esa puede seguir sin producción real
      // todavía).
      const realPorSemana = new Map(); // semana.uuid -> { idx, real }
      let idx = -1;
      for (const it of items) {
        if (!realPorSemana.has(it.semana.uuid)) {
          idx += 1;
          realPorSemana.set(it.semana.uuid, { idx, real: 0 });
        }
        realPorSemana.get(it.semana.uuid).real += it.real;
      }
      let ultimaConReal = 0;
      for (const { idx: i, real } of realPorSemana.values()) {
        if (real > 0) ultimaConReal = i;
      }
      setComparativoPaginaIdx(ultimaConReal);
    } catch (err) {
      setMsgError(err.message);
    } finally {
      setComparativoLoading(false);
    }
  }, [filtroComparativoFincaUuid]);

  useEffect(() => {
    if (vista === "ver") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarEscalera();
    }
  }, [vista, cargarEscalera]);

  useEffect(() => {
    if (vista === "comparativo") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      cargarComparativo();
    }
  }, [vista, cargarComparativo]);

  const escaleraWrapRef = useRef(null);
  useEffect(() => {
    if (!escaleraWrapRef.current || escaleraColumnas.length === 0) return;
    if (!semanaActualEscalera && !filtroEscaleraSemanaUuid) return;
    const t = setTimeout(() => {
      const wrap = escaleraWrapRef.current;
      if (!wrap) return;

      let targetLeft = wrap.scrollLeft;
      let targetTop = wrap.scrollTop;

      // Si el usuario filtró una semana puntual, enfocar directamente su
      // intersección (fila de registro = columna objetivo de esa semana),
      // no solo la columna.
      const diagCell = filtroEscaleraSemanaUuid
        ? wrap.querySelector(`[data-diag-uuid="${filtroEscaleraSemanaUuid}"]`)
        : null;

      // Horizontal: dejar la columna elegida justo después de la columna
      // fija (segunda columna visible), no simplemente "a la vista".
      const stickyCol = wrap.querySelector("thead th.sticky-col");
      const col = diagCell || (filtroEscaleraSemanaUuid
        ? wrap.querySelector(`[data-col-uuid="${filtroEscaleraSemanaUuid}"]`)
        : wrap.querySelector(".present-col"));
      if (col && stickyCol) {
        const wrapRect = wrap.getBoundingClientRect();
        const colRect = col.getBoundingClientRect();
        const stickyWidth = stickyCol.getBoundingClientRect().width;
        targetLeft = Math.max(colRect.left - wrapRect.left + wrap.scrollLeft - stickyWidth, 0);
      }

      // Vertical: centrar la intersección de la semana filtrada, o si no hay
      // filtro, la fila de la semana actual.
      const cell = diagCell || (!filtroEscaleraSemanaUuid && (wrap.querySelector(".present-cell") || wrap.querySelector(".present-row-cell")));
      if (cell) {
        const wrapRect = wrap.getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();
        targetTop = Math.max(cellRect.top - wrapRect.top + wrap.scrollTop - wrapRect.height / 2 + cellRect.height / 2, 0);
      }

      wrap.scrollTo({ left: targetLeft, top: targetTop, behavior: "smooth" });
    }, 150);
    return () => clearTimeout(t);
  }, [escaleraColumnas, escaleraFilas, semanaActualEscalera, filtroEscaleraSemanaUuid, vista]);

  // Cierra la ventana flotante de fincas al hacer clic afuera.
  useEffect(() => {
    if (graficoFincasColapsado) return;
    function onClickFuera(e) {
      if (graficoFincasRef.current && !graficoFincasRef.current.contains(e.target)) {
        setGraficoFincasColapsado(true);
      }
    }
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, [graficoFincasColapsado]);

  // Matriz [fila][columna] de la zona "esperada" de estimación (8 semanas
  // siguientes a la semana de registro de esa fila), para dibujar el borde
  // tipo "escalera". Se calcula por posición (no por si ya hay dato cargado)
  // para que el borde siga avanzando también sobre las semanas futuras del
  // año que todavía no tienen estimación cargada.
  const filledMatrix = useMemo(
    () =>
      escaleraFilas.map((fila) => {
        const src = fila.sourceSemana;
        const diagIndex = src ? escaleraColumnas.findIndex((c) => c.uuid === src.uuid) : -1;
        if (diagIndex === -1) return escaleraColumnas.map(() => false);
        return escaleraColumnas.map((_, colIndex) => colIndex > diagIndex && colIndex <= diagIndex + SEMANAS_DEFAULT);
      }),
    [escaleraFilas, escaleraColumnas],
  );

  function cargarValoresExistentes() {
    if (!filtroFincaUuid) return;
    // Trae las estimaciones propias y las precarga en el grid para poder
    // re-guardarlas / corregirlas (upsert). Puede haber varias "revisiones"
    // guardadas para la misma finca+semana objetivo (una por cada semana en
    // que se volvió a estimar — ver semana_registro_id), así que hay que
    // quedarse con la más reciente (mayor updatedAt/createdAt) y no
    // simplemente con la última que aparezca en la respuesta. Filtrado por
    // la finca seleccionada — sin este filtro, el límite de 100 filas se
    // reparte entre TODAS las fincas habilitadas y las semanas más viejas
    // de la finca actual pueden quedar afuera antes de llegar a ellas.
    apiFetch(`/estimaciones?limit=100&fincaUuid=${filtroFincaUuid}`)
      .then((res) => {
        const masReciente = new Map(); // `${fincaUuid}:${semanaUuid}` -> item
        for (const r of res.items || []) {
          const clave = `${r.finca?.uuid}:${r.semana?.uuid}`;
          const anterior = masReciente.get(clave);
          const fecha = new Date(r.updatedAt || r.createdAt || 0).getTime();
          const fechaAnterior = anterior ? new Date(anterior.updatedAt || anterior.createdAt || 0).getTime() : -1;
          if (!anterior || fecha >= fechaAnterior) {
            masReciente.set(clave, r);
          }
        }
        const nuevo = { ...valores };
        const clavesCargadas = [];
        for (const r of masReciente.values()) {
          if (nuevo[r.finca?.uuid] && nuevo[r.finca?.uuid][r.semana?.uuid] !== undefined) {
            nuevo[r.finca?.uuid][r.semana?.uuid] = r.cajas20kg;
            clavesCargadas.push(`${r.finca.uuid}:${r.semana.uuid}`);
          }
        }
        setValores(nuevo);
        // Lo que se acaba de cargar es dato real guardado, no autocompletado
        // — que deje de considerarse "auto" para que el efecto de arriba no
        // lo vuelva a pisar si el ratio/% cambia después.
        setCeldasAuto((prev) => {
          const next = { ...prev };
          for (const clave of clavesCargadas) delete next[clave];
          return next;
        });
      })
      .catch((err) => setMsgError(err.message));
  }

  // Agrupa el comparativo por semana (ya viene ordenado por semana) para
  // mostrar un encabezado de sección por semana en vez de repetir la
  // columna en cada fila — se lee más como "cómo nos fue esta semana".
  const comparativoPorSemana = useMemo(() => {
    const grupos = [];
    for (const it of comparativoItems) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.semana.uuid === it.semana.uuid) {
        ultimo.items.push(it);
        ultimo.realTotal += it.real;
      } else {
        grupos.push({ semana: it.semana, items: [it], realTotal: it.real });
      }
    }
    return grupos;
  }, [comparativoItems]);

  // Valor de un item para una columna ordenable de la tabla (finca, real, o
  // semana/estimado/% de alguna de las 3 revisiones).
  function valorOrdenComparativo(it, key) {
    if (key === "finca") return it.finca.codigo;
    if (key === "real") return it.real;
    const m = /^r(\d)_(semana|estimado|pct)$/.exec(key || "");
    if (!m) return null;
    const rev = it.revisiones?.[Number(m[1])];
    if (!rev) return null;
    if (m[2] === "semana") return rev.semanaRegistro?.codigo || "";
    if (m[2] === "estimado") return rev.estimado;
    return rev.porcentaje;
  }

  // Items de la semana actualmente paginada, ordenados según el encabezado
  // elegido (clic para ordenar, como una tabla filtrable).
  const comparativoItemsOrdenados = useMemo(() => {
    const items = comparativoPorSemana[comparativoPaginaIdx]?.items || [];
    if (!comparativoOrden.key) return items;
    const dirMul = comparativoOrden.dir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      const va = valorOrdenComparativo(a, comparativoOrden.key);
      const vb = valorOrdenComparativo(b, comparativoOrden.key);
      if (va === null || va === undefined) return vb === null || vb === undefined ? 0 : 1;
      if (vb === null || vb === undefined) return -1;
      if (typeof va === "string") return va.localeCompare(vb) * dirMul;
      return (va - vb) * dirMul;
    });
  }, [comparativoPorSemana, comparativoPaginaIdx, comparativoOrden]);

  function alternarOrdenComparativo(key) {
    setComparativoOrden((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  }

  // Años presentes en el comparativo ya cargado, para el filtro de exportación.
  const comparativoAniosDisponibles = useMemo(
    () => [...new Set(comparativoItems.map((it) => it.semana.anio))].sort((a, b) => b - a),
    [comparativoItems],
  );

  // Preseleccionar los 2 años más recientes en la gráfica la primera vez que
  // hay datos (para que se vea algo sin que el usuario tenga que elegir).
  useEffect(() => {
    if (graficoAniosSel.length === 0 && comparativoAniosDisponibles.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGraficoAniosSel(comparativoAniosDisponibles.slice(0, 2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparativoAniosDisponibles]);

  // Datos de la gráfica: una fila por número de semana (1..53), con columnas
  // dinámicas real_<año>, estimado_<año>_r{0,1,2} (última/2ª/3ª revisión) y
  // porcentaje_<año>_r{0,1,2} (sumando las fincas seleccionadas, o todas si
  // no se eligió ninguna).
  const { graficoData, graficoSeries, graficoMaxSemana, graficoDominioX } = useMemo(() => {
    const fincaSet = graficoFincaUuidsSel.length > 0 ? new Set(graficoFincaUuidsSel) : null;
    const aniosActivos = graficoAniosSel.length > 0 ? graficoAniosSel : comparativoAniosDisponibles;

    const filasPorSemana = new Map(); // numeroSemana -> fila
    for (const it of comparativoItems) {
      if (!aniosActivos.includes(it.semana.anio)) continue;
      if (fincaSet && !fincaSet.has(it.finca.uuid)) continue;
      const num = it.semana.numeroSemana;
      if (!filasPorSemana.has(num)) filasPorSemana.set(num, { numeroSemana: num });
      const fila = filasPorSemana.get(num);
      const anio = it.semana.anio;
      fila[`real_${anio}`] = (fila[`real_${anio}`] || 0) + it.real;
      for (let r = 0; r < 3; r++) {
        const estimado = it.revisiones?.[r]?.estimado || 0;
        fila[`estimado_${anio}_r${r}`] = (fila[`estimado_${anio}_r${r}`] || 0) + estimado;
      }
    }

    const data = [...filasPorSemana.values()].sort((a, b) => a.numeroSemana - b.numeroSemana);
    const series = aniosActivos
      .slice()
      .sort((a, b) => a - b)
      .map((anio, i) => ({ anio, dash: GRAFICO_ANIO_DASH[i % GRAFICO_ANIO_DASH.length] }));

    for (const { anio } of series) {
      for (const fila of data) {
        // Una semana en 0 cajas reales es "todavía no hay dato" (no se
        // cosechó esa semana), no una medición real — se quita para dejar
        // un hueco en la línea en vez de dibujar una caída falsa a 0.
        const tieneReal = Boolean(fila[`real_${anio}`]);
        if (!tieneReal) delete fila[`real_${anio}`];
        for (let r = 0; r < 3; r++) {
          const estimado = fila[`estimado_${anio}_r${r}`];
          if (tieneReal && estimado > 0) {
            fila[`porcentaje_${anio}_r${r}`] = Math.round(((fila[`real_${anio}`] - estimado) / estimado) * 10000) / 100;
          }
          if (!estimado) delete fila[`estimado_${anio}_r${r}`];
        }
      }
    }

    // La gráfica no debe seguir más allá de la última semana con cajas
    // reales cargadas (para cualquiera de los años activos) — más allá solo
    // habría estimado sin nada para comparar todavía.
    let maxSemanaConReal = 0;
    for (const fila of data) {
      const tieneAlgunReal = series.some(({ anio }) => fila[`real_${anio}`] !== undefined);
      if (tieneAlgunReal) maxSemanaConReal = Math.max(maxSemanaConReal, fila.numeroSemana);
    }
    const semanaTope = maxSemanaConReal || 53;
    const dataTruncada = maxSemanaConReal > 0 ? data.filter((f) => f.numeroSemana <= semanaTope) : data;

    // Rango de semanas elegido por el usuario — el eje X solo abarca ese
    // espacio, no todo el año.
    const rangoDesde = graficoSemanaDesde ? Math.max(Number(graficoSemanaDesde), 1) : 1;
    const rangoHasta = graficoSemanaHasta ? Math.min(Number(graficoSemanaHasta), semanaTope) : semanaTope;
    const dataFiltrada = dataTruncada.filter((f) => f.numeroSemana >= rangoDesde && f.numeroSemana <= rangoHasta);

    return {
      graficoData: dataFiltrada,
      graficoSeries: series,
      graficoMaxSemana: semanaTope,
      graficoDominioX: [rangoDesde, Math.max(rangoHasta, rangoDesde)],
    };
  }, [comparativoItems, graficoAniosSel, graficoFincaUuidsSel, comparativoAniosDisponibles, graficoSemanaDesde, graficoSemanaHasta]);

  async function handleExportarComparativo() {
    setExportandoComparativo(true);
    setMsgError("");
    try {
      const params = new URLSearchParams();
      if (filtroComparativoFincaUuid) params.set("fincaUuid", filtroComparativoFincaUuid);
      if (filtroComparativoAnioExportar) params.set("anio", filtroComparativoAnioExportar);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const blob = await apiFetchBlob(`/estimaciones/comparativo/exportar${qs}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `comparativo-estimado-vs-real${filtroComparativoAnioExportar ? `-${filtroComparativoAnioExportar}` : ""}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMsgError(err.message);
    } finally {
      setExportandoComparativo(false);
    }
  }

  function setValor(fincaUuid, semanaUuid, valor) {
    setValores((prev) => ({
      ...prev,
      [fincaUuid]: { ...prev[fincaUuid], [semanaUuid]: valor },
    }));
    // El usuario tocó esta celda a mano — deja de ser "autocompletada", así
    // que el efecto de abajo ya no la vuelve a pisar aunque cambie el ratio.
    setCeldasAuto((prev) => {
      const clave = `${fincaUuid}:${semanaUuid}`;
      if (!prev[clave]) return prev;
      const next = { ...prev };
      delete next[clave];
      return next;
    });
    setGuardado(false);
  }

  // Precarga por defecto las cajas estimadas (Sugerido próximas semanas ×
  // ratio) en la grilla de "Cargar estimaciones" — solo para semanas donde
  // las 5 cintas de edad 8-12 tienen embolse real (dato completo) y solo
  // para roles que puedan editar de verdad (crear/editar_distribución) — el
  // rol "solo ver" nunca autocompleta. Una celda autocompletada sigue
  // actualizándose en vivo si el estimado cambia (ej. al editar el ratio o
  // el % de distribución) — solo deja de tocarse si el usuario la edita a
  // mano (ver setValor).
  useEffect(() => {
    if (!puedeGuardar || !filtroFincaUuid || !proyeccionSemanas.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValores((prev) => {
      const fincaVals = { ...(prev[filtroFincaUuid] || {}) };
      let cambio = false;
      const nuevasAuto = {};
      for (const { semana, completo, cajas } of proyeccionSemanas) {
        if (!completo || cajas === null) continue;
        const clave = `${filtroFincaUuid}:${semana.uuid}`;
        const vacia = fincaVals[semana.uuid] === undefined || fincaVals[semana.uuid] === "";
        if (vacia || celdasAuto[clave]) {
          if (fincaVals[semana.uuid] !== cajas) {
            fincaVals[semana.uuid] = cajas;
            cambio = true;
          }
          nuevasAuto[clave] = true;
        }
      }
      const hayClaveNueva = Object.keys(nuevasAuto).some((clave) => !celdasAuto[clave]);
      if (hayClaveNueva) {
        setCeldasAuto((prevAuto) => ({ ...prevAuto, ...nuevasAuto }));
      }
      if (!cambio) return prev;
      return { ...prev, [filtroFincaUuid]: fincaVals };
    });
  }, [puedeGuardar, proyeccionSemanas, filtroFincaUuid, celdasAuto]);

  async function handleGuardar() {
    if (!puedeUsarGrillaBasica) return;
    // Solo se guarda la finca seleccionada — nunca varias a la vez, aunque
    // `valores` tenga filas precargadas de otras fincas sin guardar.
    if (!filtroFincaUuid) {
      setMsgError("Selecciona una finca antes de guardar.");
      return;
    }
    const itemsGuardar = [];
    const fincaUuid = filtroFincaUuid;
    for (const semanaUuid of Object.keys(valores[fincaUuid] || {})) {
      const raw = valores[fincaUuid][semanaUuid];
      if (raw === "" || raw === null || raw === undefined) continue;
      const cajas = Number(raw);
      if (Number.isNaN(cajas) || cajas < 0) {
        setMsgError("Todos los valores deben ser números mayores o iguales a 0.");
        return;
      }
      itemsGuardar.push({ fincaUuid, semanaUuid, cajas20kg: cajas });
    }

    if (itemsGuardar.length === 0) {
      setMsgError("Ingresa al menos una estimación.");
      return;
    }

    setGuardando(true);
    setMsgError("");
    try {
      const res = await apiFetch("/estimaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsGuardar }),
      });
      if (res.errores?.length) {
        setMsgError(`Se guardaron ${res.guardadas} estimación(es), con ${res.errores.length} fila(s) con error:\n${res.errores
          .map((e) => `- Fila ${e.fila}: ${e.error}`)
          .join("\n")}`);
      } else {
        setGuardado(true);
      }
    } catch (err) {
      setMsgError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  // La eliminación en escalera se hace desde el detalle por celda si hace
  // falta — por ahora la vista escalera es solo lectura agregada.

  const cajasConDecimales = tasaConversion !== null && Number(tasaConversion) % 1 !== 0;

  return (
    <RequirePermission code="menu.estimaciones">
      <div className="p-3 p-md-4">
        <div className="mb-3">
          <h1 className="fw-bold h5 mb-1 d-flex align-items-center gap-2">
            <FiTarget className="text-primary" /> Estimaciones de Fincas
          </h1>
          <p className="text-secondary small mb-0">
            Cajas estimadas (unidad de 20kg equivalente, tasa configurada{" "}
            {tasaConversion !== null ? <strong>{tasaConversion} kg</strong> : "(cargando...)"})
            por finca para las próximas semanas.
          </p>
        </div>

        {msgError && <div className="alert alert-danger py-2 small" style={{ whiteSpace: "pre-line" }}>{msgError}</div>}
        {guardado && <div className="alert alert-success py-2 small">Estimaciones guardadas correctamente.</div>}

        <ul className="nav nav-pills mb-3">
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link rounded-3 ${vista === "cargar" ? "active" : ""}`}
              onClick={() => setVista("cargar")}
            >
              <FiSave className="me-1" /> Cargar estimaciones
            </button>
          </li>
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link rounded-3 ${vista === "ver" ? "active" : ""}`}
              onClick={() => setVista("ver")}
            >
              <FiEye className="me-1" /> Ver estimaciones
            </button>
          </li>
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link rounded-3 ${vista === "comparativo" ? "active" : ""}`}
              onClick={() => setVista("comparativo")}
            >
              <FiBarChart2 className="me-1" /> Comparativo vs. real
            </button>
          </li>
        </ul>

        {vista === "cargar" && (
          <div>
            {semanaActual && (
              <div className="small text-secondary mb-2">
                Semana actual: <strong>{semanaActual.codigo}</strong> — se estiman las próximas {semanasAEstimar.length} semanas.
              </div>
            )}

            {calendarioIncompleto && (
              <div className="alert alert-warning py-2 small d-flex align-items-start gap-2">
                <FiAlertTriangle className="flex-shrink-0 mt-1" />
                <span>
                  El calendario solo llega hasta <strong>{semanasAEstimar[semanasAEstimar.length - 1]?.codigo}</strong>.
                  Genera el año siguiente en Maestros → Semanas para estimar más semanas.
                </span>
              </div>
            )}

            {!puedeVer && !puedeGuardar && (
              <div className="alert alert-warning py-2 small">
                No tienes permisos para ver ni cargar estimaciones.
              </div>
            )}

            {cargandoSemanas && (
              <div className="text-secondary small py-3">Cargando...</div>
            )}

            {!cargandoSemanas && fincas.length === 0 && !msgError && (
              <div className="alert alert-info py-2 small">
                No tienes fincas habilitadas para estimar.
              </div>
            )}

            {fincas.length > 0 && (
              <>
                {fincas.length > 1 && (
                  <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
                    <div className="row g-2 align-items-end">
                      <div className="col-12 col-md-5 col-lg-4">
                        <label className="form-label small fw-medium">
                          Finca <span className="text-danger">*</span>
                        </label>
                        <select
                          className="form-select rounded-3"
                          value={filtroFincaUuid}
                          onChange={(e) => setFiltroFincaUuid(e.target.value)}
                          required
                        >
                          <option value="">Selecciona una finca...</option>
                          {fincas.map((f) => (
                            <option key={f.uuid} value={f.uuid}>
                              {f.codigo} — {f.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {!filtroFincaUuid && (
                  <div className="alert alert-info py-2 small">
                    Selecciona una finca para cargar sus estimaciones — se carga y se guarda una finca a la vez.
                  </div>
                )}

                {filtroFincaUuid && (
                  <>
                    {resumenFincaLoading && (
                      <div className="text-secondary small py-2">Cargando resumen de racimos...</div>
                    )}

                    {!resumenFincaLoading && resumenFinca && (
                      <div className="card border-0 shadow-sm rounded-4 p-3 mb-3 resumen-racimos-card">
                        <h3 className="h6 fw-bold mb-1">Resumen de racimos</h3>
                        <div className="small text-secondary mb-3">{resumenFinca.finca.codigo} — {resumenFinca.finca.nombre}</div>

                        <div>
                          <div className="small fw-medium text-secondary mb-2">
                            Patrón de corte — cada fila es la cinta (semana de embolse) que cumplió 12 semanas en la semana liquidada indicada
                          </div>
                          <div className="table-responsive">
                            <table className="table table-sm mb-0 small text-center">
                              <thead className="table-light">
                                <tr>
                                  <th>Cinta (embolse)</th>
                                  {PATRON_CORTE_EDADES.map((edad) => (
                                    <th key={edad}>Patrón de corte {edad}</th>
                                  ))}
                                  <th className="aprovechamiento-col">Aprovechamiento</th>
                                </tr>
                              </thead>
                              <tbody>
                                {resumenFinca.patronCorte.length === 0 && (
                                  <tr>
                                    <td colSpan={1 + PATRON_CORTE_EDADES.length + 1} className="text-secondary py-3">
                                      Todavía no hay semanas liquidadas para esta finca.
                                    </td>
                                  </tr>
                                )}
                                {resumenFinca.patronCorte.map((fila) => {
                                  const esActual = fila.semana.uuid === resumenFinca.semanaActual?.uuid;
                                  const cinta = colorDeCinta(fila.semanaEmbolse?.codigo);
                                  return (
                                    <tr key={fila.semana.uuid} className={esActual ? "table-success" : ""}>
                                      <td>
                                        {fila.semanaEmbolse ? (
                                          <span
                                            className="badge rounded-pill"
                                            style={cinta ? { backgroundColor: cinta.bg, color: cinta.text } : undefined}
                                            title={cinta?.nombre}
                                          >
                                            {fila.semanaEmbolse.codigo}
                                          </span>
                                        ) : (
                                          "—"
                                        )}
                                      </td>
                                      {fila.porEdad.map((p) => (
                                        <td key={p.edad}>{p.porcentaje === null ? "—" : `${p.porcentaje}%`}</td>
                                      ))}
                                      <td className="aprovechamiento-col fw-bold">
                                        {fila.aprovechamiento === null ? "—" : `${(fila.aprovechamiento * 100).toFixed(1)}%`}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              {resumenFinca.patronCorte.length > 0 && (
                                <tfoot>
                                  <tr className="table-light fw-bold">
                                    <td>Promedio</td>
                                    {resumenFinca.promedio.porEdad.map((p) => (
                                      <td key={p.edad}>{p.porcentaje === null ? "—" : `${p.porcentaje}%`}</td>
                                    ))}
                                    <td className="aprovechamiento-col">
                                      {resumenFinca.promedio.aprovechamiento === null ? "—" : `${(resumenFinca.promedio.aprovechamiento * 100).toFixed(1)}%`}
                                    </td>
                                  </tr>
                                </tfoot>
                              )}
                            </table>
                          </div>
                        </div>

                        {puedeGuardar && (
                        <div className="mt-3 pt-3 border-top">
                          <div className="alert alert-success py-2 px-3 small mb-0 d-flex align-items-center flex-wrap gap-2">
                            <strong>Estimado de corte para {resumenFinca.semanaEstimado?.codigo || "la semana que viene"}:</strong>
                            <span className="h6 fw-bold mb-0">{estimadoTotalEditable.toLocaleString("es")} racimos</span>
                            <span className="text-secondary">
                              (% promedio de las últimas 5 cintas del patrón de corte, aplicado sobre lo que va a quedar pendiente por edad la semana que viene — editable abajo)
                            </span>
                          </div>
                        </div>
                        )}

                        {puedeGuardar && (
                        <div className="mt-3 pt-3 border-top">
                          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                            <div className="small fw-medium text-secondary">
                              Distribución por cinta del estimado — {resumenFinca.semanaEstimado?.codigo || "la semana que viene"} (el % es editable)
                            </div>
                            {puedeEditarPct && (
                              <div className="d-flex gap-2">
                                <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={restaurarPorcentajes}>
                                  Restaurar porcentajes originales
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-brand btn-sm rounded-3"
                                  onClick={guardarPatronCortePct}
                                  disabled={guardandoPct}
                                >
                                  {guardandoPct ? "Guardando..." : "Guardar para esta finca"}
                                </button>
                              </div>
                            )}
                          </div>
                          {resumenFinca.patronCortePctGuardado && (
                            <div className="small text-secondary mb-2">
                              Esta finca tiene % personalizados guardados — se aplican automáticamente cada vez que se carga el panel.
                            </div>
                          )}
                          <div className="table-responsive">
                            <table className="table table-sm mb-0 small text-center">
                              <thead className="table-light">
                                <tr>
                                  <th>Cinta (embolse)</th>
                                  <th>Edad esa semana</th>
                                  <th className="text-end">Pendiente</th>
                                  <th>% promedio (patrón)</th>
                                  <th>% aplicado (editable)</th>
                                  <th className="text-end">Estimado</th>
                                  <th className="text-end">Saldo teórico</th>
                                </tr>
                              </thead>
                              <tbody>
                                {estimadoPorCintaEditable.map((e) => {
                                  const cinta = colorDeCinta(e.semanaEmbolse?.codigo);
                                  const pctPromedio = resumenFinca?.promedio?.porEdad?.find((p) => p.edad === e.edad)?.porcentaje;
                                  return (
                                    <tr key={e.edad}>
                                      <td>
                                        {e.semanaEmbolse ? (
                                          <span
                                            className="badge rounded-pill"
                                            style={cinta ? { backgroundColor: cinta.bg, color: cinta.text } : undefined}
                                            title={cinta?.nombre}
                                          >
                                            {e.semanaEmbolse.codigo}
                                          </span>
                                        ) : (
                                          "—"
                                        )}
                                      </td>
                                      <td>{e.edad} sem.</td>
                                      <td className="text-end">{e.saldo.toLocaleString("es")}</td>
                                      <td className="text-secondary">{pctPromedio != null ? `${pctPromedio}%` : "—"}</td>
                                      <td>
                                        {puedeEditarPct ? (
                                          <div className="input-group input-group-sm" style={{ maxWidth: "6.5rem", margin: "0 auto" }}>
                                            <input
                                              type="number"
                                              step="0.01"
                                              className="form-control text-end"
                                              value={pctEditados[e.edad] ?? ""}
                                              onChange={(ev) => setPctEditados((prev) => ({ ...prev, [e.edad]: ev.target.value }))}
                                            />
                                            <span className="input-group-text">%</span>
                                          </div>
                                        ) : (
                                          <span>{pctEditados[e.edad] != null && pctEditados[e.edad] !== "" ? `${pctEditados[e.edad]}%` : "—"}</span>
                                        )}
                                      </td>
                                      <td className="text-end fw-bold aprovechamiento-col">{e.estimado.toLocaleString("es")}</td>
                                      <td className="text-end text-secondary">{e.saldoTeorico.toLocaleString("es")}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className="table-light fw-bold">
                                  <td colSpan={4}></td>
                                  <td className="text-end">Total</td>
                                  <td className="text-end aprovechamiento-col">{estimadoTotalEditable.toLocaleString("es")}</td>
                                  <td className="text-end">{saldoTeoricoTotalEditable.toLocaleString("es")}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                        )}

                        {graficoRatioData.length > 1 && (
                          <div className="mt-3 pt-3 border-top">
                            <div className="small fw-medium text-secondary mb-2">
                              Histórico del ratio (cajas ÷ racimo cosechado) — real hasta hoy, proyectado hasta fin de año
                            </div>
                            <div style={{ width: "100%", height: 230 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={graficoRatioData} margin={{ top: 5, right: 10, left: -10, bottom: 30 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                                  <XAxis dataKey="codigo" tick={{ fontSize: 9 }} interval={0} angle={-60} textAnchor="end" height={50} />
                                  <YAxis tick={{ fontSize: 10 }} width={45} domain={["auto", "auto"]} />
                                  <Tooltip formatter={(v) => (v == null ? "—" : Number(v).toLocaleString("es", { maximumFractionDigits: 3 }))} />
                                  <Legend wrapperStyle={{ fontSize: 11 }} />
                                  <Line type="monotone" dataKey="ratioReal" name="Ratio real" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
                                  {puedeGuardar && (
                                    <Line
                                      type="monotone"
                                      dataKey="proyectado"
                                      name="Ratio proyectado (próximas 8 semanas)"
                                      stroke="#dc2626"
                                      strokeWidth={2.5}
                                      strokeDasharray="5 3"
                                      dot={{ r: 3 }}
                                      connectNulls
                                    />
                                  )}
                                  <Line
                                    type="monotone"
                                    dataKey="promedio"
                                    name="Promedio histórico (misma semana)"
                                    stroke="#059669"
                                    strokeWidth={2}
                                    strokeDasharray="5 3"
                                    dot={{ r: 2 }}
                                    connectNulls
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}

                        {puedeGuardar && proyeccionSemanas.length > 0 && (
                          <div className="mt-3 pt-3 border-top">
                            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                              <div className="small fw-medium text-secondary">
                                Sugerido próximas {proyeccionSemanas.length} semanas — misma cinta, envejeciendo semana a semana (usa los mismos % editables de arriba)
                              </div>
                              {puedeGuardar && (
                                <div className="d-flex gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-outline-secondary btn-sm rounded-3"
                                    onClick={() => setEstimadoManual({})}
                                  >
                                    Restaurar celdas calculadas
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-brand btn-sm rounded-3"
                                    onClick={guardarRatiosCajas}
                                    disabled={guardandoRatios}
                                  >
                                    {guardandoRatios ? "Guardando..." : "Guardar ratios"}
                                  </button>
                                </div>
                              )}
                            </div>
                            {puedeGuardar && (
                              <div className="small text-secondary mb-2">
                                Las celdas por edad son editables (como Excel) — un valor editado se marca en azul y se usa para arrastrar el saldo a las semanas siguientes.
                              </div>
                            )}
                            <div className="table-responsive">
                              <table className="table table-sm mb-0 small text-center">
                                <thead className="table-light">
                                  <tr>
                                    <th>Semana</th>
                                    {PATRON_CORTE_EDADES.map((edad) => (
                                      <th key={edad}>Edad {edad}</th>
                                    ))}
                                    <th className="aprovechamiento-col">Estimado</th>
                                    <th>Ratio histórico</th>
                                    <th>Ratio (editable)</th>
                                    <th className="aprovechamiento-col" style={{ minWidth: "5.5rem" }}>Cajas</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {proyeccionSemanas.map(({ semana, filas, total, cajas }) => {
                                    return (
                                      <tr key={semana.uuid}>
                                        <td className="fw-medium">{semana.codigo}</td>
                                        {PATRON_CORTE_EDADES.map((edad) => {
                                          const fila = filas.find((f) => f.edad === edad);
                                          const cinta = fila ? colorDeCinta(fila.semanaEmbolse?.codigo) : null;
                                          const clave = `${semana.uuid}:${edad}`;
                                          return (
                                            <td key={edad} className="p-0" style={{ minWidth: "4rem" }}>
                                              {!fila ? (
                                                <div className="py-2">—</div>
                                              ) : (
                                                <div className="d-flex align-items-center justify-content-center gap-1 px-1">
                                                  {cinta && (
                                                    <span
                                                      title={fila.semanaEmbolse?.codigo}
                                                      className="rounded-circle d-inline-block flex-shrink-0"
                                                      style={{
                                                        width: 7,
                                                        height: 7,
                                                        backgroundColor: cinta.bg,
                                                        border: cinta.nombre === "Blanco" ? "1px solid #000" : "none",
                                                      }}
                                                    />
                                                  )}
                                                  {puedeGuardar ? (
                                                    <input
                                                      type="number"
                                                      className={`form-control form-control-sm text-center border-0 bg-transparent px-0 ${fila.esManual ? "fw-bold text-primary" : ""}`}
                                                      style={{ width: "3.2rem" }}
                                                      title={fila.esManual ? `Editado a mano (calculado: ${fila.calculado.toLocaleString("es")})` : fila.semanaEmbolse?.codigo}
                                                      value={estimadoManual[clave] ?? fila.estimado}
                                                      onChange={(ev) =>
                                                        setEstimadoManual((prev) => ({ ...prev, [clave]: ev.target.value }))
                                                      }
                                                    />
                                                  ) : (
                                                    <span title={fila.semanaEmbolse?.codigo}>{fila.estimado.toLocaleString("es")}</span>
                                                  )}
                                                </div>
                                              )}
                                            </td>
                                          );
                                        })}
                                        <td className="aprovechamiento-col fw-bold">{total.toLocaleString("es")}</td>
                                        <td className="text-secondary">
                                          {semana.ratioHistorico != null ? semana.ratioHistorico.toLocaleString("es", { maximumFractionDigits: 3 }) : "—"}
                                        </td>
                                        <td>
                                          {puedeGuardar ? (
                                            <input
                                              type="number"
                                              step="0.001"
                                              className="form-control form-control-sm text-end"
                                              style={{ maxWidth: "6rem", margin: "0 auto" }}
                                              value={ratiosEditados[semana.numeroSemana] ?? ""}
                                              onChange={(ev) => {
                                                // Máximo 3 decimales — recorta lo que sobre sin
                                                // molestar mientras se sigue escribiendo (ej. "0.").
                                                const match = /^-?\d*(\.\d{0,3})?/.exec(ev.target.value);
                                                const valor = match ? match[0] : ev.target.value;
                                                setRatiosEditados((prev) => ({ ...prev, [semana.numeroSemana]: valor }));
                                              }}
                                            />
                                          ) : (
                                            <span>
                                              {ratiosEditados[semana.numeroSemana] != null && ratiosEditados[semana.numeroSemana] !== ""
                                                ? Number(ratiosEditados[semana.numeroSemana]).toLocaleString("es", { maximumFractionDigits: 3 })
                                                : "—"}
                                            </span>
                                          )}
                                        </td>
                                        <td className="aprovechamiento-col fw-bold">
                                          {cajas !== null ? cajas.toLocaleString("es") : "—"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
                      <div className="table-responsive">
                        <table className="table table-sm table-hover align-middle mb-0 small">
                          <thead className="table-light">
                            <tr>
                              <th className="sticky-col">Finca</th>
                              {semanasAEstimar.map((s) => (
                                <th key={s.uuid} className="text-center">
                                  {s.codigo}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {fincas
                              .filter((f) => f.uuid === filtroFincaUuid)
                              .map((f) => {
                              const fila = valores[f.uuid] || {};
                              return (
                                <tr key={f.uuid}>
                                  <td className="fw-medium sticky-col">
                                    {f.codigo} — {f.nombre}
                                  </td>
                                  {semanasAEstimar.map((s) => (
                                    <td key={s.uuid} className="text-center" style={{ minWidth: "5.5rem" }}>
                                      {puedeUsarGrillaBasica ? (
                                        <input
                                          type="number"
                                          min="0"
                                          step={cajasConDecimales ? "0.5" : "1"}
                                          className="form-control form-control-sm text-center rounded-3"
                                          value={fila[s.uuid] ?? ""}
                                          onChange={(e) => setValor(f.uuid, s.uuid, e.target.value)}
                                        />
                                      ) : (
                                        <span>{fila[s.uuid] === "" ? "—" : Number(fila[s.uuid]).toLocaleString("es")}</span>
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-brand rounded-3 d-flex align-items-center gap-2"
                        onClick={handleGuardar}
                        disabled={!puedeUsarGrillaBasica || guardando}
                      >
                        <FiSave /> {guardando ? "Guardando..." : "Guardar estimaciones"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary rounded-3"
                        onClick={cargarValoresExistentes}
                        disabled={!puedeUsarGrillaBasica}
                      >
                        Cargar mis estimaciones guardadas
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {vista === "ver" && (
          <div>
            {/* Filtros de la escalera: finca, año y semana (enfoque) */}
            {(fincas.length > 0 || escaleraAniosDisponibles.length > 0 || escaleraColumnas.length > 0) && (
              <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
                <div className="row g-2 align-items-end">
                  {fincas.length > 0 && (
                    <div className="col-12 col-md-5 col-lg-4">
                      <label className="form-label small fw-medium">Finca (escalera)</label>
                      <select
                        className="form-select rounded-3"
                        value={filtroEscaleraFincaUuid}
                        onChange={(e) => setFiltroEscaleraFincaUuid(e.target.value)}
                      >
                        <option value="">Todas (total)</option>
                        {fincas.map((f) => (
                          <option key={f.uuid} value={f.uuid}>
                            {f.codigo} — {f.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {escaleraAniosDisponibles.length > 0 && (
                    <div className="col-6 col-md-3 col-lg-2">
                      <label className="form-label small fw-medium">Año</label>
                      <select
                        className="form-select rounded-3"
                        value={filtroEscaleraAnio}
                        onChange={(e) => {
                          setFiltroEscaleraAnio(e.target.value);
                          setFiltroEscaleraSemanaUuid("");
                        }}
                      >
                        {escaleraAniosDisponibles.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {escaleraColumnas.length > 0 && (
                    <div className="col-6 col-md-3 col-lg-2">
                      <label className="form-label small fw-medium">Semana (enfocar)</label>
                      <select
                        className="form-select rounded-3"
                        value={filtroEscaleraSemanaUuid}
                        onChange={(e) => setFiltroEscaleraSemanaUuid(e.target.value)}
                      >
                        <option value="">Semana actual</option>
                        {escaleraColumnas.map((c) => (
                          <option key={c.uuid} value={c.uuid}>
                            {c.codigo}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="col-auto">
                    <label className="form-label small fw-medium invisible d-block">.</label>
                    <button type="button" className="btn btn-outline-secondary rounded-3" onClick={cargarEscalera} disabled={escaleraLoading}>
                      {escaleraLoading ? "Cargando..." : "Actualizar"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="card shadow-sm rounded-4 overflow-hidden escalera-card">
              {escaleraLoading && <div className="text-center text-secondary py-4 small">Cargando escalera...</div>}
              {!escaleraLoading && escaleraColumnas.length === 0 && (
                <div className="text-center text-secondary py-4 small">No hay estimaciones para mostrar en la escalera.</div>
              )}
              {!escaleraLoading && escaleraColumnas.length > 0 && (
                <div ref={escaleraWrapRef} className="table-responsive escalera-wrap">
                  <table className="table table-sm table-hover align-middle mb-0 small escalera-table">
                    <thead>
                      <tr>
                        <th className="sticky-col text-center" style={{ minWidth: "5.5rem" }} />
                        {escaleraColumnas.map((c) => {
                          const isColActual = semanaActualEscalera && c.uuid === semanaActualEscalera.uuid;
                          return (
                            <th
                              key={`sub-${c.uuid}`}
                              className={`text-center fw-medium ${isColActual ? "present-col" : ""}`}
                              title={c.codigo}
                              data-col-uuid={c.uuid}
                              style={{ minWidth: "4.6rem" }}
                            >
                              <span className="d-inline-block text-truncate" style={{ maxWidth: "4.5rem" }}>{c.codigo}</span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {escaleraFilas.map((fila, rowIndex) => {
                        const src = fila.sourceSemana;
                        const isRowActual = semanaActualEscalera && src && src.uuid === semanaActualEscalera.uuid;
                        return (
                          <tr key={src ? src.uuid : fila.sourceFecha} className={isRowActual ? "present-row" : ""}>
                            <td
                              className={`fw-medium text-center sticky-col ${isRowActual ? "present-row" : ""}`}
                              title={src ? `${src.codigo} · ${src.fechaInicio} → ${src.fechaFin}` : fila.sourceFecha}
                              style={{ minWidth: "5.5rem" }}
                            >
                              {src ? src.codigo : fila.sourceFecha}
                            </td>
                            {escaleraColumnas.map((col, colIndex) => {
                              const raw = fila.valores?.[col.uuid];
                              const hasVal = raw !== undefined && raw !== null && raw !== "";
                              const isDiagonal = src && col.uuid === src.uuid;
                              const isColActual = semanaActualEscalera && col.uuid === semanaActualEscalera.uuid;
                              const isCruceActual = isRowActual && isColActual;
                              // Fuera de la ventana de 8 semanas de esa fila no
                              // habrá nunca un dato — se deja vacío para una
                              // vista más minimalista, en vez de llenar de "—".
                              const dentroDeEscalera = filledMatrix[rowIndex]?.[colIndex] || isDiagonal;
                              return (
                                <td
                                  key={col.uuid}
                                  className={`text-center escalera-valor ${hasVal ? "fw-medium" : "text-secondary"} ${isDiagonal ? "fw-medium" : ""} ${!dentroDeEscalera ? "fuera-escalera" : ""} ${dentroDeEscalera && !hasVal ? "dentro-escalera-vacia" : ""} ${isCruceActual ? "present-cell" : isRowActual ? "present-row-cell" : ""}`}
                                  data-diag-uuid={isDiagonal ? col.uuid : undefined}
                                  style={{ minWidth: "4.6rem" }}
                                >
                                  {hasVal ? Number(raw).toLocaleString("es") : dentroDeEscalera ? "—" : ""}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {!escaleraLoading && escaleraColumnas.length > 0 && (
              <div className="small text-secondary mt-2">
                Cada fila es la <strong>semana de registro</strong> (cuándo se cargó la estimación) y cada columna la <strong>semana objetivo</strong>. El valor es la suma de cajas (20&nbsp;kg eq.) estimada. La diagonal marca el registro de la misma semana.
              </div>
            )}
          </div>
        )}

        {vista === "comparativo" && (
          <div>
            {(fincas.length > 0 || comparativoPorSemana.length > 0) && (
              <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
                <div className="row g-2 align-items-end">
                  {fincas.length > 0 && (
                    <div className="col-12 col-md-5 col-lg-4">
                      <label className="form-label small fw-medium">Finca</label>
                      <select
                        className="form-select rounded-3"
                        value={filtroComparativoFincaUuid}
                        onChange={(e) => {
                          setFiltroComparativoFincaUuid(e.target.value);
                          setGraficoFincaUuidsSel([]);
                        }}
                      >
                        <option value="">Todas</option>
                        {fincas.map((f) => (
                          <option key={f.uuid} value={f.uuid}>
                            {f.codigo} — {f.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {comparativoPorSemana.length > 0 && (
                    <div className="col-6 col-md-3 col-lg-2">
                      <label className="form-label small fw-medium">Semana</label>
                      <select
                        className="form-select rounded-3"
                        value={comparativoPaginaIdx}
                        onChange={(e) => setComparativoPaginaIdx(Number(e.target.value))}
                      >
                        {comparativoPorSemana.map((grupo, i) => (
                          <option key={grupo.semana.uuid} value={i}>
                            {grupo.semana.codigo}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="col-auto">
                    <label className="form-label small fw-medium invisible d-block">.</label>
                    <button type="button" className="btn btn-outline-secondary rounded-3" onClick={cargarComparativo} disabled={comparativoLoading}>
                      {comparativoLoading ? "Cargando..." : "Actualizar"}
                    </button>
                  </div>
                </div>

                {comparativoAniosDisponibles.length > 0 && (
                  <>
                    <hr className="my-3" />
                    <div className="d-flex align-items-center flex-wrap gap-2">
                      <span className="small fw-medium text-secondary">Exportar a Excel:</span>
                      <select
                        className="form-select form-select-sm rounded-3"
                        style={{ width: "auto" }}
                        value={filtroComparativoAnioExportar}
                        onChange={(e) => setFiltroComparativoAnioExportar(e.target.value)}
                      >
                        <option value="">Todos los años</option>
                        {comparativoAniosDisponibles.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2"
                        onClick={handleExportarComparativo}
                        disabled={exportandoComparativo}
                      >
                        <FiDownload size={14} /> {exportandoComparativo ? "Exportando..." : "Descargar Excel"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {comparativoAniosDisponibles.length > 0 && (
              <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-3 grafico-card">
                <div className="p-3 pb-2 d-flex align-items-start justify-content-between flex-wrap gap-2">
                  <div>
                    <h2 className="h6 fw-bold mb-0 d-flex align-items-center gap-2">
                      <FiBarChart2 className="text-primary" /> Estimado vs. real por semana
                    </h2>
                    <p className="text-secondary small mb-0">
                      {graficoModo === "cajas"
                        ? "Real (sólida) y estimado por revisión (punteada) — un color por revisión, un trazo por año."
                        : "Precisión de cada revisión: % de diferencia entre lo estimado y lo real producido."}
                    </p>
                  </div>
                  <div className="btn-group btn-group-sm" role="group">
                    <button
                      type="button"
                      className={`btn ${graficoModo === "cajas" ? "btn-brand" : "btn-outline-secondary"}`}
                      onClick={() => setGraficoModo("cajas")}
                    >
                      Cajas
                    </button>
                    <button
                      type="button"
                      className={`btn ${graficoModo === "porcentaje" ? "btn-brand" : "btn-outline-secondary"}`}
                      onClick={() => setGraficoModo("porcentaje")}
                    >
                      Porcentaje
                    </button>
                  </div>
                </div>

                <div className="px-3 pb-3 grafico-controles">
                  <div className="grafico-control-grupo">
                    <div className="grafico-control-label">Líneas</div>
                    <div className="d-flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-sm rounded-pill"
                        style={
                          graficoMostrarReal
                            ? { backgroundColor: GRAFICO_REAL_COLOR, borderColor: GRAFICO_REAL_COLOR, color: "#fff" }
                            : { borderColor: GRAFICO_REAL_COLOR, color: GRAFICO_REAL_COLOR }
                        }
                        onClick={() => setGraficoMostrarReal((v) => !v)}
                      >
                        Real
                      </button>
                      {GRAFICO_REVISION_LABELS.map((label, r) => {
                        const color = GRAFICO_REVISION_COLORES[r];
                        const activa = graficoRevisionesSel.includes(r);
                        return (
                          <button
                            key={r}
                            type="button"
                            className="btn btn-sm rounded-pill"
                            style={activa ? { backgroundColor: color, borderColor: color, color: "#fff" } : { borderColor: color, color }}
                            onClick={() =>
                              setGraficoRevisionesSel((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))
                            }
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grafico-control-grupo">
                    <div className="grafico-control-label">Años</div>
                    <div className="d-flex flex-wrap gap-2">
                      {comparativoAniosDisponibles.map((a) => (
                        <button
                          key={a}
                          type="button"
                          className={`btn btn-sm rounded-pill ${graficoAniosSel.includes(a) ? "btn-brand" : "btn-outline-secondary"}`}
                          onClick={() =>
                            setGraficoAniosSel((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]))
                          }
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>

                  {!filtroComparativoFincaUuid && fincas.length > 1 && (
                    <div className="grafico-control-grupo position-relative" ref={graficoFincasRef}>
                      <button
                        type="button"
                        className="grafico-control-label bg-transparent border-0 p-0 d-flex align-items-center gap-1"
                        onClick={() => setGraficoFincasColapsado((v) => !v)}
                      >
                        Fincas
                        {graficoFincaUuidsSel.length > 0 ? ` (${graficoFincaUuidsSel.length} de ${fincas.length})` : " (todas sumadas)"}
                        {graficoFincasColapsado ? <FiChevronDown size={14} /> : <FiChevronUp size={14} />}
                      </button>
                      {!graficoFincasColapsado && (
                        <div className="grafico-fincas-flotante shadow-lg rounded-4">
                          <div className="p-2 border-bottom">
                            <input
                              type="text"
                              className="form-control form-control-sm rounded-3"
                              placeholder="Buscar finca por nombre o código..."
                              value={graficoFincaBusqueda}
                              onChange={(e) => setGraficoFincaBusqueda(e.target.value)}
                              autoFocus
                            />
                          </div>
                          <div className="grafico-fincas-lista">
                            {fincas
                              .filter((f) => {
                                const q = graficoFincaBusqueda.trim().toLowerCase();
                                if (!q) return true;
                                return f.nombre.toLowerCase().includes(q) || f.codigo.toLowerCase().includes(q);
                              })
                              .sort((a, b) => a.nombre.localeCompare(b.nombre))
                              .map((f) => {
                                const activa = graficoFincaUuidsSel.includes(f.uuid);
                                return (
                                  <label key={f.uuid} className="grafico-finca-item">
                                    <input
                                      type="checkbox"
                                      checked={activa}
                                      onChange={() =>
                                        setGraficoFincaUuidsSel((prev) =>
                                          prev.includes(f.uuid) ? prev.filter((x) => x !== f.uuid) : [...prev, f.uuid],
                                        )
                                      }
                                    />
                                    <span className="text-secondary small">{f.codigo}</span>
                                    <span>{f.nombre}</span>
                                  </label>
                                );
                              })}
                          </div>
                          <div className="p-2 border-top d-flex justify-content-between">
                            <button
                              type="button"
                              className="btn btn-sm p-0 border-0 text-secondary"
                              onClick={() => setGraficoFincaUuidsSel([])}
                              disabled={graficoFincaUuidsSel.length === 0}
                            >
                              Limpiar selección
                            </button>
                            <button type="button" className="btn btn-brand btn-sm rounded-3" onClick={() => setGraficoFincasColapsado(true)}>
                              Listo
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grafico-control-grupo grafico-control-grupo-ancho">
                    <div className="grafico-control-label">Vista</div>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <select
                        className="form-select form-select-sm rounded-3"
                        style={{ width: "auto" }}
                        value={graficoSemanaDesde}
                        onChange={(e) => setGraficoSemanaDesde(e.target.value)}
                      >
                        <option value="">Semana desde</option>
                        {Array.from({ length: graficoMaxSemana }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                      <select
                        className="form-select form-select-sm rounded-3"
                        style={{ width: "auto" }}
                        value={graficoSemanaHasta}
                        onChange={(e) => setGraficoSemanaHasta(e.target.value)}
                      >
                        <option value="">Hasta</option>
                        {Array.from({ length: graficoMaxSemana }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                      {(graficoSemanaDesde || graficoSemanaHasta) && (
                        <button
                          type="button"
                          className="btn btn-sm p-0 border-0 text-secondary"
                          onClick={() => {
                            setGraficoSemanaDesde("");
                            setGraficoSemanaHasta("");
                          }}
                          title="Quitar rango"
                        >
                          Ver todo
                        </button>
                      )}
                      <span className="grafico-control-divisor" />
                      <button
                        type="button"
                        className={`btn btn-sm rounded-pill ${graficoMostrarPuntos ? "btn-brand" : "btn-outline-secondary"}`}
                        onClick={() => setGraficoMostrarPuntos((v) => !v)}
                      >
                        Puntos
                      </button>
                      <button
                        type="button"
                        className={`btn btn-sm rounded-pill ${graficoMostrarEtiquetas ? "btn-brand" : "btn-outline-secondary"}`}
                        onClick={() => setGraficoMostrarEtiquetas((v) => !v)}
                      >
                        Etiquetas
                      </button>
                      {graficoMostrarEtiquetas && (
                        <select
                          className="form-select form-select-sm rounded-3"
                          style={{ width: "auto" }}
                          value={graficoDensidadEtiquetas}
                          onChange={(e) => setGraficoDensidadEtiquetas(Number(e.target.value))}
                          title="Cada cuántos puntos mostrar la etiqueta"
                        >
                          <option value={1}>Todas</option>
                          <option value={2}>1 de cada 2</option>
                          <option value={3}>1 de cada 3</option>
                          <option value={4}>1 de cada 4</option>
                          <option value={5}>1 de cada 5</option>
                        </select>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grafico-lienzo" style={{ height: "26rem" }}>
                  {graficoSeries.length === 0 || graficoData.length === 0 ? (
                    <div className="d-flex align-items-center justify-content-center h-100 text-secondary small">
                      Elegí al menos un año para ver la gráfica.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={graficoData} margin={{ top: 5, right: 10, left: -5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="numeroSemana" tick={{ fontSize: 10 }} domain={graficoDominioX} type="number" allowDecimals={false} />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          width={45}
                          domain={graficoModo === "porcentaje" ? ["auto", "auto"] : ["dataMin", "dataMax"]}
                          unit={graficoModo === "porcentaje" ? "%" : ""}
                        />
                        <Tooltip
                          formatter={(value, name) => [
                            graficoModo === "porcentaje" ? `${value > 0 ? "+" : ""}${value}%` : Number(value).toLocaleString("es"),
                            name,
                          ]}
                          labelFormatter={(l) => `Semana ${l}`}
                        />
                        <Legend wrapperStyle={{ fontSize: "0.72rem" }} />
                        {graficoModo === "porcentaje" && <ReferenceLine y={0} stroke="#6c757d" strokeDasharray="3 3" />}
                        {graficoModo === "cajas" &&
                          graficoMostrarReal &&
                          graficoSeries.map(({ anio, dash }) => (
                            <Line
                              key={`real-${anio}`}
                              type="monotone"
                              dataKey={`real_${anio}`}
                              name={`Real ${anio}`}
                              stroke={GRAFICO_REAL_COLOR}
                              strokeWidth={2}
                              strokeDasharray={dash}
                              dot={graficoMostrarPuntos ? { r: 3, strokeWidth: 1, fill: GRAFICO_REAL_COLOR } : false}
                              connectNulls={false}
                            >
                              {graficoMostrarEtiquetas && (
                                <LabelList
                                  dataKey={`real_${anio}`}
                                  content={etiquetaConDensidad(
                                    GRAFICO_REAL_COLOR,
                                    (v) => Number(v).toLocaleString("es"),
                                    graficoDensidadEtiquetas,
                                  )}
                                />
                              )}
                            </Line>
                          ))}
                        {graficoModo === "cajas" &&
                          graficoSeries.flatMap(({ anio, dash }) =>
                            graficoRevisionesSel.map((r) => (
                              <Line
                                key={`estimado-${anio}-r${r}`}
                                type="monotone"
                                dataKey={`estimado_${anio}_r${r}`}
                                name={`${GRAFICO_REVISION_LABELS[r]} ${anio}`}
                                stroke={GRAFICO_REVISION_COLORES[r]}
                                strokeWidth={1.5}
                                strokeDasharray={dash}
                                dot={graficoMostrarPuntos ? { r: 3, strokeWidth: 1, fill: GRAFICO_REVISION_COLORES[r] } : false}
                                connectNulls={false}
                              >
                                {graficoMostrarEtiquetas && (
                                  <LabelList
                                    dataKey={`estimado_${anio}_r${r}`}
                                    content={etiquetaConDensidad(
                                      GRAFICO_REVISION_COLORES[r],
                                      (v) => Number(v).toLocaleString("es"),
                                      graficoDensidadEtiquetas,
                                    )}
                                  />
                                )}
                              </Line>
                            )),
                          )}
                        {graficoModo === "porcentaje" &&
                          graficoSeries.flatMap(({ anio, dash }) =>
                            graficoRevisionesSel.map((r) => (
                              <Line
                                key={`porcentaje-${anio}-r${r}`}
                                type="monotone"
                                dataKey={`porcentaje_${anio}_r${r}`}
                                name={`${GRAFICO_REVISION_LABELS[r]} ${anio}`}
                                stroke={GRAFICO_REVISION_COLORES[r]}
                                strokeWidth={1.5}
                                strokeDasharray={dash}
                                dot={graficoMostrarPuntos ? { r: 3, strokeWidth: 1, fill: GRAFICO_REVISION_COLORES[r] } : false}
                                connectNulls={false}
                              >
                                {graficoMostrarEtiquetas && (
                                  <LabelList
                                    dataKey={`porcentaje_${anio}_r${r}`}
                                    content={etiquetaConDensidad(
                                      GRAFICO_REVISION_COLORES[r],
                                      (v) => `${v > 0 ? "+" : ""}${v}%`,
                                      graficoDensidadEtiquetas,
                                    )}
                                  />
                                )}
                              </Line>
                            )),
                          )}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            )}

            <p className="small text-secondary mb-3">
              Compara, semana por semana, cuánto se estimó contra cuánto se produjo realmente (Producción Semanal) — mostrando las <strong>últimas 3 revisiones</strong> cargadas para esa semana (la más reciente primero). Las semanas futuras no aparecen — todavía no tienen producción real que comparar.
            </p>

            {!comparativoLoading && comparativoPorSemana.length > 0 && (
              <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm rounded-3"
                  onClick={() => setComparativoPaginaIdx((i) => Math.max(i - 1, 0))}
                  disabled={comparativoPaginaIdx <= 0}
                >
                  ← Semana anterior
                </button>
                <div className="small text-secondary text-center">
                  Semana <strong>{comparativoPorSemana[comparativoPaginaIdx]?.semana.codigo}</strong> — {comparativoPaginaIdx + 1} de {comparativoPorSemana.length} · Real total: <strong>{comparativoPorSemana[comparativoPaginaIdx]?.realTotal.toLocaleString("es")}</strong> cajas
                </div>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm rounded-3"
                  onClick={() => setComparativoPaginaIdx((i) => Math.min(i + 1, comparativoPorSemana.length - 1))}
                  disabled={comparativoPaginaIdx >= comparativoPorSemana.length - 1}
                >
                  Semana siguiente →
                </button>
              </div>
            )}

            <div className="card border-0 shadow-sm rounded-4 overflow-hidden comparativo-card">
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0 small comparativo-table">
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ minWidth: "12rem", verticalAlign: "bottom" }}>
                        <SortableTh label="Finca" sortKey="finca" orden={comparativoOrden} onSort={alternarOrdenComparativo} />
                      </th>
                      <th rowSpan={2} className="text-end" style={{ minWidth: "5.5rem", verticalAlign: "bottom" }}>
                        <SortableTh label="Real" sortKey="real" orden={comparativoOrden} onSort={alternarOrdenComparativo} align="end" />
                      </th>
                      {GRAFICO_REVISION_LABELS.map((label, r) => (
                        <th key={r} colSpan={3} className="text-center comparativo-rev-header">
                          {label}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {[0, 1, 2].map((r) => (
                        <Fragment key={r}>
                          <th className="text-center" style={{ minWidth: "5rem" }}>
                            <SortableTh label="Semana" sortKey={`r${r}_semana`} orden={comparativoOrden} onSort={alternarOrdenComparativo} align="center" />
                          </th>
                          <th className="text-center" style={{ minWidth: "5rem" }}>
                            <SortableTh label="Estimado" sortKey={`r${r}_estimado`} orden={comparativoOrden} onSort={alternarOrdenComparativo} align="center" />
                          </th>
                          <th className="text-center" style={{ minWidth: "5.5rem" }}>
                            <SortableTh label="Dif. %" sortKey={`r${r}_pct`} orden={comparativoOrden} onSort={alternarOrdenComparativo} align="center" />
                          </th>
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparativoLoading && (
                      <tr>
                        <td colSpan={11} className="text-center text-secondary py-4">
                          Cargando...
                        </td>
                      </tr>
                    )}
                    {!comparativoLoading && comparativoPorSemana.length === 0 && (
                      <tr>
                        <td colSpan={11} className="text-center text-secondary py-4">
                          No hay semanas con estimación y producción real para comparar todavía.
                        </td>
                      </tr>
                    )}
                    {!comparativoLoading &&
                      comparativoItemsOrdenados.map((it) => (
                        <tr key={it.finca.uuid}>
                          <td className="fw-medium">{it.finca.codigo} — {it.finca.nombre}</td>
                          <td className="text-end fw-medium">{it.real.toLocaleString("es")}</td>
                          {[0, 1, 2].map((r) => {
                            const rev = it.revisiones?.[r];
                            if (!rev) {
                              return (
                                <Fragment key={r}>
                                  <td className="text-center text-secondary comparativo-rev-sep">—</td>
                                  <td className="text-center text-secondary">—</td>
                                  <td className="text-center text-secondary">—</td>
                                </Fragment>
                              );
                            }
                            const tono = rev.diferencia > 0 ? "pos" : rev.diferencia < 0 ? "neg" : "neutro";
                            return (
                              <Fragment key={r}>
                                <td className="text-center text-secondary comparativo-rev-sep">{rev.semanaRegistro?.codigo || "—"}</td>
                                <td className="text-center fw-medium">{rev.estimado.toLocaleString("es")}</td>
                                <td className="text-center">
                                  <span className={`rev-pill rev-pill-${tono}`}>
                                    {rev.diferencia > 0 ? "+" : ""}{rev.diferencia.toLocaleString("es")}
                                    {" · "}
                                    {rev.porcentaje === null ? "—" : `${rev.porcentaje > 0 ? "+" : ""}${rev.porcentaje}%`}
                                  </span>
                                </td>
                              </Fragment>
                            );
                          })}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="d-flex align-items-center gap-1 mt-4 text-secondary small">
          <FiList /> Solo ves las fincas que tienes habilitadas y tus propias estimaciones.
        </div>
      </div>

      <style jsx>{`
        .comparativo-card {
          border: 1px solid #e5e7eb;
        }
        .comparativo-rev-header {
          border-left: 2px solid #adb5bd;
        }
        .comparativo-table tbody td.comparativo-rev-sep {
          border-left: 2px solid #adb5bd;
        }
        .comparativo-table tbody tr:nth-child(even) {
          background-color: #fafbfc;
        }
        .grafico-card {
          border: 1px solid #e5e7eb;
        }
        .grafico-controles {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          gap: 1.25rem 2rem;
          background-color: #fafbfc;
          border-top: 1px solid #f1f3f5;
          border-bottom: 1px solid #f1f3f5;
          padding-top: 0.9rem;
        }
        .grafico-control-grupo {
          min-width: 9rem;
        }
        .grafico-control-grupo-ancho {
          flex: 1 1 100%;
          padding-top: 0.6rem;
          border-top: 1px dashed #e5e7eb;
        }
        .grafico-control-label {
          font-size: 0.72rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: #adb5bd;
          margin-bottom: 0.4rem;
        }
        .grafico-control-divisor {
          width: 1px;
          height: 1.5rem;
          background-color: #dee2e6;
          margin: 0 0.25rem;
        }
        .grafico-lienzo {
          padding: 1rem 0.75rem 0.5rem;
        }
        .aprovechamiento-col {
          background-color: #f0fdf4 !important;
          border-left: 2px solid #86efac !important;
          color: #15803d;
        }
        .resumen-racimos-card table td,
        .resumen-racimos-card table th {
          padding: 0.35rem 0.5rem;
          vertical-align: middle;
        }
        .resumen-racimos-card .form-control {
          padding-top: 0.15rem;
          padding-bottom: 0.15rem;
        }
        .grafico-fincas-flotante {
          position: absolute;
          top: calc(100% + 0.4rem);
          left: 0;
          z-index: 20;
          width: 20rem;
          max-width: 90vw;
          background-color: #fff;
          border: 1px solid #e5e7eb;
        }
        .grafico-fincas-lista {
          max-height: 16rem;
          overflow-y: auto;
          padding: 0.25rem 0;
        }
        .grafico-finca-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 0.9rem;
          margin: 0;
          cursor: pointer;
          font-size: 0.8rem;
        }
        .grafico-finca-item:hover {
          background-color: #f8f9fa;
        }
        .comparativo-table thead th {
          background-color: #fff;
          color: #6c757d;
          font-weight: 600;
          border-bottom: 1px solid #e5e7eb;
        }
        .comparativo-table tbody td {
          border-bottom: 1px solid #f1f3f5;
          padding-top: 0.6rem;
          padding-bottom: 0.6rem;
        }
        .rev-semana {
          font-size: 0.68rem;
          color: #adb5bd;
        }
        .rev-pill {
          display: inline-block;
          padding: 0.1rem 0.5rem;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 600;
          white-space: nowrap;
        }
        .rev-pill-pos {
          background-color: #dcf3e6;
          color: #15803d;
        }
        .rev-pill-neg {
          background-color: #fde8e8;
          color: #b91c1c;
        }
        .rev-pill-neutro {
          background-color: #f1f3f5;
          color: #6c757d;
        }
        .btn-brand {
          background-color: #16a34a;
          border-color: #16a34a;
          color: #fff;
        }
        .btn-brand:hover {
          background-color: #15803d;
          border-color: #15803d;
          color: #fff;
        }
        .sticky-col {
          position: sticky;
          left: 0;
          background-color: #fff;
          z-index: 1;
          min-width: 12rem;
        }
        thead .sticky-col {
          background-color: #f8f9fa;
        }
        .escalera-card {
          border: 1px solid #e5e7eb;
        }
        .escalera-table {
          font-variant-numeric: tabular-nums;
          border-collapse: collapse;
        }
        .escalera-table tbody td {
          background-color: #fff !important;
          color: #1f2937 !important;
          border: none;
          border-bottom: 1px solid #f1f3f5;
        }
        .escalera-table tbody td.escalera-valor {
          font-size: 0.72rem;
        }
        .escalera-table tbody td.fuera-escalera {
          background-color: #e9ecef !important;
        }
        .escalera-table tbody td.dentro-escalera-vacia {
          background-color: #f1f8f4 !important;
        }
        .escalera-table td, .escalera-table th {
          border-left: none;
          border-right: none;
          border-top: none;
        }
        .escalera-table .sticky-col,
        .escalera-table thead th.sticky-col,
        .escalera-table tbody td.sticky-col {
          background-color: var(--brand-900) !important;
          color: #fff !important;
          font-weight: 600;
          border: none !important;
        }
        .present-col {
          background-color: #15803d !important;
          color: #fff !important;
        }
        .escalera-table .present-row td.sticky-col {
          background-color: #dcf3e6 !important;
          color: #14532d !important;
        }
        .present-row {
          background-color: #fafbfa !important;
        }
        .escalera-table tbody td.present-row-cell {
          background-color: #e3f2e9 !important;
        }
        .escalera-table tbody td.present-cell {
          background-color: #dcf3e6 !important;
          color: #14532d !important;
          font-weight: 700 !important;
          border-bottom: 1px solid #f1f3f5;
        }
        @media (max-width: 768px) {
          .sticky-col {
            min-width: 9rem;
          }
        }
        .escalera-wrap {
          overflow: auto;
          max-height: 70vh;
        }
        .escalera-table thead {
          position: sticky;
          top: 0;
          z-index: 2;
        }
        .escalera-table thead th {
          background-color: var(--brand-900);
          color: #fff;
          font-weight: 600;
          border: none;
        }
        .escalera-table thead th.sticky-col {
          position: sticky;
          left: 0;
          z-index: 3;
        }
        .escalera-table thead th.sticky-col:first-child {
          z-index: 4;
        }
      `}</style>
    </RequirePermission>
  );
}