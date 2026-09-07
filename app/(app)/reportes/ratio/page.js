"use client";

import { FiActivity } from "react-icons/fi";
import MetricaAnualChart from "@/components/reportes/MetricaAnualChart";

export default function RatioPage() {
  return (
    <MetricaAnualChart
      permCode="menu.reportes"
      icon={FiActivity}
      titulo="Ratio"
      subtitulo="Cajas producidas / racimos procesados, por semana."
      arrayField="ratioAnual"
      metricKey="ratio"
      color="#6d28d9"
      decimal
      prefix="Ratio"
      referenceLineAt={1}
      rankingArrayField="rankingCajasRatio"
      rankingMetricKey="ratio"
      rankingSemanalKey="ratio"
    />
  );
}
