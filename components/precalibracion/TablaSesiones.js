"use client";

// Sesiones de precalibración: una fila por sesión iniciada en la app de campo. Las columnas de edades salen solo de las
// edades que de verdad tienen racimos aptos en el resultado (solo se precalibra en edades de cosecha).
import { useEffect, useMemo, useState } from "react";
import { FiMapPin, FiUpload } from "react-icons/fi";
import { hasPermission } from "@/lib/auth";
import ImportarPrecalibracionModal from "@/components/precalibracion/ImportarPrecalibracionModal";
import { getSesiones } from "@/lib/precalibracion/api";
import MapaTrazaModal from "@/components/precalibracion/MapaTrazaModal";

const TIPOS = { VIGENTE: "Vigente", ANTICIPADA: "Anticipada" };
const COLOR_TIPO = { VIGENTE: { bg: "#dcfce7", fg: "#166534" }, ANTICIPADA: { bg: "#e0e7ff", fg: "#3730a3" } };

const fmtFecha = (f) => (f ? f.split("-").reverse().join("/") : "—");
const fmtDuracion = (min) => {
  if (min === null || min === undefined) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
};
const fmtRecorrido = (m) => (m === null || m === undefined ? "—" : m >= 1000 ? `${(m / 1000).toLocaleString("es-CO", { maximumFractionDigits: 2 })} km` : `${m} m`);

export default function TablaSesiones({ opciones }) {
  const [filtros, setFiltros] = useState({ fincaId: "", semanaId: "", tipo: "", fechaDesde: "", fechaHasta: "" });
  const [res, setRes] = useState({ clave: null, data: null, error: "" });
  const [verTraza, setVerTraza] = useState(null);
  const [importando, setImportando] = useState(false);
  const [refresco, setRefresco] = useState(0);
  const puedeImportar = hasPermission("precalibracion.crear");
  const clave = JSON.stringify({ ...filtros, refresco });

  useEffect(() => {
    let vivo = true;
    getSesiones(filtros)
      .then((data) => vivo && setRes({ clave, data, error: "" }))
      .catch((e) => vivo && setRes({ clave, data: null, error: e.message }));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const cargando = res.clave !== clave;
  const data = res.data;
  const edades = useMemo(() => data?.edades || [], [data]);
  const cambiar = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }));

  return (
    <div>
      <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-6 col-md-3">
            <label className="form-label small fw-medium mb-1">Finca</label>
            <select className="form-select form-select-sm rounded-3" value={filtros.fincaId} onChange={cambiar("fincaId")}>
              <option value="">Todas</option>
              {(opciones?.fincas || []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small fw-medium mb-1">Semana</label>
            <select className="form-select form-select-sm rounded-3" value={filtros.semanaId} onChange={cambiar("semanaId")}>
              <option value="">Todas</option>
              {[...(opciones?.semanas || [])].reverse().map((s) => (
                <option key={s.id} value={s.id}>
                  {s.codigo}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small fw-medium mb-1">Tipo</label>
            <select className="form-select form-select-sm rounded-3" value={filtros.tipo} onChange={cambiar("tipo")}>
              <option value="">Todos</option>
              <option value="VIGENTE">Vigente</option>
              <option value="ANTICIPADA">Anticipada</option>
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small fw-medium mb-1">Desde</label>
            <input type="date" className="form-control form-control-sm rounded-3" value={filtros.fechaDesde} onChange={cambiar("fechaDesde")} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small fw-medium mb-1">Hasta</label>
            <input type="date" className="form-control form-control-sm rounded-3" value={filtros.fechaHasta} onChange={cambiar("fechaHasta")} />
          </div>
          {puedeImportar && (
            <div className="col-12 col-md ms-md-auto d-flex justify-content-md-end">
              <button type="button" className="btn btn-success btn-sm rounded-1 d-inline-flex align-items-center gap-1" onClick={() => setImportando(true)}>
                <FiUpload /> Importar Excel
              </button>
            </div>
          )}
        </div>
      </div>

      {res.error && !cargando && <div className="alert alert-danger py-2 small">{res.error}</div>}
      {cargando && <p className="text-secondary small">Cargando...</p>}
      {!cargando && data && data.sesiones.length === 0 && (
        <p className="text-secondary small">No hay sesiones de precalibración con esos filtros. Las sesiones se crean desde la app de campo.</p>
      )}

      {!cargando && data && data.sesiones.length > 0 && (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle small text-center text-nowrap" style={{ width: "auto", margin: "0 auto" }}>
              <thead className="table-light text-wrap">
                <tr>
                  <th className="">Fecha</th>
                  
                  <th className="text-center">Finca</th>
                       <th className="text-center">Lote</th>
                  <th className="text-center" title="Semana en que se hizo la precalibración">Semana de precalibración</th>
                  <th className="text-center">Tipo</th>
                  <th className="text-center" title="Vigente: la misma semana. Anticipada: la semana siguiente">Semana de cosecha</th>
                  {edades.map((e) => (
                    <th key={e} className="" title={`Racimos aptos de ${e} semanas de edad`}>
                      {e}
                    </th>
                  ))}
                  <th className="">Has</th>
                  <th className="text-center">Inicio</th>
                  <th className="text-center">Final</th>
                  <th className="">Duración</th>
                  <th className="">Recorrido</th>
                  <th className="text-center">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {data.sesiones.map((s) => (
                  <tr key={s.id} title={s.potencialRacimos != null ? `Potencial de cosecha guardado: ${s.potencialRacimos.toLocaleString("es-CO")} racimos · ${(s.potencialCajas ?? 0).toLocaleString("es-CO")} cajas` : "Potencial sin guardar (sesión sin cerrar o sin estimación)"}>
                    <td className="">{fmtFecha(s.fecha)}</td>
                    
                    <td className="text-center">{s.finca}</td>
                    <td className="text-center">
                     <span className="text-secondary">{s.lote}</span>
                    </td>
                    <td className="text-center">{s.semana || "—"}</td>
                    <td className="text-center">
                      <span className="badge rounded-pill" style={{ backgroundColor: COLOR_TIPO[s.tipo]?.bg, color: COLOR_TIPO[s.tipo]?.fg }}>
                        {TIPOS[s.tipo] || s.tipo}
                      </span>
                      {!s.cerrada && <span className="badge rounded-pill text-bg-light text-secondary ms-1">en curso</span>}
                    </td>
                    <td className="text-center fw-semibold">{s.semanaCosecha || "—"}</td>
                    {edades.map((e) => (
                      <td key={e} className="">
                        {s.aptosPorEdad?.[e] ? s.aptosPorEdad[e].toLocaleString("es-CO") : "—"}
                      </td>
                    ))}
                    <td className="">{s.ha != null ? s.ha.toLocaleString("es-CO", { maximumFractionDigits: 2 }) : "—"}</td>
                    <td className="text-center">{s.horaInicio || "—"}</td>
                    <td className="text-center">{s.horaFin || "—"}</td>
                    <td className="">{fmtDuracion(s.duracionMin)}</td>
                    <td className="">
                      {fmtRecorrido(s.recorridoM)}
                      {s.recorridoM !== null && !s.recorridoMedido && <span className="text-secondary" title="Aproximado con las coordenadas de los racimos (sin tracking GPS)"> ~</span>}
                      {s.trazaPuntos > 0 && (
                        <button type="button" className="btn btn-link btn-sm p-0 ms-2 text-decoration-none" title="Ver el recorrido en el mapa" onClick={() => setVerTraza(s)}>
                          <FiMapPin />
                        </button>
                      )}
                    </td>
                    <td className="text-center">{s.usuario || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {importando && (
        <ImportarPrecalibracionModal
          opciones={opciones}
          onClose={() => setImportando(false)}
          onImportado={() => setRefresco((n) => n + 1)}
        />
      )}
      {verTraza && <MapaTrazaModal sesion={verTraza} onClose={() => setVerTraza(null)} />}
    </div>
  );
}
