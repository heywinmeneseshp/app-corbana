"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FiHome, FiLayers, FiUploadCloud, FiBarChart2, FiTrendingUp, FiActivity, FiLogOut, FiChevronRight, FiChevronLeft, FiChevronsRight, FiUsers, FiShield, FiCalendar, FiList, FiUser, FiSmartphone, FiCloudRain, FiFolder, FiCheckSquare, FiClipboard, FiMap, FiPackage, FiAlertTriangle } from "react-icons/fi";
import { GiFarmTractor, GiBananaBunch, GiCancel, GiScissors, GiFruitBowl } from "react-icons/gi";
import { clearSession, hasPermission } from "@/lib/auth";
import CorbanaLogo from "@/components/CorbanaLogo";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [maestrosOpen, setMaestrosOpen] = useState(pathname.startsWith("/maestros"));
  const [racimosOpen, setRacimosOpen] = useState(pathname.startsWith("/racimos"));
  const [laboresOpen, setLaboresOpen] = useState(pathname.startsWith("/calendario-labores") || pathname.startsWith("/labores"));
  const [sanidadOpen, setSanidadOpen] = useState(pathname.startsWith("/sanidad-vegetal"));
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
      // Menú (nivel 1 — muestra/oculta la sección completa) y submenú
      // (nivel 2 — cada link puntual, ya con la sección visible). Capa
      // separada de los permisos granulares de acción (finca.ver,
      // infeccion.crear, etc.), que siguen controlando el backend y los
      // botones puntuales dentro de cada pantalla — ver
      // permissions.constants.js.
      maestrosMenu: hasPermission("menu.maestros"),
      fincas: hasPermission("menu.maestros.fincas"),
      gruposFinca: hasPermission("menu.maestros.grupos_finca"),
      areaLoteConfig: hasPermission("menu.maestros.area_lotes"),
      usuarios: hasPermission("menu.maestros.usuarios"),
      roles: hasPermission("menu.maestros.roles"),
      semanas: hasPermission("menu.maestros.semanas"),
      calendario: hasPermission("menu.maestros.calendario"),
      motivoRepique: hasPermission("menu.maestros.motivos_repique"),
      motivoRecuse: hasPermission("menu.maestros.motivos_recuse"),
      categoriaLabor: hasPermission("menu.maestros.categorias_labor"),
      labor: hasPermission("menu.maestros.labores"),
      estadioSigatoka: hasPermission("menu.maestros.estadios_sigatoka"),
      versionApp: hasPermission("menu.maestros.version_app"),

      racimosMenu: hasPermission("menu.racimos"),
      racimoMovimientoVer: hasPermission("menu.racimos.movimientos"),
      racimoMovimientoCrear: hasPermission("menu.racimos.registrar"),
      racimoSaldosLotesCintas: hasPermission("menu.racimos.saldos_lotes_cintas"),
      racimoReporteEmbolses: hasPermission("menu.racimos.reporte_embolses"),

      laboresMenu: hasPermission("menu.labores"),
      calendarioLabores: hasPermission("menu.labores.calendario"),
      estadosLabores: hasPermission("menu.labores.estados"),

      sanidadVegetalMenu: hasPermission("menu.sanidad_vegetal"),
      sanidadVegetal: hasPermission("menu.sanidad_vegetal.evaluaciones"),
      sanidadGraficos: hasPermission("menu.sanidad_vegetal.graficos"),
      laborEvaluacion: hasPermission("menu.sanidad_vegetal.labores"),
      sanidadAlertas: hasPermission("menu.sanidad_vegetal.alertas"),

      precipitacionDiaria: hasPermission("menu.precipitacion_diaria"),
      produccionSemanal: hasPermission("menu.produccion_semanal"),
      pronostico: hasPermission("menu.pronostico"),
      cargue: hasPermission("menu.cargue_masivo"),
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

  const maestrosVisible = perms.maestrosMenu;
  const laboresVisible = perms.laboresMenu;
  const label = (text) => (!collapsed ? text : null);

  return (
    <aside
      className="d-flex flex-column flex-shrink-0"
      style={{ width, backgroundColor: "var(--brand-900)", transition: "width .15s", height: "100%", position: "sticky", top: 0 }}
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
                {perms.gruposFinca && (
                  <Link href="/maestros/grupos-finca" className={navLinkClass(pathname === "/maestros/grupos-finca")}>
                    <GiFarmTractor size={16} />
                    Grupos de Finca
                  </Link>
                )}
                {perms.areaLoteConfig && (
                  <Link href="/maestros/area-lotes-config" className={navLinkClass(pathname === "/maestros/area-lotes-config")}>
                    <FiMap size={16} />
                    Área de Lotes
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
                {perms.calendario && (
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
                {perms.categoriaLabor && (
                  <Link href="/maestros/categorias-labor" className={navLinkClass(pathname === "/maestros/categorias-labor")}>
                    <FiFolder size={16} />
                    Categorías de Labor
                  </Link>
                )}
                {perms.labor && (
                  <Link href="/maestros/labores" className={navLinkClass(pathname === "/maestros/labores")}>
                    <FiCheckSquare size={16} />
                    Labores
                  </Link>
                )}
                {perms.estadioSigatoka && (
                  <Link href="/maestros/estadios-sigatoka" className={navLinkClass(pathname === "/maestros/estadios-sigatoka")}>
                    <FiTrendingUp size={16} />
                    Estadios de Sigatoka
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

        {perms.racimosMenu && (
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
                {perms.racimoSaldosLotesCintas && (
                  <Link href="/racimos/saldos-lotes-cintas" className={navLinkClass(pathname === "/racimos/saldos-lotes-cintas")}>
                    <FiBarChart2 size={16} />
                    Saldos × Lotes y Cintas
                  </Link>
                )}
                {perms.racimoReporteEmbolses && (
                  <Link href="/racimos/reporte-embolses" className={navLinkClass(pathname === "/racimos/reporte-embolses")}>
                    <FiTrendingUp size={16} />
                    Reporte de Embolses
                  </Link>
                )}
              </div>
            )}
          </>
        )}
        {laboresVisible && (
          <>
            <button
              type="button"
              onClick={() => setLaboresOpen((v) => !v)}
              className={`d-flex align-items-center justify-content-between gap-2 px-3 py-2 rounded-3 border-0 bg-transparent small ${
                pathname.startsWith("/calendario-labores") || pathname.startsWith("/labores") ? "text-white fw-medium" : "text-white-50"
              }`}
              title="Labores"
            >
              <span className="d-flex align-items-center gap-2">
                <FiClipboard size={18} />
                {label("Labores")}
              </span>
              {!collapsed && (
                <FiChevronRight style={{ transform: laboresOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
              )}
            </button>

            {laboresOpen && !collapsed && (
              <div className="ps-4 d-flex flex-column gap-1">
                {perms.calendarioLabores && (
                  <Link href="/calendario-labores" className={navLinkClass(pathname.startsWith("/calendario-labores"))}>
                    <FiCalendar size={16} />
                    Calendario de Labores
                  </Link>
                )}
                {perms.estadosLabores && (
                  <Link href="/labores/estados" className={navLinkClass(pathname === "/labores/estados")}>
                    <FiCheckSquare size={16} />
                    Estados de Labores
                  </Link>
                )}
              </div>
            )}
          </>
        )}
        {perms.precipitacionDiaria && (
          <Link
            href="/precipitacion-diaria"
            className={navLinkClass(pathname.startsWith("/precipitacion-diaria"))}
            title="Precipitación Diaria"
          >
            <FiCloudRain size={18} />
            {label("Precipitación Diaria")}
          </Link>
        )}
        {perms.produccionSemanal && (
          <Link
            href="/produccion-semanal"
            className={navLinkClass(pathname.startsWith("/produccion-semanal"))}
            title="Producción Semanal"
          >
            <FiPackage size={18} />
            {label("Producción Semanal")}
          </Link>
        )}
        {perms.pronostico && (
          <Link
            href="/pronostico"
            className={navLinkClass(pathname.startsWith("/pronostico"))}
            title="Pronóstico de Cajas"
          >
            <FiActivity size={18} />
            {label("Pronóstico de Cajas")}
          </Link>
        )}
        {perms.sanidadVegetalMenu && (
          <>
            <button
              type="button"
              onClick={() => setSanidadOpen((v) => !v)}
              className={`d-flex align-items-center justify-content-between gap-2 px-3 py-2 rounded-3 border-0 bg-transparent small ${
                pathname.startsWith("/sanidad-vegetal") ? "text-white fw-medium" : "text-white-50"
              }`}
              title="Sanidad Vegetal"
            >
              <span className="d-flex align-items-center gap-2">
                <FiTrendingUp size={18} />
                {label("Sanidad Vegetal")}
              </span>
              {!collapsed && (
                <FiChevronRight style={{ transform: sanidadOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
              )}
            </button>

            {sanidadOpen && !collapsed && (
              <div className="ps-4 d-flex flex-column gap-1">
                {perms.sanidadVegetal && (
                  <Link href="/sanidad-vegetal/evaluaciones" className={navLinkClass(pathname === "/sanidad-vegetal/evaluaciones")}>
                    <FiList size={16} />
                    Evaluaciones
                  </Link>
                )}
                {perms.sanidadGraficos && (
                  <Link href="/sanidad-vegetal/graficos" className={navLinkClass(pathname === "/sanidad-vegetal/graficos")}>
                    <FiBarChart2 size={16} />
                    Gráficos
                  </Link>
                )}
                {perms.laborEvaluacion && (
                  <Link href="/sanidad-vegetal/labores" className={navLinkClass(pathname === "/sanidad-vegetal/labores")}>
                    <GiFarmTractor size={16} />
                    Evaluación de Labores
                  </Link>
                )}
                {perms.sanidadAlertas && (
                  <Link href="/sanidad-vegetal/alertas" className={navLinkClass(pathname === "/sanidad-vegetal/alertas")}>
                    <FiAlertTriangle size={16} />
                    Alertas
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
        <Link
          href="/reportes"
          className={navLinkClass(pathname === "/reportes")}
          title="Reportes"
        >
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
