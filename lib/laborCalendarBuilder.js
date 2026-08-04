import { dateFnsLocalizer } from "react-big-calendar";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import es from "date-fns/locale/es";

// Helpers puros para el Calendario de Labores: la Vista anual por semanas
// (grid propio) y las vistas Semanal/Diaria/Por Lote (react-big-calendar).
// Las filas de la vista anual son las semanas reales del negocio (el mismo
// maestro `Semana` que usa todo el módulo de racimos/embolse), no un cálculo
// ISO aparte — así el calendario de labores queda alineado con las semanas
// que la finca ya usa para programar y reportar.

export const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: es }),
  getDay,
  locales: { es },
});

// Convierte una ocurrencia (fecha + hora opcional + duración opcional) en un
// evento de react-big-calendar. Sin hora, queda como evento "todo el día".
export function ocurrenciaAEvento(oc) {
  const [y, m, d] = oc.fecha.split("-").map(Number);
  if (!oc.hora) {
    const dia = new Date(y, m - 1, d);
    return { id: oc.uuid, title: oc.labor?.nombre || "Labor", start: dia, end: dia, allDay: true, resource: oc };
  }
  const [hh, mm] = oc.hora.split(":").map(Number);
  const start = new Date(y, m - 1, d, hh, mm);
  const end = new Date(start.getTime() + (oc.duracionMinutos || 60) * 60000);
  return { id: oc.uuid, title: oc.labor?.nombre || "Labor", start, end, allDay: false, resource: oc };
}

export function ocurrenciasAEventos(ocurrencias) {
  return ocurrencias.map(ocurrenciaAEvento);
}

const MESES_ABBR = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function parseLocalDate(fechaIso) {
  const [y, m, d] = fechaIso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatRangoSemana(fechaInicio, fechaFin) {
  const inicio = parseLocalDate(fechaInicio);
  const fin = parseLocalDate(fechaFin);
  return `${inicio.getDate()} ${MESES_ABBR[inicio.getMonth()]} - ${fin.getDate()} ${MESES_ABBR[fin.getMonth()]}`;
}

// Encuentra a qué semana pertenece una fecha (YYYY-MM-DD), respetando el
// rango real (fechaInicio/fechaFin) de cada semana generada para el año.
export function ubicarSemana(fecha, semanas) {
  return semanas.find((s) => fecha >= s.fechaInicio && fecha <= s.fechaFin) || null;
}

// Agrupa las ocurrencias en un mapa "semanaUuid:loteUuid" -> [ocurrencias],
// para que el grid haga lookups O(1) por celda en vez de filtrar el arreglo
// completo en cada render.
export function agruparPorSemanaYLote(ocurrencias, semanas) {
  const mapa = new Map();
  for (const oc of ocurrencias) {
    const semana = ubicarSemana(oc.fecha, semanas);
    if (!semana || !oc.lote) continue;
    const key = `${semana.uuid}:${oc.lote.uuid}`;
    if (!mapa.has(key)) mapa.set(key, []);
    mapa.get(key).push(oc);
  }
  return mapa;
}

export function celdaKey(semanaUuid, loteUuid) {
  return `${semanaUuid}:${loteUuid}`;
}
