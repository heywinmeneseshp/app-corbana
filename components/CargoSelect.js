"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";

// Lista de cargos activos (Maestros → Cargos), compartida entre los selectores de la página.
let cache = null;
const cargarCargos = () => {
  if (!cache) cache = apiFetch("/cargos?activos=true").catch((err) => {
    cache = null;
    throw err;
  });
  return cache;
};

// Selector de cargo para usuarios y colaboradores. El valor es el NOMBRE del cargo (la API lo resuelve contra el maestro). Si la
// persona tiene un cargo que ya no está activo, se muestra igual para no perderlo.
export default function CargoSelect({ value, onChange, className = "form-select rounded-3", required = false, vacio = "Sin cargo", ayuda = true }) {
  const [cargos, setCargos] = useState([]);

  useEffect(() => {
    let activo = true;
    cargarCargos()
      .then((l) => activo && setCargos(l || []))
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, []);

  const enLista = !value || cargos.some((c) => c.nombre === value);
  return (
    <>
      <select className={className} value={value || ""} required={required} onChange={(e) => onChange(e.target.value)}>
        <option value="">{vacio}</option>
        {!enLista && <option value={value}>{value} (inactivo)</option>}
        {cargos.map((c) => (
          <option key={c.uuid} value={c.nombre}>
            {c.nombre}
          </option>
        ))}
      </select>
      {ayuda && hasPermission("cargo.crear") && (
        <div className="form-text small">
          ¿No está el cargo?{" "}
          <Link href="/maestros/cargos" target="_blank" className="text-decoration-none">
            Créalo en Maestros → Cargos
          </Link>
        </div>
      )}
    </>
  );
}
