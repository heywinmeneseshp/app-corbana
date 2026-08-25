"use client";

import RequirePermission from "@/components/RequirePermission";

export default function KardexPage() {
  return (
    <RequirePermission code="menu.inventarios.movimientos">
      <div className="p-4">
        <h2 className="h4 fw-bold mb-3">Kardex</h2>
        <p className="text-secondary">Fecha | Documento | Tipo | Entrada | Salida | Saldo | Costo. Filtros por producto, almacén y fecha. Próximamente tabla.</p>
      </div>
    </RequirePermission>
  );
}
