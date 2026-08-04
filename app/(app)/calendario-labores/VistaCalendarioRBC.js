"use client";

import { Calendar } from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { FiClock } from "react-icons/fi";
import { localizer, ocurrenciasAEventos } from "@/lib/laborCalendarBuilder";
import LaborIconBadge from "@/components/calendario-labores/LaborIconBadge";

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

function horaHHmm(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

const DnDCalendar = withDragAndDrop(Calendar);

// Sin rectángulos de color: el color vive únicamente en el icono de
// LaborIconBadge, igual que en la Vista anual.
function eventPropGetter() {
  return {
    style: {
      backgroundColor: "transparent",
      border: "none",
      color: "#1e293b",
      padding: 0,
    },
  };
}

function EventoCalendario({ event }) {
  const oc = event.resource;
  return (
    <div className="d-flex align-items-center gap-1" style={{ fontSize: "0.75rem", lineHeight: 1.2 }} title={event.title}>
      <LaborIconBadge icono={oc?.labor?.icono} color={oc?.labor?.color} size={14} />
      <span className="text-truncate">{event.title}</span>
      {!event.allDay && (
        <span className="d-flex align-items-center gap-1 text-secondary flex-shrink-0">
          <FiClock size={10} /> {horaHHmm(event.start)}
        </span>
      )}
      {oc?.lote && <span className="text-secondary text-truncate">· {oc.lote.nombre}</span>}
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
}) {
  const eventos = ocurrenciasAEventos(ocurrencias);

  return (
    <div className="card border-0 shadow-sm rounded-4 p-3" style={{ height: 750 }}>
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
        onSelectEvent={(evt) => onSelectEvent(evt.resource)}
        eventPropGetter={eventPropGetter}
        components={{ event: EventoCalendario }}
        resizable={puedeEditar}
        draggableAccessor={() => puedeEditar}
        onEventDrop={({ event, start, end }) => onMoverOcurrencia(event.resource, start, end)}
        onEventResize={({ event, start, end }) => onMoverOcurrencia(event.resource, start, end)}
        // "no-overlap": si dos labores caen en el mismo horario, cada una
        // ocupa toda la fila (se apilan hacia abajo) en vez de partirse en
        // columnas angostas donde el texto/icono termina superpuesto.
        dayLayoutAlgorithm="no-overlap"
        popup
      />
    </div>
  );
}
