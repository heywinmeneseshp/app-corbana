"use client";

import { FiDroplet } from "react-icons/fi";
import RequireAdmin from "@/components/RequireAdmin";
import MezclaParametrosForm from "@/components/configuracion/MezclaParametrosForm";

export default function ConfiguracionMezclaParametrosPage() {
  return (
    <RequireAdmin>
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
            <FiDroplet className="text-primary" /> Parámetros de Mezclas
          </h1>
          <p className="text-secondary mb-0">
            Rango de pH y CE máxima que determinan si una prueba de mezcla del laboratorio es válida.
          </p>
        </div>

        <MezclaParametrosForm />
      </div>
    </RequireAdmin>
  );
}
