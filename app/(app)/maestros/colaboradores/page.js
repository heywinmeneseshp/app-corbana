"use client";

import RequirePermission from "@/components/RequirePermission";
import ColaboradoresModulo from "@/components/colaboradores/ColaboradoresModulo";

// Maestros → Colaboradores: todos los colaboradores (con columna y filtro de módulo). Ver components/colaboradores/ColaboradoresModulo.js.
export default function ColaboradoresPage() {
  return (
    <RequirePermission code="menu.maestros.colaboradores">
      <div className="p-4 p-md-5">
        <ColaboradoresModulo />
      </div>
    </RequirePermission>
  );
}
