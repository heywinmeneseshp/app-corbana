"use client";

import { useMemo, useState } from "react";
import { GiWeightScale } from "react-icons/gi";

import RequirePermission from "@/components/RequirePermission";
import DetalleLoteModal from "@/components/precalibracion/DetalleLoteModal";
import FiltrosPrecalibracion, { FILTROS_VACIOS } from "@/components/precalibracion/FiltrosPrecalibracion";
import GraficosPrecalibracion from "@/components/precalibracion/GraficosPrecalibracion";
import GraficoRatio from "@/components/precalibracion/GraficoRatio";
import KpiCards from "@/components/precalibracion/KpiCards";
import MapaRecorridoModal from "@/components/precalibracion/MapaRecorridoModal";
import PotencialCosecha from "@/components/precalibracion/PotencialCosecha";
import TablaLotes from "@/components/precalibracion/TablaLotes";
import { getDetalleLote, getOpcionesFiltros, getResumen } from "@/lib/precalibracion/api";

// Módulo de Precalibración: plataforma de consulta y análisis de los
// registros que llegan de la app móvil de campo (hoy datos MOCK, ver
// lib/precalibracion/api.js para el cambio a API real).
export default function PrecalibracionPage() {
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [loteDetalleId, setLoteDetalleId] = useState(null);
  const [loteRutaId, setLoteRutaId] = useState(null);

  const resumen = useMemo(() => getResumen(filtros), [filtros]);

  const alcanceRatio = useMemo(() => {
    if (!filtros.fincaId) return "";
    const finca = getOpcionesFiltros().fincas.find((f) => f.id === filtros.fincaId);
    return finca ? finca.nombre : "";
  }, [filtros.fincaId]);

  const detalle = useMemo(
    () => (loteDetalleId ? getDetalleLote(loteDetalleId, filtros) : null),
    [loteDetalleId, filtros],
  );

  const recorrido = useMemo(
    () => (loteRutaId ? getDetalleLote(loteRutaId, filtros) : null),
    [loteRutaId, filtros],
  );

  return (
    <RequirePermission code="menu.precalibracion">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
            <GiWeightScale className="text-primary" /> Precalibración
          </h1>
          <p className="text-secondary mb-0">
            Racimos que cumplen con la medida del calibrador, consolidados por lote, cinta y edad.
          </p>
        </div>

        <FiltrosPrecalibracion
          key={JSON.stringify(filtros)}
          aplicados={filtros}
          onAplicar={setFiltros}
          onLimpiar={() => setFiltros(FILTROS_VACIOS)}
        />

        <KpiCards kpis={resumen.kpis} />

        <TablaLotes
          filas={resumen.tabla.filas}
          totales={resumen.tabla.totales}
          cintas={resumen.cintas}
          onVerLote={setLoteDetalleId}
          onVerRuta={setLoteRutaId}
        />

        <div className="row g-3 mb-3">
          <div className="col-12 col-grafico-dist">
            <GraficosPrecalibracion distribucion={resumen.distribucion} />
          </div>
          <div className="col-12 col-grafico-ratio">
            <GraficoRatio datos={resumen.ratio} alcance={alcanceRatio} />
          </div>
        </div>

        <PotencialCosecha key={filtros.fincaId || "todas"} potencial={resumen.potencial} />
      </div>

      <style jsx>{`
        @media (min-width: 992px) {
          .col-grafico-dist {
            flex: 0 0 30%;
            max-width: 30%;
          }
          .col-grafico-ratio {
            flex: 0 0 70%;
            max-width: 70%;
          }
        }
      `}</style>

      {detalle && <DetalleLoteModal detalle={detalle} onClose={() => setLoteDetalleId(null)} />}

      {recorrido && (
        <MapaRecorridoModal
          titulo={`Recorrido — Lote ${recorrido.lote.nombre} (${recorrido.finca?.nombre || ""})`}
          registros={recorrido.registros}
          onClose={() => setLoteRutaId(null)}
        />
      )}
    </RequirePermission>
  );
}
