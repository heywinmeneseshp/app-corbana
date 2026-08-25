"use client";

import RequirePermission from "@/components/RequirePermission";

export default function MezclasPage() {
  return (
    <RequirePermission code="menu.inventarios.mezclas">
      <div className="p-4">
        <h2 className="h4 fw-bold mb-3">Mezclas</h2>
        <p className="text-secondary">
          Recetas de mezclas: producto elaborado, rendimiento, precio de venta y componentes con costo snapshot por versión. Próximamente tabla + modal + historial de versiones.
        </p>
        <div className="d-flex gap-2">
          <span className="badge bg-primary">Versión activa</span>
          <span className="badge bg-secondary">Costo total / unitario</span>
          <span className="badge bg-info">Componentes</span>
        </div>
      </div>
    </RequirePermission>
  );
}
