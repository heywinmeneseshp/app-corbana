"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { FiChevronLeft, FiChevronRight, FiDownload } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { descargarExistenciasPdf } from "@/lib/existenciasExport";
import RequirePermission from "@/components/RequirePermission";
import { construirGrafoUnidades, convertirCantidad, unidadesAlcanzables } from "@/lib/unidadConversion";

export default function ExistenciasPage() {
  const [items, setItems] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [conversiones, setConversiones] = useState([]);
  // Unidad elegida por fila (clave almacén+artículo) para ver el saldo convertido; sin elegir = la del artículo.
  const [unidadSel, setUnidadSel] = useState({});
  const [loading, setLoading] = useState(true);
  const [descargando, setDescargando] = useState(""); // "" | "excel" | "pdf"
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState({ almacenUuid: "", articuloUuid: "", fecha: "" });
  const [meta, setMeta] = useState({ page: 1, limit: 100, total: 0, totalPages: 1 });
  // Texto escrito en los campos con sugerencias (datalist); al coincidir exactamente con una opción se fija el filtro.
  const [textoAlmacen, setTextoAlmacen] = useState("");
  const [textoArticulo, setTextoArticulo] = useState("");

  const grafo = useMemo(() => construirGrafoUnidades(conversiones), [conversiones]);
  const unidadPorUuid = useMemo(() => new Map(unidades.map((u) => [u.uuid, u])), [unidades]);
  const etiquetaAlmacen = (a) => a.nombre;
  const etiquetaArticulo = (p) => (p.codigo ? `${p.nombre} (${p.codigo})` : p.nombre);
  const unicasAlmacen = useMemo(() => new Map(almacenes.map((a) => [etiquetaAlmacen(a), a.uuid])), [almacenes]);
  const unicasArticulo = useMemo(() => new Map(articulos.map((p) => [etiquetaArticulo(p), p.uuid])), [articulos]);

  async function load(pagina = 1) {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ page: String(pagina), limit: "100" });
      Object.entries(filtros).forEach(([k, v]) => v && qs.set(k, v));
      const r = await apiFetch(`/inventarios/movimientos/existencias?${qs}`);
      setItems(Array.isArray(r) ? r : r.items || []);
      if (r.meta) setMeta(r.meta);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Trae TODAS las existencias (no solo la página en pantalla) que cumplan los filtros, con su saldo en la unidad base del artículo.
  async function obtenerTodas() {
    const qs = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => v && qs.set(k, v));
    const r = await apiFetch(`/inventarios/movimientos/existencias?${qs}`);
    return (Array.isArray(r) ? r : r.items || [])
      .map((e) => ({
        almacen: e.almacen?.nombre || "",
        codigo: e.articulo?.codigo || "",
        articulo: e.articulo?.nombre || "",
        saldo: Number(e.saldo),
        unidad: e.unidad ? e.unidad.simbolo : "",
      }))
      .sort((a, b) => a.almacen.localeCompare(b.almacen) || a.articulo.localeCompare(b.articulo));
  }

  async function descargar(formato) {
    setDescargando(formato);
    setError("");
    try {
      const filas = await obtenerTodas();
      const hoy = new Date().toISOString().slice(0, 10);
      if (formato === "pdf") {
        const partes = [];
        if (textoAlmacen && filtros.almacenUuid) partes.push(`Almacén: ${textoAlmacen}`);
        if (textoArticulo && filtros.articuloUuid) partes.push(`Artículo: ${textoArticulo}`);
        descargarExistenciasPdf(filas, { filtros: partes.join(" · "), fecha: filtros.fecha });
        return;
      }
      const hoja = XLSX.utils.json_to_sheet(
        filas.map((f) => ({ Almacén: f.almacen, Código: f.codigo, Artículo: f.articulo, Saldo: f.saldo, Unidad: f.unidad })),
        { header: ["Almacén", "Código", "Artículo", "Saldo", "Unidad"] },
      );
      hoja["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 48 }, { wch: 14 }, { wch: 10 }];
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, "Existencias");
      const buffer = XLSX.write(libro, { bookType: "xlsx", type: "array" });
      const url = URL.createObjectURL(new Blob([buffer], { type: "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `existencias_${filtros.fecha || hoy}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setDescargando("");
    }
  }

  async function loadCombos() {
    try {
      const [a, p, u, c] = await Promise.all([
        apiFetch("/inventarios/almacenes?limit=100&estado=true"),
        apiFetch("/inventarios/articulos?limit=100&estado=true"),
        apiFetch("/inventarios/unidades?limit=100&estado=true"),
        apiFetch("/inventarios/unidades/conversiones").catch(() => []),
      ]);
      setAlmacenes(a.items || []);
      setArticulos(p.items || []);
      setUnidades(u.items || []);
      setConversiones(Array.isArray(c) ? c : c.items || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load(1);
    loadCombos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <RequirePermission code="menu.inventarios.movimientos">
      <div className="p-4 p-md-5">
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1">Existencias</h1>
          <p className="text-secondary mb-0">{filtros.fecha ? `Saldo por almacén y artículo al ${filtros.fecha.split("-").reverse().join("/")} (reconstruido desde el kárdex).` : "Saldo actual por almacén y artículo (existencia en tiempo real)."}</p>
        </div>

        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label className="form-label small fw-medium mb-1">Almacén</label>
              <input
                list="existencias-almacenes"
                className="form-control form-control-sm rounded-3"
                style={{ minWidth: 220 }}
                placeholder="Todos"
                value={textoAlmacen}
                onChange={(e) => {
                  setTextoAlmacen(e.target.value);
                  setFiltros((f) => ({ ...f, almacenUuid: unicasAlmacen.get(e.target.value) || "" }));
                }}
              />
              <datalist id="existencias-almacenes">
                {almacenes.map((a) => (
                  <option key={a.uuid} value={etiquetaAlmacen(a)} />
                ))}
              </datalist>
            </div>
            <div className="col-auto">
              <label className="form-label small fw-medium mb-1">Artículo</label>
              <input
                list="existencias-articulos"
                className="form-control form-control-sm rounded-3"
                style={{ minWidth: 260 }}
                placeholder="Todos"
                value={textoArticulo}
                onChange={(e) => {
                  setTextoArticulo(e.target.value);
                  setFiltros((f) => ({ ...f, articuloUuid: unicasArticulo.get(e.target.value) || "" }));
                }}
              />
              <datalist id="existencias-articulos">
                {articulos.map((p) => (
                  <option key={p.uuid} value={etiquetaArticulo(p)} />
                ))}
              </datalist>
            </div>
            <div className="col-auto">
              <label className="form-label small fw-medium mb-1">Saldo al día</label>
              <input
                type="date"
                className="form-control form-control-sm rounded-3"
                max={new Date().toLocaleDateString("en-CA")}
                value={filtros.fecha}
                onChange={(e) => setFiltros((f) => ({ ...f, fecha: e.target.value }))}
                title="Déjalo vacío para ver el saldo actual"
              />
            </div>
            <div className="col-auto">
              <button type="button" className="btn btn-brand btn-sm rounded-3" onClick={() => load(1)}>
                Consultar
              </button>
            </div>
            <div className="col-auto ms-auto d-flex gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 d-inline-flex align-items-center gap-1" disabled={Boolean(descargando)} onClick={() => descargar("excel")}>
                <FiDownload /> {descargando === "excel" ? "Generando..." : "Descargar Excel"}
              </button>
              <button type="button" className="btn btn-outline-secondary btn-sm rounded-3 d-inline-flex align-items-center gap-1" disabled={Boolean(descargando)} onClick={() => descargar("pdf")}>
                <FiDownload /> {descargando === "pdf" ? "Generando..." : "Descargar PDF"}
              </button>
            </div>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>Almacén</th>
                  <th>Código</th>
                  <th>Artículo</th>
                  <th className="text-end">Saldo</th>
                  <th>Unidad</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} className="text-center text-secondary py-4">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-secondary py-4">
                      No hay existencias para los filtros seleccionados.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((e, idx) => {
                    const clave = `${e.almacen?.uuid || idx}-${e.articulo?.uuid || idx}`;
                    const baseUuid = e.unidad?.uuid;
                    const elegida = unidadSel[clave] || baseUuid;
                    const convertido = baseUuid ? convertirCantidad(grafo, baseUuid, elegida, Number(e.saldo)) : null;
                    const opciones = baseUuid ? [...unidadesAlcanzables(grafo, baseUuid)].map((u) => unidadPorUuid.get(u)).filter(Boolean) : [];
                    return (
                      <tr key={clave}>
                        <td className="small text-secondary">{e.almacen?.nombre || "—"}</td>
                        <td className="small text-secondary">{e.articulo?.codigo || "—"}</td>
                        <td className="fw-medium">{e.articulo?.nombre || "—"}</td>
                        <td className={`text-end fw-medium ${e.saldo < 0 ? "text-danger" : ""}`}>
                          {convertido === null ? Number(e.saldo).toFixed(2) : Number(convertido.toFixed(4)).toLocaleString("es-CO", { maximumFractionDigits: 4 })}
                        </td>
                        <td className="small text-secondary">
                          {opciones.length > 1 ? (
                            <select
                              className="form-select form-select-sm rounded-3"
                              style={{ minWidth: 150 }}
                              value={elegida}
                              onChange={(ev) => setUnidadSel((m) => ({ ...m, [clave]: ev.target.value }))}
                            >
                              {opciones.map((u) => (
                                <option key={u.uuid} value={u.uuid}>
                                  {u.simbolo} · {u.nombre}
                                  {u.uuid === baseUuid ? " (base)" : ""}
                                </option>
                              ))}
                            </select>
                          ) : e.unidad ? (
                            `${e.unidad.simbolo} · ${e.unidad.nombre}`
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mt-3">
          <span className="small text-secondary">
            Mostrando página {meta.page} de {meta.totalPages} ({meta.total} existencias)
          </span>
          {meta.totalPages > 1 && (
            <div className="d-flex align-items-center gap-2">
              <button type="button" className="btn btn-sm btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-1" disabled={loading || meta.page <= 1} onClick={() => load(meta.page - 1)}>
                <FiChevronLeft /> Anterior
              </button>
              <button type="button" className="btn btn-sm btn-outline-secondary rounded-3 d-inline-flex align-items-center gap-1" disabled={loading || meta.page >= meta.totalPages} onClick={() => load(meta.page + 1)}>
                Siguiente <FiChevronRight />
              </button>
            </div>
          )}
        </div>
      </div>
    </RequirePermission>
  );
}
