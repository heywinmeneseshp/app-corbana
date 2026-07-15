"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LeafIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 21C7 21 3 17.5 3 12.5C3 7 7.5 3 13 3C13 9 9.5 12.5 5 13.5C7.5 15.5 11 16 12 21Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [maestrosOpen, setMaestrosOpen] = useState(pathname.startsWith("/maestros"));

  const handleLogout = () => {
    localStorage.removeItem("corbana_access_token");
    localStorage.removeItem("corbana_refresh_token");
    router.push("/login");
  };

  const navLinkClass = (active) =>
    `d-flex align-items-center gap-2 px-3 py-2 rounded-3 text-decoration-none small ${
      active ? "bg-white bg-opacity-10 text-white fw-medium" : "text-white-50"
    }`;

  return (
    <aside className="d-flex flex-column flex-shrink-0" style={{ width: "16rem", backgroundColor: "var(--brand-900)" }}>
      <div className="d-flex align-items-center gap-2 px-4 py-4 text-white">
        <LeafIcon />
        <span className="fs-5 fw-semibold">Corbana</span>
      </div>

      <nav className="flex-grow-1 px-3 d-flex flex-column gap-1 mt-2">
        <Link href="/" className={navLinkClass(pathname === "/")}>
          <IconHome />
          Inicio
        </Link>

        <button
          type="button"
          onClick={() => setMaestrosOpen((v) => !v)}
          className={`d-flex align-items-center justify-content-between gap-2 px-3 py-2 rounded-3 border-0 bg-transparent small ${
            pathname.startsWith("/maestros") ? "text-white fw-medium" : "text-white-50"
          }`}
        >
          <span className="d-flex align-items-center gap-2">
            <IconLayers />
            Maestros
          </span>
          <span style={{ transform: maestrosOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>›</span>
        </button>

        {maestrosOpen && (
          <div className="ps-4 d-flex flex-column gap-1">
            <Link href="/maestros/fincas" className={navLinkClass(pathname === "/maestros/fincas")}>
              <IconFinca />
              Fincas
            </Link>
          </div>
        )}

        <Link href="/cargue" className={navLinkClass(pathname === "/cargue")}>
          <IconUpload />
          Cargue Masivo
        </Link>
        <Link href="/reportes" className={navLinkClass(pathname === "/reportes")}>
          <IconChart />
          Reportes
        </Link>
      </nav>

      <div className="px-3 pb-4">
        <button
          type="button"
          onClick={handleLogout}
          className="d-flex align-items-center gap-2 px-3 py-2 rounded-3 border-0 bg-transparent text-white-50 small w-100 text-start"
        >
          <IconLogout />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}

function IconHome() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 11.5L12 4l8 7.5M6 10v9h5v-5h2v5h5v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconLayers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M12 3 2 8l10 5 10-5-10-5Z" strokeLinejoin="round" />
      <path d="M2 12l10 5 10-5M2 16l10 5 10-5" strokeLinejoin="round" />
    </svg>
  );
}
function IconFinca() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 12h4l3 8 4-16 3 8h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconUpload() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path
        d="M12 15V3m0 12l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconChart() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 19h16M7 16v-4m5 4V8m5 8v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path
        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
