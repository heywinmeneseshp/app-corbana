"use client";

import RequirePermission from "@/components/RequirePermission";
import ReporteLabores from "@/components/reportes/ReporteLabores";

export default function SanidadLaboresPage() {
  return (
    <RequirePermission code="menu.sanidad_vegetal.labores">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1">Sanidad Vegetal — Evaluación de Labores</h1>
          <p className="text-secondary mb-0">Visitas de sanidad y labor cultural registradas desde la app móvil.</p>
        </div>
        <ReporteLabores />
      </div>
    </RequirePermission>
  );
}