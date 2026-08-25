"use client";

import RequirePermission from "@/components/RequirePermission";

export default function ElaboracionesPage() {
  return (
    <RequirePermission code="menu.inventarios.elaboraciones">
      <div className="p-4">
        <h2 className="h4 fw-bold mb-3">Elaboraciones</h2>
        <p className="text-secondary">
          Elaboración de mezclas: valida stock de componentes, genera salidas de insumos y entrada de producto elaborado en un solo documento. Próximamente formulario + kardex de elaboraciones.
        </p>
        <div className="d-flex gap-2">
          <span className="badge bg-success">Entradas elaboradas</span>
          <span className="badge bg-danger">Salidas componentes</span>
          <span className="badge bg-warning text-dark">Validación de existencias</span>
        </div>
      </div>
    </RequirePermission>
  );
}
