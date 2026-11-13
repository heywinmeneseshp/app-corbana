"use client";

import { useState } from "react";
import ModalShell from "@/components/ModalShell";
import EstacionAlertaConfigModal from "@/components/EstacionAlertaConfigModal";
import EstacionUcBasesModal from "@/components/EstacionUcBasesModal";
import OpenMeteoConfigForm from "@/components/OpenMeteoConfigForm";
import EstacionesAdmin from "@/components/EstacionesAdmin";

// Un solo modal de configuración de la Estación Meteorológica, con pestañas:
// alerta por correo cuando no hay datos y bases de las unidades calóricas.
export default function EstacionConfigModal({ ucBases, onUcGuardado, onClose, onEstacionesCambio }) {
  const [tab, setTab] = useState("uc");

  return (
    <ModalShell title="Configuración" onClose={onClose} size="xl">
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button type="button" className={`nav-link btn-sm py-1 ${tab === "uc" ? "active" : ""}`} onClick={() => setTab("uc")}>
            Unidades calóricas
          </button>
        </li>
        <li className="nav-item">
          <button type="button" className={`nav-link btn-sm py-1 ${tab === "estaciones" ? "active" : ""}`} onClick={() => setTab("estaciones")}>
            Estaciones
          </button>
        </li>
        <li className="nav-item">
          <button type="button" className={`nav-link btn-sm py-1 ${tab === "alerta" ? "active" : ""}`} onClick={() => setTab("alerta")}>
            Alerta sin datos
          </button>
        </li>
        <li className="nav-item">
          <button type="button" className={`nav-link btn-sm py-1 ${tab === "openmeteo" ? "active" : ""}`} onClick={() => setTab("openmeteo")}>
            Open-Meteo
          </button>
        </li>
      </ul>
      {tab === "uc" && <EstacionUcBasesModal embebido basesActuales={ucBases} onClose={onClose} onGuardado={onUcGuardado} />}
      {tab === "estaciones" && <EstacionesAdmin onCambio={onEstacionesCambio} />}
      {tab === "alerta" && <EstacionAlertaConfigModal embebido onClose={onClose} />}
      {tab === "openmeteo" && <OpenMeteoConfigForm onClose={onClose} />}
    </ModalShell>
  );
}
