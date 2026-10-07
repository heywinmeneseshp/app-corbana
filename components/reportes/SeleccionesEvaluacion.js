"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import SelectorCanastas from "@/components/reportes/SelectorCanastas";

export const SERIE_COLORS = ["#16a34a", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#be185d", "#65a30d"];

// Estado del filtro de selecciones de Sanidad Vegetal > Gráficos — el mismo
// filtro que usa Reportes > Producción: cada "canasta" agrupa fincas/grupos
// (se agregan juntas) y sus años; cada combinación canasta × año es una serie
// del gráfico. Devuelve `series` listas para pedir a los endpoints:
// [{ key, label, fincaUuids, anio, color }].
export function useSelecciones({ fincas: fincasExternas } = {}) {
  const anioActual = new Date().getFullYear();
  const anioOpciones = useMemo(() => {
    const out = [];
    for (let i = anioActual - 5; i <= anioActual; i++) out.push(i);
    return out;
  }, [anioActual]);

  const [fincasPropias, setFincas] = useState([]);
  const fincas = fincasExternas ?? fincasPropias;
  const [canastas, setCanastas] = useState([{ id: "c0", nombre: "", objetivos: [], anios: [] }]);

  useEffect(() => {
    if (fincasExternas) return;
    apiFetch("/fincas?limit=100")
      .then((res) => setFincas(res.items || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const series = useMemo(() => {
    const objetivos = canastas.map((c, i) => {
      const fincaUuids = [...new Set(c.objetivos.flatMap((o) => o.fincaUuids || []))];
      const fincaIds = [...new Set(c.objetivos.flatMap((o) => o.fincaIds || []))];
      const nombreAuto =
        c.objetivos.length === 0
          ? "Todas las fincas"
          : c.objetivos.length === 1
            ? c.objetivos[0].nombre
            : c.objetivos.length <= 3
              ? c.objetivos.map((o) => o.nombre).join(" + ")
              : `${c.objetivos.length} seleccionados`;
      return {
        id: c.id,
        nombre: c.nombre?.trim() || (canastas.length > 1 ? `Selección ${i + 1}` : nombreAuto),
        fincaUuids,
        fincaIds,
        anios: c.anios.length > 0 ? c.anios : [anioActual],
      };
    });
    const aniosDistintos = new Set(objetivos.flatMap((o) => o.anios));
    const out = [];
    for (const obj of objetivos) {
      for (const anio of obj.anios) {
        out.push({
          key: `${obj.id}-${anio}`,
          label: `${obj.nombre}${aniosDistintos.size > 1 ? ` ${anio}` : ""}`,
          fincaUuids: obj.fincaUuids,
          fincaIds: obj.fincaIds,
          anio,
          color: SERIE_COLORS[out.length % SERIE_COLORS.length],
        });
      }
    }
    return out;
  }, [canastas, anioActual]);

  return { fincas, canastas, setCanastas, anioOpciones, series };
}

// Barra de filtros (misma que Reportes > Producción): fincas/grupos, años y el
// botón verde «Comparar con otra selección» al extremo derecho.
export function BarraSelecciones({ sel }) {
  return (
    <div className="mb-3 d-flex flex-wrap align-items-end gap-2">
      <SelectorCanastas fincas={sel.fincas} anioOpciones={sel.anioOpciones} canastas={sel.canastas} onChange={sel.setCanastas} />
    </div>
  );
}
