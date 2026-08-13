"use client";

import { useEffect, useState } from "react";
import { FiTrendingUp } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ReporteEvaluacion from "@/components/reportes/ReporteEvaluacion";
import IndicadoresEvaluaciones from "@/components/reportes/IndicadoresEvaluaciones";

const TIPOS = [
  { key: "Índice de infección", label: "Índice de Infección", permiso: "infeccion.ver" },
  { key: "Conteo de Hojas", label: "Conteo de Hojas", permiso: "conteo_hojas.ver" },
  { key: "Suma Bruta", label: "Suma Bruta", permiso: "suma_bruta.ver" },
];

const TAB_INDICADORES = "indicadores";

export default function SanidadEvaluacionesPage() {
  const [tiposEvaluacion, setTiposEvaluacion] = useState([]);
  const [tab, setTab] = useState(TAB_INDICADORES);

  useEffect(() => {
    apiFetch("/tipos-evaluacion?limit=100")
      .then((data) => setTiposEvaluacion(data.items))
      .catch(() => {});
  }, []);

  const tipoActual = tiposEvaluacion.find((t) => t.nombre === tab);
  const tabsVisibles = TIPOS.filter((t) => !t.permiso || hasPermission(t.permiso));

  return (
    <RequirePermission code="menu.sanidad_vegetal.evaluaciones">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1">Sanidad Vegetal — Evaluaciones</h1>
          <p className="text-secondary mb-0">Detalle de evaluaciones de infección, conteo de hojas y suma bruta.</p>
        </div>

        <ul className="nav nav-pills mb-4 gap-2">
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link rounded-3 ${tab === TAB_INDICADORES ? "btn-brand text-white" : "btn btn-outline-secondary"}`}
              onClick={() => setTab(TAB_INDICADORES)}
            >
              <FiTrendingUp className="me-1" /> Indicadores
            </button>
          </li>
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

        {tab === TAB_INDICADORES ? (
          <IndicadoresEvaluaciones />
        ) : tipoActual ? (
          <ReporteEvaluacion tipoEvaluacionUuid={tipoActual.uuid} tab={tab} />
        ) : (
          <p className="text-secondary small">Cargando tipos de evaluación...</p>
        )}
      </div>
    </RequirePermission>
  );
}