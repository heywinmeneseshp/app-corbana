"use client";

import { FiPackage } from "react-icons/fi";
import MetricaAnualChart from "@/components/reportes/MetricaAnualChart";

export default function CajasProducidasPage() {
  return (
    <MetricaAnualChart
      permCode="menu.reportes"
      icon={FiPackage}
      titulo="Cajas Producidas"
      subtitulo="Cajas producidas por semana de registro, comparativa anual."
      arrayField="ratioAnual"
      metricKey="cajas"
      color="#16a34a"
      prefix="Cajas"
      rankingArrayField="rankingCajasRatio"
      rankingMetricKey="cajas"
      rankingMostrarParticipacion
      rankingSemanalKey="cajas"
    />
  );
}
