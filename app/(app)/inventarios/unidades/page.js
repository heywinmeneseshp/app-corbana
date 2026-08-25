"use client";

import RequirePermission from "@/components/RequirePermission";

export default function UnidadesPage() {
  return (
    <RequirePermission code="menu.inventarios.unidades">
      <div className="p-4">
        <h2 className="h4 fw-bold mb-3">Unidades de Medida</h2>
        <p className="text-secondary">Catálogo de unidades (kg, g, L, ml...) y conversiones. Próximamente tabla + modal.</p>
      </div>
    </RequirePermission>
  );
}
