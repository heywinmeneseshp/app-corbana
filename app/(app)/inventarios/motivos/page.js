"use client";

import RequirePermission from "@/components/RequirePermission";

export default function MotivosPage() {
  return (
    <RequirePermission code="menu.inventarios.motivos">
      <div className="p-4">
        <h2 className="h4 fw-bold mb-3">Motivos</h2>
        <p className="text-secondary">Catálogo de motivos para ajustes, salidas y transferencias. Próximamente tabla + modal.</p>
      </div>
    </RequirePermission>
  );
}
