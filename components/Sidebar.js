"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FiHome,
  FiLayers,
  FiUploadCloud,
  FiBarChart2,
  FiTrendingUp,
  FiActivity,
  FiLogOut,
  FiChevronRight,
  FiChevronLeft,
  FiChevronsRight,
  FiUsers,
  FiShield,
  FiCalendar,
  FiList,
  FiUser,
  FiCloudRain,
  FiFolder,
  FiCheckSquare,
  FiClipboard,
  FiMap,
  FiPackage,
  FiAlertTriangle,
  FiSearch,
  FiX,
  FiSettings,
  FiShare2,
  FiSmartphone,
  FiDatabase,
  FiBox,
  FiImage,
} from "react-icons/fi";
import { GiFarmTractor, GiBananaBunch, GiCancel, GiScissors, GiFruitBowl } from "react-icons/gi";
import { clearSession, hasPermission } from "@/lib/auth";
import { esAdministrador } from "@/lib/laborEstados";
import { useMarca } from "@/lib/marca";
import AppLogo from "@/components/AppLogo";

// Estructura del menú como datos, no JSX repetido — permite ordenar los
// submenús alfabéticamente y filtrarlos por el buscador con la misma lógica
// en vez de cuatro bloques de render casi idénticos. El orden de las
// SECCIONES de nivel 1 (Maestros, Racimos, ...) se respeta tal cual está acá
// (no se ordena solo); lo que pidió el usuario es que los ITEMS DENTRO de
// cada sección salgan alfabéticos, ya que van creciendo con el tiempo.
const NAV = [
  {
    type: "section",
    key: "maestros",
    label: "Maestros",
    icon: FiLayers,
    permKey: "maestrosMenu",
    pathPrefix: "/maestros",
    items: [
      { key: "fincas", label: "Fincas", icon: GiFarmTractor, permKey: "fincas", href: "/maestros/fincas" },
      { key: "productos", label: "Productos", icon: FiBox, permKey: "productos", href: "/maestros/productos" },
      { key: "gruposFinca", label: "Grupos de Finca", icon: GiFarmTractor, permKey: "gruposFinca", href: "/maestros/grupos-finca" },
      { key: "areaLoteConfig", label: "Área de Lotes", icon: FiMap, permKey: "areaLoteConfig", href: "/maestros/area-lotes-config" },
      { key: "usuarios", label: "Usuarios", icon: FiUsers, permKey: "usuarios", href: "/maestros/usuarios" },
      { key: "roles", label: "Roles", icon: FiShield, permKey: "roles", href: "/maestros/roles" },
      { key: "semanas", label: "Semanas", icon: FiCalendar, permKey: "semanas", href: "/maestros/semanas" },
      { key: "calendario", label: "Calendario", icon: FiCalendar, permKey: "calendario", href: "/maestros/calendario" },
      { key: "motivoRepique", label: "Motivos de Repique", icon: GiCancel, permKey: "motivoRepique", href: "/maestros/motivos-repique" },
      { key: "motivoRecuse", label: "Motivos de Recuse", icon: GiFruitBowl, permKey: "motivoRecuse", href: "/maestros/motivos-recuse" },
      { key: "categoriaLabor", label: "Categorías de Labor", icon: FiFolder, permKey: "categoriaLabor", href: "/maestros/categorias-labor" },
      { key: "labor", label: "Labores", icon: FiCheckSquare, permKey: "labor", href: "/maestros/labores" },
      { key: "colaboradores", label: "Colaboradores", icon: FiUsers, permKey: "colaboradores", href: "/maestros/colaboradores" },
      { key: "estadioSigatoka", label: "Estadios de Sigatoka", icon: FiTrendingUp, permKey: "estadioSigatoka", href: "/maestros/estadios-sigatoka" },
    ],
  },
  {
    type: "section",
    key: "racimos",
    label: "Racimos",
    icon: GiBananaBunch,
    permKey: "racimosMenu",
    pathPrefix: "/racimos",
    items: [
      { key: "racimoMovimientoVer", label: "Movimientos", icon: FiList, permKey: "racimoMovimientoVer", href: "/racimos/movimientos" },
      { key: "racimoMovimientoCrear1", label: "Registrar Embolse", icon: GiBananaBunch, permKey: "racimoMovimientoCrear", href: "/racimos/embolses" },
      { key: "racimoMovimientoCrear2", label: "Registrar Repiques", icon: GiCancel, permKey: "racimoMovimientoCrear", href: "/racimos/repiques" },
      { key: "racimoMovimientoCrear3", label: "Registrar Corte", icon: GiScissors, permKey: "racimoMovimientoCrear", href: "/racimos/corte" },
      { key: "racimoSaldosLotesCintas", label: "Saldos × Lotes y Cintas", icon: FiBarChart2, permKey: "racimoSaldosLotesCintas", href: "/racimos/saldos-lotes-cintas" },
      { key: "racimoReporteEmbolses", label: "Reporte de Embolses", icon: FiTrendingUp, permKey: "racimoReporteEmbolses", href: "/racimos/reporte-embolses" },
    ],
  },
  {
    type: "section",
    key: "labores",
    label: "Labores",
    icon: FiClipboard,
    permKey: "laboresMenu",
    pathPrefix: "/calendario-labores",
    altPathPrefix: "/labores",
    items: [
      { key: "calendarioLabores", label: "Calendario de Labores", icon: FiCalendar, permKey: "calendarioLabores", href: "/calendario-labores" },
      { key: "estadosLabores", label: "Estados de Labores", icon: FiCheckSquare, permKey: "estadosLabores", href: "/labores/estados" },
    ],
  },
  { type: "link", key: "precipitacionDiaria", label: "Precipitación Diaria", icon: FiCloudRain, permKey: "precipitacionDiaria", href: "/precipitacion-diaria" },
  { type: "link", key: "produccionSemanal", label: "Producción Semanal", icon: FiPackage, permKey: "produccionSemanal", href: "/produccion-semanal" },
  { type: "link", key: "pronostico", label: "Pronóstico de Cajas", icon: FiActivity, permKey: "pronostico", href: "/pronostico" },
  {
    type: "section",
    key: "sanidadVegetal",
    label: "Sanidad Vegetal",
    icon: FiTrendingUp,
    permKey: "sanidadVegetalMenu",
    pathPrefix: "/sanidad-vegetal",
    items: [
      { key: "sanidadVegetal", label: "Evaluaciones", icon: FiList, permKey: "sanidadVegetal", href: "/sanidad-vegetal/evaluaciones" },
      { key: "sanidadGraficos", label: "Gráficos", icon: FiBarChart2, permKey: "sanidadGraficos", href: "/sanidad-vegetal/graficos" },
      { key: "laborEvaluacion", label: "Evaluación de Labores", icon: GiFarmTractor, permKey: "laborEvaluacion", href: "/sanidad-vegetal/labores" },
      { key: "sanidadAlertas", label: "Alertas", icon: FiAlertTriangle, permKey: "sanidadAlertas", href: "/sanidad-vegetal/alertas" },
    ],
  },
  { type: "link", key: "programacionCorte", label: "Programación de Corte", icon: GiScissors, permKey: "programacionCorte", href: "/programacion-corte" },
  { type: "link", key: "reportes", label: "Reportes", icon: FiBarChart2, permKey: "reportes", href: "/reportes" },
  {
    type: "section",
    key: "inventarios",
    label: "Inventarios",
    icon: FiBox,
    permKey: "inventariosMenu",
    pathPrefix: "/inventarios",
    items: [
      { key: "inventariosDashboard", label: "Dashboard", icon: FiBarChart2, permKey: "inventariosDashboard", href: "/inventarios" },
      { key: "inventariosProductos", label: "Productos", icon: FiPackage, permKey: "inventariosProductos", href: "/inventarios/productos" },
      { key: "inventariosCategorias", label: "Categorías", icon: FiFolder, permKey: "inventariosCategorias", href: "/inventarios/categorias" },
      { key: "inventariosUnidades", label: "Unidades", icon: FiSettings, permKey: "inventariosUnidades", href: "/inventarios/unidades" },
      { key: "inventariosAlmacenes", label: "Almacenes", icon: FiDatabase, permKey: "inventariosAlmacenes", href: "/inventarios/almacenes" },
      { key: "inventariosMotivos", label: "Motivos", icon: FiClipboard, permKey: "inventariosMotivos", href: "/inventarios/motivos" },
      { key: "inventariosMovimientos", label: "Movimientos", icon: FiShare2, permKey: "inventariosMovimientos", href: "/inventarios/movimientos" },
      { key: "inventariosExistencias", label: "Existencias", icon: FiBox, permKey: "inventariosMovimientos", href: "/inventarios/existencias" },
      { key: "inventariosKardex", label: "Kardex", icon: FiList, permKey: "inventariosMovimientos", href: "/inventarios/kardex" },
    ],
  },
  {
    type: "section",
    key: "configuracion",
    label: "Configuración",
    icon: FiSettings,
    permKey: "configuracionMenu",
    pathPrefix: "/configuracion",
    items: [
      { key: "configLogistica", label: "Conexión con Logística", icon: FiShare2, permKey: "configuracion", href: "/configuracion/logistica" },
      { key: "configVersionApp", label: "Versión App Móvil", icon: FiSmartphone, permKey: "configuracion", href: "/configuracion/version-app" },
      { key: "configCargue", label: "Cargue Masivo", icon: FiUploadCloud, permKey: "configuracion", href: "/configuracion/cargue" },
      { key: "configBackup", label: "Base de Datos", icon: FiDatabase, permKey: "configuracion", href: "/configuracion/backup" },
      { key: "configConversion", label: "Tasa de Conversión", icon: FiPackage, permKey: "configuracion", href: "/configuracion/conversion" },
      { key: "configMarca", label: "Marca de la App", icon: FiImage, permKey: "configuracion", href: "/configuracion/marca" },
    ],
  },
];

// Quita tildes (vía NFD + rango unicode de marcas diacríticas) para que
// buscar "grafico" encuentre "Gráficos" sin que el usuario tenga que
// escribir la tilde.
const DIACRITICOS = /[̀-ͯ]/g;
const normalizar = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICOS, "");

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { nombreApp } = useMarca();
  const [openSections, setOpenSections] = useState(() => {
    const inicial = {};
    for (const entry of NAV) {
      if (entry.type !== "section") continue;
      inicial[entry.key] = pathname.startsWith(entry.pathPrefix) || (entry.altPathPrefix && pathname.startsWith(entry.altPathPrefix));
    }
    return inicial;
  });
  const [collapsed, setCollapsed] = useState(false);
  const [perms, setPerms] = useState(null); // null hasta montar en cliente, evita parpadeo/mismatch
  const [busqueda, setBusqueda] = useState("");

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
      // evaluacion.crear, etc.), que siguen controlando el backend y los
      // botones puntuales dentro de cada pantalla — ver
      // permissions.constants.js.
      maestrosMenu: hasPermission("menu.maestros"),
      fincas: hasPermission("menu.maestros.fincas"),
      productos: hasPermission("menu.maestros.productos"),
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
      colaboradores: hasPermission("menu.maestros.colaboradores"),
      estadioSigatoka: hasPermission("menu.maestros.estadios_sigatoka"),
      // Sin código de permiso propio a propósito: Configuración es solo
      // para el rol Administrador, nunca asignable a otros roles (ver
      // components/RequireAdmin.js y requireAdmin.middleware.js).
      configuracionMenu: esAdministrador(),
      configuracion: esAdministrador(),

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
      programacionCorte: hasPermission("menu.programacion_corte"),
      reportes: hasPermission("menu.reportes"),

      inventariosMenu: hasPermission("menu.inventarios"),
      inventariosDashboard: hasPermission("menu.inventarios.dashboard"),
      inventariosProductos: hasPermission("menu.inventarios.productos"),
      inventariosCategorias: hasPermission("menu.inventarios.categorias"),
      inventariosUnidades: hasPermission("menu.inventarios.unidades"),
      inventariosAlmacenes: hasPermission("menu.inventarios.almacenes"),
      inventariosMotivos: hasPermission("menu.inventarios.motivos"),
      inventariosMovimientos: hasPermission("menu.inventarios.movimientos"),
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

  // Cada sección visible, con sus items ya filtrados por permiso y
  // ORDENADOS ALFABÉTICAMENTE (localeCompare en español, para que las
  // tildes ordenen bien) — antes salían en el orden fijo en que se habían
  // ido agregando al código, cada vez más difícil de ubicar a simple vista
  // a medida que crecen las opciones.
  const secciones = useMemo(() => {
    if (!perms) return [];
    return NAV.map((entry) => {
      if (entry.type === "link") {
        return { ...entry, visible: entry.permKey === null || perms[entry.permKey] };
      }
      const items = entry.items
        .filter((item) => perms[item.permKey])
        .sort((a, b) => a.label.localeCompare(b.label, "es"));
      return { ...entry, items, visible: perms[entry.permKey] && items.length > 0 };
    });
  }, [perms]);

  // Con texto en el buscador: se filtra cada sección a solo los items que
  // matchean (o, si el nombre de la SECCIÓN matchea, se muestran todos sus
  // items ya visibles) y se fuerzan abiertas las que tengan algún
  // resultado — sin esto, buscar "roles" no serviría de nada si "Maestros"
  // estaba plegado.
  const query = normalizar(busqueda.trim());
  const resultados = useMemo(() => {
    // Sin texto de búsqueda igual hay que filtrar por `.visible` — antes se
    // devolvía `secciones` tal cual, sin sacar las entradas sin permiso, y
    // el menú terminaba mostrando TODO (el filtro por permiso solo se
    // aplicaba de rebote cuando había una búsqueda activa).
    if (!query) return secciones.filter((entry) => entry.visible);
    return secciones
      .map((entry) => {
        if (entry.type === "link") {
          return { ...entry, visible: entry.visible && normalizar(entry.label).includes(query) };
        }
        const seccionMatch = normalizar(entry.label).includes(query);
        const items = seccionMatch ? entry.items : entry.items.filter((item) => normalizar(item.label).includes(query));
        return { ...entry, items, visible: entry.visible && items.length > 0 };
      })
      .filter((entry) => entry.visible);
  }, [secciones, query]);

  if (!perms) return <aside className="flex-shrink-0" style={{ width, backgroundColor: "var(--brand-900)" }} />;

  const label = (text) => (!collapsed ? text : null);
  const buscando = query.length > 0;

  const toggleSection = (key) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <aside
      className="d-flex flex-column flex-shrink-0"
      style={{ width, backgroundColor: "var(--brand-900)", transition: "width .15s", height: "100%", position: "sticky", top: 0 }}
    >
      <div className={`d-flex align-items-center text-white py-4 ${collapsed ? "justify-content-center px-2" : "justify-content-between px-4"}`}>
        <div className="d-flex align-items-center gap-2">
          <AppLogo size={24} color="#fff" />
          {!collapsed && <span className="fs-5 fw-semibold">{nombreApp}</span>}
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

      {!collapsed && (
        <div className="px-3 mt-1">
          <div className="position-relative">
            <FiSearch
              size={14}
              className="position-absolute text-white-50"
              style={{ top: "50%", left: "0.75rem", transform: "translateY(-50%)" }}
            />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en el menú..."
              className="sidebar-search-input form-control form-control-sm rounded-3 bg-transparent text-white border-white border-opacity-25"
              style={{ paddingLeft: "2rem", paddingRight: busqueda ? "2rem" : undefined }}
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                className="btn btn-sm p-0 border-0 position-absolute text-white-50"
                style={{ top: "50%", right: "0.5rem", transform: "translateY(-50%)" }}
                title="Limpiar búsqueda"
              >
                <FiX size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      <nav className="flex-grow-1 px-3 d-flex flex-column gap-1 mt-2 overflow-y-auto">
        {(!buscando || normalizar("Inicio").includes(query)) && (
          <Link href="/" className={navLinkClass(pathname === "/")} title="Inicio">
            <FiHome size={18} />
            {label("Inicio")}
          </Link>
        )}

        {resultados.map((entry) => {
          if (entry.type === "link") {
            const Icon = entry.icon;
            return (
              <Link key={entry.key} href={entry.href} className={navLinkClass(pathname === entry.href || pathname.startsWith(`${entry.href}/`))} title={entry.label}>
                <Icon size={18} />
                {label(entry.label)}
              </Link>
            );
          }

          const Icon = entry.icon;
          const abierta = buscando || openSections[entry.key];
          const activa = pathname.startsWith(entry.pathPrefix) || (entry.altPathPrefix && pathname.startsWith(entry.altPathPrefix));

          return (
            <div key={entry.key}>
              <button
                type="button"
                onClick={() => toggleSection(entry.key)}
                className={`d-flex align-items-center justify-content-between gap-2 px-3 py-2 rounded-3 border-0 bg-transparent small w-100 ${
                  activa ? "text-white fw-medium" : "text-white-50"
                }`}
                title={entry.label}
              >
                <span className="d-flex align-items-center gap-2">
                  <Icon size={18} />
                  {label(entry.label)}
                </span>
                {!collapsed && (
                  <FiChevronRight style={{ transform: abierta ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                )}
              </button>

              {abierta && !collapsed && (
                <div className="ps-4 d-flex flex-column gap-1">
                  {entry.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <Link key={item.key} href={item.href} className={navLinkClass(pathname === item.href || pathname.startsWith(`${item.href}/`))}>
                        <ItemIcon size={16} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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

      <style jsx>{`
        .sidebar-search-input::placeholder {
          color: rgba(255, 255, 255, 0.6);
        }
        .sidebar-search-input:focus {
          color: #fff;
          background-color: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.5);
          box-shadow: none;
        }
      `}</style>
    </aside>
  );
}
