"use client";

import { useEffect, useState } from "react";
import { FiCloudRain, FiThermometer, FiDroplet, FiWind, FiRefreshCw } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";

// Estación meteorológica WeatherLink ("Pantoja 01 Norte") — módulo aparte,
// de solo consulta: NO alimenta Clima ni Precipitación Diaria (esos
// módulos siguen con su captura manual/analista de siempre). El
// histórico diario se llena solo vía el cron
// sincronizar-estacion-meteorologica; acá también hay un botón para
// forzar una sincronización puntual.

function fmtFechaHora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
}

function Stat({ icon: Icon, label, value, unidad }) {
  return (
    <div className="col-6 col-md-3">
      <div className="card border-0 rounded-4 h-100" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
        <div className="card-body p-3 text-center">
          <Icon size={22} style={{ color: "#166534" }} className="mb-2" />
          <div className="small text-uppercase text-secondary fw-semibold" style={{ fontSize: "0.68rem", letterSpacing: "0.03em" }}>
            {label}
          </div>
          <div className="fw-bold" style={{ fontSize: "1.3rem" }}>
            {value ?? "—"} {value != null && unidad}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EstacionMeteorologicaPage() {
  const [actual, setActual] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sincronizando, setSincronizando] = useState(false);
  const [sincError, setSincError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [actualData, historicoData] = await Promise.all([
        apiFetch("/estacion-meteorologica/actual"),
        apiFetch("/estacion-meteorologica/historico"),
      ]);
      setActual(actualData);
      setHistorico((historicoData.items || []).slice().reverse());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function handleSincronizar() {
    setSincError("");
    setSincronizando(true);
    try {
      await apiFetch("/estacion-meteorologica/sincronizar", { method: "POST", body: JSON.stringify({}) });
      await load();
    } catch (err) {
      setSincError(err.message);
    } finally {
      setSincronizando(false);
    }
  }

  return (
    <RequirePermission code="estacion_meteorologica.ver">
      <div className="p-3 p-md-4">
        <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
          <div>
            <h1 className="h4 fw-bold mb-1">Estación Meteorológica</h1>
            <p className="text-secondary small mb-0">Pantoja 01 Norte — datos en vivo vía WeatherLink.</p>
          </div>
          <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 d-inline-flex align-items-center gap-1" disabled={sincronizando} onClick={handleSincronizar}>
            <FiRefreshCw size={14} className={sincronizando ? "spin" : ""} />
            {sincronizando ? "Sincronizando..." : "Sincronizar ayer"}
          </button>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        {sincError && <div className="alert alert-danger py-2 small">{sincError}</div>}

        {loading ? (
          <p className="text-secondary small">Cargando...</p>
        ) : (
          <>
            <div className="card border-0 rounded-4 mb-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
              <div className="px-3 py-1" style={{ backgroundColor: "#166534" }}>
                <h2 className="h6 fw-bold mb-0 text-white text-uppercase" style={{ fontSize: "0.8rem", letterSpacing: "0.03em" }}>
                  Condiciones actuales
                </h2>
              </div>
              <div className="p-3">
                {actual ? (
                  <>
                    <p className="text-secondary small mb-3">Medido: {fmtFechaHora(actual.medidoEn)}</p>
                    <div className="row g-3 mb-3">
                      <Stat icon={FiThermometer} label="Temperatura" value={actual.temperatura} unidad="°C" />
                      <Stat icon={FiDroplet} label="Humedad relativa" value={actual.humedadRelativa} unidad="%" />
                      <Stat icon={FiWind} label="Viento" value={actual.vientoVelocidadKmh} unidad="km/h" />
                      <Stat icon={FiCloudRain} label="Lluvia hoy" value={actual.lluviaHoyMm} unidad="mm" />
                    </div>
                    <div className="row g-3">
                      <Stat icon={FiCloudRain} label="Lluvia última hora" value={actual.lluviaUltimaHoraMm} unidad="mm" />
                      <Stat icon={FiCloudRain} label="Lluvia del mes" value={actual.lluviaMesMm} unidad="mm" />
                      <Stat icon={FiCloudRain} label="Lluvia del año" value={actual.lluviaAnioMm} unidad="mm" />
                    </div>
                  </>
                ) : (
                  <p className="text-secondary small mb-0">Sin datos disponibles.</p>
                )}
              </div>
            </div>

            <div className="card border-0 rounded-4 mb-4 overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
              <div className="px-3 py-1" style={{ backgroundColor: "#166534" }}>
                <h2 className="h6 fw-bold mb-0 text-white text-uppercase" style={{ fontSize: "0.8rem", letterSpacing: "0.03em" }}>
                  Histórico diario
                </h2>
              </div>
              <div className="p-3">
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead>
                      <tr className="small" style={{ backgroundColor: "#f0fdf4" }}>
                        <th style={{ color: "#166534" }}>Fecha</th>
                        <th className="text-center" style={{ color: "#166534" }}>Lluvia (mm)</th>
                        <th className="text-center" style={{ color: "#166534" }}>Temperatura (°C)</th>
                        <th className="text-center" style={{ color: "#166534" }}>Humedad (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historico.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center text-secondary small py-3">
                            Sin registros todavía — se sincroniza solo, una vez al día.
                          </td>
                        </tr>
                      )}
                      {historico.map((h) => (
                        <tr key={h.uuid}>
                          <td className="small">{h.fecha}</td>
                          <td className="small text-center">{h.mm ?? "—"}</td>
                          <td className="small text-center">{h.temperatura ?? "—"}</td>
                          <td className="small text-center">{h.humedadRelativa ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <style jsx>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </RequirePermission>
  );
}
