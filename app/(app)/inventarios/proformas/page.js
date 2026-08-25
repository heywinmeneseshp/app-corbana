"use client";

import RequirePermission from "@/components/RequirePermission";

export default function ProformasPage() {
  return (
    <RequirePermission code="menu.inventarios.proformas">
      <div className="p-4">
        <h2 className="h4 fw-bold mb-3">Proformas</h2>
        <p className="text-secondary">
          FASE 4: Gestión de proformas (cliente, fecha, vigencia, descuento, impuestos, total, estado). No afecta inventario. Próximamente tabla + modal + detalle con conversión a factura.
        </p>
        <div className="d-flex gap-2 flex-wrap">
          <span className="badge bg-primary">Cliente</span>
          <span className="badge bg-secondary">Descuento / Impuestos</span>
          <span className="badge bg-success">Convertir a factura</span>
          <span className="badge bg-info">Estados</span>
        </div>
        <div className="alert alert-info mt-3 small">
          Endpoints: GET/POST /inventarios/proformas, GET/PUT/DELETE /inventarios/proformas/:uuid, POST /:uuid/convertir (prepara factura)
        </div>
      </div>
    </RequirePermission>
  );
}
