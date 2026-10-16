"use client";

import { useEffect, useState } from "react";
import { FiTrendingUp } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";
import ReporteEvaluacion from "@/components/reportes/ReporteEvaluacion";
import IndicadoresEvaluaciones from "@/components/reportes/IndicadoresEvaluaciones";
import SeguimientoEmisionFoliar from "@/components/reportes/SeguimientoEmisionFoliar";

// Quien puede abrir este módulo (menu.sanidad_vegetal.evaluaciones) ve
// todas sus pestañas — el backend ya acepta ese mismo permiso de menú para
// leer los datos, así que no hace falta asignar `evaluacion.ver` aparte.
const TIPOS = [
  { key: "Índice de infección", label: "Índice de Infección" },
  { key: "Conteo de Hojas", label: "Conteo de Hojas" },
  { key: "Suma Bruta", label: "Suma Bruta" },
  { key: "Emisión Foliar", label: "Emisión Foliar" },
];

const TAB_INDICADORES = "indicadores";
const TAB_SEGUIMIENTO = "seguimiento-emision";

export default function SanidadEvaluacionesPage() {
  const [tiposEvaluacion, setTiposEvaluacion] = useState([]);
  const [tab, setTab] = useState(TAB_INDICADORES);

  useEffect(() => {
    apiFetch("/tipos-evaluacion?limit=100")
      .then((data) => setTiposEvaluacion(data.items))
      .catch(() => {});
  }, []);

  const tipoActual = tiposEvaluacion.find((t) => t.nombre === tab);
  const tabsVisibles = TIPOS;

  return (
    <RequirePermission code="menu.sanidad_vegetal.evaluaciones">
      <div className="p-3 p-md-4">
        <div className="mb-4">
          <h1 className="fw-bold h4 mb-1">Sanidad Vegetal — Evaluaciones</h1>
          <p className="text-secondary mb-0">Detalle de evaluaciones de infección, conteo de hojas, suma bruta y emisión foliar.</p>
        </div>

        <ul className="nav nav-pills mb-4 gap-2">
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link rounded-3 ${tab === TAB_INDICADORES ? "btn-brand text-white" : "btn btn-sm btn-link text-secondary text-decoration-none"}`}
              onClick={() => setTab(TAB_INDICADORES)}
            >
              <FiTrendingUp className="me-1" /> Indicadores
            </button>
          </li>
          {tabsVisibles.map((t) => (
            <li className="nav-item" key={t.key}>
              <button
                type="button"
                className={`nav-link rounded-3 ${tab === t.key ? "btn-brand text-white" : "btn btn-sm btn-link text-secondary text-decoration-none"}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            </li>
          ))}
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link rounded-3 ${tab === TAB_SEGUIMIENTO ? "btn-brand text-white" : "btn btn-sm btn-link text-secondary text-decoration-none"}`}
              onClick={() => setTab(TAB_SEGUIMIENTO)}
            >
              <FiTrendingUp className="me-1" /> Seguimiento Emisión Foliar
            </button>
          </li>
        </ul>

        {tab === TAB_INDICADORES ? (
          <IndicadoresEvaluaciones />
        ) : tab === TAB_SEGUIMIENTO ? (
          <SeguimientoEmisionFoliar />
        ) : tipoActual ? (
          <ReporteEvaluacion tipoEvaluacionUuid={tipoActual.uuid} tab={tab} />
        ) : (
          <p className="text-secondary small">Cargando tipos de evaluación...</p>
        )}
      </div>
    </RequirePermission>
  );
}