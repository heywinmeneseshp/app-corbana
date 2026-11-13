"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiCheck, FiEdit2, FiMapPin, FiPlus, FiTrash2, FiWifi, FiX } from "react-icons/fi";
import { apiFetch } from "@/lib/api";

// Alta y administración de las estaciones meteorológicas (WeatherLink): nombre, credenciales (se guardan cifradas y nunca se muestran de nuevo) y las
// fincas que usan los datos de cada estación para su temperatura y humedad en las gráficas de clima. Solo Administrador.
const VACIO = { id: null, nombre: "", apiKey: "", apiSecret: "", stationId: "", estado: true };

const etiquetaCred = (e) =>
  e.origenCredenciales === "base" ? { texto: `En la base ${e.apiKeyFin || ""}`.trim(), clase: "text-success" } : e.origenCredenciales === "entorno" ? { texto: "Del servidor (.env)", clase: "text-secondary" } : { texto: "Incompletas", clase: "text-danger" };

export default function EstacionesAdmin({ onCambio }) {
  const [estaciones, setEstaciones] = useState([]);
  const [fincas, setFincas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null); // formulario de alta / edición
  const [guardando, setGuardando] = useState(false);
  const [pruebas, setPruebas] = useState({}); // id -> { cargando | conectado | error }
  const [asignando, setAsignando] = useState(null); // { id, sel: Set de uuids de finca }
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => {
    setError("");
    try {
      const [est, fin] = await Promise.all([apiFetch("/estacion-meteorologica/estaciones"), apiFetch("/fincas?limit=200")]);
      setEstaciones(est || []);
      setFincas((fin?.items || []).filter((f) => f.estado !== false).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar() {
    setError("");
    if (!form.nombre.trim()) return setError("Escribe el nombre de la estación.");
    setGuardando(true);
    try {
      const cuerpo = { nombre: form.nombre.trim(), stationId: form.stationId.trim(), estado: form.estado, apiKey: form.apiKey.trim(), apiSecret: form.apiSecret.trim() };
      if (form.id) await apiFetch(`/estacion-meteorologica/estaciones/${form.id}`, { method: "PUT", body: JSON.stringify(cuerpo) });
      else await apiFetch("/estacion-meteorologica/estaciones", { method: "POST", body: JSON.stringify(cuerpo) });
      setForm(null);
      await cargar();
      onCambio?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(e) {
    if (!window.confirm(`¿Eliminar la estación «${e.nombre}»? Deja de sincronizarse y se quitan sus fincas; el histórico ya guardado no se borra.`)) return;
    setError("");
    try {
      await apiFetch(`/estacion-meteorologica/estaciones/${e.id}`, { method: "DELETE" });
      await cargar();
      onCambio?.();
    } catch (err) {
      setError(err.message);
    }
  }

  async function probar(e) {
    setPruebas((p) => ({ ...p, [e.id]: { cargando: true } }));
    try {
      const r = await apiFetch(`/estacion-meteorologica/estaciones/${e.id}/probar`, { method: "POST" });
      setPruebas((p) => ({ ...p, [e.id]: r }));
    } catch (err) {
      setPruebas((p) => ({ ...p, [e.id]: { conectado: false, error: err.message } }));
    }
  }

  async function guardarFincas() {
    setError("");
    try {
      await apiFetch(`/estacion-meteorologica/estaciones/${asignando.id}/fincas`, { method: "PUT", body: JSON.stringify({ fincaUuids: [...asignando.sel] }) });
      setAsignando(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  // Estación a la que ya pertenece cada finca (una finca solo puede usar una).
  const duenoDe = useMemo(() => {
    const m = new Map();
    for (const e of estaciones) for (const f of e.fincas) m.set(f.uuid, e);
    return m;
  }, [estaciones]);

  const fincasFiltradas = useMemo(() => fincas.filter((f) => f.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())), [fincas, busqueda]);
  const editar = (e) => setForm({ id: e.id, nombre: e.nombre, apiKey: "", apiSecret: "", stationId: e.stationId || "", estado: e.estado });

  if (cargando) return <p className="small text-secondary mb-0">Cargando...</p>;

  return (
    <div>
      <p className="small text-secondary mb-2">
        Cada estación necesita su <strong>API key</strong>, <strong>API secret</strong> y <strong>Station ID</strong> de WeatherLink. Se guardan cifradas y no se vuelven a mostrar. Las fincas que asignes
        usan los datos de su estación para la temperatura y humedad de las gráficas de clima (una finca solo puede usar una estación).
      </p>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <div className="table-responsive border rounded-1 mb-2">
        <table className="table table-sm align-middle mb-0 small">
          <thead className="table-light">
            <tr>
              <th>Estación</th>
              <th>Station ID</th>
              <th>Credenciales</th>
              <th>Estado</th>
              <th>Fincas</th>
              <th style={{ width: "9rem" }}></th>
            </tr>
          </thead>
          <tbody>
            {estaciones.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-secondary py-3">
                  Aún no hay estaciones.
                </td>
              </tr>
            )}
            {estaciones.map((e) => {
              const c = etiquetaCred(e);
              const p = pruebas[e.id];
              return (
                <tr key={e.id} style={e.estado ? undefined : { opacity: 0.6 }}>
                  <td className="fw-medium">
                    {e.nombre}
                    {p && !p.cargando && (
                      <div className={`small ${p.conectado ? "text-success" : "text-danger"}`}>
                        {p.conectado ? `Conectó${p.ultimoDato ? ` · último dato ${new Date(p.ultimoDato).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" })}` : ""}${p.detalle ? ` · ${p.detalle}` : ""}` : p.error}
                      </div>
                    )}
                    {p?.cargando && <div className="small text-secondary">Probando...</div>}
                  </td>
                  <td>{e.stationId || <span className="text-secondary">—</span>}</td>
                  <td className={c.clase}>{c.texto}</td>
                  <td>{e.estado ? "Activa" : <span className="text-secondary">Inactiva</span>}</td>
                  <td>{e.fincas.length ? e.fincas.map((f) => f.nombre).join(", ") : <span className="text-secondary">Ninguna</span>}</td>
                  <td className="text-end text-nowrap">
                    <button type="button" className="btn btn-link btn-sm p-1 text-secondary" title="Probar conexión" onClick={() => probar(e)}>
                      <FiWifi />
                    </button>
                    <button type="button" className="btn btn-link btn-sm p-1 text-secondary" title="Fincas que usan esta estación" onClick={() => (setAsignando({ id: e.id, sel: new Set(e.fincas.map((f) => f.uuid)) }), setBusqueda(""))}>
                      <FiMapPin />
                    </button>
                    <button type="button" className="btn btn-link btn-sm p-1 text-secondary" title="Editar" onClick={() => editar(e)}>
                      <FiEdit2 />
                    </button>
                    <button type="button" className="btn btn-link btn-sm p-1 text-danger" title="Eliminar" onClick={() => eliminar(e)}>
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!form && (
        <button type="button" className="btn btn-sm btn-brand rounded-1 d-inline-flex align-items-center gap-1" onClick={() => setForm({ ...VACIO })}>
          <FiPlus /> Agregar estación
        </button>
      )}

      {form && (
        <div className="border rounded-1 p-2 mt-2" style={{ background: "#f8faf9" }}>
          <div className="fw-semibold small mb-2">{form.id ? "Editar estación" : "Nueva estación"}</div>
          <div className="row g-2">
            <div className="col-12 col-md-6">
              <label className="form-label small text-secondary mb-1">Nombre</label>
              <input className="form-control form-control-sm rounded-1" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="p. ej. Banafe Consola" maxLength={120} />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label small text-secondary mb-1">Station ID</label>
              <input className="form-control form-control-sm rounded-1" value={form.stationId} onChange={(e) => setForm({ ...form, stationId: e.target.value })} placeholder="Número de la estación en WeatherLink" maxLength={60} />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label small text-secondary mb-1">API key</label>
              <input className="form-control form-control-sm rounded-1" autoComplete="off" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={form.id ? "Vacío = conservar la guardada" : ""} />
            </div>
            <div className="col-12 col-md-6">
              <label className="form-label small text-secondary mb-1">API secret</label>
              <input type="password" className="form-control form-control-sm rounded-1" autoComplete="new-password" value={form.apiSecret} onChange={(e) => setForm({ ...form, apiSecret: e.target.value })} placeholder={form.id ? "Vacío = conservar la guardada" : ""} />
            </div>
            <div className="col-12">
              <div className="form-check">
                <input type="checkbox" className="form-check-input" id="estacion-activa" checked={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.checked })} />
                <label className="form-check-label small" htmlFor="estacion-activa">
                  Activa (se sincroniza cada día y entra en la alerta de «sin datos»)
                </label>
              </div>
            </div>
          </div>
          <div className="d-flex gap-2 mt-2">
            <button type="button" className="btn btn-sm btn-brand rounded-1 d-inline-flex align-items-center gap-1" disabled={guardando} onClick={guardar}>
              <FiCheck /> {guardando ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary rounded-1 d-inline-flex align-items-center gap-1" disabled={guardando} onClick={() => (setForm(null), setError(""))}>
              <FiX /> Cancelar
            </button>
          </div>
        </div>
      )}

      {asignando && (
        <div className="border rounded-1 p-2 mt-2" style={{ background: "#f8faf9" }}>
          <div className="fw-semibold small mb-1">Fincas de «{estaciones.find((e) => e.id === asignando.id)?.nombre}»</div>
          <input className="form-control form-control-sm rounded-1 mb-2" placeholder="Buscar finca..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          <div className="border rounded-1 bg-white" style={{ maxHeight: "14rem", overflowY: "auto" }}>
            {fincasFiltradas.map((f) => {
              const otra = duenoDe.get(f.uuid);
              const enOtra = otra && otra.id !== asignando.id;
              return (
                <label key={f.uuid} className="d-flex align-items-center gap-2 px-2 py-1 small border-bottom" style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    className="form-check-input mt-0"
                    checked={asignando.sel.has(f.uuid)}
                    onChange={() =>
                      setAsignando((a) => {
                        const sel = new Set(a.sel);
                        if (sel.has(f.uuid)) sel.delete(f.uuid);
                        else sel.add(f.uuid);
                        return { ...a, sel };
                      })
                    }
                  />
                  <span>{f.nombre}</span>
                  {enOtra && <span className="text-secondary ms-auto">hoy usa «{otra.nombre}»</span>}
                </label>
              );
            })}
          </div>
          <div className="d-flex gap-2 mt-2">
            <button type="button" className="btn btn-sm btn-brand rounded-1 d-inline-flex align-items-center gap-1" onClick={guardarFincas}>
              <FiCheck /> Guardar fincas
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary rounded-1 d-inline-flex align-items-center gap-1" onClick={() => setAsignando(null)}>
              <FiX /> Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
