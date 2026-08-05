"use client";

import { FiCheckCircle, FiXCircle, FiAlertTriangle } from "react-icons/fi";
import { esOcurrenciaRetrasada } from "@/lib/laborEstados";

// Indicador de estado de una labor: visto bueno (completada), X (cancelada)
// o advertencia (retrasada). Las programadas vigentes no muestran nada.
export default function EstadoLaborBadge({ ocurrencia }) {
  if (ocurrencia.estado === "COMPLETADA") {
    return <FiCheckCircle size={14} color="#16a34a" title="Completada" className="flex-shrink-0" />;
  }
  if (ocurrencia.estado === "CANCELADA") {
    return <FiXCircle size={14} color="#dc2626" title="Cancelada" className="flex-shrink-0" />;
  }
  if (esOcurrenciaRetrasada(ocurrencia)) {
    return <FiAlertTriangle size={14} color="#d97706" title="Retrasada" className="flex-shrink-0" />;
  }
  return null;
}