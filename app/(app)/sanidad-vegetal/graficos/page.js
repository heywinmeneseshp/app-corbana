"use client";

import { useEffect, useState } from "react";
import { hasPermission } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";
import PromedioPorSemanaChart from "@/components/reportes/PromedioPorSemanaChart";
import PromedioPorEdadChart from "@/components/reportes/PromedioPorEdadChart";
import PromedioInfeccionChart from "@/components/reportes/PromedioInfeccionChart";
import PromedioSumaBrutaPorHojaChart from "@/components/reportes/PromedioSumaBrutaPorHojaChart";
import EvaluacionCompareModal from "@/components/reportes/EvaluacionCompareModal";
import ClimaChart from "@/components/reportes/ClimaChart";

const LIMITES_SB_SEMANA = [{ valor: 1200, color: "#dc2626" }];
const LIMITES_SB_HOJA = [
  { valor: 450, color: "#f59e0b" },
  { valor: 650, color: "#dc2626" },
];
const LINEAS_SB_SEMANA = [{ key: "promedio", label: "Promedio", color: "#16a34a" }];
const LINEAS_SB_HOJA = [
  { key: "h3", label: "Suma Bruta Hoja 3", color: "#2563eb", filtro: (i) => i.hoja === 3 },
  { key: "h5", label: "Suma Bruta Hoja 5", color: "#f59e0b", filtro: (i) => i.hoja === 5 },
];

const INFO_SB_SEMANA = (
  <>
    <p className="fw-semibold mb-1">Suma Bruta por planta</p>
    <p className="mb-2">SB_planta = Hoja_3_val + Hoja_4_val + Hoja_5_val</p>
    <p className="fw-semibold mb-1">Promedio de la finca</p>
    <p className="mb-2">SB_Finca = (Σ SB_planta) / N.° de lotes evaluados</p>
    <p className="mb-0 fst-italic">
      No se divide entre la cantidad de plantas: cada lote suma todas sus plantas evaluadas y ese total
      es lo que se promedia entre lotes — así un lote con más plantas evaluadas no pesa más que uno con
      menos.
    </p>
  </>
);

const INFO_SB_HOJA = (
  <>
    <p className="fw-semibold mb-1">Corrección por candela</p>
    <p className="mb-2">CC_hoja = Candela × 10 (solo si esa hoja fue evaluada; si está vacía, CC = 0)</p>
    <p className="fw-semibold mb-1">Indicador por hoja</p>
    <p className="mb-1">SB_H3 = 10 × [(Σ Hoja_3_val − Σ CC_H3) / N.° de plantas evaluadas]</p>
    <p className="mb-2">SB_H5 = 10 × [(Σ Hoja_5_val − Σ CC_H5) / N.° de plantas evaluadas]</p>
    <p className="mb-0 fst-italic">
      N.° de plantas es siempre la cantidad real de plantas del grupo (finca + semana), nunca un valor
      fijo — normaliza el resultado a una base equivalente de 10 plantas sin importar cuántas se hayan
      evaluado en realidad.
    </p>
  </>
);

// Finca compartida entre los dos gráficos de Suma Bruta (antes cada uno
// tenía su propio selector independiente). Por defecto los dos muestran el
// año actual — igual que ClimaChart — y cada uno tiene su botón de
// expandir para comparar entre fincas y entre años.
function SumaBrutaGraficos() {
  const [fincas, setFincas] = useState([]);
  const [fincaUuid, setFincaUuid] = useState("");
  const [modalAbierto, setModalAbierto] = useState(null); // null | "semana" | "hoja"

  useEffect(() => {
    apiFetch("/fincas?limit=100")
      .then((data) => setFincas(data.items))
      .catch(() => {});
  }, []);

  const fincaNombre = fincas.find((f) => f.uuid === fincaUuid)?.nombre || "Todas las fincas";

  return (
    <>
      <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
        <label className="form-label small fw-medium mb-1">Finca</label>
        <select
          className="form-select form-select-sm rounded-3"
          style={{ width: "auto" }}
          value={fincaUuid}
          onChange={(e) => setFincaUuid(e.target.value)}
        >
          <option value="">Todas las fincas</option>
          {fincas.map((f) => (
            <option key={f.uuid} value={f.uuid}>
              {f.nombre}
            </option>
          ))}
        </select>
      </div>

      <PromedioPorSemanaChart
        titulo="Promedio de Suma Bruta por Semana"
        endpoint="/evaluaciones/suma-bruta-promedio"
        colorLinea="#16a34a"
        mensajeVacio="No hay evaluaciones de Suma Bruta para mostrar."
        limitesControl={LIMITES_SB_SEMANA}
        fincaUuid={fincaUuid}
        onExpand={() => setModalAbierto("semana")}
        info={INFO_SB_SEMANA}
      />
      <PromedioSumaBrutaPorHojaChart
        titulo="Promedio de Suma Bruta por Hoja"
        endpoint="/evaluaciones/suma-bruta-promedio-por-hoja"
        mensajeVacio="No hay evaluaciones de Suma Bruta para mostrar."
        fincaUuid={fincaUuid}
        onExpand={() => setModalAbierto("hoja")}
        info={INFO_SB_HOJA}
      />

      <EvaluacionCompareModal
        open={modalAbierto === "semana"}
        onClose={() => setModalAbierto(null)}
        titulo="Promedio de Suma Bruta por Semana"
        endpoint="/evaluaciones/suma-bruta-promedio"
        lineas={LINEAS_SB_SEMANA}
        limitesControl={LIMITES_SB_SEMANA}
        fincaUuidBase={fincaUuid}
        fincaBaseLabel={fincaNombre}
      />
      <EvaluacionCompareModal
        open={modalAbierto === "hoja"}
        onClose={() => setModalAbierto(null)}
        titulo="Promedio de Suma Bruta por Hoja"
        endpoint="/evaluaciones/suma-bruta-promedio-por-hoja"
        lineas={LINEAS_SB_HOJA}
        limitesControl={LIMITES_SB_HOJA}
        fincaUuidBase={fincaUuid}
        fincaBaseLabel={fincaNombre}
      />
    </>
  );
}

// El permiso null en Clima es intencional: la lista de clima (GET /clima) ya
// es visible para cualquier usuario autenticado, sin permiso puntual — el
// gráfico sigue el mismo criterio. Ver cualquiera de las 3 evaluaciones
// exige el mismo permiso genérico (evaluacion.ver), ya no uno por tipo.
const TIPOS = [
  { key: "Índice de infección", label: "Índice de Infección", permiso: "evaluacion.ver" },
  { key: "Conteo de Hojas", label: "Conteo de Hojas", permiso: "evaluacion.ver" },
  { key: "Suma Bruta", label: "Suma Bruta", permiso: "evaluacion.ver" },
  { key: "Clima", label: "Clima", permiso: null },
];

export default function SanidadGraficosPage() {
  const tabsVisibles = TIPOS.filter((t) => !t.permiso || hasPermission(t.permiso));
  // El tab por defecto tiene que ser uno que el usuario efectivamente pueda
  // ver — antes siempre arrancaba en "Índice de infección" porque la página
  // entera exigía ese permiso; ahora alguien sin permisos de Sanidad Vegetal
  // puede entrar (por Clima) y ese tab ya no existiría para él.
  const [tab, setTab] = useState(() => tabsVisibles[0]?.key);

  // El gate de página ahora es el submenú de navegación
  // (menu.sanidad_vegetal.graficos), no un permiso granular de Sanidad
  // Vegetal — así alguien con acceso al submenú pero sin evaluacion.ver
  // igual puede entrar y ver (solo) Clima.
  return (
    <RequirePermission code="menu.sanidad_vegetal.graficos">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1">Gráficos</h1>
          <p className="text-secondary mb-0">Promedios semanales de infección, conteo de hojas, suma bruta y clima.</p>
        </div>

        <ul className="nav nav-pills mb-4 gap-2">
          {tabsVisibles.map((t) => (
            <li className="nav-item" key={t.key}>
              <button
                type="button"
                className={`nav-link rounded-3 ${tab === t.key ? "btn-brand text-white" : "btn btn-outline-secondary"}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>

        {tab === "Índice de infección" ? (
          <PromedioInfeccionChart titulo="Índice de Infección por Semana" mensajeVacio="No hay evaluaciones de infección para mostrar." />
        ) : tab === "Conteo de Hojas" ? (
          <PromedioPorEdadChart
            titulo="Promedio de Hojas Funcionales por Edad"
            endpoint="/evaluaciones/conteo-promedio"
            mensajeVacio="No hay evaluaciones de Conteo de Hojas para mostrar."
          />
        ) : tab === "Suma Bruta" ? (
          <SumaBrutaGraficos />
        ) : tab === "Clima" ? (
          <ClimaChart mensajeVacio="No hay registros de clima para mostrar." />
        ) : null}
      </div>
    </RequirePermission>
  );
}