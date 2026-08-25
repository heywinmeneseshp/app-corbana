"use client";

import RequirePermission from "@/components/RequirePermission";

export default function AlmacenesPage() {
  return (
    <RequirePermission code="menu.inventarios.almacenes">
      <div className="p-4">
        <h2 className="h4 fw-bold mb-3">Almacenes</h2>
        <p className="text-secondary">Jerarquía de almacenes/centros de costo (puede ligarse a finca). Próximamente árbol + modal.</p>
      </div>
    </RequirePermission>
  );
}
