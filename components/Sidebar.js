"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FiHome, FiLayers, FiUploadCloud, FiBarChart2, FiLogOut, FiChevronRight, FiUsers, FiShield, FiCalendar } from "react-icons/fi";
import { GiFarmTractor } from "react-icons/gi";
import { PiPlantFill } from "react-icons/pi";
import { clearSession, hasPermission, hasAnyPermission } from "@/lib/auth";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [maestrosOpen, setMaestrosOpen] = useState(pathname.startsWith("/maestros"));
  const [perms, setPerms] = useState(null); // null hasta montar en cliente, evita parpadeo/mismatch

  useEffect(() => {
    setPerms({
      fincas: hasPermission("finca.ver"),
      usuarios: hasPermission("usuarios.ver"),
      roles: hasPermission("roles.ver"),
      semanas: hasPermission("semana.ver"),
      cargue: hasAnyPermission(["finca.crear", "lote.crear"]),
    });
  }, []);

  const handleLogout = () => {
    clearSession();
    router.push("/login");
  };

  const navLinkClass = (active) =>
    `d-flex align-items-center gap-2 px-3 py-2 rounded-3 text-decoration-none small ${
      active ? "bg-white bg-opacity-10 text-white fw-medium" : "text-white-50"
    }`;

  if (!perms) return <aside className="flex-shrink-0" style={{ width: "16rem", backgroundColor: "var(--brand-900)" }} />;

  const maestrosVisible = perms.fincas || perms.usuarios || perms.roles || perms.semanas;

  return (
    <aside className="d-flex flex-column flex-shrink-0" style={{ width: "16rem", backgroundColor: "var(--brand-900)" }}>
      <div className="d-flex align-items-center gap-2 px-4 py-4 text-white">
        <PiPlantFill size={24} />
        <span className="fs-5 fw-semibold">Corbana</span>
      </div>

      <nav className="flex-grow-1 px-3 d-flex flex-column gap-1 mt-2">
        <Link href="/" className={navLinkClass(pathname === "/")}>
          <FiHome size={18} />
          Inicio
        </Link>

        {maestrosVisible && (
          <>
            <button
              type="button"
              onClick={() => setMaestrosOpen((v) => !v)}
              className={`d-flex align-items-center justify-content-between gap-2 px-3 py-2 rounded-3 border-0 bg-transparent small ${
                pathname.startsWith("/maestros") ? "text-white fw-medium" : "text-white-50"
              }`}
            >
              <span className="d-flex align-items-center gap-2">
                <FiLayers size={18} />
                Maestros
              </span>
              <FiChevronRight style={{ transform: maestrosOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
            </button>

            {maestrosOpen && (
              <div className="ps-4 d-flex flex-column gap-1">
                {perms.fincas && (
                  <Link href="/maestros/fincas" className={navLinkClass(pathname === "/maestros/fincas")}>
                    <GiFarmTractor size={16} />
                    Fincas
                  </Link>
                )}
                {perms.usuarios && (
                  <Link href="/maestros/usuarios" className={navLinkClass(pathname === "/maestros/usuarios")}>
                    <FiUsers size={16} />
                    Usuarios
                  </Link>
                )}
                {perms.roles && (
                  <Link href="/maestros/roles" className={navLinkClass(pathname === "/maestros/roles")}>
                    <FiShield size={16} />
                    Roles
                  </Link>
                )}
                {perms.semanas && (
                  <Link href="/maestros/semanas" className={navLinkClass(pathname === "/maestros/semanas")}>
                    <FiCalendar size={16} />
                    Semanas
                  </Link>
                )}
              </div>
            )}
          </>
        )}

        {perms.cargue && (
          <Link href="/cargue" className={navLinkClass(pathname === "/cargue")}>
            <FiUploadCloud size={18} />
            Cargue Masivo
          </Link>
        )}
        <Link href="/reportes" className={navLinkClass(pathname === "/reportes")}>
          <FiBarChart2 size={18} />
          Reportes
        </Link>
      </nav>

      <div className="px-3 pb-4">
        <button
          type="button"
          onClick={handleLogout}
          className="d-flex align-items-center gap-2 px-3 py-2 rounded-3 border-0 bg-transparent text-white-50 small w-100 text-start"
        >
          <FiLogOut size={18} />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
