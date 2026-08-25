"use client";

import RequirePermission from "@/components/RequirePermission";

export default function InventariosDashboardPage() {
  return (
    <RequirePermission code="menu.inventarios.dashboard">
      <div className="p-4">
        <h2 className="h4 fw-bold mb-3">Inventarios — Dashboard</h2>
        <p className="text-secondary">
          FASE 7: Resumen de inventarios — conteos, valor inventario (SUM existencias*costo), bajo stock, próximos mantenimientos y equipos fuera de servicio.
          <br />
          <span className="small">Endpoint: GET /inventarios/dashboard/resumen</span>
        </p>
        <div className="row g-3">
          <div className="col-md-3">
            <div className="card border-0 shadow-sm rounded-4 p-3 text-center">
              <div className="h5 mb-1">—</div>
              <div className="small text-secondary">Productos</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-0 shadow-sm rounded-4 p-3 text-center">
              <div className="h5 mb-1">—</div>
              <div className="small text-secondary">Almacenes</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-0 shadow-sm rounded-4 p-3 text-center">
              <div className="h5 mb-1">—</div>
              <div className="small text-secondary">Valor Inventario</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-0 shadow-sm rounded-4 p-3 text-center">
              <div className="h5 mb-1">—</div>
              <div className="small text-secondary">Bajo Stock</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-0 shadow-sm rounded-4 p-3 text-center">
              <div className="h5 mb-1">—</div>
              <div className="small text-secondary">Equipos</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-0 shadow-sm rounded-4 p-3 text-center">
              <div className="h5 mb-1">—</div>
              <div className="small text-secondary">Próximos Mantenimientos</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-0 shadow-sm rounded-4 p-3 text-center">
              <div className="h5 mb-1">—</div>
              <div className="small text-secondary">Equipos Fuera Servicio</div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card border-0 shadow-sm rounded-4 p-3 text-center">
              <div className="h5 mb-1">—</div>
              <div className="small text-secondary">Órdenes Abiertas</div>
            </div>
          </div>
        </div>
        <div className="alert alert-info mt-4 small">
          Dashboard consume GET /api/v1/inventarios/dashboard/resumen con permisos inventario.dashboard.ver — integra existencias, kardex y mantenimiento.
        </div>
      </div>
    </RequirePermission>
  );
}
