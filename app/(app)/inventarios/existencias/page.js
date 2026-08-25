"use client";

import RequirePermission from "@/components/RequirePermission";

export default function ExistenciasPage() {
  return (
    <RequirePermission code="menu.inventarios.movimientos">
      <div className="p-4">
        <h2 className="h4 fw-bold mb-3">Existencias</h2>
        <p className="text-secondary">Consulta por almacén, producto o lote. Saldo = SUM(entradas) - SUM(salidas). Próximamente tabla.</p>
      </div>
    </RequirePermission>
  );
}
