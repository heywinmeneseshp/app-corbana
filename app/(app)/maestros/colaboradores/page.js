"use client";

import { useState } from "react";
import RequirePermission from "@/components/RequirePermission";
import ColaboradoresModulo from "@/components/colaboradores/ColaboradoresModulo";
import NovedadesAsistencia from "@/components/asistencia/NovedadesAsistencia";
import { hasPermission } from "@/lib/auth";

// Maestros → Colaboradores: todos los colaboradores (con columna y filtro de módulo) y sus novedades de asistencia (vacaciones,
// compensatorios, incapacidades, permisos). Ver components/colaboradores/ColaboradoresModulo.js.
export default function ColaboradoresPage() {
  const [tab, setTab] = useState("colaboradores");
  const veNovedades = hasPermission("asistencia.novedades.ver") || hasPermission("asistencia.novedades.gestionar");
  return (
    <RequirePermission code="menu.maestros.colaboradores">
      <div className="p-4 p-md-5">
        {veNovedades && (
          <ul className="nav nav-tabs mb-3">
            {[["colaboradores", "Colaboradores"], ["novedades", "Ausencias y permisos"], ["saldos", "Vacaciones y compensatorios"]].map(([key, label]) => (
              <li key={key} className="nav-item">
                <button type="button" className={`nav-link ${tab === key ? "active fw-semibold" : "text-secondary"}`} onClick={() => setTab(key)}>
                  {label}
                </button>
              </li>
            ))}
          </ul>
        )}
        {(tab === "novedades" || tab === "saldos") && veNovedades ? <NovedadesAsistencia key={tab} vistaFija={tab === "saldos" ? "saldos" : "registro"} /> : <ColaboradoresModulo />}
      </div>
    </RequirePermission>
  );
}
