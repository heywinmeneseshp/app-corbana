"use client";

import { useMemo, useRef, useState } from "react";
import { FiClipboard, FiPlus, FiTrash2, FiUpload } from "react-icons/fi";
import * as XLSX from "xlsx";
import { apiFetch } from "@/lib/api";
import ModalShell from "@/components/ModalShell";

const hoy = () => new Date().toISOString().slice(0, 10);
const renglonVacio = () => ({ id: `${Date.now()}-${Math.random()}`, texto: "", articuloUuid: "", cantidad: "", unidadUuid: "", costoUnitario: "", lote: "", fechaVencimiento: "" });

const normal = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const etiquetaArticulo = (a) => (a.codigo ? `${a.nombre} (${a.codigo})` : a.nombre);
const numero = (v) => {
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const aFechaIso = (v) => {
  if (v === "" || v === null || v === undefined) return "";
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : "";
  }
  const t = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
};

const TIPOS = [
  { value: "ENTRADA", label: "Entrada" },
  { value: "SALIDA", label: "Salida" },
  { value: "AJUSTE_ENTRADA", label: "Ajuste (entrada)" },
  { value: "AJUSTE_SALIDA", label: "Ajuste (salida)" },
];

// Nuevo movimiento con varios artículos: los datos comunes (tipo, documento, fecha, almacén, proveedor y motivo) se capturan una
// vez y cada renglón es un artículo. Sirve para recepciones de una factura, salidas de varios insumos y ajustes. Se puede
// pegar o subir la lista desde Excel.
// `modo`: "recepcion" (solo entradas de una factura, con proveedor) o "movimiento" (cualquier tipo; solo Administrador).
export default function MovimientoLoteModal({ modo = "movimiento", almacenes, articulos, unidades, motivos, onClose, onGuardado }) {
  const [cabecera, setCabecera] = useState({ tipo: "ENTRADA", documento: "", fecha: hoy(), almacenTexto: "", almacenUuid: "", proveedorTexto: "", proveedorUuid: "", motivoUuid: "", observaciones: "" });
  const [renglones, setRenglones] = useState([renglonVacio(), renglonVacio(), renglonVacio()]);
  const [proveedores, setProveedores] = useState(null);
  const [pegar, setPegar] = useState(false);
  const [textoPegado, setTextoPegado] = useState("");
  const [avisos, setAvisos] = useState([]);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const archivo = useRef(null);
  const esEntrada = cabecera.tipo === "ENTRADA" || cabecera.tipo === "AJUSTE_ENTRADA";
  const esAjuste = cabecera.tipo.startsWith("AJUSTE");

  // Proveedores: se cargan al enfocar el campo (evita pedirlos si no se usan).
  async function cargarProveedores() {
    if (proveedores) return;
    try {
      const { items } = await apiFetch("/inventarios/proveedores?limit=100&estado=true");
      setProveedores(items || []);
    } catch {
      setProveedores([]);
    }
  }

  const mapaAlmacen = useMemo(() => new Map(almacenes.map((a) => [a.nombre, a.uuid])), [almacenes]);
  const mapaProveedor = useMemo(() => new Map((proveedores || []).map((p) => [p.nombre, p.uuid])), [proveedores]);
  const mapaArticulo = useMemo(() => new Map(articulos.map((a) => [etiquetaArticulo(a), a])), [articulos]);
  const unidadesPorTexto = useMemo(() => {
    const m = new Map();
    for (const u of unidades) {
      m.set(normal(u.simbolo), u.uuid);
      m.set(normal(u.nombre), u.uuid);
      m.set(normal(u.codigo), u.uuid);
    }
    return m;
  }, [unidades]);

  const cambiarRenglon = (id, cambios) => setRenglones((rs) => rs.map((r) => (r.id === id ? { ...r, ...cambios } : r)));
  const quitarRenglon = (id) => setRenglones((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : [renglonVacio()]));
  const agregarRenglon = () => setRenglones((rs) => [...rs, renglonVacio()]);

  function elegirArticulo(id, texto) {
    const art = mapaArticulo.get(texto);
    cambiarRenglon(id, { texto, articuloUuid: art?.uuid || "", ...(art ? { unidadUuid: art.unidadMedida?.uuid || "" } : {}) });
  }

  // Enter en el último campo de un renglón: pasa al siguiente (crea uno si es el último).
  function enterSiguiente(e, indice) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (indice === renglones.length - 1) agregarRenglon();
    setTimeout(() => document.getElementById(`rec-articulo-${indice + 1}`)?.focus(), 30);
  }

  // Busca un artículo por código exacto o por nombre (exacto, o único que lo contenga).
  function buscarArticulo(valor) {
    const t = normal(valor);
    if (!t) return null;
    const exacto = articulos.find((a) => normal(a.codigo) === t || normal(a.nombre) === t || normal(etiquetaArticulo(a)) === t);
    if (exacto) return exacto;
    const parciales = articulos.filter((a) => normal(a.nombre).includes(t));
    return parciales.length === 1 ? parciales[0] : null;
  }

  // Filas [articulo/código, cantidad, costo, lote, vencimiento, unidad] -> renglones; informa lo que no se pudo leer.
  function cargarFilas(filas) {
    const nuevos = [];
    const problemas = [];
    filas.forEach((fila, i) => {
      const [articuloTxt, cant, costo, lote, venc, unidadTxt] = fila.map((c) => (typeof c === "string" ? c.trim() : c));
      if (![articuloTxt, cant, costo].some((c) => c !== "" && c !== undefined && c !== null)) return;
      if (i === 0 && Number.isNaN(numero(cant)) && /art|cod|prod|nombre/i.test(String(articuloTxt))) return; // encabezado
      const art = buscarArticulo(articuloTxt);
      const cantidad = numero(cant);
      if (!art) return problemas.push(`Fila ${i + 1}: no se encontró el artículo «${articuloTxt}»`);
      if (!Number.isFinite(cantidad) || cantidad <= 0) return problemas.push(`Fila ${i + 1}: cantidad inválida para «${art.nombre}»`);
      const costoNum = costo === "" || costo === undefined ? 0 : numero(costo);
      nuevos.push({
        id: `${Date.now()}-${i}-${Math.random()}`,
        texto: etiquetaArticulo(art),
        articuloUuid: art.uuid,
        cantidad: String(cantidad),
        unidadUuid: (unidadTxt && unidadesPorTexto.get(normal(unidadTxt))) || art.unidadMedida?.uuid || "",
        costoUnitario: Number.isFinite(costoNum) ? String(costoNum) : "0",
        lote: lote ? String(lote) : "",
        fechaVencimiento: aFechaIso(venc),
      });
    });
    if (nuevos.length) setRenglones((rs) => [...rs.filter((r) => r.articuloUuid || r.cantidad), ...nuevos]);
    setAvisos(nuevos.length ? [`Se cargaron ${nuevos.length} renglón(es).`, ...problemas] : problemas.length ? problemas : ["No se encontraron filas para cargar."]);
  }

  function aplicarPegado() {
    const filas = textoPegado
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => (l.includes("\t") ? l.split("\t") : l.split(/[;,](?=(?:[^"]*"[^"]*")*[^"]*$)/)).map((c) => c.replace(/^"|"$/g, "")));
    cargarFilas(filas);
    setTextoPegado("");
    setPegar(false);
  }

  async function leerArchivo(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const libro = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const hoja = libro.Sheets[libro.SheetNames[0]];
      cargarFilas(XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "", raw: true }));
    } catch {
      setAvisos(["No se pudo leer el archivo. Usa un .xlsx o .csv válido."]);
    }
  }

  const total = renglones.reduce((acc, r) => acc + (Number(r.cantidad) || 0) * (Number(r.costoUnitario) || 0), 0);
  const validos = renglones.filter((r) => r.articuloUuid && Number(r.cantidad) > 0);

  async function guardar(e, forzarSaldoNegativo = false) {
    e?.preventDefault?.();
    setError("");
    if (!cabecera.almacenUuid) return setError("Elige el almacén (selecciónalo de la lista de sugerencias).");
    if (cabecera.proveedorTexto && !cabecera.proveedorUuid) return setError("El proveedor escrito no coincide con uno de la lista.");
    const incompletos = renglones.filter((r) => (r.texto || r.cantidad) && !(r.articuloUuid && Number(r.cantidad) > 0));
    if (incompletos.length) return setError("Hay renglones incompletos: elige el artículo de la lista y escribe una cantidad mayor a 0 (o quita el renglón).");
    if (validos.length === 0) return setError("Agrega al menos un artículo.");
    if (esAjuste && !cabecera.motivoUuid) return setError("Los ajustes requieren motivo.");
    setGuardando(true);
    try {
      const resultado = await apiFetch("/inventarios/movimientos/lote", {
        method: "POST",
        body: JSON.stringify({
          tipo: cabecera.tipo,
          forzarSaldoNegativo,
          documento: cabecera.documento,
          fecha: cabecera.fecha,
          almacenUuid: cabecera.almacenUuid,
          proveedorUuid: cabecera.tipo === "ENTRADA" ? cabecera.proveedorUuid || null : null,
          motivoUuid: cabecera.motivoUuid || null,
          observaciones: cabecera.observaciones || null,
          renglones: validos.map((r) => ({
            articuloUuid: r.articuloUuid,
            cantidad: Number(r.cantidad),
            unidadUuid: r.unidadUuid || null,
            costoUnitario: esEntrada ? Number(r.costoUnitario) || 0 : 0,
            lote: esEntrada ? r.lote || null : null,
            fechaVencimiento: esEntrada ? r.fechaVencimiento || null : null,
          })),
        }),
      });
      // Salida de un artículo elaborado con algún insumo insuficiente: nada se guardó; se pide confirmar.
      if (resultado?.requiereConfirmacion) {
        const mensaje = resultado.advertencias.map((a) => a.mensaje).join("\n");
        if (confirm(`${mensaje}\n\n¿Registrar de todas formas?`)) {
          setGuardando(false);
          return guardar(null, true);
        }
        return;
      }
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ModalShell title={modo === "recepcion" ? "Recepción de mercancía" : "Nuevo movimiento"} onClose={onClose} size="xl">
      <form onSubmit={guardar}>
        <div className="row g-2 mb-3">
          {modo !== "recepcion" && (
          <div className="col-12 col-md-3">
            <label className="form-label small fw-medium mb-1">Tipo</label>
            <select className="form-select form-select-sm rounded-3" value={cabecera.tipo} onChange={(e) => setCabecera({ ...cabecera, tipo: e.target.value })}>
              {TIPOS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          )}
          <div className="col-6 col-md-3">
            <label className="form-label small fw-medium mb-1">
              {modo === "recepcion" ? "Documento / factura" : "Documento"} <span className="text-danger">*</span>
            </label>
            <input type="text" className="form-control form-control-sm rounded-3" required maxLength={50} value={cabecera.documento} onChange={(e) => setCabecera({ ...cabecera, documento: e.target.value })} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small fw-medium mb-1">
              Fecha <span className="text-danger">*</span>
            </label>
            <input type="date" className="form-control form-control-sm rounded-3" required value={cabecera.fecha} onChange={(e) => setCabecera({ ...cabecera, fecha: e.target.value })} />
          </div>
          <div className="col-12 col-md-3">
            <label className="form-label small fw-medium mb-1">
              Almacén <span className="text-danger">*</span>
            </label>
            <input
              list="rec-almacenes"
              className="form-control form-control-sm rounded-3"
              placeholder="Escribe para buscar..."
              value={cabecera.almacenTexto}
              onChange={(e) => setCabecera({ ...cabecera, almacenTexto: e.target.value, almacenUuid: mapaAlmacen.get(e.target.value) || "" })}
            />
            <datalist id="rec-almacenes">
              {almacenes.map((a) => (
                <option key={a.uuid} value={a.nombre} />
              ))}
            </datalist>
          </div>
          {cabecera.tipo === "ENTRADA" && (
          <div className="col-12 col-md-4">
            <label className="form-label small fw-medium mb-1">Proveedor (opcional)</label>
            <input
              list="rec-proveedores"
              className="form-control form-control-sm rounded-3"
              placeholder="Escribe para buscar..."
              value={cabecera.proveedorTexto}
              onFocus={cargarProveedores}
              onChange={(e) => setCabecera({ ...cabecera, proveedorTexto: e.target.value, proveedorUuid: mapaProveedor.get(e.target.value) || "" })}
            />
            <datalist id="rec-proveedores">
              {(proveedores || []).map((p) => (
                <option key={p.uuid} value={p.nombre} />
              ))}
            </datalist>
          </div>
          )}
          <div className="col-12 col-md-4">
            <label className="form-label small fw-medium mb-1">
              Motivo {esAjuste ? <span className="text-danger">*</span> : "(opcional)"}
            </label>
            <select className="form-select form-select-sm rounded-3" value={cabecera.motivoUuid} onChange={(e) => setCabecera({ ...cabecera, motivoUuid: e.target.value })}>
              <option value="">Sin motivo</option>
              {motivos.map((m) => (
                <option key={m.uuid} value={m.uuid}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-8">
            <label className="form-label small fw-medium mb-1">Observaciones</label>
            <input type="text" className="form-control form-control-sm rounded-3" maxLength={500} value={cabecera.observaciones} onChange={(e) => setCabecera({ ...cabecera, observaciones: e.target.value })} />
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
          <span className="fw-semibold small">Artículos</span>
          <button type="button" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 ms-auto" onClick={() => setPegar((v) => !v)}>
            <FiClipboard /> Pegar desde Excel
          </button>
          <button type="button" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" onClick={() => archivo.current?.click()}>
            <FiUpload /> Subir archivo
          </button>
          <input ref={archivo} type="file" accept=".xlsx,.xls,.csv" className="d-none" onChange={leerArchivo} />
        </div>

        {pegar && (
          <div className="border rounded-3 p-2 mb-2 bg-light">
            <p className="small text-secondary mb-1">
              Copia las filas de Excel con las columnas <strong>artículo (nombre o código), cantidad, costo unitario, lote, vencimiento y unidad</strong> (las últimas tres son opcionales) y pégalas aquí.
            </p>
            <textarea className="form-control form-control-sm" rows={5} value={textoPegado} onChange={(e) => setTextoPegado(e.target.value)} placeholder={"Glifosato\t10\t45000\tL123\t2027-05-30\nAbono 15-15-15\t40\t98000"} />
            <div className="d-flex gap-2 mt-2">
              <button type="button" className="btn btn-sm btn-brand btn-brand-verde" disabled={!textoPegado.trim()} onClick={aplicarPegado}>
                Cargar renglones
              </button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setPegar(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {avisos.length > 0 && (
          <div className={`alert py-2 small ${avisos.length > 1 ? "alert-warning" : "alert-success"}`}>
            {avisos.slice(0, 8).map((a) => (
              <div key={a}>{a}</div>
            ))}
            {avisos.length > 8 && <div>y {avisos.length - 8} más...</div>}
          </div>
        )}

        <div className="table-responsive">
          <table className="table table-sm align-middle mb-2">
            <thead className="table-light">
              <tr>
                <th style={{ minWidth: 240 }}>Artículo</th>
                <th style={{ width: 100 }}>Cantidad</th>
                <th style={{ width: 130 }}>Unidad</th>
                {esEntrada && <th style={{ width: 120 }}>Costo unit.</th>}
                {esEntrada && (
                  <th style={{ width: 110 }} className="text-end">
                    Subtotal
                  </th>
                )}
                {esEntrada && <th style={{ width: 120 }}>Lote</th>}
                {esEntrada && <th style={{ width: 140 }}>Vencimiento</th>}
                <th style={{ width: 32 }}></th>
              </tr>
            </thead>
            <tbody>
              {renglones.map((r, i) => (
                <tr key={r.id}>
                  <td>
                    <input
                      id={`rec-articulo-${i}`}
                      list="rec-articulos"
                      className="form-control form-control-sm"
                      placeholder="Nombre o código..."
                      value={r.texto}
                      onChange={(e) => elegirArticulo(r.id, e.target.value)}
                    />
                  </td>
                  <td>
                    <input type="number" min="0" step="any" className="form-control form-control-sm" value={r.cantidad} onChange={(e) => cambiarRenglon(r.id, { cantidad: e.target.value })} onKeyDown={(e) => !esEntrada && enterSiguiente(e, i)} />
                  </td>
                  <td>
                    <select className="form-select form-select-sm" value={r.unidadUuid} onChange={(e) => cambiarRenglon(r.id, { unidadUuid: e.target.value })}>
                      <option value="">—</option>
                      {unidades.map((u) => (
                        <option key={u.uuid} value={u.uuid}>
                          {u.simbolo}
                        </option>
                      ))}
                    </select>
                  </td>
                  {esEntrada && (
                    <td>
                      <input type="number" min="0" step="any" className="form-control form-control-sm" value={r.costoUnitario} onChange={(e) => cambiarRenglon(r.id, { costoUnitario: e.target.value })} />
                    </td>
                  )}
                  {esEntrada && <td className="text-end small">{((Number(r.cantidad) || 0) * (Number(r.costoUnitario) || 0)).toLocaleString("es", { maximumFractionDigits: 2 })}</td>}
                  {esEntrada && (
                    <td>
                      <input type="text" maxLength={50} className="form-control form-control-sm" value={r.lote} onChange={(e) => cambiarRenglon(r.id, { lote: e.target.value })} />
                    </td>
                  )}
                  {esEntrada && (
                    <td>
                      <input type="date" className="form-control form-control-sm" value={r.fechaVencimiento} onChange={(e) => cambiarRenglon(r.id, { fechaVencimiento: e.target.value })} onKeyDown={(e) => enterSiguiente(e, i)} />
                    </td>
                  )}
                  <td>
                    <button type="button" className="btn btn-sm btn-link text-danger p-0" title="Quitar renglón" onClick={() => quitarRenglon(r.id)}>
                      <FiTrash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                {esEntrada ? (
                  <>
                    <td colSpan={4} className="text-end fw-semibold small">
                      Total de la factura
                    </td>
                    <td className="text-end fw-bold">{total.toLocaleString("es", { maximumFractionDigits: 2 })}</td>
                    <td colSpan={3}></td>
                  </>
                ) : (
                  <td colSpan={4}></td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
        <datalist id="rec-articulos">
          {articulos.map((a) => (
            <option key={a.uuid} value={etiquetaArticulo(a)} />
          ))}
        </datalist>

        <button type="button" className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 mb-3" onClick={agregarRenglon}>
          <FiPlus /> Agregar renglón
        </button>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="d-flex justify-content-between align-items-center">
          <span className="small text-secondary">{validos.length} artículo(s) · se registran {modo === "recepcion" ? "como entradas " : ""}con el mismo documento</span>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-brand btn-brand-verde btn-sm rounded-3" disabled={guardando}>
              {guardando ? "Guardando..." : modo === "recepcion" ? "Registrar recepción" : "Registrar movimiento"}
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
}
