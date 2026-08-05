"use client";

import { useState } from "react";
import { Calendar } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { localizer, ocurrenciasAEventos } from "@/lib/laborCalendarBuilder";
import LaborIconBadge from "@/components/calendario-labores/LaborIconBadge";
import EstadoLaborBadge from "@/components/calendario-labores/EstadoLaborBadge";
import { esAdministrador, estaBloqueada } from "@/lib/laborEstados";

const RBC_MESSAGES = {
  today: "Hoy",
  previous: "Atrás",
  next: "Siguiente",
  week: "Semana",
  day: "Día",
  agenda: "Agenda",
  date: "Fecha",
  time: "Hora",
  event: "Evento",
  noEventsInRange: "No hay labores programadas en este rango.",
  showMore: (total) => `+ ${total} más`,
};

const ESTADOS = {
  PROGRAMADA: "Programada",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
  VENCIDA: "Vencida",
};

function horaHHmm(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function fechaCorta(date) {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function nombreCompleto(u) {
  return `${u?.nombre || ""} ${u?.apellido || ""}`.trim();
}

function fechaISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Número de semana (del catálogo de semanas del año) para una fecha dada.
function numeroSemanaDe(fechaISOStr, semanas) {
  const s = semanas?.find((sem) => fechaISOStr >= sem.fechaInicio && fechaISOStr <= sem.fechaFin);
  return s?.numeroSemana ?? null;
}

// Toolbar propio: "Hoy / Atrás / Siguiente" + la fecha que se visualiza con
// su número de semana.
function ToolbarRBC({ label, date, onNavigate, semanas }) {
  const semana = numeroSemanaDe(fechaISO(date), semanas);
  return (
    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <div className="d-flex gap-2">
        <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => onNavigate("TODAY")}>
          Hoy
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => onNavigate("PREV")}>
          Atrás
        </button>
        <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => onNavigate("NEXT")}>
          Siguiente
        </button>
      </div>
      <span className="small fw-medium">
        {label}
        {semana != null && <span className="text-secondary ms-2">Semana {semana}</span>}
      </span>
    </div>
  );
}

const DnDCalendar = withDragAndDrop(Calendar);

// Convierte un color hex a rgba con la opacidad dada (para fondos claros y
// traslúcidos estilo Google Calendar).
function colorConAlpha(hex, alpha) {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex || "");
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Cada labor se pinta como un cuadro con el color de la labor de fondo, claro
// y traslúcido, con una franja izquierda en el color pleno (como Google
// Calendar). El color vive además en el icono de LaborIconBadge.
function eventPropGetter(event) {
  const color = event.resource?.labor?.color || "#16a34a";
  return {
    style: {
      backgroundColor: colorConAlpha(color, 0.12),
      borderLeft: `3px solid ${color}`,
      borderRadius: "4px",
      color: "#1e293b",
      padding: "2px 4px",
    },
  };
}

function EventoCalendario({ event }) {
  const oc = event.resource;
  return (
    <div data-uuid={event.id} style={{ width: "100%", minWidth: 0, cursor: "pointer" }} title={event.title}>
      <div className="d-flex align-items-center gap-1" style={{ fontSize: "0.72rem", lineHeight: 1.15, minWidth: 0 }}>
        <LaborIconBadge icono={oc?.labor?.icono} color={oc?.labor?.color} size={14} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
          {event.title}
        </span>
        <EstadoLaborBadge ocurrencia={oc} />
      </div>
      {!event.allDay && (
        <div className="text-secondary" style={{ fontSize: "0.68rem", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {horaHHmm(event.start)}
        </div>
      )}
      {oc?.lote && (
        <div className="text-secondary" style={{ fontSize: "0.68rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
          {oc.lote.nombre}
        </div>
      )}
    </div>
  );
}

// Tooltip con la información de la labor al pasar el mouse sobre el cuadro
// (igual que Google Calendar).
function TooltipLabor({ x, y, evento }) {
  if (!evento) return null;
  const oc = evento.resource;
  const left = Math.min(x + 14, window.innerWidth - 280);
  const top = Math.min(y + 14, window.innerHeight - 220);
  return (
    <div
      className="bg-white border rounded-3 shadow-sm px-3 py-2"
      style={{ position: "fixed", left, top, zIndex: 2000, pointerEvents: "none", maxWidth: 260, fontSize: "0.78rem" }}
    >
      <div className="d-flex align-items-center gap-2 mb-1">
        <span className="d-inline-block rounded-circle flex-shrink-0" style={{ width: 10, height: 10, backgroundColor: oc?.labor?.color || "#16a34a" }} />
        <span className="fw-bold">{oc?.labor?.nombre || evento.title}</span>
      </div>
      <div className="text-secondary">
        {oc?.lote && <div>Lote: {oc.lote.nombre}</div>}
        <div>Fecha: {fechaCorta(evento.start)}</div>
        {!evento.allDay && (
          <div>
            Hora: {horaHHmm(evento.start)} - {horaHHmm(evento.end)}
          </div>
        )}
        {oc?.responsable && <div>Responsable: {nombreCompleto(oc.responsable)}</div>}
        <div>Estado: {ESTADOS[oc?.estado] || oc?.estado}</div>
        {oc?.observaciones && <div style={{ whiteSpace: "pre-wrap" }}>Obs: {oc.observaciones}</div>}
      </div>
    </div>
  );
}

// Vistas Semanal / Diaria (react-big-calendar). Sin fetch propio: recibe las
// ocurrencias ya cargadas y delega toda mutación al padre.
export default function VistaCalendarioRBC({
  vista,
  ocurrencias,
  fechaFoco,
  onNavigate,
  puedeCrear,
  puedeEditar,
  onSelectSlot,
  onSelectEvent,
  onMoverOcurrencia,
  semanas,
}) {
  const eventos = ocurrenciasAEventos(ocurrencias);
  const [tooltip, setTooltip] = useState(null); // { x, y, evento } | null

  // Hover a nivel de tarjeta: cubre todo el cuadro del evento (incluida la
  // zona de la hora de react-big-calendar). Se identifica la ocurrencia por
  // el data-uuid del contenido y el tooltip se oculta al salir del cuadro.
  function handleMouseOver(e) {
    const box = e.target.closest?.(".rbc-event");
    const contenido = box?.querySelector("[data-uuid]");
    const uuid = contenido?.dataset?.uuid;
    if (!uuid) return;
    const evento = eventos.find((ev) => ev.id === uuid);
    if (evento) setTooltip({ x: e.clientX, y: e.clientY, evento });
  }

  function handleMouseMove(e) {
    if (!tooltip) return;
    if (!e.target.closest?.(".rbc-event")) return;
    setTooltip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t));
  }

  function handleMouseOut(e) {
    const relacionado = e.relatedTarget;
    if (!relacionado?.closest?.(".rbc-event") && tooltip) setTooltip(null);
  }

  // Solo se puede arrastrar/redimensionar/editar si el usuario tiene permiso
  // y la tarea no está bloqueada (completada o con fecha pasada). El rol de
  // administrador siempre puede.
  const acceso = (oc) => puedeEditar && (esAdministrador() || !estaBloqueada(oc));

  return (
    <div
      className="card border-0 shadow-sm rounded-4 p-3 hojas-calendario-rbc"
      style={{ height: 750 }}
      onMouseOver={handleMouseOver}
      onMouseMove={handleMouseMove}
      onMouseOut={handleMouseOut}
    >
      <style>{`.hojas-calendario-rbc .rbc-event-label { display: none !important; }`}</style>
      <DnDCalendar
        localizer={localizer}
        culture="es"
        messages={RBC_MESSAGES}
        events={eventos}
        date={fechaFoco}
        onNavigate={onNavigate}
        view={vista === "semanal" ? "week" : "day"}
        views={vista === "semanal" ? ["week"] : ["day"]}
        onView={() => {}}
        selectable={puedeCrear}
        onSelectSlot={onSelectSlot}
        onSelectEvent={(evt) => {
          setTooltip(null);
          onSelectEvent(evt.resource);
        }}
        eventPropGetter={eventPropGetter}
        components={{
          event: EventoCalendario,
          toolbar: (props) => <ToolbarRBC {...props} semanas={semanas} />,
        }}
        resizable={puedeEditar}
        draggableAccessor={(event) => acceso(event.resource)}
        resizableAccessor={(event) => acceso(event.resource)}
        onEventDrop={({ event, start, end }) => onMoverOcurrencia(event.resource, start, end)}
        onEventResize={({ event, start, end }) => onMoverOcurrencia(event.resource, start, end)}
        // "no-overlap": si dos labores caen en el mismo horario, cada una
        // ocupa toda la fila (se apilan hacia abajo) en vez de partirse en
        // columnas angostas donde el texto/icono termina superpuesto.
        dayLayoutAlgorithm="no-overlap"
        popup
      />
      {tooltip && <TooltipLabor x={tooltip.x} y={tooltip.y} evento={tooltip.evento} />}
    </div>
  );
}
