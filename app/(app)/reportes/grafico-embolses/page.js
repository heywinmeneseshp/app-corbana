"use client";

import { GiBananaBunch } from "react-icons/gi";
import GraficoMovimientoAnual from "@/components/reportes/GraficoMovimientoAnual";

export default function GraficoEmbolsesPage() {
  return (
    <GraficoMovimientoAnual
      permCode="menu.racimos.reporte_embolses"
      icon={GiBananaBunch}
      titulo="Gráfico de Embolses"
      subtitulo="Total de racimos embolsados por semana, comparativa multi-año."
      tipo="EMBOLSE"
      colorPrincipal="#16a34a"
      etiquetaMetrica="Embolsado"
    />
  );
}
