"use client";

import MotivoCatalogPage from "@/components/MotivoCatalogPage";

export default function MotivosRecusePage() {
  return (
    <MotivoCatalogPage
      title="Motivos de Recuse"
      description="Catálogo de motivos por los que un racimo cosechado se rechaza y no va a la caja de exportación (bajo grado, sobremaduro, daño mecánico, etc.)."
      endpoint="/motivos-recuse"
      permVer="motivo_recuse.ver"
      permCrear="motivo_recuse.crear"
      permEditar="motivo_recuse.editar"
      permEliminar="motivo_recuse.eliminar"
    />
  );
}
