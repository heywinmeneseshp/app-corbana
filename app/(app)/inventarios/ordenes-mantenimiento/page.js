"use client";

import RequirePermission from "@/components/RequirePermission";

export default function OrdenesMantenimientoHyphenPage() {
  return (
    <RequirePermission code="menu.inventarios.ordenes">
      <div className="p-4">
        <h2 className="h4 fw-bold mb-3">Órdenes de Mantenimiento</h2>
        <p className="text-secondary">FASE 6: Órdenes con detalles, mano de obra y servicios. Cerrar genera salida de inventario.</p>
        <div className="alert alert-info mt-3 small">Alias: /inventarios/ordenes — Endpoints: /inventarios/ordenes-mantenimiento</div>
      </div>
    </RequirePermission>
  );
}
