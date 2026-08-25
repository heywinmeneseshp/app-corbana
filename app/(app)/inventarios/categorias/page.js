"use client";

import RequirePermission from "@/components/RequirePermission";

export default function CategoriasPage() {
  return (
    <RequirePermission code="menu.inventarios.categorias">
      <div className="p-4">
        <h2 className="h4 fw-bold mb-3">Categorías de Productos</h2>
        <p className="text-secondary">CRUD de categorías (Insumo, Repuesto, Elaborado, General). Próximamente tabla + modal.</p>
      </div>
    </RequirePermission>
  );
}
