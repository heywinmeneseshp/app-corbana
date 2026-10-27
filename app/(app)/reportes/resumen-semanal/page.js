"use client";

import { useState } from "react";
import { FiFileText } from "react-icons/fi";
import RequirePermission from "@/components/RequirePermission";
import InformeSemanal from "@/components/reportes/InformeSemanal";
import CentroAlertas from "@/components/reportes/CentroAlertas";

// Resumen semanal: el informe de producción de la semana por finca y, en otra pestaña, las alertas de todos los módulos.
export default function ResumenSemanalPage() {
  const [pestana, setPestana] = useState("informe");
  return (
    <RequirePermission code="menu.reportes">
      <div className="p-4 p-md-5">
        <div className="mb-3">
          <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
            <FiFileText /> Resumen semanal
          </h1>
          <p className="text-secondary mb-0">Informe de producción de la semana por finca y alertas que requieren atención.</p>
        </div>
        <div className="d-flex gap-2 mb-3">
          {[
            ["informe", "Informe de la semana"],
            ["alertas", "Alertas"],
          ].map(([k, l]) => (
            <button key={k} type="button" className={`btn btn-sm rounded-3 ${pestana === k ? "btn-brand text-white" : "btn-outline-secondary"}`} onClick={() => setPestana(k)}>
              {l}
            </button>
          ))}
        </div>
        {pestana === "informe" ? <InformeSemanal /> : <CentroAlertas />}
      </div>
    </RequirePermission>
  );
}
