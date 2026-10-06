"use client";

import { FiSettings } from "react-icons/fi";

// Botón de configuración (engranaje) unificado: gris claro, sin borde,
// esquinas redondeadas y tamaño fijo. Se usa en todos los módulos donde hay
// una configuración (destinatarios de correo, rol revisor, umbrales...).
// - `label`: si se pasa, muestra el texto junto al icono (ancho automático).
// - `alto`: altura CSS opcional para alinearlo con inputs de al lado
//   (ej. "calc(1.5em + 0.5rem + 2px)" = form-control-sm).
// - `compacto`: versión pequeña para encabezados de tarjetas/gráficos.
export default function BotonConfiguracion({ onClick, title, label, alto, compacto = false }) {
  const lado = compacto ? 26 : 32;
  return (
    <button
      type="button"
      className="btn btn-light btn-sm border-0 rounded-3 d-inline-flex align-items-center justify-content-center gap-1 flex-shrink-0"
      style={{ width: label ? undefined : lado, height: alto || lado, padding: label ? "0 0.6rem" : 0 }}
      onClick={onClick}
      title={title}
      aria-label={title || label || "Configurar"}
    >
      <FiSettings size={compacto ? 13 : 15} />
      {label && <span>{label}</span>}
    </button>
  );
}
