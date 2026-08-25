"use client";

import RequirePermission from "@/components/RequirePermission";

export default function ProgramacionesMantenimientoHyphenPage() {
  return (
    <RequirePermission code="menu.inventarios.programaciones">
      <div className="p-4">
        <h2 className="h4 fw-bold mb-3">Programaciones de Mantenimiento</h2>
        <p className="text-secondary">FASE 6: Programaciones por plan/equipo.</p>
        <div className="alert alert-info mt-3 small">Alias: /inventarios/programaciones — Endpoints: /inventarios/programaciones-mantenimiento</div>
      </div>
    </RequirePermission>
  );
}
