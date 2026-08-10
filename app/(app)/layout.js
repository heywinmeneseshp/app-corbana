"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import PrecipitacionDiariaModal from "@/components/PrecipitacionDiariaModal";
import AreaLoteModal from "@/components/AreaLoteModal";

export default function AppLayout({ children }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("corbana_access_token")) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return null;

  return (
    <div className="d-flex min-vh-100">
      <Sidebar />
      <main
        className="flex-grow-1 min-w-0"
        style={{ backgroundColor: "var(--brand-50)", overflowX: "hidden" }}
      >
        {children}
      </main>
      <PrecipitacionDiariaModal />
      <AreaLoteModal />
    </div>
  );
}
