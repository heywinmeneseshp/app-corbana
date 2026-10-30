"use client";

import { useState } from "react";
import { FiBarChart2, FiClock, FiMap, FiUsers } from "react-icons/fi";
import RequirePermission from "@/components/RequirePermission";
import ColaboradoresModulo from "@/components/colaboradores/ColaboradoresModulo";
import AsistenciaVista from "@/components/asistencia/AsistenciaVista";
import HectareasAsperjadas from "@/components/colaboradores/HectareasAsperjadas";

// Sanidad Vegetal → Colaboradores: los colaboradores creados desde este módulo (misma base que Maestros → Colaboradores, con
// permisos propios), su rostro, su asistencia y sus jornadas, y las hectáreas asperjadas por cada piloto de dron y asistente
// (se les paga por hectárea): historial por día y gráficos.
export default function ColaboradoresSanidadPage() {
  const [tab, setTab] = useState("colaboradores");
  return (
    <RequirePermission code="menu.sanidad_vegetal.colaboradores">
      <div className="p-3 p-md-4">
        <h1 className="fw-bold h4 mb-3">Colaboradores de Sanidad Vegetal</h1>
        <ul className="nav nav-tabs mb-3">
          {[
            ["colaboradores", "Colaboradores", FiUsers],
            ["asistencia", "Asistencia y jornadas", FiClock],
            ["hectareas", "Hectáreas asperjadas", FiMap],
            ["graficos", "Gráficos", FiBarChart2],
          ].map(([key, label, Icono]) => (
            <li key={key} className="nav-item">
              <button
                type="button"
                className={`nav-link d-flex align-items-center gap-2 ${tab === key ? "active fw-semibold" : "text-secondary"}`}
                onClick={() => setTab(key)}
              >
                <Icono size={14} /> {label}
              </button>
            </li>
          ))}
        </ul>
        {tab === "colaboradores" && <ColaboradoresModulo modulo="SANIDAD_VEGETAL" />}
        {tab === "asistencia" && <AsistenciaVista modulo="SANIDAD_VEGETAL" />}
        {tab === "hectareas" && <HectareasAsperjadas vista="tabla" />}
        {tab === "graficos" && <HectareasAsperjadas vista="graficos" />}
      </div>
    </RequirePermission>
  );
}
