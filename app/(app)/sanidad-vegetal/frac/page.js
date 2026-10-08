"use client";

import { useState } from "react";
import Link from "next/link";
import RequirePermission from "@/components/RequirePermission";
import GruposFracModal from "@/components/GruposFracModal";
import FracLimitesModal from "@/components/FracLimitesModal";

// Todo lo referente a la clasificación FRAC (Fungicide Resistance Action Committee) en un solo lugar:
// códigos y grupos químicos (a qué grupo pertenece cada ingrediente activo) y las reglas de manejo de
// resistencia por código (máximos, intervalos...) que generan las alertas de aspersiones.
export default function SanidadFracPage() {
  const [seccion, setSeccion] = useState("grupos"); // "grupos" | "reglas"

  return (
    <RequirePermission code="menu.sanidad_vegetal.ingredientes_activos">
      <div className="p-3 p-md-4">
        <ul className="nav nav-pills gap-1 mb-3">
          <li className="nav-item">
            <Link href="/sanidad-vegetal/mezclas" className="nav-link btn-sm py-1 px-3">
              Mezclas
            </Link>
          </li>
          <li className="nav-item">
            <Link href="/sanidad-vegetal/ingredientes-activos/insumos" className="nav-link btn-sm py-1 px-3">
              Insumos
            </Link>
          </li>
          <li className="nav-item">
            <Link href="/sanidad-vegetal/ingredientes-activos" className="nav-link btn-sm py-1 px-3">
              Ingredientes Activos
            </Link>
          </li>
          <li className="nav-item">
            <Link href="/sanidad-vegetal/frac" className="nav-link btn-sm py-1 px-3 active">
              FRAC
            </Link>
          </li>
        </ul>

        <div className="mb-3">
          <h1 className="fw-bold h4 mb-1">FRAC</h1>
          <p className="text-secondary mb-0">
            Clasificación FRAC de los ingredientes activos y reglas de manejo de resistencia a fungicidas.
          </p>
        </div>

        <div className="d-flex border-bottom mb-3">
          {[
            { id: "grupos", label: "Códigos y grupos químicos" },
            { id: "reglas", label: "Reglas de uso" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className="btn btn-sm border-0 rounded-0 px-3 py-2 fw-medium"
              style={{
                color: seccion === t.id ? "#166534" : "#6b7280",
                borderBottom: seccion === t.id ? "2px solid #166534" : "2px solid transparent",
                background: "transparent",
              }}
              onClick={() => setSeccion(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {seccion === "grupos" && <GruposFracModal embebido />}
        {seccion === "reglas" && <FracLimitesModal embebido />}
      </div>
    </RequirePermission>
  );
}
