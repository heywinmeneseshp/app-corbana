"use client";

import { useEffect, useMemo, useState } from "react";
import { YAxis, Bar } from "recharts";
import { FiCloudRain } from "react-icons/fi";
import { apiFetch } from "@/lib/api";

// Hook compartido por las gráficas de evaluaciones de Sanidad Vegetal
// (Índice de Infección, Conteo de Hojas, Suma Bruta) para poder superponer
// la precipitación semanal de la misma finca/año y correlacionar
// visualmente lluvia con lo que muestre cada gráfica.
//
// `desfase` (en semanas) recorre la curva de precipitación sobre el eje X
// del propio histórico de precipitación (por posición cronológica, no por
// aritmética de calendario): un desfase positivo muestra en cada punto la
// lluvia de N semanas ANTES (para explorar efectos retardados — ej. "la
// lluvia de hace 3 semanas ¿se nota hoy en el índice de infección?");
// negativo muestra lluvia futura respecto a ese punto.
//
// `offsetY` es un corrimiento vertical puramente visual (se suma al mm ya
// desplazado) para separar la curva de precipitación de la línea principal
// cuando quedan muy pegadas — no altera el dato real, solo dónde se dibuja.
export function usePrecipitacionOverlay({ fincaUuid, anio }) {
  const [activo, setActivo] = useState(false);
  const [desfase, setDesfase] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [precipItems, setPrecipItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activo) return;
    let cancelado = false;
    setLoading(true);
    const params = new URLSearchParams({ anio });
    if (fincaUuid) params.set("fincaUuid", fincaUuid);
    apiFetch(`/clima/promedio-semanal?${params.toString()}`)
      .then((res) => {
        if (cancelado) return;
        setPrecipItems(res.items || []);
        setLoading(false);
      })
      .catch(() => {
        if (cancelado) return;
        setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [activo, fincaUuid, anio]);

  // semanaCodigo -> mm ya desplazado + con el offset visual aplicado.
  const precipPorSemana = useMemo(() => {
    const mapa = new Map();
    if (!activo || precipItems.length === 0) return mapa;
    for (let i = 0; i < precipItems.length; i++) {
      const origen = precipItems[i - desfase];
      if (!origen || origen.totalMm == null) continue;
      mapa.set(precipItems[i].semanaCodigo, Math.round((origen.totalMm + offsetY) * 100) / 100);
    }
    return mapa;
  }, [activo, precipItems, desfase, offsetY]);

  return { activo, setActivo, desfase, setDesfase, offsetY, setOffsetY, precipPorSemana, loading };
}

// Agrega `precipMm` a cada fila de `filas` (deben tener `semanaCodigo`)
// según el mapa que devuelve el hook de arriba — no muta el arreglo
// original.
export function conPrecipitacion(filas, precipPorSemana) {
  if (!precipPorSemana || precipPorSemana.size === 0) return filas;
  return (filas || []).map((f) => ({ ...f, precipMm: precipPorSemana.get(f.semanaCodigo) ?? null }));
}

// Controles del overlay — un botón para activarlo y, mientras esté activo,
// los dos inputs de desfase/desplazamiento vertical.
export function PrecipitacionControls({ activo, setActivo, desfase, setDesfase, offsetY, setOffsetY }) {
  return (
    <div className="d-flex flex-wrap align-items-center gap-2 mb-2 small">
      <button
        type="button"
        className={`btn btn-sm rounded-3 d-inline-flex align-items-center gap-1 ${activo ? "btn-brand text-white" : "btn-outline-secondary"}`}
        onClick={() => setActivo((a) => !a)}
        title="Superponer la precipitación semanal de esta finca para correlacionar"
      >
        <FiCloudRain size={13} /> Precipitación
      </button>
      {activo && (
        <>
          <label className="text-secondary mb-0 d-flex align-items-center gap-1">
            Desfase (sem.)
            <input
              type="number"
              className="form-control form-control-sm rounded-3"
              style={{ width: "4.5rem" }}
              value={desfase}
              onChange={(e) => setDesfase(Number(e.target.value) || 0)}
              title="Positivo: en cada punto muestra la lluvia de N semanas antes. Negativo: N semanas después."
            />
          </label>
          <label className="text-secondary mb-0 d-flex align-items-center gap-1">
            Desplaz. vertical (mm)
            <input
              type="number"
              className="form-control form-control-sm rounded-3"
              style={{ width: "5rem" }}
              value={offsetY}
              onChange={(e) => setOffsetY(Number(e.target.value) || 0)}
              title="Solo visual: separa la curva de precipitación de la línea principal, sin cambiar el dato."
            />
          </label>
        </>
      )}
    </div>
  );
}

// Barras + eje secundario de precipitación, listas para insertar dentro de
// cualquier <ComposedChart> de este módulo (junto al resto de <YAxis>/
// <Line>) — con <LineChart> normal Recharts no deja mezclar un <Bar>, por
// eso las 4 gráficas que usan esto pasaron de <LineChart> a <ComposedChart>.
export function PrecipitacionSerie({ activo }) {
  if (!activo) return null;
  return (
    <>
      <YAxisPrecip />
      <BarPrecip />
    </>
  );
}

function YAxisPrecip() {
  return <YAxis yAxisId="precip" orientation="right" tick={{ fontSize: 10 }} width={40} allowDecimals unit=" mm" />;
}

function BarPrecip() {
  return <Bar yAxisId="precip" dataKey="precipMm" name="Precipitación (mm)" fill="#0ea5e9" fillOpacity={0.45} radius={[3, 3, 0, 0]} barSize={14} />;
}

export default usePrecipitacionOverlay;
