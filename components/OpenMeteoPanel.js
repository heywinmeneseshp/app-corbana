"use client";

import { useEffect, useState } from "react";
import { FiRefreshCw, FiSearch, FiInfo } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import BotonConfiguracion from "@/components/BotonConfiguracion";

// Mismo alto que un form-control-sm para alinear botones con los inputs.
const ALTO_CONTROL = "calc(1.5em + 0.5rem + 2px)";

const FRECUENCIAS = { DIARIA: "Diaria", SEMANAL: "Semanal", MENSUAL: "Mensual" };
const th = { color: "#166534" };
const CARD_STYLE = { boxShadow: "0 1px 3px rgba(0,0,0,.06)" };

function hoyIso() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Bogota" });
}

function haceDiasIso(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toLocaleDateString("sv-SE", { timeZone: "America/Bogota" });
}

function fmtFechaHora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
}

// Unidades calóricas: (Tmáx + Tmín) / 2 − base (negativo tal cual).
function calcularUc(h, base) {
  if (h.temperaturaMaxima == null || h.temperaturaMinima == null) return null;
  return Math.round(((Number(h.temperaturaMaxima) + Number(h.temperaturaMinima)) / 2 - base) * 100) / 100;
}

// Tarjeta con barra verde de título — mismo diseño que las tarjetas de la
// pestaña Estación (Condiciones actuales / Histórico diario).
function Tarjeta({ titulo, children }) {
  return (
    <div className="card border-0 rounded-4 mb-4 overflow-hidden" style={CARD_STYLE}>
      <div className="px-3 py-1" style={{ backgroundColor: "#166534" }}>
        <h2 className="h6 fw-bold mb-0 text-white text-uppercase" style={{ fontSize: "0.8rem", letterSpacing: "0.03em" }}>
          {titulo}
        </h2>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

// Clima por finca traído de Open-Meteo (https://open-meteo.com). Mismo
// diseño que la pestaña Estación: encabezado con título y controles a la
// derecha, y tarjetas con barra verde. Las fincas necesitan coordenadas
// (Maestros > Fincas); la frecuencia de la actualización automática se
// configura en el engranaje.
export default function OpenMeteoPanel({ ucBases, esAdmin, onConfigurar }) {
  const [fincas, setFincas] = useState([]);
  const [seleccion, setSeleccion] = useState([]); // uuids de fincas marcadas (por defecto todas)
  const [actuales, setActuales] = useState([]); // condiciones actuales por finca
  const [cargandoActuales, setCargandoActuales] = useState(true);
  const [fechaDesde, setFechaDesde] = useState(haceDiasIso(29));
  const [fechaHasta, setFechaHasta] = useState(hoyIso());
  const [items, setItems] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [rellenandoFaltantes, setRellenandoFaltantes] = useState(false);

  const conCoordenadas = fincas.filter((f) => f.conCoordenadas);
  const sinCoordenadas = fincas.filter((f) => !f.conCoordenadas);

  async function cargarActuales() {
    setCargandoActuales(true);
    try {
      const data = await apiFetch("/estacion-meteorologica/open-meteo/actuales");
      setActuales(data || []);
      return data || [];
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setCargandoActuales(false);
    }
  }

  async function consultar(sel = seleccion) {
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams({ fechaDesde, fechaHasta });
      if (sel.length && sel.length < conCoordenadas.length) params.set("fincaUuids", sel.join(","));
      const data = await apiFetch(`/estacion-meteorologica/open-meteo?${params.toString()}`);
      setItems(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const [f, c] = await Promise.all([
          apiFetch("/estacion-meteorologica/open-meteo/fincas"),
          apiFetch("/estacion-meteorologica/open-meteo/configuracion").catch(() => null),
        ]);
        setFincas(f || []);
        setConfig(c);
        setSeleccion((f || []).filter((x) => x.conCoordenadas).map((x) => x.uuid));
      } catch (err) {
        setError(err.message);
      }
      await Promise.all([consultar([]), cargarActuales()]);

      // Relleno automático, en segundo plano, de los días del último mes que
      // todavía no tengan dato — igual que la pestaña Estación al abrirse.
      setRellenandoFaltantes(true);
      try {
        const res = await apiFetch("/estacion-meteorologica/open-meteo/actualizar-faltantes", { method: "POST", body: JSON.stringify({}) });
        if (res?.fincas?.length) await Promise.all([consultar([]), cargarActuales()]);
      } catch {
        // Silencioso: es un relleno en segundo plano; el botón manual sigue disponible.
      } finally {
        setRellenandoFaltantes(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleActualizar() {
    setError("");
    setAviso("");
    setActualizando(true);
    try {
      const body = { fechaDesde, fechaHasta };
      if (seleccion.length && seleccion.length < conCoordenadas.length) body.fincaUuids = seleccion;
      const res = await apiFetch("/estacion-meteorologica/open-meteo/actualizar", { method: "POST", body: JSON.stringify(body) });
      setAviso(
        `Actualizado: ${res.fincas.length} finca(s)${res.errores.length ? `, ${res.errores.length} con error (${res.errores.map((e) => e.finca).join(", ")})` : ""}.`,
      );
      setConfig(await apiFetch("/estacion-meteorologica/open-meteo/configuracion").catch(() => config));
      await consultar();
    } catch (err) {
      setError(err.message);
    } finally {
      setActualizando(false);
    }
  }

  // Zonas: fincas cuyo dato sale de la misma celda de la malla del modelo.
  const zonas = (() => {
    const porCelda = new Map();
    for (const h of items) {
      if (!h.celda || !h.finca) continue;
      if (!porCelda.has(h.celda)) porCelda.set(h.celda, new Map());
      porCelda.get(h.celda).set(h.finca.uuid, h.finca.nombre);
    }
    return [...porCelda.entries()]
      .map(([celda, m]) => ({ celda, fincas: [...m.values()].sort((a, b) => a.localeCompare(b, "es")) }))
      .sort((a, b) => b.fincas.length - a.fincas.length);
  })();

  const alternar = (uuid) => setSeleccion((s) => (s.includes(uuid) ? s.filter((x) => x !== uuid) : [...s, uuid]));
  const todasMarcadas = conCoordenadas.length > 0 && seleccion.length === conCoordenadas.length;
  const alternarTodas = () => setSeleccion(todasMarcadas ? [] : conCoordenadas.map((f) => f.uuid));
  const medidoEn = actuales.find((a) => a.medidoEn)?.medidoEn || null;
  const num = (v) => (v === null || v === undefined ? "—" : v);

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
        <div>
          <h1 className="h4 fw-bold mb-1">Open-Meteo</h1>
          <p className="text-secondary small mb-0">
            Clima por finca vía Open-Meteo
            {config && (
              <>
                {" "}
                — actualización {FRECUENCIAS[config.frecuencia]?.toLowerCase() || "diaria"}, última: {fmtFechaHora(config.ultimaActualizacion)}.
              </>
            )}
          </p>
        </div>
        <div className="d-flex align-items-end gap-2 flex-wrap">
          <div>
            <label className="form-label small text-secondary mb-1">Desde</label>
            <input type="date" className="form-control form-control-sm rounded-3" value={fechaDesde} max={fechaHasta} onChange={(e) => setFechaDesde(e.target.value)} />
          </div>
          <div>
            <label className="form-label small text-secondary mb-1">Hasta</label>
            <input
              type="date"
              className="form-control form-control-sm rounded-3"
              value={fechaHasta}
              min={fechaDesde}
              max={hoyIso()}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-light btn-sm border-0 rounded-3 d-inline-flex align-items-center gap-1"
            style={{ height: ALTO_CONTROL }}
            disabled={loading || !fechaDesde || !fechaHasta}
            onClick={() => consultar()}
          >
            <FiSearch size={14} /> Consultar
          </button>
          <button
            type="button"
            className="btn btn-light btn-sm border-0 rounded-3 d-inline-flex align-items-center gap-1"
            style={{ height: ALTO_CONTROL }}
            disabled={actualizando || conCoordenadas.length === 0 || !fechaDesde || !fechaHasta}
            onClick={handleActualizar}
            title="Trae de Open-Meteo el clima del rango elegido para las fincas seleccionadas"
          >
            <FiRefreshCw size={14} className={actualizando ? "spin" : ""} />
            {actualizando ? "Actualizando..." : "Actualizar rango"}
          </button>
          {esAdmin && (
            <BotonConfiguracion
              alto={ALTO_CONTROL}
              onClick={onConfigurar}
              title="Configuración: frecuencia de Open-Meteo, unidades calóricas y alerta de estación"
            />
          )}
        </div>
      </div>

      {rellenandoFaltantes && (
        <p className="text-secondary small mb-3">
          <FiRefreshCw size={12} className="spin me-1" />
          Revisando días del último mes sin datos...
        </p>
      )}

      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {aviso && <div className="alert alert-success py-2 small">{aviso}</div>}

      <Tarjeta titulo="Condiciones actuales por finca">
        <p className="text-secondary small mb-2">
          Calculadas con los datos de Open-Meteo{medidoEn ? ` — medido: ${medidoEn.replace("T", " ")}` : ""}. Marca las fincas que quieres ver en el histórico.
        </p>
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr className="small" style={{ backgroundColor: "#f0fdf4" }}>
                <th style={{ width: "2rem" }}>
                  <input type="checkbox" className="form-check-input" checked={todasMarcadas} onChange={alternarTodas} title="Marcar / desmarcar todas" />
                </th>
                <th style={th}>Código</th>
                <th style={th}>Finca</th>
                <th className="text-center" style={th}>Temperatura (°C)</th>
                <th className="text-center" style={th}>Humedad (%)</th>
                <th className="text-center" style={th}>Viento (km/h)</th>
                <th className="text-center" style={th}>Lluvia hoy (mm)</th>
                <th className="text-center" style={th}>Lluvia última hora (mm)</th>
                <th className="text-center" style={th}>Lluvia del mes (mm)</th>
                <th className="text-center" style={th}>Lluvia del año (mm)</th>
              </tr>
            </thead>
            <tbody>
              {cargandoActuales && (
                <tr>
                  <td colSpan={10} className="text-center text-secondary small py-3">
                    Cargando...
                  </td>
                </tr>
              )}
              {!cargandoActuales && actuales.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-secondary small py-3">
                    Ninguna finca tiene coordenadas todavía — agrégalas en Maestros &gt; Fincas.
                  </td>
                </tr>
              )}
              {!cargandoActuales &&
                actuales.map((a) => (
                  <tr key={a.uuid}>
                    <td>
                      <input type="checkbox" className="form-check-input" checked={seleccion.includes(a.uuid)} onChange={() => alternar(a.uuid)} />
                    </td>
                    <td className="small fw-medium">{a.codigo}</td>
                    <td className="small text-nowrap">{a.nombre}</td>
                    <td className="small text-center">{num(a.temperatura)}</td>
                    <td className="small text-center">{num(a.humedadRelativa)}</td>
                    <td className="small text-center">{num(a.vientoKmh)}</td>
                    <td className="small text-center">{num(a.lluviaHoyMm)}</td>
                    <td className="small text-center">{num(a.lluviaUltimaHoraMm)}</td>
                    <td className="small text-center">{num(a.lluviaMesMm)}</td>
                    <td className="small text-center">{num(a.lluviaAnioMm)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {sinCoordenadas.length > 0 && (
          <p className="text-secondary small mb-0 mt-3">
            Sin coordenadas (no se consultan): {sinCoordenadas.map((f) => f.nombre).join(", ")}. Agrégalas en Maestros &gt; Fincas.
          </p>
        )}
        <div className="d-flex align-items-start gap-1 mt-3 text-secondary small">
          <FiInfo className="flex-shrink-0 mt-1" />
          <span>
            <strong>Nota:</strong> Open-Meteo no mide en el punto exacto de cada finca; entrega el valor de la malla de su modelo (celdas de
            unos 10 a 25 km). Por eso fincas cercanas pueden compartir el mismo dato y no se capta la lluvia muy localizada. Sirve para
            comparar zonas amplias; para lluvia exacta por finca usa los pluviómetros o la estación.
          </span>
        </div>
        {zonas.length > 0 && (
          <div className="mt-3">
            <div className="small fw-medium text-secondary mb-1">Zonas (fincas que comparten el mismo dato)</div>
            <div className="d-flex flex-column gap-1">
              {zonas.map((z) => (
                <div key={z.celda} className="small">
                  <span className="badge text-bg-light me-2">{z.fincas.length === 1 ? "Sola" : `${z.fincas.length} fincas`}</span>
                  {z.fincas.join(", ")}
                </div>
              ))}
            </div>
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Histórico diario">
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr className="small" style={{ backgroundColor: "#f0fdf4" }}>
                <th style={th}>Fecha</th>
                <th style={th}>Finca</th>
                <th className="text-center" style={th}>Lluvia (mm)</th>
                <th className="text-center" style={th}>Temperatura (°C)</th>
                <th className="text-center" style={th}>Temp. máxima (°C)</th>
                <th className="text-center" style={th}>Temp. mínima (°C)</th>
                <th className="text-center" style={th}>Humedad (%)</th>
                <th className="text-center" style={th}>Viento (km/h)</th>
                <th className="text-center" style={th}>Viento máx. (km/h)</th>
                <th className="text-center" style={th}>Radiación (MJ/m²)</th>
                <th className="text-center" style={th}>ET0 (mm)</th>
                {ucBases.map((b) => (
                  <th key={b} className="text-center" style={th} title={`Unidades calóricas = (Temp. máx. + Temp. mín.) / 2 − ${b}`}>
                    UC (base {b})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={11 + ucBases.length} className="text-center text-secondary small py-3">
                    Cargando...
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={11 + ucBases.length} className="text-center text-secondary small py-3">
                    Sin registros todavía — pulsa «Actualizar rango» o espera la actualización automática.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((h) => (
                  <tr key={h.uuid}>
                    <td className="small text-nowrap">{h.fecha}</td>
                    <td className="small text-nowrap">{h.finca?.nombre}</td>
                    <td className="small text-center">{h.mm ?? "—"}</td>
                    <td className="small text-center">{h.temperatura ?? "—"}</td>
                    <td className="small text-center">{h.temperaturaMaxima ?? "—"}</td>
                    <td className="small text-center">{h.temperaturaMinima ?? "—"}</td>
                    <td className="small text-center">{h.humedadRelativa ?? "—"}</td>
                    <td className="small text-center">{h.vientoVelocidad ?? "—"}</td>
                    <td className="small text-center">{h.vientoMax ?? "—"}</td>
                    <td className="small text-center">{h.radiacion ?? "—"}</td>
                    <td className="small text-center">{h.et0 ?? "—"}</td>
                    {ucBases.map((b) => (
                      <td key={b} className="small text-center">
                        {calcularUc(h, b) ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      <style jsx>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
