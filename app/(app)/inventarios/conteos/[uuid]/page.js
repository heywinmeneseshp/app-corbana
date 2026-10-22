"use client";

// Detalle de un conteo de inventario: se digita lo contado por artículo, se ven las diferencias contra el saldo del sistema y, al cerrar,
// las diferencias se aplican como ajustes en el kárdex.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { FiArrowLeft, FiSave } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

const ESTADOS = {
  BORRADOR: { texto: "En conteo", bg: "#fef3c7", fg: "#92400e" },
  CERRADO: { texto: "Cerrado", bg: "#dcfce7", fg: "#166534" },
  ANULADO: { texto: "Anulado", bg: "#f1f5f9", fg: "#475569" },
};
const n = (v, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? "—" : Number(v).toLocaleString("es-CO", { maximumFractionDigits: d }));
const fmtFecha = (f) => (f ? String(f).slice(0, 10).split("-").reverse().join("/") : "—");

function CerrarModal({ conteo, ajustes, motivos, onClose, onCerrado }) {
  const porDefecto = motivos.find((m) => m.codigo === "AJUSTE_CONTEO") || motivos.find((m) => m.tipo === "AJUSTE") || motivos[0];
  const [motivoUuid, setMotivoUuid] = useState(porDefecto?.uuid || "");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function cerrar() {
    setGuardando(true);
    setError("");
    try {
      await apiFetch(`/inventarios/conteos/${conteo.uuid}/cerrar`, { method: "POST", body: JSON.stringify({ motivoUuid, observaciones: observaciones || null }) });
      onCerrado();
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <ModalShell title={`Cerrar conteo ${conteo.documento}`} onClose={onClose}>
      <div className="d-flex flex-column gap-3">
        <p className="small mb-0">
          Se registrarán <strong>{ajustes}</strong> ajuste(s) en el kárdex de <strong>{conteo.almacen.nombre}</strong> y las existencias quedarán iguales a lo contado. Los artículos sin cantidad digitada no se
          ajustan. Un conteo cerrado no se puede modificar.
        </p>
        <div>
          <label className="form-label small fw-bold text-dark mb-1">Motivo del ajuste</label>
          <select className="form-select form-select-sm rounded-1" value={motivoUuid} onChange={(e) => setMotivoUuid(e.target.value)}>
            {motivos.map((m) => (
              <option key={m.uuid} value={m.uuid}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label small fw-bold text-dark mb-1">Observaciones</label>
          <input className="form-control form-control-sm rounded-1" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </div>
        {error && <div className="alert alert-danger py-2 small mb-0">{error}</div>}
        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm rounded-1" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-success btn-sm rounded-1 px-4" disabled={!motivoUuid || guardando} onClick={cerrar}>
            {guardando ? "Cerrando..." : "Cerrar y aplicar ajustes"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export default function ConteoDetallePage() {
  const { uuid } = useParams();
  const router = useRouter();
  const [conteo, setConteo] = useState(null);
  const [motivos, setMotivos] = useState([]);
  const [valores, setValores] = useState({}); // articuloUuid -> texto digitado
  const [sucios, setSucios] = useState(new Set()); // articuloUuid con cambios sin guardar
  const [filtro, setFiltro] = useState({ texto: "", categoria: "", ver: "todos" });
  const [guardando, setGuardando] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const puedeCrear = hasPermission("inventario.conteos.crear");
  const puedeCerrar = hasPermission("inventario.conteos.cerrar");

  const cargar = useCallback(async () => {
    try {
      const data = await apiFetch(`/inventarios/conteos/${uuid}`);
      setConteo(data);
      setValores(Object.fromEntries(data.lineas.map((l) => [l.articuloUuid, l.cantidadContada === null ? "" : String(l.cantidadContada)])));
      setSucios(new Set());
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [uuid]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  useEffect(() => {
    apiFetch("/inventarios/motivos?limit=100&estado=true")
      .then((r) => setMotivos(r.items || []))
      .catch(() => {});
  }, []);

  const editable = conteo?.estado === "BORRADOR" && puedeCrear;
  const categorias = useMemo(() => [...new Set((conteo?.lineas || []).map((l) => l.categoria).filter(Boolean))].sort(), [conteo]);

  const filas = useMemo(() => {
    if (!conteo) return [];
    const t = filtro.texto.trim().toLowerCase();
    return conteo.lineas
      .map((l) => {
        const txt = valores[l.articuloUuid];
        const contada = txt === "" || txt === undefined ? null : Number(txt);
        const referencia = l.saldoVigente;
        const diferencia = contada === null || referencia === null ? null : Math.round((contada - referencia) * 100) / 100;
        return { ...l, contada, diferencia };
      })
      .filter((l) => (!t || l.nombre.toLowerCase().includes(t) || String(l.codigo || "").toLowerCase().includes(t)) && (!filtro.categoria || l.categoria === filtro.categoria))
      .filter((l) => (filtro.ver === "pendientes" ? l.contada === null : filtro.ver === "diferencias" ? l.diferencia !== null && Math.abs(l.diferencia) >= 0.005 : true));
  }, [conteo, valores, filtro]);

  const totales = useMemo(() => {
    if (!conteo) return { contados: 0, diferencias: 0 };
    let contados = 0;
    let diferencias = 0;
    for (const l of conteo.lineas) {
      const txt = valores[l.articuloUuid];
      if (txt === "" || txt === undefined) continue;
      contados += 1;
      if (l.saldoVigente !== null && Math.abs(Number(txt) - l.saldoVigente) >= 0.005) diferencias += 1;
    }
    return { contados, diferencias };
  }, [conteo, valores]);

  function cambiar(articuloUuid, texto) {
    setValores((v) => ({ ...v, [articuloUuid]: texto }));
    setSucios((s) => new Set(s).add(articuloUuid));
    setMensaje("");
  }

  async function guardar() {
    if (sucios.size === 0) return true;
    setGuardando(true);
    setError("");
    try {
      const lineas = [...sucios].map((u) => ({ articuloUuid: u, cantidadContada: valores[u] === "" ? null : Number(valores[u]) }));
      const data = await apiFetch(`/inventarios/conteos/${uuid}/lineas`, { method: "PUT", body: JSON.stringify({ lineas }) });
      setConteo(data);
      setSucios(new Set());
      setMensaje("Conteo guardado.");
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function abrirCierre() {
    if (await guardar()) setCerrando(true);
  }

  async function anular() {
    if (!window.confirm("¿Anular este conteo? No se aplicará ningún ajuste.")) return;
    try {
      await apiFetch(`/inventarios/conteos/${uuid}/anular`, { method: "POST" });
      router.push("/inventarios/conteos");
    } catch (err) {
      setError(err.message);
    }
  }

  if (!conteo) {
    return (
      <RequirePermission code="menu.inventarios.conteos">
        <div className="p-4 p-md-5">{error ? <div className="alert alert-danger small">{error}</div> : <p className="text-secondary">Cargando...</p>}</div>
      </RequirePermission>
    );
  }

  const ciego = conteo.ciego && conteo.estado === "BORRADOR";
  const estado = ESTADOS[conteo.estado];

  return (
    <RequirePermission code="menu.inventarios.conteos">
      <div className="p-4 p-md-5">
        <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none mb-2 d-inline-flex align-items-center gap-1" onClick={() => router.push("/inventarios/conteos")}>
          <FiArrowLeft /> Conteos
        </button>
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-3">
          <div>
            <h1 className="fw-bold h4 mb-1 d-flex align-items-center gap-2">
              {conteo.documento} · {conteo.almacen.nombre}
              <span className="badge rounded-1 fs-6" style={{ backgroundColor: estado?.bg, color: estado?.fg }}>
                {estado?.texto}
              </span>
              {conteo.ciego && <span className="badge rounded-1 bg-secondary bg-opacity-10 text-secondary fs-6">ciego</span>}
            </h1>
            <div className="small text-secondary">
              {fmtFecha(conteo.fecha)} · {conteo.categoria ? `Categoría ${conteo.categoria.nombre}` : "Todas las categorías"}
              {conteo.motivo ? ` · Motivo: ${conteo.motivo.nombre}` : ""}
              {conteo.observaciones ? ` · ${conteo.observaciones}` : ""}
            </div>
          </div>
          <div className="text-end small">
            <div>
              <strong>{totales.contados}</strong> de {conteo.lineas.length} contados
            </div>
            {!ciego && (
              <div className="text-secondary">
                {totales.diferencias} con diferencia
              </div>
            )}
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-4">
              <label className="form-label small fw-bold text-dark mb-1">Buscar</label>
              <input className="form-control form-control-sm rounded-1" placeholder="Código o nombre" value={filtro.texto} onChange={(e) => setFiltro((f) => ({ ...f, texto: e.target.value }))} />
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small fw-bold text-dark mb-1">Categoría</label>
              <select className="form-select form-select-sm rounded-1" value={filtro.categoria} onChange={(e) => setFiltro((f) => ({ ...f, categoria: e.target.value }))}>
                <option value="">Todas</option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small fw-bold text-dark mb-1">Mostrar</label>
              <select className="form-select form-select-sm rounded-1" value={filtro.ver} onChange={(e) => setFiltro((f) => ({ ...f, ver: e.target.value }))}>
                <option value="todos">Todos</option>
                <option value="pendientes">Pendientes por contar</option>
                {!ciego && <option value="diferencias">Con diferencia</option>}
              </select>
            </div>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        {mensaje && <div className="alert alert-success py-2 small">{mensaje}</div>}

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-3">
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle small">
              <thead className="table-light">
                <tr>
                  <th>Código</th>
                  <th>Artículo</th>
                  <th>Categoría</th>
                  <th className="text-center">Unidad</th>
                  {!ciego && <th className="text-end">{conteo.estado === "BORRADOR" ? "Saldo sistema" : "Saldo al cierre"}</th>}
                  <th className="text-center" style={{ width: 140 }}>
                    Contado
                  </th>
                  {!ciego && <th className="text-end">Diferencia</th>}
                </tr>
              </thead>
              <tbody>
                {filas.map((l) => (
                  <tr key={l.articuloUuid}>
                    <td className="text-secondary">{l.codigo || "—"}</td>
                    <td className="fw-medium">{l.nombre}</td>
                    <td className="text-secondary">{l.categoria || "—"}</td>
                    <td className="text-center">{l.unidad || "—"}</td>
                    {!ciego && <td className="text-end">{n(l.saldoVigente)}</td>}
                    <td className="text-center">
                      {editable ? (
                        <input
                          type="number"
                          min={0}
                          step="any"
                          className="form-control form-control-sm rounded-1 text-end"
                          value={valores[l.articuloUuid] ?? ""}
                          onChange={(e) => cambiar(l.articuloUuid, e.target.value)}
                        />
                      ) : (
                        n(l.cantidadContada)
                      )}
                    </td>
                    {!ciego && (
                      <td className="text-end fw-semibold" style={{ color: !l.diferencia ? undefined : l.diferencia > 0 ? "#16a34a" : "#dc2626" }}>
                        {l.diferencia === null ? "—" : `${l.diferencia > 0 ? "+" : ""}${n(l.diferencia)}`}
                      </td>
                    )}
                  </tr>
                ))}
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-secondary py-3">
                      Sin artículos con ese filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {conteo.estado === "BORRADOR" && (
          <div className="d-flex flex-wrap justify-content-between gap-2">
            {puedeCrear ? (
              <button type="button" className="btn btn-outline-danger btn-sm rounded-1" onClick={anular}>
                Anular conteo
              </button>
            ) : (
              <span />
            )}
            <div className="d-flex gap-2">
              {puedeCrear && (
                <button type="button" className="btn btn-outline-success btn-sm rounded-1 d-inline-flex align-items-center gap-1" disabled={guardando || sucios.size === 0} onClick={guardar}>
                  <FiSave /> {guardando ? "Guardando..." : `Guardar${sucios.size > 0 ? ` (${sucios.size})` : ""}`}
                </button>
              )}
              {puedeCerrar && (
                <button type="button" className="btn btn-success btn-sm rounded-1 px-4" disabled={guardando || totales.contados === 0} onClick={abrirCierre}>
                  Cerrar conteo
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {cerrando && <CerrarModal conteo={conteo} ajustes={totales.diferencias} motivos={motivos} onClose={() => setCerrando(false)} onCerrado={() => { setCerrando(false); cargar(); }} />}
    </RequirePermission>
  );
}
