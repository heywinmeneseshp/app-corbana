"use client";

import InfoModulo from "@/components/InfoModulo";
import RequirePermission from "@/components/RequirePermission";
import ReporteLabores from "@/components/reportes/ReporteLabores";

export default function SanidadLaboresPage() {
  return (
    <RequirePermission code="menu.sanidad_vegetal.labores">
      <div className="p-3 p-md-4">
        <div className="mb-4">
          <h1 className="fw-bold h4 mb-1">Sanidad Vegetal — Evaluación de Labores <InfoModulo titulo={"Evaluación de Labores"} secciones={[{"titulo": "Qué muestra", "texto": "Las visitas de sanidad y labor cultural registradas desde la app móvil."}, {"titulo": "Cómo usarlo", "texto": "Filtra por finca, lote, semana y labor para revisar lo evaluado en cada visita."}]} /></h1>
          <p className="text-secondary mb-0">Visitas de sanidad y labor cultural registradas desde la app móvil.</p>
        </div>
        <ReporteLabores />
      </div>
    </RequirePermission>
  );
}