"use client";

import { FiCheckCircle } from "react-icons/fi";
import MetricaAnualChart from "@/components/reportes/MetricaAnualChart";

export default function AprovechamientoPage() {
  return (
    <MetricaAnualChart
      permCode="menu.reportes"
      icon={FiCheckCircle}
      titulo="Aprovechamiento"
      subtitulo="(Recusado + Procesado) / Embolsado, por semana."
      arrayField="aprovechamientoAnual"
      metricKey="aprovechamiento"
      color="#047857"
      decimal
      prefix="Aprov."
      yDomain={[0, 100]}
      yUnit="%"
      rankingArrayField="rankingAprovechamiento"
      rankingMetricKey="aprovechamiento"
      rankingUnit="%"
      rankingSemanalKey="aprovechamiento"
    />
  );
}
