"use client";

import RequirePermission from "@/components/RequirePermission";

export default function PlanesMantenimientoHyphenPage() {
  return (
    <RequirePermission code="menu.inventarios.planes">
      <div className="p-4">
        <h2 className="h4 fw-bold mb-3">Planes de Mantenimiento</h2>
        <p className="text-secondary">FASE 6: Planes por equipo (tipo preventivo/correctivo, periodicidad valor/unidad).</p>
        <div className="alert alert-info mt-3 small">Alias: /inventarios/planes — Endpoints: /inventarios/planes-mantenimiento</div>
      </div>
    </RequirePermission>
  );
}
