"use client";

import CorbanaLogo from "@/components/CorbanaLogo";
import { useMarca } from "@/lib/marca";

// Logo de la app: usa la imagen subida en Configuración → Marca de la App
// si hay una, si no cae al ícono SVG por defecto (CorbanaLogo).
export default function AppLogo({ size = 24, color = "currentColor" }) {
  const { logoUrl } = useMarca();

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt="Logo"
        width={size}
        height={size}
        style={{ objectFit: "contain", borderRadius: 4 }}
      />
    );
  }

  return <CorbanaLogo size={size} color={color} />;
}
