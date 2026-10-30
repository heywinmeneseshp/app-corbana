"use client";

import RequirePermission from "@/components/RequirePermission";
import AsistenciaVista from "@/components/asistencia/AsistenciaVista";

// Asistencia de todos los colaboradores. El contenido está en components/asistencia/AsistenciaVista.js (Sanidad Vegetal →
// Colaboradores lo usa filtrado a su módulo).
export default function AsistenciaPage() {
  return (
    <RequirePermission code="menu.asistencia">
      <div className="p-3 p-md-4">
        <AsistenciaVista />
      </div>
    </RequirePermission>
  );
}
