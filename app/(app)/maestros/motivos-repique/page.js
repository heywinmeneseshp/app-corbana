"use client";

import MotivoCatalogPage from "@/components/MotivoCatalogPage";

export default function MotivosRepiquePage() {
  return (
    <MotivoCatalogPage
      title="Motivos de Repique"
      description="Catálogo de motivos por los que un racimo se repica antes de cosecha (viento, sigatoka, quema de sol, etc.)."
      endpoint="/motivos-repique"
      permVer="motivo_repique.ver"
      permCrear="motivo_repique.crear"
      permEditar="motivo_repique.editar"
      permEliminar="motivo_repique.eliminar"
    />
  );
}
