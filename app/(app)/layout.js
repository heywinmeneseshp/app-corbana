"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import PrecipitacionDiariaModal from "@/components/PrecipitacionDiariaModal";
import AreaLoteModal from "@/components/AreaLoteModal";
import PreviewRolBanner from "@/components/PreviewRolBanner";

export default function AppLayout({ children }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("corbana_user")) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return null;

  // Alto fijo (no "min-vh-100") a propósito: así el div raíz tiene una
  // altura real y no una que dependa del contenido, que es lo que hacía
  // que el Sidebar (con height: 100%, relativo a esta fila) se quedara
  // corto — .min-h-0 de Bootstrap no existe en la versión instalada acá,
  // así que ese min-height nunca se aplicaba. Con altura real en cada
  // nivel, "main" es el único que scrollea (overflowY auto), Sidebar y el
  // banner quedan fijos arriba sin necesidad de position:sticky.
  return (
    <div className="d-flex flex-column" style={{ height: "100vh" }}>
      <PreviewRolBanner />
      <div className="d-flex" style={{ flex: "1 1 auto", minHeight: 0 }}>
        <Sidebar />
        <main
          className="flex-grow-1 min-w-0"
          style={{ backgroundColor: "var(--brand-50)", overflowX: "hidden", overflowY: "auto" }}
        >
          {children}
        </main>
      </div>
      <PrecipitacionDiariaModal />
      <AreaLoteModal />
    </div>
  );
}
