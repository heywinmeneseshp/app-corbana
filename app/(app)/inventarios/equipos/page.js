"use client";

import RequirePermission from "@/components/RequirePermission";

export default function EquiposPage() {
  return (
    <RequirePermission code="menu.inventarios.equipos">
      <div className="p-4">
        <h2 className="h4 fw-bold mb-3">Equipos</h2>
        <p className="text-secondary">
          FASE 5: Catálogo de equipos (código, nombre, tipo, marca, modelo, serie, fecha adquisición, ubicación, centro de costo, estado, horómetro, kilometraje) + repuestos compatibles (M2M con productos tipo REPUESTO).
        </p>
        <div className="d-flex gap-2 flex-wrap">
          <span className="badge bg-primary">Ubicación → Almacén</span>
          <span className="badge bg-secondary">Centro Costo → Almacén</span>
          <span className="badge bg-success">Horómetro / Kilometraje</span>
          <span className="badge bg-warning text-dark">Repuestos compatibles</span>
        </div>
        <div className="alert alert-info mt-3 small">
          Endpoints: /inventarios/equipos CRUD + POST /:uuid/componentes y DELETE /:uuid/componentes/:productoUuid
        </div>
      </div>
    </RequirePermission>
  );
}
