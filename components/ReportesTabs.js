"use client";

// Botones para saltar entre las vistas del menú Reportes sin volver al
// sidebar — cada página de Reportes (Detalle Semanal, Gráfico de Embolses,
// ...) monta esto arriba del título para que el usuario cambie de una a
// otra directamente. Solo muestra los botones para los que el usuario
// tiene permiso.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiBarChart2, FiTrendingUp, FiPackage, FiActivity, FiCheckCircle } from "react-icons/fi";
import { GiCancel } from "react-icons/gi";
import { hasPermission } from "@/lib/auth";

const TABS = [
  { href: "/reportes/detalle-semanal", label: "Saldo y Movimientos", icon: FiBarChart2, permCode: "menu.racimos.movimientos_semana" },
  { href: "/reportes/grafico-embolses", label: "Gráfico de Embolses", icon: FiTrendingUp, permCode: "menu.racimos.reporte_embolses" },
  { href: "/reportes/grafico-repiques", label: "Gráfico de Repiques", icon: GiCancel, permCode: "menu.racimos.reporte_repiques" },
  { href: "/reportes/cajas-producidas", label: "Cajas Producidas", icon: FiPackage, permCode: "menu.reportes" },
  { href: "/reportes/ratio", label: "Ratio", icon: FiActivity, permCode: "menu.reportes" },
  { href: "/reportes/aprovechamiento", label: "Aprovechamiento", icon: FiCheckCircle, permCode: "menu.reportes" },
];

export default function ReportesTabs() {
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
            className={`btn btn-sm rounded-3 d-flex align-items-center gap-2 text-decoration-none ${
              activo ? "btn-brand text-white" : "btn-outline-secondary"
            }`}
          >
            <t.icon /> {t.label}
          </Link>
        );
      })}
    </div>
  );
}
