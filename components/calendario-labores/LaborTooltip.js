"use client";

const ESTADO_LABEL = {
  PROGRAMADA: "Programada",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
};

function nombreCompleto(u) {
  return `${u.nombre} ${u.apellido}`.trim();
}

// Tooltip propio (sin librería nueva): posicionado "fixed" con las
// coordenadas que le pasa LaborItem al hacer hover, así escapa cualquier
// contenedor con overflow (la tabla con scroll horizontal).
export default function LaborTooltip({ ocurrencia, position }) {
  const vencida = ocurrencia.estado === "PROGRAMADA" && ocurrencia.fecha < new Date().toISOString().slice(0, 10);

  return (
    <div
      className="bg-dark text-white rounded-3 shadow p-3 small"
      style={{
        position: "fixed",
        left: position.x,
        top: position.y + 6,
        zIndex: 2000,
        width: 240,
        pointerEvents: "none",
      }}
    >
      <div className="fw-bold mb-1">{ocurrencia.labor?.nombre}</div>
      {ocurrencia.labor?.categoria && <div className="text-white-50 mb-2">{ocurrencia.labor.categoria.nombre}</div>}
      <div className="d-flex justify-content-between">
        <span className="text-white-50">Fecha</span>
        <span>{ocurrencia.fecha}</span>
      </div>
      {ocurrencia.hora && (
        <div className="d-flex justify-content-between">
          <span className="text-white-50">Hora</span>
          <span>{ocurrencia.hora.slice(0, 5)}</span>
        </div>
      )}
      <div className="d-flex justify-content-between">
        <span className="text-white-50">Responsable</span>
        <span>{ocurrencia.responsable ? nombreCompleto(ocurrencia.responsable) : "Sin asignar"}</span>
      </div>
      <div className="d-flex justify-content-between">
        <span className="text-white-50">Estado</span>
        <span>{vencida ? "Vencida" : ESTADO_LABEL[ocurrencia.estado] || ocurrencia.estado}</span>
      </div>
      {ocurrencia.observaciones && <div className="text-white-50 mt-2 border-top border-secondary pt-2">{ocurrencia.observaciones}</div>}
    </div>
  );
}
