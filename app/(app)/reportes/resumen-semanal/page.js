"use client";

import { FiFileText } from "react-icons/fi";
import RequirePermission from "@/components/RequirePermission";
import InformeSemanal from "@/components/reportes/InformeSemanal";

// Resumen semanal: el informe de producción de la semana por finca.
export default function ResumenSemanalPage() {
  return (
    <RequirePermission code="menu.reportes">
      <div className="p-4 p-md-5">
        <div className="mb-3">
          <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
            <FiFileText /> Resumen semanal
          </h1>
          <p className="text-secondary mb-0">Informe de producción de la semana por finca.</p>
        </div>
        <InformeSemanal />
      </div>
    </RequirePermission>
  );
}
