"use client";

import { useState } from "react";
import { FiSmartphone } from "react-icons/fi";
import RequireAdmin from "@/components/RequireAdmin";
import VersionAppForm from "@/components/configuracion/VersionAppForm";

const APPS = [
  { id: "movil", nombre: "App Móvil" },
  { id: "finca", nombre: "App Finca" },
];

export default function ConfiguracionVersionAppPage() {
  const [app, setApp] = useState("movil");
  return (
    <RequireAdmin>
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
            <FiSmartphone className="text-primary" /> Versión de las apps
          </h1>
          <p className="text-secondary mb-0">Controla el aviso de actualización que ven los usuarios al abrir cada app. Cada app tiene su propia versión y su propio APK.</p>
        </div>

        <ul className="nav nav-tabs mb-3">
          {APPS.map((a) => (
            <li key={a.id} className="nav-item">
              <button type="button" className={`nav-link ${app === a.id ? "active fw-semibold" : ""}`} onClick={() => setApp(a.id)}>
                {a.nombre}
              </button>
            </li>
          ))}
        </ul>

        <VersionAppForm key={app} app={app} />
      </div>
    </RequireAdmin>
  );
}
