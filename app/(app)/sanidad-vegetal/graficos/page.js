"use client";

import { useState } from "react";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import PromedioPorSemanaChart from "@/components/reportes/PromedioPorSemanaChart";
import PromedioPorEdadChart from "@/components/reportes/PromedioPorEdadChart";
import PromedioInfeccionChart from "@/components/reportes/PromedioInfeccionChart";

const TIPOS = [
  { key: "Índice de infección", label: "Índice de Infección", permiso: "infeccion.ver" },
  { key: "Conteo de Hojas", label: "Conteo de Hojas", permiso: "conteo_hojas.ver" },
  { key: "Suma Bruta", label: "Suma Bruta", permiso: "suma_bruta.ver" },
];

export default function SanidadGraficosPage() {
  const [tab, setTab] = useState(TIPOS[0].key);

  const tabsVisibles = TIPOS.filter((t) => !t.permiso || hasPermission(t.permiso));

  return (
    <RequirePermission code="infeccion.ver">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1">Sanidad Vegetal — Gráficos</h1>
          <p className="text-secondary mb-0">Promedios semanales de infección, conteo de hojas y suma bruta.</p>
        </div>

        <ul className="nav nav-pills mb-4 gap-2">
          {tabsVisibles.map((t) => (
            <li className="nav-item" key={t.key}>
              <button
                type="button"
                className={`nav-link rounded-3 ${tab === t.key ? "btn-brand text-white" : "btn btn-outline-secondary"}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>

        {tab === "Índice de infección" ? (
          <PromedioInfeccionChart titulo="Índice de Infección por Semana" mensajeVacio="No hay evaluaciones de infección para mostrar." />
        ) : tab === "Conteo de Hojas" ? (
          <PromedioPorEdadChart
            titulo="Promedio de Hojas Funcionales por Edad"
            endpoint="/evaluaciones/conteo-promedio"
            mensajeVacio="No hay evaluaciones de Conteo de Hojas para mostrar."
          />
        ) : (
          <PromedioPorSemanaChart
            titulo="Promedio de Suma Bruta por Semana"
            endpoint="/evaluaciones/suma-bruta-promedio"
            colorLinea="#16a34a"
            mensajeVacio="No hay evaluaciones de Suma Bruta para mostrar."
          />
        )}
      </div>
    </RequirePermission>
  );
}