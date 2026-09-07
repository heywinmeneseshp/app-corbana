"use client";

import { GiCancel } from "react-icons/gi";
import GraficoMovimientoAnual from "@/components/reportes/GraficoMovimientoAnual";

export default function GraficoRepiquesPage() {
  return (
    <GraficoMovimientoAnual
      permCode="menu.racimos.reporte_repiques"
      icon={GiCancel}
      titulo="Gráfico de Repiques"
      subtitulo="Total de racimos repicados por semana, comparativa multi-año."
      tipo="REPIQUE"
      colorPrincipal="#dc2626"
      etiquetaMetrica="Repicado"
      mostrarMotivos
    />
  );
}
