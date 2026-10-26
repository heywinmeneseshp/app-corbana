"use client";

// Botones para saltar entre las vistas de stock de Inventarios (Existencias, Kárdex, Movimientos, Conteo) sin volver al sidebar, igual
// que ReportesTabs. Solo muestra las que el usuario puede ver.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiBarChart2, FiBox, FiList, FiShare2, FiCheckSquare } from "react-icons/fi";
import { hasPermission } from "@/lib/auth";

const TABS = [
  { href: "/inventarios", label: "Resumen", icon: FiBarChart2, permCode: "menu.inventarios.dashboard" },
  { href: "/inventarios/existencias", label: "Existencias", icon: FiBox, permCode: "menu.inventarios.movimientos" },
  { href: "/inventarios/kardex", label: "Kárdex", icon: FiList, permCode: "menu.inventarios.movimientos" },
  { href: "/inventarios/movimientos", label: "Movimientos", icon: FiShare2, permCode: "menu.inventarios.movimientos" },
  { href: "/inventarios/conteos", label: "Conteo", icon: FiCheckSquare, permCode: "menu.inventarios.conteos" },
];

export default function InventarioTabs() {
  const pathname = usePathname();
  const visibles = TABS.filter((t) => hasPermission(t.permCode));
  if (visibles.length < 2) return null;

  return (
    <div className="d-flex flex-wrap gap-2 mb-3">
      {visibles.map((t) => {
        const activo = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`btn btn-sm rounded-3 d-flex align-items-center gap-2 text-decoration-none ${activo ? "btn-brand text-white" : "btn-outline-secondary"}`}
          >
            <t.icon /> {t.label}
          </Link>
        );
      })}
    </div>
  );
}
