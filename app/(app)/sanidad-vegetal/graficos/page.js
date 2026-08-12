"use client";

import { useState } from "react";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import PromedioPorSemanaChart from "@/components/reportes/PromedioPorSemanaChart";
import PromedioPorEdadChart from "@/components/reportes/PromedioPorEdadChart";
import PromedioInfeccionChart from "@/components/reportes/PromedioInfeccionChart";
import ClimaChart from "@/components/reportes/ClimaChart";

// El permiso null en Clima es intencional: la lista de clima (GET /clima) ya
// es visible para cualquier usuario autenticado, sin permiso puntual — el
// gráfico sigue el mismo criterio.
const TIPOS = [
  { key: "Índice de infección", label: "Índice de Infección", permiso: "infeccion.ver" },
  { key: "Conteo de Hojas", label: "Conteo de Hojas", permiso: "conteo_hojas.ver" },
  { key: "Suma Bruta", label: "Suma Bruta", permiso: "suma_bruta.ver" },
  { key: "Clima", label: "Clima", permiso: null },
];

export default function SanidadGraficosPage() {
  const tabsVisibles = TIPOS.filter((t) => !t.permiso || hasPermission(t.permiso));
  // El tab por defecto tiene que ser uno que el usuario efectivamente pueda
  // ver — antes siempre arrancaba en "Índice de infección" porque la página
  // entera exigía ese permiso; ahora alguien sin permisos de Sanidad Vegetal
  // puede entrar (por Clima) y ese tab ya no existiría para él.
  const [tab, setTab] = useState(() => tabsVisibles[0]?.key);

  // El gate de página ahora es el submenú de navegación
  // (menu.sanidad_vegetal.graficos), no un permiso granular de Sanidad
  // Vegetal — así alguien con acceso al submenú pero sin infeccion.ver/
  // conteo_hojas.ver/suma_bruta.ver igual puede entrar y ver (solo) Clima.
  return (
    <RequirePermission code="menu.sanidad_vegetal.graficos">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1">Gráficos</h1>
          <p className="text-secondary mb-0">Promedios semanales de infección, conteo de hojas, suma bruta y clima.</p>
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
        ) : tab === "Suma Bruta" ? (
          <PromedioPorSemanaChart
            titulo="Promedio de Suma Bruta por Semana"
            endpoint="/evaluaciones/suma-bruta-promedio"
            colorLinea="#16a34a"
            mensajeVacio="No hay evaluaciones de Suma Bruta para mostrar."
          />
        ) : tab === "Clima" ? (
          <ClimaChart mensajeVacio="No hay registros de clima para mostrar." />
        ) : null}
      </div>
    </RequirePermission>
  );
}