"use client";

// Conteo (toma de inventario físico) por almacén: lista de conteos y creación de uno nuevo. Cada conteo carga los artículos del
// almacén con su saldo del sistema; se digita lo contado y al cerrarlo las diferencias se aplican como ajustes en el kárdex.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiCheckSquare, FiPlus, FiBookOpen } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import InventarioTabs from "@/components/inventario/InventarioTabs";
import ModalShell from "@/components/ModalShell";
import InfoModulo from "@/components/InfoModulo";

const ESTADOS = {
  BORRADOR: { texto: "En conteo", bg: "#fef3c7", fg: "#92400e" },
  CERRADO: { texto: "Cerrado", bg: "#dcfce7", fg: "#166534" },
  ANULADO: { texto: "Anulado", bg: "#f1f5f9", fg: "#475569" },
};
const fmtFecha = (f) => (f ? String(f).slice(0, 10).split("-").reverse().join("/") : "—");

function NuevoConteoModal({ almacenes, categorias, onClose, onCreado }) {
  const [form, setForm] = useState({ almacenUuid: "", categoriaUuid: "", ciego: false, observaciones: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function crear() {
    setGuardando(true);
    setError("");
    try {
      const r = await apiFetch("/inventarios/conteos", {
        method: "POST",
        body: JSON.stringify({
          almacenUuid: form.almacenUuid,
          categoriaUuid: form.categoriaUuid || null,
          ciego: form.ciego,
          observaciones: form.observaciones || null,
        }),
      });
      onCreado(r.uuid);
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <ModalShell title="Nuevo conteo de inventario" onClose={onClose}>
      <div className="d-flex flex-column gap-3">
        <div>
          <label className="form-label small fw-bold text-dark mb-1">Almacén</label>
          <select className="form-select form-select-sm rounded-1" value={form.almacenUuid} onChange={(e) => setForm((f) => ({ ...f, almacenUuid: e.target.value }))}>
            <option value="">Selecciona</option>
            {almacenes.map((a) => (
              <option key={a.uuid} value={a.uuid}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label small fw-bold text-dark mb-1">Categoría (opcional)</label>
          <select className="form-select form-select-sm rounded-1" value={form.categoriaUuid} onChange={(e) => setForm((f) => ({ ...f, categoriaUuid: e.target.value }))}>
            <option value="">Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.uuid} value={c.uuid}>
                {c.nombre}
              </option>
            ))}
          </select>
          <div className="small text-secondary mt-1">Se cargan los artículos con inventario del almacén (sin los elaborados).</div>
        </div>
        <div className="form-check">
          <input id="ciego" type="checkbox" className="form-check-input" checked={form.ciego} onChange={(e) => setForm((f) => ({ ...f, ciego: e.target.checked }))} />
          <label htmlFor="ciego" className="form-check-label small">
            Conteo ciego <span className="text-secondary">(no muestra el saldo del sistema mientras se cuenta)</span>
          </label>
        </div>
        <div>
          <label className="form-label small fw-bold text-dark mb-1">Observaciones</label>
          <input className="form-control form-control-sm rounded-1" value={form.observaciones} onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))} />
        </div>
        {error && <div className="alert alert-danger py-2 small mb-0">{error}</div>}
        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm rounded-1" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-success btn-sm rounded-1 px-4" disabled={!form.almacenUuid || guardando} onClick={crear}>
            {guardando ? "Creando..." : "Crear y empezar a contar"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

export default function ConteosPage() {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [filtros, setFiltros] = useState({ almacenUuid: "", estado: "" });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const puedeCrear = hasPermission("inventario.conteos.crear");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const qs = new URLSearchParams({ limit: "100" });
      Object.entries(filtros).forEach(([k, v]) => v && qs.set(k, v));
      const { items: rows } = await apiFetch(`/inventarios/conteos?${qs}`);
      setItems(rows || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [filtros]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  useEffect(() => {
    Promise.all([apiFetch("/inventarios/almacenes?limit=100&estado=true"), apiFetch("/inventarios/categorias?limit=100")])
      .then(([a, c]) => {
        setAlmacenes(a.items || []);
        setCategorias(c.items || []);
      })
      .catch(() => {});
  }, []);

  return (
    <RequirePermission code="menu.inventarios.conteos">
      <div className="p-4 p-md-5">
        <InventarioTabs />
        <div className="mb-4 d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1 d-flex align-items-center gap-2">
              <FiCheckSquare className="text-primary" /> Conteo de inventario
              <InfoModulo
                titulo="Conteo de inventario"
                secciones={[
                  { titulo: "Para qué sirve", texto: "Toma de inventario físico: compara lo que hay en cada almacén con las existencias del sistema y corrige las diferencias." },
                  {
                    titulo: "Cómo funciona",
                    items: [
                      "Nuevo conteo: eliges el almacén (y opcionalmente una categoría). Se cargan sus artículos con el saldo del sistema.",
                      "Digitas lo contado de cada artículo; puedes guardar y seguir después. Los no digitados no se ajustan.",
                      "Cerrar: cada diferencia contra el saldo vigente se registra como un ajuste de entrada (sobrante) o salida (faltante) en el kárdex, y la existencia queda igual a lo contado.",
                      "Conteo ciego: oculta el saldo del sistema mientras se cuenta. Un conteo cerrado ya no se puede modificar.",
                    ],
                  },
                ]}
              />
            </h1>
            <p className="text-secondary mb-0">Toma de inventario físico por almacén.</p>
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-1 d-inline-flex align-items-center gap-1"
              onClick={async () => (await import("@/lib/manualConteoPdf")).descargarManualConteo()}
              title="Descargar el manual de usuario en PDF"
            >
              <FiBookOpen /> Manual (PDF)
            </button>
          {puedeCrear && (
            <button type="button" className="btn btn-success btn-sm rounded-1 d-inline-flex align-items-center gap-1" onClick={() => setNuevo(true)}>
              <FiPlus /> Nuevo conteo
            </button>
          )}
          </div>
        </div>

        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
          <div className="row g-2">
            <div className="col-12 col-md-4">
              <label className="form-label small fw-bold text-dark mb-1">Almacén</label>
              <select className="form-select form-select-sm rounded-1" value={filtros.almacenUuid} onChange={(e) => setFiltros((f) => ({ ...f, almacenUuid: e.target.value }))}>
                <option value="">Todos</option>
                {almacenes.map((a) => (
                  <option key={a.uuid} value={a.uuid}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label small fw-bold text-dark mb-1">Estado</label>
              <select className="form-select form-select-sm rounded-1" value={filtros.estado} onChange={(e) => setFiltros((f) => ({ ...f, estado: e.target.value }))}>
                <option value="">Todos</option>
                <option value="BORRADOR">En conteo</option>
                <option value="CERRADO">Cerrado</option>
                <option value="ANULADO">Anulado</option>
              </select>
            </div>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        {cargando && <p className="text-secondary small">Cargando...</p>}
        {!cargando && items.length === 0 && <p className="text-secondary small">Aún no hay conteos. Crea el primero con «Nuevo conteo».</p>}

        {!cargando && items.length > 0 && (
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0 align-middle small text-center">
                <thead className="table-light">
                  <tr>
                    <th>Conteo</th>
                    <th>Fecha</th>
                    <th className="text-start">Almacén</th>
                    <th>Categoría</th>
                    <th>Artículos</th>
                    <th>Contados</th>
                    <th>Con diferencia</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.uuid} role="button" onClick={() => router.push(`/inventarios/conteos/${c.uuid}`)}>
                      <td className="fw-semibold">{c.documento}</td>
                      <td>{fmtFecha(c.fecha)}</td>
                      <td className="text-start">
                        {c.almacen?.nombre}
                        {c.ciego && <span className="badge rounded-1 bg-secondary bg-opacity-10 text-secondary ms-2">ciego</span>}
                      </td>
                      <td>{c.categoria?.nombre || "Todas"}</td>
                      <td>{c.articulos}</td>
                      <td>{c.contados}</td>
                      <td>{c.conDiferencia}</td>
                      <td>
                        <span className="badge rounded-1" style={{ backgroundColor: ESTADOS[c.estado]?.bg, color: ESTADOS[c.estado]?.fg }}>
                          {ESTADOS[c.estado]?.texto || c.estado}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {nuevo && (
        <NuevoConteoModal
          almacenes={almacenes}
          categorias={categorias}
          onClose={() => setNuevo(false)}
          onCreado={(uuid) => router.push(`/inventarios/conteos/${uuid}`)}
        />
      )}
    </RequirePermission>
  );
}
