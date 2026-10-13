"use client";

import { FiMaximize } from "react-icons/fi";
import MetricaAnualChart from "@/components/reportes/MetricaAnualChart";

// Hectáreas en producción por semana y lo que se produce por cada una. Mismos filtros que el resto de reportes anuales
// (finca/selecciones, año y semana); las tres vistas salen de la misma consulta (/dashboard/resumen → hectareasAnual).
const METRICAS = [
  {
    id: "hectareas",
    label: "Hectáreas en producción",
    titulo: "Hectáreas en producción",
    subtitulo: "Hectáreas en producción por semana (área vigente de cada lote en esa semana).",
    arrayField: "hectareasAnual",
    metricKey: "hectareas",
    color: "#0f766e",
    decimal: true,
    prefix: "Hectáreas",
  },
  {
    id: "embolsesPorHa",
    label: "Embolses por hectárea",
    titulo: "Embolses por hectárea",
    subtitulo: "Racimos embolsados en la semana ÷ hectáreas en producción de esa semana.",
    arrayField: "hectareasAnual",
    metricKey: "embolsesPorHa",
    color: "#2563eb",
    decimal: true,
    prefix: "Embolses / ha",
  },
  {
    id: "cajasPorHa",
    label: "Cajas por hectárea",
    titulo: "Cajas por hectárea",
    subtitulo: "Cajas producidas en la semana ÷ hectáreas en producción de esa semana.",
    arrayField: "hectareasAnual",
    metricKey: "cajasPorHa",
    color: "#16a34a",
    decimal: true,
    prefix: "Cajas / ha",
  },
];

export default function HectareasPage() {
  return <MetricaAnualChart permCode="menu.reportes" icon={FiMaximize} metricas={METRICAS} />;
}
