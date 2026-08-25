"use client";

import RequirePermission from "@/components/RequirePermission";

export default function ProductosInventarioPage() {
  return (
    <RequirePermission code="menu.inventarios.productos">
      <div className="p-4">
        <h2 className="h4 fw-bold mb-3">Productos de Inventario</h2>
        <p className="text-secondary">Catálogo de insumos, repuestos y elaborados (código, categoría, unidad, costos, stock min/max). Próximamente tabla + modal.</p>
      </div>
    </RequirePermission>
  );
}
