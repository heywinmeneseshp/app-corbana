"use client";

import RequirePermission from "@/components/RequirePermission";

export default function DashboardInventariosPage() {
  return (
    <RequirePermission code="menu.inventarios.dashboard">
      <div className="p-4">
        <h2 className="h4 fw-bold mb-3">Inventarios — Dashboard</h2>
        <p className="text-secondary">
          FASE 7: Resumen — productos, almacenes, valor inventario, bajo stock, próximos mantenimientos, equipos fuera de servicio.
          <br />
          <span className="small">Datos vía GET /inventarios/dashboard/resumen</span>
        </p>
        <div className="row g-3">
          <div className="col-md-3"><div className="card border-0 shadow-sm rounded-4 p-3 text-center"><div className="h5 mb-1">—</div><div className="small text-secondary">Productos</div></div></div>
          <div className="col-md-3"><div className="card border-0 shadow-sm rounded-4 p-3 text-center"><div className="h5 mb-1">—</div><div className="small text-secondary">Valor Inventario</div></div></div>
          <div className="col-md-3"><div className="card border-0 shadow-sm rounded-4 p-3 text-center"><div className="h5 mb-1">—</div><div className="small text-secondary">Bajo Stock</div></div></div>
          <div className="col-md-3"><div className="card border-0 shadow-sm rounded-4 p-3 text-center"><div className="h5 mb-1">—</div><div className="small text-secondary">Equipos Fuera Servicio</div></div></div>
        </div>
      </div>
    </RequirePermission>
  );
}
