"use client";

import { useEffect, useState } from "react";
import { GiWeightScale } from "react-icons/gi";

import RequirePermission from "@/components/RequirePermission";
import DetalleLoteModal from "@/components/precalibracion/DetalleLoteModal";
import FiltrosPrecalibracion, { filtrosPorDefecto } from "@/components/precalibracion/FiltrosPrecalibracion";
import GraficosPrecalibracion from "@/components/precalibracion/GraficosPrecalibracion";
import GraficoRatio from "@/components/precalibracion/GraficoRatio";
import KpiCards from "@/components/precalibracion/KpiCards";
import MapaRecorridoModal from "@/components/precalibracion/MapaRecorridoModal";
import PotencialCosecha from "@/components/precalibracion/PotencialCosecha";
import TablaLotes from "@/components/precalibracion/TablaLotes";
import ConfiguracionPrecalibracion from "@/components/precalibracion/ConfiguracionPrecalibracion";
import TablaSesiones from "@/components/precalibracion/TablaSesiones";
import ResumenSemanal from "@/components/precalibracion/ResumenSemanal";
import RendimientoTrabajadores from "@/components/precalibracion/RendimientoTrabajadores";
import { hasPermission } from "@/lib/auth";
import { getDetalleLote, getOpciones, getResumen } from "@/lib/precalibracion/api";

// Módulo de Precalibración: plataforma de consulta y análisis de los racimos aptos
// (cumplen la medida del calibrador) que llegan de la app móvil de campo.
// Los datos vienen de la API (lib/precalibracion/api.js).
export default function PrecalibracionPage() {
  const [filtrosElegidos, setFiltros] = useState(null);
  const [loteDetalleId, setLoteDetalleId] = useState(null);
  const [loteRutaId, setLoteRutaId] = useState(null);
  const [opciones, setOpciones] = useState(null);
  const [vista, setVista] = useState("visualizacion"); // "visualizacion" | "sesiones" | "semanal" | "rendimiento" | "configuracion"
  const puedeConfigurar = hasPermission("precalibracion.configurar");
  const [refresco, setRefresco] = useState(0); // fuerza a recargar el resumen tras guardar un ajuste
  const [resumenEstado, setResumenEstado] = useState({ clave: null, resumen: null, error: "" });
  const [detalleEstado, setDetalleEstado] = useState({ clave: null, detalle: null });
  const [recorridoEstado, setRecorridoEstado] = useState({ clave: null, detalle: null });

  // "Cargando" se deriva de la clave de la última respuesta (sin setState síncrono en el efecto).
  // Hasta elegir otra, la semana es la actual (siempre hay una semana; nunca "todas").
  const filtros = filtrosElegidos || (opciones ? filtrosPorDefecto(opciones) : null);
  const clave = filtros ? JSON.stringify(filtros) : "";
  const claveResumen = `${clave}#${refresco}`;
  const claveDetalle = loteDetalleId ? `${loteDetalleId}|${clave}` : null;
  const claveRecorrido = loteRutaId ? `${loteRutaId}|${clave}` : null;

  useEffect(() => {
    let cancelado = false;
    getOpciones()
      .then((o) => !cancelado && setOpciones(o))
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!filtros) return undefined;
    let cancelado = false;
    getResumen(filtros)
      .then((resumen) => !cancelado && setResumenEstado({ clave: claveResumen, resumen, error: "" }))
      .catch((err) => !cancelado && setResumenEstado({ clave: claveResumen, resumen: null, error: err.message }));
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveResumen]);

  useEffect(() => {
    if (!claveDetalle) return undefined;
    let cancelado = false;
    getDetalleLote(loteDetalleId, filtros)
      .then((detalle) => !cancelado && setDetalleEstado({ clave: claveDetalle, detalle }))
      .catch(() => !cancelado && setDetalleEstado({ clave: claveDetalle, detalle: null }));
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveDetalle]);

  useEffect(() => {
    if (!claveRecorrido) return undefined;
    let cancelado = false;
    getDetalleLote(loteRutaId, filtros)
      .then((detalle) => !cancelado && setRecorridoEstado({ clave: claveRecorrido, detalle }))
      .catch(() => !cancelado && setRecorridoEstado({ clave: claveRecorrido, detalle: null }));
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveRecorrido]);

  const cargando = !filtros || resumenEstado.clave !== claveResumen;
  const resumen = resumenEstado.clave === claveResumen ? resumenEstado.resumen : null;
  const detalle = detalleEstado.clave === claveDetalle ? detalleEstado.detalle : null;
  const recorrido = recorridoEstado.clave === claveRecorrido ? recorridoEstado.detalle : null;

  const alcanceRatio = (filtros?.fincaId && opciones?.fincas.find((f) => f.id === filtros.fincaId)?.nombre) || "";

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

        <ul className="nav nav-pills gap-1 mb-3">
          <li className="nav-item">
            <button type="button" className={`nav-link btn-sm py-1 px-3 ${vista === "visualizacion" ? "active" : ""}`} onClick={() => setVista("visualizacion")}>
              Visualización
            </button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link btn-sm py-1 px-3 ${vista === "sesiones" ? "active" : ""}`} onClick={() => setVista("sesiones")}>
              Sesiones
            </button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link btn-sm py-1 px-3 ${vista === "semanal" ? "active" : ""}`} onClick={() => setVista("semanal")}>
              Semanal
            </button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link btn-sm py-1 px-3 ${vista === "rendimiento" ? "active" : ""}`} onClick={() => setVista("rendimiento")}>
              Rendimiento
            </button>
          </li>
          {puedeConfigurar && (
            <li className="nav-item">
              <button type="button" className={`nav-link btn-sm py-1 px-3 ${vista === "configuracion" ? "active" : ""}`} onClick={() => setVista("configuracion")}>
                Configuración
              </button>
            </li>
          )}
        </ul>

        {vista === "sesiones" ? (
          <TablaSesiones opciones={opciones} />
        ) : vista === "semanal" ? (
          <ResumenSemanal opciones={opciones} />
        ) : vista === "rendimiento" ? (
          opciones ? <RendimientoTrabajadores opciones={opciones} /> : <p className="text-secondary small">Cargando...</p>
        ) : vista === "configuracion" && puedeConfigurar ? (
          <ConfiguracionPrecalibracion onCambio={() => setRefresco((n) => n + 1)} />
        ) : (
          <>
          {opciones && (
            <FiltrosPrecalibracion
              key={clave}
              opciones={opciones}
              aplicados={filtros}
              onAplicar={setFiltros}
            />
          )}

          {resumenEstado.error && !cargando && <div className="alert alert-danger py-2 small">{resumenEstado.error}</div>}
          {cargando && <p className="text-secondary">Cargando...</p>}

          {resumen && !cargando && (
            <>
            <KpiCards kpis={resumen.kpis} />

            <TablaLotes
              filas={resumen.tabla.filas}
              totales={resumen.tabla.totales}
              porFinca={resumen.tabla.agrupadoPor === "finca"}
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

            {resumen.potencial && (
              <PotencialCosecha
                key={`${filtros?.semanaId}-${filtros?.fincaId || "todas"}-${refresco}`}
                potencial={resumen.potencial}
                fincaId={filtros?.fincaId || ""}
                semanaId={filtros?.semanaId || ""}
                onGuardado={() => setRefresco((n) => n + 1)}
              />
            )}
            </>
          )}
          </>
        )}
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
