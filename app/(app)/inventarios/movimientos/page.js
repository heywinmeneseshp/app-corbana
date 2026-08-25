"use client";

import RequirePermission from "@/components/RequirePermission";

export default function MovimientosPage() {
  return (
    <RequirePermission code="menu.inventarios.movimientos">
      <div className="p-4">
        <h2 className="h4 fw-bold mb-3">Movimientos</h2>
        <p className="text-secondary">Entradas, salidas, ajustes, transferencias y elaboraciones. Motor centralizado. Próximamente tabla + formulario.</p>
        <div className="d-flex gap-2">
          <span className="badge bg-success">Entradas</span>
          <span className="badge bg-danger">Salidas</span>
          <span className="badge bg-warning text-dark">Ajustes</span>
          <span className="badge bg-info">Transferencias</span>
        </div>
      </div>
    </RequirePermission>
  );
}
