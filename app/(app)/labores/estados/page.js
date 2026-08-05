"use client";

import RequirePermission from "@/components/RequirePermission";
import EstadosLabores from "@/components/reportes/EstadosLabores";

export default function EstadosLaboresPage() {
  return (
    <RequirePermission code="labor_programacion.ver">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1">Estados de Labores</h1>
          <p className="text-secondary mb-0">Programaciones de labores por estado: completadas, programadas y con retraso.</p>
        </div>
        <EstadosLabores />
      </div>
    </RequirePermission>
  );
}