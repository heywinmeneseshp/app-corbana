"use client";

import { useCallback, useEffect, useState } from "react";
import { FiCheck, FiClock, FiEdit2, FiPlus, FiRepeat, FiTrash2 } from "react-icons/fi";
import { apiFetch, apiFetchTodos } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import ModalShell from "@/components/ModalShell";

const TIPOS = [
  { value: "BATERIA", label: "Batería" },
  { value: "CONTROL_REMOTO", label: "Control remoto" },
  { value: "CARGADOR", label: "Cargador" },
  { value: "ANTENA", label: "Antena" },
  { value: "OTRO", label: "Otro" },
];
const ESTADOS = [
  { value: "ACTIVA", label: "Activa" },
  { value: "EN_REVISION", label: "En revisión" },
  { value: "RETIRADA", label: "Retirada" },
];
const REGISTROS = [
  { value: "CICLOS", label: "Ciclos" },
  { value: "NOVEDAD", label: "Novedad" },
  { value: "MANTENIMIENTO", label: "Mantenimiento" },
];
const etiqueta = (lista, v) => lista.find((x) => x.value === v)?.label || v;
const fmtFecha = (iso) => new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "short", timeStyle: "short" });
const VACIA = { uuid: null, tipo: "BATERIA", codigo: "", serie: "", descripcion: "", estado: "ACTIVA", ciclos: "0", observaciones: "" };

// Partes y accesorios con serie de un equipo (baterías, control remoto, cargador, antenas...): cada una con su código interno, serie, ciclos y novedades,
// y asignable a una aeronave o movible a otra. Así se sabe qué batería hizo qué y cuál da problemas.
export default function PartesEquipoModal({ equipo, onClose }) {
  const [datos, setDatos] = useState(null); // { asignadas, libres }
  const [error, setError] = useState("");
  const [form, setForm] = useState(null); // alta / edición
  const [registro, setRegistro] = useState(null); // { parte, tipo, ciclos, descripcion }
  const [mover, setMover] = useState(null); // { parte, equipoUuid }
  const [equipos, setEquipos] = useState([]);
  const [historial, setHistorial] = useState(null);
  const puedeEditar = hasPermission("inventario.equipos.editar");
  const puedeRegistrar = puedeEditar || hasPermission("inventario.equipos.lecturas");

  const cargar = useCallback(async () => {
    try {
      setDatos(await apiFetch(`/inventarios/equipos/${equipo.uuid}/partes`));
    } catch (err) {
      setError(err.message);
    }
  }, [equipo.uuid]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  async function llamar(accion) {
    setError("");
    try {
      await accion();
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  const guardarParte = () =>
    llamar(async () => {
      if (!form.codigo.trim()) throw new Error("Escribe el código interno (por ejemplo «Batería 01»).");
      const cuerpo = { tipo: form.tipo, codigo: form.codigo.trim(), serie: form.serie.trim(), descripcion: form.descripcion.trim(), estado: form.estado, observaciones: form.observaciones.trim() };
      if (form.uuid) await apiFetch(`/inventarios/equipos/partes/${form.uuid}`, { method: "PUT", body: JSON.stringify(cuerpo) });
      else await apiFetch(`/inventarios/equipos/${equipo.uuid}/partes`, { method: "POST", body: JSON.stringify({ ...cuerpo, ciclos: Number(form.ciclos) || 0 }) });
      setForm(null);
    });

  const guardarRegistro = () =>
    llamar(async () => {
      const cuerpo = { tipo: registro.tipo, descripcion: registro.descripcion.trim() || undefined };
      if (registro.tipo === "CICLOS") cuerpo.ciclos = Number(registro.ciclos);
      await apiFetch(`/inventarios/equipos/partes/${registro.parte.uuid}/registros`, { method: "POST", body: JSON.stringify(cuerpo) });
      setRegistro(null);
    });

  const asignar = (parte, equipoUuid) =>
    llamar(async () => {
      await apiFetch(`/inventarios/equipos/partes/${parte.uuid}/registros`, { method: "POST", body: JSON.stringify({ tipo: "ASIGNACION", equipoUuid: equipoUuid || null }) });
      setMover(null);
    });

  const eliminar = (p) => window.confirm(`¿Eliminar la parte «${p.codigo}»?`) && llamar(() => apiFetch(`/inventarios/equipos/partes/${p.uuid}`, { method: "DELETE" }));

  async function verHistorial(p) {
    try {
      setHistorial(await apiFetch(`/inventarios/equipos/partes/${p.uuid}/registros`));
    } catch (err) {
      setError(err.message);
    }
  }

  async function abrirMover(p) {
    setMover({ parte: p, equipoUuid: "" });
    if (equipos.length === 0) apiFetchTodos("/inventarios/equipos?limit=100").then((r) => setEquipos(r.items || [])).catch(() => {});
  }

  const fila = (p, libre = false) => (
    <tr key={p.uuid} style={p.estado === "RETIRADA" ? { opacity: 0.55 } : undefined}>
      <td className="fw-medium">{p.codigo}</td>
      <td>{etiqueta(TIPOS, p.tipo)}</td>
      <td>{p.serie || <span className="text-secondary">—</span>}</td>
      <td className="text-end">{p.ciclos}</td>
      <td>
        {p.estado === "ACTIVA" ? <span className="text-success">Activa</span> : <span className={p.estado === "EN_REVISION" ? "text-warning" : "text-secondary"}>{etiqueta(ESTADOS, p.estado)}</span>}
        {p.ultimoRegistro?.tipo === "NOVEDAD" && <div className="text-secondary" style={{ fontSize: "0.72rem" }}>Novedad: {p.ultimoRegistro.descripcion}</div>}
      </td>
      <td className="text-end text-nowrap">
        {libre && puedeEditar && (
          <button type="button" className="btn btn-outline-secondary btn-sm rounded-1 me-1" onClick={() => asignar(p, equipo.uuid)}>
            Asignar aquí
          </button>
        )}
        {puedeRegistrar && (
          <button type="button" className="btn btn-link btn-sm p-1 text-secondary" title="Registrar ciclos, novedad o mantenimiento" onClick={() => setRegistro({ parte: p, tipo: "CICLOS", ciclos: String(p.ciclos), descripcion: "" })}>
            <FiPlus />
          </button>
        )}
        <button type="button" className="btn btn-link btn-sm p-1 text-secondary" title="Historial" onClick={() => verHistorial(p)}>
          <FiClock />
        </button>
        {puedeEditar && (
          <>
            {!libre && (
              <button type="button" className="btn btn-link btn-sm p-1 text-secondary" title="Mover a otra aeronave o dejarla sin asignar" onClick={() => abrirMover(p)}>
                <FiRepeat />
              </button>
            )}
            <button type="button" className="btn btn-link btn-sm p-1 text-secondary" title="Editar" onClick={() => setForm({ uuid: p.uuid, tipo: p.tipo, codigo: p.codigo, serie: p.serie || "", descripcion: p.descripcion || "", estado: p.estado, ciclos: String(p.ciclos), observaciones: p.observaciones || "" })}>
              <FiEdit2 />
            </button>
            <button type="button" className="btn btn-link btn-sm p-1 text-danger" title="Eliminar" onClick={() => eliminar(p)}>
              <FiTrash2 />
            </button>
          </>
        )}
      </td>
    </tr>
  );

  const tabla = (lista, libre) => (
    <div className="table-responsive border rounded-1 mb-2">
      <table className="table table-sm align-middle mb-0 small">
        <thead className="table-light">
          <tr>
            <th>Código</th>
            <th>Tipo</th>
            <th>Serie</th>
            <th className="text-end">Ciclos</th>
            <th>Estado</th>
            <th style={{ width: "10rem" }}></th>
          </tr>
        </thead>
        <tbody>
          {lista.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-secondary py-3">
                {libre ? "No hay partes sin asignar." : "Este equipo no tiene partes registradas."}
              </td>
            </tr>
          )}
          {lista.map((p) => fila(p, libre))}
        </tbody>
      </table>
    </div>
  );

  return (
    <ModalShell title={`Partes y accesorios · ${equipo.codigo} ${equipo.nombre}`} onClose={onClose} size="xl">
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <p className="small text-secondary mb-2">
        Baterías, control remoto, cargadores y antenas con su serie y ciclos. Identifica cada una y asígnala a una aeronave para saber cuál tiene problemas y cuánto se ha usado.
      </p>
      {!datos ? (
        <p className="small text-secondary">Cargando...</p>
      ) : (
        <>
          <div className="d-flex align-items-center justify-content-between mb-1">
            <span className="fw-semibold small">Partes de este equipo ({datos.asignadas.length})</span>
            {puedeEditar && !form && (
              <button type="button" className="btn btn-brand btn-sm rounded-1 d-inline-flex align-items-center gap-1" onClick={() => setForm({ ...VACIA })}>
                <FiPlus /> Nueva parte
              </button>
            )}
          </div>
          {tabla(datos.asignadas, false)}
          {datos.libres.length > 0 && (
            <>
              <div className="fw-semibold small mb-1">Partes sin asignar ({datos.libres.length})</div>
              {tabla(datos.libres, true)}
            </>
          )}
        </>
      )}

      {form && (
        <div className="border rounded-1 p-2 mb-2" style={{ background: "#f8faf9" }}>
          <div className="fw-semibold small mb-2">{form.uuid ? "Editar parte" : "Nueva parte"}</div>
          <div className="row g-2">
            <div className="col-6 col-md-3">
              <label className="form-label small mb-1">Tipo</label>
              <select className="form-select form-select-sm rounded-1" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {TIPOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small mb-1">Código interno</label>
              <input className="form-control form-control-sm rounded-1" maxLength={60} placeholder="Batería 01" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small mb-1">Serie</label>
              <input className="form-control form-control-sm rounded-1" maxLength={100} value={form.serie} onChange={(e) => setForm({ ...form, serie: e.target.value })} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small mb-1">Estado</label>
              <select className="form-select form-select-sm rounded-1" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                {ESTADOS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-5">
              <label className="form-label small mb-1">Descripción (modelo, capacidad...)</label>
              <input className="form-control form-control-sm rounded-1" maxLength={200} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="DB2160, TKPL 2..." />
            </div>
            {!form.uuid && (
              <div className="col-6 col-md-2">
                <label className="form-label small mb-1">Ciclos actuales</label>
                <input type="number" min="0" className="form-control form-control-sm rounded-1" value={form.ciclos} onChange={(e) => setForm({ ...form, ciclos: e.target.value })} />
              </div>
            )}
            <div className="col-12 col-md">
              <label className="form-label small mb-1">Observaciones</label>
              <input className="form-control form-control-sm rounded-1" value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
            </div>
          </div>
          <div className="d-flex gap-2 mt-2">
            <button type="button" className="btn btn-brand btn-sm rounded-1 d-inline-flex align-items-center gap-1" onClick={guardarParte}>
              <FiCheck /> Guardar
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-1" onClick={() => setForm(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {registro && (
        <div className="border rounded-1 p-2 mb-2" style={{ background: "#f8faf9" }}>
          <div className="fw-semibold small mb-2">Registrar en {registro.parte.codigo}</div>
          <div className="d-flex flex-wrap gap-2 align-items-end">
            <select className="form-select form-select-sm rounded-1" style={{ width: "auto" }} value={registro.tipo} onChange={(e) => setRegistro({ ...registro, tipo: e.target.value })}>
              {REGISTROS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {registro.tipo === "CICLOS" && (
              <div>
                <label className="form-label small mb-0">Ciclos acumulados (hoy {registro.parte.ciclos})</label>
                <input type="number" min="0" className="form-control form-control-sm rounded-1" style={{ width: "9rem" }} value={registro.ciclos} onChange={(e) => setRegistro({ ...registro, ciclos: e.target.value })} />
              </div>
            )}
            <input className="form-control form-control-sm rounded-1" style={{ flex: 1, minWidth: "14rem" }} placeholder={registro.tipo === "CICLOS" ? "Nota (opcional)" : "Describe la novedad o el mantenimiento"} value={registro.descripcion} onChange={(e) => setRegistro({ ...registro, descripcion: e.target.value })} />
            <button type="button" className="btn btn-brand btn-sm rounded-1" onClick={guardarRegistro}>
              Guardar
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-1" onClick={() => setRegistro(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {mover && (
        <div className="border rounded-1 p-2 mb-2" style={{ background: "#f8faf9" }}>
          <div className="fw-semibold small mb-2">Mover {mover.parte.codigo}</div>
          <div className="d-flex flex-wrap gap-2">
            <select className="form-select form-select-sm rounded-1" style={{ maxWidth: "24rem" }} value={mover.equipoUuid} onChange={(e) => setMover({ ...mover, equipoUuid: e.target.value })}>
              <option value="">Dejar sin asignar</option>
              {equipos
                .filter((e) => e.uuid !== equipo.uuid)
                .map((e) => (
                  <option key={e.uuid} value={e.uuid}>
                    {e.codigo} · {e.nombre}
                  </option>
                ))}
            </select>
            <button type="button" className="btn btn-brand btn-sm rounded-1" onClick={() => asignar(mover.parte, mover.equipoUuid)}>
              Mover
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-1" onClick={() => setMover(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {historial && (
        <div className="border rounded-1 p-2" style={{ background: "#f8faf9" }}>
          <div className="d-flex justify-content-between mb-1">
            <span className="fw-semibold small">
              Historial de {historial.parte.codigo} {historial.parte.serie ? `· serie ${historial.parte.serie}` : ""}
            </span>
            <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setHistorial(null)}>
              Cerrar
            </button>
          </div>
          <table className="table table-sm mb-0 small">
            <tbody>
              {historial.items.length === 0 && (
                <tr>
                  <td className="text-secondary">Sin registros.</td>
                </tr>
              )}
              {historial.items.map((r) => (
                <tr key={r.uuid}>
                  <td className="text-nowrap text-secondary">{fmtFecha(r.fechaHora)}</td>
                  <td className="fw-medium">{etiqueta([...REGISTROS, { value: "ASIGNACION", label: "Asignación" }], r.tipo)}</td>
                  <td>
                    {r.ciclos !== null ? `${r.ciclos} ciclos` : ""} {r.descripcion || ""}
                  </td>
                  <td className="text-secondary">{r.usuario || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ModalShell>
  );
}
