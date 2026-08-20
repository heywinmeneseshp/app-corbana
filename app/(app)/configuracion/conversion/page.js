"use client";

import { FiPackage } from "react-icons/fi";
import RequireAdmin from "@/components/RequireAdmin";
import TasaConversionForm from "@/components/configuracion/TasaConversionForm";

export default function ConfiguracionConversionPage() {
  return (
    <RequireAdmin>
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
            <FiPackage className="text-primary" /> Tasa de Conversión
          </h1>
          <p className="text-secondary mb-0">Peso de referencia usado para convertir cajas de Programación de Corte a cajas de 20kg.</p>
        </div>

        <TasaConversionForm />
      </div>
    </RequireAdmin>
  );
}
