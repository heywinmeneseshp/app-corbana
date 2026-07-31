"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FiHome, FiLayers, FiUploadCloud, FiBarChart2, FiTrendingUp, FiLogOut, FiChevronRight, FiChevronLeft, FiChevronsRight, FiUsers, FiShield, FiCalendar, FiList, FiUser, FiSmartphone } from "react-icons/fi";
import { GiFarmTractor, GiBananaBunch, GiCancel, GiScissors, GiFruitBowl } from "react-icons/gi";
import { clearSession, hasPermission, hasAnyPermission } from "@/lib/auth";
import CorbanaLogo from "@/components/CorbanaLogo";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [maestrosOpen, setMaestrosOpen] = useState(pathname.startsWith("/maestros"));
  const [racimosOpen, setRacimosOpen] = useState(pathname.startsWith("/racimos"));
  const [collapsed, setCollapsed] = useState(false);
  const [perms, setPerms] = useState(null); // null hasta montar en cliente, evita parpadeo/mismatch

  useEffect(() => {
    const saved = localStorage.getItem("corbana_sidebar_collapsed");
    if (saved === "1") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      localStorage.setItem("corbana_sidebar_collapsed", !v ? "1" : "0");
      return !v;
    });
  };

  useEffect(() => {
    setPerms({
      fincas: hasPermission("finca.ver"),
      usuarios: hasPermission("usuarios.ver"),
      roles: hasPermission("roles.ver"),
      semanas: hasPermission("semana.ver"),
      motivoRepique: hasPermission("motivo_repique.ver"),
      motivoRecuse: hasPermission("motivo_recuse.ver"),
      versionApp: hasPermission("roles.ver"),
      cargue: hasAnyPermission([
        "finca.crear",
        "lote.crear",
        "racimo_movimiento.crear",
        "motivo_repique.crear",
        "motivo_recuse.crear",
      ]),
      racimoMovimientoCrear: hasPermission("racimo_movimiento.crear"),
      racimoMovimientoVer: hasPermission("racimo_movimiento.ver"),
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

  const width = collapsed ? "4.25rem" : "16rem";

  if (!perms) return <aside className="flex-shrink-0" style={{ width, backgroundColor: "var(--brand-900)" }} />;

  const maestrosVisible =
    perms.fincas ||
    perms.usuarios ||
    perms.roles ||
    perms.semanas ||
    perms.motivoRepique ||
    perms.motivoRecuse ||
    perms.versionApp;
  const label = (text) => (!collapsed ? text : null);

  return (
    <aside
      className="d-flex flex-column flex-shrink-0"
      style={{ width, backgroundColor: "var(--brand-900)", transition: "width .15s", height: "100vh", position: "sticky", top: 0 }}
    >
      <div className={`d-flex align-items-center text-white py-4 ${collapsed ? "justify-content-center px-2" : "justify-content-between px-4"}`}>
        <div className="d-flex align-items-center gap-2">
          <CorbanaLogo size={24} />
          {!collapsed && <span className="fs-5 fw-semibold">Corbana</span>}
        </div>
        {!collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="btn btn-sm btn-link text-white-50 p-0"
            title="Ocultar menú"
          >
            <FiChevronLeft size={18} />
          </button>
        )}
      </div>
      {collapsed && (
        <button
          type="button"
          onClick={toggleCollapsed}
          className="btn btn-sm btn-link text-white-50 d-flex justify-content-center py-1"
          title="Mostrar menú"
        >
          <FiChevronsRight size={16} />
        </button>
      )}

      <nav className="flex-grow-1 px-3 d-flex flex-column gap-1 mt-2 overflow-y-auto">
        <Link href="/" className={navLinkClass(pathname === "/")} title="Inicio">
          <FiHome size={18} />
          {label("Inicio")}
        </Link>

        {maestrosVisible && (
          <>
            <button
              type="button"
              onClick={() => setMaestrosOpen((v) => !v)}
              className={`d-flex align-items-center justify-content-between gap-2 px-3 py-2 rounded-3 border-0 bg-transparent small ${
                pathname.startsWith("/maestros") ? "text-white fw-medium" : "text-white-50"
              }`}
              title="Maestros"
            >
              <span className="d-flex align-items-center gap-2">
                <FiLayers size={18} />
                {label("Maestros")}
              </span>
              {!collapsed && (
                <FiChevronRight style={{ transform: maestrosOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
              )}
            </button>

            {maestrosOpen && !collapsed && (
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
                {perms.semanas && (
                  <Link href="/maestros/calendario" className={navLinkClass(pathname === "/maestros/calendario")}>
                    <FiCalendar size={16} />
                    Calendario
                  </Link>
                )}
                {perms.motivoRepique && (
                  <Link href="/maestros/motivos-repique" className={navLinkClass(pathname === "/maestros/motivos-repique")}>
                    <GiCancel size={16} />
                    Motivos de Repique
                  </Link>
                )}
                {perms.motivoRecuse && (
                  <Link href="/maestros/motivos-recuse" className={navLinkClass(pathname === "/maestros/motivos-recuse")}>
                    <GiFruitBowl size={16} />
                    Motivos de Recuse
                  </Link>
                )}
                {perms.versionApp && (
                  <Link href="/maestros/version-app" className={navLinkClass(pathname === "/maestros/version-app")}>
                    <FiSmartphone size={16} />
                    Versión App Móvil
                  </Link>
                )}
              </div>
            )}
          </>
        )}

        {(perms.racimoMovimientoCrear || perms.racimoMovimientoVer) && (
          <>
            <button
              type="button"
              onClick={() => setRacimosOpen((v) => !v)}
              className={`d-flex align-items-center justify-content-between gap-2 px-3 py-2 rounded-3 border-0 bg-transparent small ${
                pathname.startsWith("/racimos") ? "text-white fw-medium" : "text-white-50"
              }`}
              title="Racimos"
            >
              <span className="d-flex align-items-center gap-2">
                <GiBananaBunch size={18} />
                {label("Racimos")}
              </span>
              {!collapsed && (
                <FiChevronRight style={{ transform: racimosOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
              )}
            </button>

            {racimosOpen && !collapsed && (
              <div className="ps-4 d-flex flex-column gap-1">
                {perms.racimoMovimientoVer && (
                  <Link href="/racimos/movimientos" className={navLinkClass(pathname === "/racimos/movimientos")}>
                    <FiList size={16} />
                    Movimientos
                  </Link>
                )}
                {perms.racimoMovimientoCrear && (
                  <>
                    <Link href="/racimos/embolses" className={navLinkClass(pathname === "/racimos/embolses")}>
                      <GiBananaBunch size={16} />
                      Registrar Embolse
                    </Link>
                    <Link href="/racimos/repiques" className={navLinkClass(pathname === "/racimos/repiques")}>
                      <GiCancel size={16} />
                      Registrar Repiques
                    </Link>
                    <Link href="/racimos/corte" className={navLinkClass(pathname === "/racimos/corte")}>
                      <GiScissors size={16} />
                      Registrar Corte
                    </Link>
                  </>
                )}
                {perms.racimoMovimientoVer && (
                  <Link href="/racimos/saldos-lotes-cintas" className={navLinkClass(pathname === "/racimos/saldos-lotes-cintas")}>
                    <FiBarChart2 size={16} />
                    Saldos × Lotes y Cintas
                  </Link>
                )}
                {perms.racimoMovimientoVer && (
                  <Link href="/racimos/reporte-embolses" className={navLinkClass(pathname === "/racimos/reporte-embolses")}>
                    <FiTrendingUp size={16} />
                    Reporte de Embolses
                  </Link>
                )}
              </div>
            )}
          </>
        )}

        {perms.cargue && (
          <Link href="/cargue" className={navLinkClass(pathname === "/cargue")} title="Cargue Masivo">
            <FiUploadCloud size={18} />
            {label("Cargue Masivo")}
          </Link>
        )}
        <Link href="/reportes" className={navLinkClass(pathname === "/reportes")} title="Reportes">
          <FiBarChart2 size={18} />
          {label("Reportes")}
        </Link>
      </nav>

      <div className="px-3 pb-4 d-flex flex-column gap-1 flex-shrink-0">
        <Link href="/profile" className={navLinkClass(pathname === "/profile")} title="Mi Perfil">
          <FiUser size={18} />
          {label("Mi Perfil")}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="d-flex align-items-center gap-2 px-3 py-2 rounded-3 border-0 bg-transparent text-white-50 small w-100 text-start"
          title="Cerrar Sesión"
        >
          <FiLogOut size={18} />
          {label("Cerrar Sesión")}
        </button>
      </div>
    </aside>
  );
}
