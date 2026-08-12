"use client";

import MotivoCatalogPage from "@/components/MotivoCatalogPage";
import RequirePermission from "@/components/RequirePermission";

export default function MotivosRecusePage() {
  return (
    <RequirePermission code="menu.maestros.motivos_recuse">
      <MotivoCatalogPage
        title="Motivos de Recuse"
        description="Catálogo de motivos por los que un racimo cosechado se rechaza y no va a la caja de exportación (bajo grado, sobremaduro, daño mecánico, etc.)."
        endpoint="/motivos-recuse"
        permVer="motivo_recuse.ver"
        permCrear="motivo_recuse.crear"
        permEditar="motivo_recuse.editar"
        permEliminar="motivo_recuse.eliminar"
      />
    </RequirePermission>
  );
}
