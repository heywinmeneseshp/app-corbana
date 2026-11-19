"use client";

import { useEffect, useState } from "react";
import { FiDownload, FiSave } from "react-icons/fi";
import RequirePermission from "@/components/RequirePermission";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import { descargarInformeIca, FILAS_APLICACIONES } from "@/lib/informeIcaExport";

// Sanidad Vegetal → Informe ICA: informe fitosanitario trimestral por finca en el formato oficial del ICA.
// Producción en kg brutos = cajas 20 kg × peso bruto de la caja (20 kg por defecto). Real si la semana ya se produjo; si no,
// la estimación de la finca, la proyección o, más allá de su horizonte, lo producido la misma semana del año anterior.
const TRIMESTRES = [
  [1, "Feb, mar y abr"],
  [2, "May, jun y jul"],
  [3, "Ago, sep y oct"],
  [4, "Nov, dic y ene"],
];
const CAMPOS_PREDIO = [
  ["registroIca", "No. registro ICA"],
  ["titular", "Titular del registro ICA"],
  ["telefono", "Teléfono"],
  ["correo", "Correo"],
  ["departamento", "Departamento"],
  ["municipio", "Municipio"],
  ["vereda", "Vereda"],
  ["areaRegistrada", "Área registrada ICA (ha)", "number"],
];
const CAMPOS_ASISTENTE = [
  ["asistenteNombre", "Asistente técnico"],
  ["asistenteDocumento", "CC"],
  ["asistenteTarjeta", "Tarjeta profesional"],
  ["asistenteCursoSv", "¿Curso de SV?", "sino"],
  ["asistenteSensorExterno", "¿Sensor externo?", "sino"],
  ["asistenteTelefono", "Teléfono"],
  ["asistenteCorreo", "Correo"],
  ["exportador", "Exportador"],
];
const COLOR_FUENTE = { real: "success", estimado: "primary", proyectado: "warning", "año anterior": "secondary", mixto: "info", "sin datos": "light" };

function trimestreActual() {
  const d = new Date();
  const m = d.getMonth() + 1;
  if (m === 1) return { anio: d.getFullYear() - 1, trimestre: 4 };
  return { anio: d.getFullYear(), trimestre: Math.floor((m - 2) / 3) + 1 };
}
const hoy = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
const fmt = (n, dec = 0) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("es-CO", { maximumFractionDigits: dec }));

export default function InformeIcaPage() {
  const inicial = trimestreActual();
  const [fincas, setFincas] = useState([]);
  const [fincaUuid, setFincaUuid] = useState("");
  const [anio, setAnio] = useState(inicial.anio);
  const [trimestre, setTrimestre] = useState(inicial.trimestre);
  const [informe, setInforme] = useState(null);
  const [datos, setDatos] = useState({});
  const [aplicaciones, setAplicaciones] = useState([]);
  const [kgCaja, setKgCaja] = useState(20);
  const [fechaReporte, setFechaReporte] = useState(hoy());
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const puedeEditar = hasPermission("sanidad_vegetal.comprobantes_aspersion.editar");

  useEffect(() => {
    apiFetch("/fincas?limit=100&soloOperativas=true")
      .then((d) => {
        const lista = (d?.items || d || []).filter((f) => !f.esExterna);
        setFincas(lista);
        if (lista.length) setFincaUuid((v) => v || lista[0].uuid);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!fincaUuid) return;
    let activo = true;
    Promise.resolve()
      .then(() => {
        setCargando(true);
        setError("");
        setAviso("");
        return apiFetch(`/sanidad-vegetal/informe-ica?fincaUuid=${fincaUuid}&anio=${anio}&trimestre=${trimestre}`);
      })
      .then((d) => {
        if (!activo) return;
        setInforme(d);
        setDatos(d.datosIca || {});
        setAplicaciones((d.aplicaciones || []).map((a) => ({ ...a, blanco: "Micosphaerella fijiensis", carencia: 0, reentrada: 4 })));
      })
      .catch((e) => activo && setError(e.message))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [fincaUuid, anio, trimestre]);

  async function guardarDatos() {
    setGuardando(true);
    setError("");
    try {
      const payload = { ...datos, areaRegistrada: datos.areaRegistrada === "" || datos.areaRegistrada === null || datos.areaRegistrada === undefined ? null : Number(datos.areaRegistrada) };
      const r = await apiFetch("/sanidad-vegetal/informe-ica/datos", { method: "PUT", body: JSON.stringify({ fincaUuid, datos: payload }) });
      setDatos(r);
      setAviso("Datos ICA de la finca guardados");
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function descargar() {
    setDescargando(true);
    setError("");
    try {
      await descargarInformeIca({ informe: { ...informe, datosIca: datos }, aplicaciones, kgCaja: Number(kgCaja) || 20, fechaReporte });
    } catch (e) {
      setError(e.message);
    } finally {
      setDescargando(false);
    }
  }

  const cambiarApl = (i, campo, valor) => setAplicaciones((l) => l.map((a, j) => (j === i ? { ...a, [campo]: valor } : a)));
  const campo = ([k, label, tipo]) => (
    <div key={k} className="col-6 col-md-3">
      <label className="form-label small text-secondary mb-0">{label}</label>
      {tipo === "sino" ? (
        <select className="form-select form-select-sm" value={datos[k] ?? ""} disabled={!puedeEditar} onChange={(e) => setDatos({ ...datos, [k]: e.target.value })}>
          <option value="">—</option>
          <option value="SI">SI</option>
          <option value="NO">NO</option>
        </select>
      ) : (
        <input className="form-control form-control-sm" type={tipo === "number" ? "number" : "text"} value={datos[k] ?? ""} disabled={!puedeEditar} onChange={(e) => setDatos({ ...datos, [k]: e.target.value })} />
      )}
    </div>
  );
  const filaProduccion = (m) => (
    <tr key={`${m.anio}-${m.mes}`}>
      <td>
        {m.nombre} {m.anio}
      </td>
      <td className="text-end">{fmt(m.cajas20)}</td>
      <td className="text-end fw-semibold">{fmt(m.cajas20 * (Number(kgCaja) || 0))}</td>
      <td title={(m.detalleFuentes || []).map((s) => `${s.semana}: ${fmt(s.cajas)} (${s.fuente})`).join("\n")}>
        <span className={`badge text-bg-${COLOR_FUENTE[m.fuente] || "light"}`}>{m.fuente}</span>
      </td>
    </tr>
  );

  return (
    <RequirePermission code="menu.sanidad_vegetal.comprobantes_aspersion">
      <div className="p-3 p-md-4">
        <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
          <h1 className="fw-bold h4 mb-0 me-auto">Informe fitosanitario ICA</h1>
          <div>
            <label className="form-label small text-secondary mb-0">Finca</label>
            <select className="form-select form-select-sm" value={fincaUuid} onChange={(e) => setFincaUuid(e.target.value)}>
              {fincas.map((f) => (
                <option key={f.uuid} value={f.uuid}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label small text-secondary mb-0">Año</label>
            <input className="form-control form-control-sm" type="number" style={{ width: 90 }} value={anio} onChange={(e) => setAnio(Number(e.target.value))} />
          </div>
          <div>
            <label className="form-label small text-secondary mb-0">Trimestre</label>
            <select className="form-select form-select-sm" value={trimestre} onChange={(e) => setTrimestre(Number(e.target.value))}>
              {TRIMESTRES.map(([t, l]) => (
                <option key={t} value={t}>
                  T{t} · {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label small text-secondary mb-0">Fecha del reporte</label>
            <input className="form-control form-control-sm" type="date" value={fechaReporte} onChange={(e) => setFechaReporte(e.target.value)} />
          </div>
          <button type="button" className="btn btn-sm btn-success d-flex align-items-center gap-1" disabled={!informe || cargando || descargando} onClick={descargar}>
            <FiDownload /> {descargando ? "Generando…" : "Descargar formato ICA"}
          </button>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        {aviso && <div className="alert alert-success py-2 small">{aviso}</div>}
        {cargando && <div className="text-secondary small mb-2">Cargando…</div>}

        {informe && (
          <>
            <div className="card mb-3">
              <div className="card-header d-flex align-items-center">
                <span className="fw-semibold me-auto">Datos ICA de {informe.finca.nombre}</span>
                {!informe.datosGuardados && <span className="small text-warning me-2">Aún no guardados: se llenan una vez por finca</span>}
                {puedeEditar && (
                  <button type="button" className="btn btn-sm btn-primary d-flex align-items-center gap-1" disabled={guardando} onClick={guardarDatos}>
                    <FiSave /> {guardando ? "Guardando…" : "Guardar"}
                  </button>
                )}
              </div>
              <div className="card-body">
                <div className="small fw-semibold text-secondary mb-1">Predio</div>
                <div className="row g-2 mb-3">{CAMPOS_PREDIO.map(campo)}</div>
                <div className="small fw-semibold text-secondary mb-1">Asistente técnico y exportador</div>
                <div className="row g-2">{CAMPOS_ASISTENTE.map(campo)}</div>
              </div>
            </div>

            <div className="row g-3 mb-3">
              <div className="col-lg-6">
                <div className="card h-100">
                  <div className="card-header d-flex align-items-center gap-2">
                    <span className="fw-semibold me-auto">Producción (VIII)</span>
                    <span className="small text-secondary">Peso bruto caja (kg)</span>
                    <input className="form-control form-control-sm" type="number" step="0.1" style={{ width: 80 }} value={kgCaja} onChange={(e) => setKgCaja(e.target.value)} />
                  </div>
                  <div className="card-body p-0">
                    <table className="table table-sm mb-0 small align-middle">
                      <thead>
                        <tr>
                          <th>Mes</th>
                          <th className="text-end">Cajas 20 kg</th>
                          <th className="text-end">Kg brutos</th>
                          <th>Fuente</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="table-light">
                          <td colSpan={4} className="fw-semibold">
                            Trimestre reportado
                          </td>
                        </tr>
                        {informe.produccion.map(filaProduccion)}
                        <tr className="table-light">
                          <td colSpan={4} className="fw-semibold">
                            Pronóstico (3 meses siguientes)
                          </td>
                        </tr>
                        {informe.pronostico.map(filaProduccion)}
                      </tbody>
                    </table>
                    <div className="small text-secondary p-2">Área en producción: {fmt(informe.areaProduccion, 2)} ha. Pasa el cursor sobre la fuente para ver el detalle por semana.</div>
                  </div>
                </div>
              </div>
              <div className="col-lg-6">
                <div className="card h-100">
                  <div className="card-header fw-semibold">Aplicaciones químicas del trimestre (VI)</div>
                  <div className="card-body p-0" style={{ overflowX: "auto" }}>
                    {aplicaciones.length > FILAS_APLICACIONES && (
                      <div className="alert alert-warning py-1 px-2 m-2 small">El formato tiene {FILAS_APLICACIONES} filas; solo salen las primeras {FILAS_APLICACIONES} aplicaciones.</div>
                    )}
                    <table className="table table-sm mb-0 small align-middle">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Producto</th>
                          <th>Blanco biológico</th>
                          <th className="text-end">Dosis</th>
                          <th>Carencia (días)</th>
                          <th>Reentrada (h)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aplicaciones.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-secondary text-center py-3">
                              Sin comprobantes de aspersión en el trimestre
                            </td>
                          </tr>
                        )}
                        {aplicaciones.map((a, i) => (
                          <tr key={a.comprobante} title={a.comprobante}>
                            <td className="text-nowrap">{a.fecha}</td>
                            <td>{a.producto}</td>
                            <td>
                              <input className="form-control form-control-sm" value={a.blanco} onChange={(e) => cambiarApl(i, "blanco", e.target.value)} />
                            </td>
                            <td className="text-end text-nowrap">
                              {fmt(a.dosis, 3)} {a.unidad}/ha
                            </td>
                            <td>
                              <input className="form-control form-control-sm" type="number" style={{ width: 70 }} value={a.carencia} onChange={(e) => cambiarApl(i, "carencia", e.target.value)} />
                            </td>
                            <td>
                              <input className="form-control form-control-sm" type="number" style={{ width: 70 }} value={a.reentrada} onChange={(e) => cambiarApl(i, "reentrada", e.target.value)} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            <div className="small text-secondary">Monitoreo de plagas (incidencia, lotes, plantas), trampas y PTO quedan como en la plantilla para completarlos a mano.</div>
          </>
        )}
      </div>
    </RequirePermission>
  );
}
