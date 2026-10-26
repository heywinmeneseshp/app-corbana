"use client";

import { useEffect, useState } from "react";
import { FiDownload } from "react-icons/fi";
import { apiFetch, apiFetchTodos } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";
import InventarioTabs from "@/components/inventario/InventarioTabs";

// La fecha del movimiento es DATEONLY ("2026-10-22"): se muestra tal cual (dd/mm/aaaa). `new Date("2026-10-22")` es medianoche UTC y en
// Colombia (UTC-5) se mostraba como el día anterior.
function formatoFecha(f) {
  if (!f) return "—";
  const [a, m, d] = String(f).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

const num = (v) => Number(v || 0).toLocaleString("es", { maximumFractionDigits: 2 });

export default function KardexPage() {
  const [items, setItems] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [almacenes, setAlmacenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [textoArticulo, setTextoArticulo] = useState("");
  const [filtros, setFiltros] = useState({ articuloUuid: "", almacenUuid: "", fechaDesde: "", fechaHasta: "" });

  async function load(f = filtros) {
    if (!f.articuloUuid) {
      setError("Selecciona un artículo para ver su kárdex.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => v && qs.set(k, v));
      const rows = await apiFetch(`/inventarios/movimientos/kardex?${qs}`);
      setItems(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const [p, a] = await Promise.all([
          apiFetchTodos("/inventarios/articulos?limit=100&estado=true"),
          apiFetch("/inventarios/almacenes?limit=100&estado=true"),
        ]);
        const lista = p.items || [];
        setArticulos(lista);
        setAlmacenes(a.items || []);
        // Abierto desde Existencias / Dashboard / Movimientos: ?articuloUuid=...&almacenUuid=... consulta directo.
        const params = new URLSearchParams(window.location.search);
        const articuloUuid = params.get("articuloUuid") || "";
        if (articuloUuid) {
          const inicial = { articuloUuid, almacenUuid: params.get("almacenUuid") || "", fechaDesde: "", fechaHasta: "" };
          setFiltros(inicial);
          setTextoArticulo(lista.find((x) => x.uuid === articuloUuid)?.nombre || "");
          load(inicial);
        }
      } catch (err) {
        setError(err.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function elegirArticulo(texto) {
    setTextoArticulo(texto);
    const exacto = articulos.find((a) => a.nombre.toLowerCase() === texto.trim().toLowerCase() || (a.codigo && a.codigo.toLowerCase() === texto.trim().toLowerCase()));
    setFiltros((f) => ({ ...f, articuloUuid: exacto ? exacto.uuid : "" }));
  }

  async function exportarExcel() {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Kárdex", { views: [{ state: "frozen", ySplit: 1 }] });
    const art = articulos.find((a) => a.uuid === filtros.articuloUuid);
    ws.columns = [
      { header: "Fecha", width: 12 },
      { header: "Documento", width: 16 },
      { header: "Tipo", width: 22 },
      { header: "Entrada", width: 12 },
      { header: "Salida", width: 12 },
      { header: "Saldo", width: 12 },
      { header: "Costo unit.", width: 12 },
      { header: "Costo total", width: 14 },
      { header: "Almacén", width: 18 },
      { header: "Lote", width: 12 },
      { header: "Motivo", width: 18 },
      { header: "Usuario", width: 16 },
    ];
    for (const m of items) {
      ws.addRow([
        formatoFecha(m.fecha),
        m.documento,
        m.tipo,
        m.entrada ? Number(m.entrada) : null,
        m.salida ? Number(m.salida) : null,
        Number(m.saldo),
        Number(m.costoUnitario || 0),
        Number(m.costoTotal || 0),
        m.almacen?.nombre || "",
        m.lote || "",
        m.motivo?.nombre || "",
        m.usuario?.usuario || "",
      ]);
    }
    ws.getRow(1).eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF14532D" } };
    });
    [4, 5, 6, 7, 8].forEach((i) => (ws.getColumn(i).numFmt = "#,##0.00"));
    const buffer = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `kardex-${art?.codigo || art?.nombre || "articulo"}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <RequirePermission code="menu.inventarios.movimientos">
      <div className="p-4 p-md-5">
        <InventarioTabs />
        <div className="mb-4">
          <h1 className="fw-bold h3 mb-1">Kárdex</h1>
          <p className="text-secondary mb-0">Historial de movimientos de un artículo con saldo acumulado.</p>
        </div>

        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-4">
              <label className="form-label small fw-medium mb-1">
                Artículo <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                list="kardex-articulos"
                className="form-control form-control-sm rounded-3"
                placeholder="Escribe el nombre o código..."
                autoComplete="off"
                value={textoArticulo}
                onChange={(e) => elegirArticulo(e.target.value)}
              />
              <datalist id="kardex-articulos">
                {articulos.map((p) => (
                  <option key={p.uuid} value={p.nombre}>
                    {p.codigo || ""}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="col-auto">
              <label className="form-label small fw-medium mb-1">Almacén</label>
              <select
                className="form-select form-select-sm rounded-3"
                value={filtros.almacenUuid}
                onChange={(e) => setFiltros((f) => ({ ...f, almacenUuid: e.target.value }))}
              >
                <option value="">Todos</option>
                {almacenes.map((a) => (
                  <option key={a.uuid} value={a.uuid}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-auto">
              <label className="form-label small fw-medium mb-1">Desde</label>
              <input
                type="date"
                className="form-control form-control-sm rounded-3"
                value={filtros.fechaDesde}
                onChange={(e) => setFiltros((f) => ({ ...f, fechaDesde: e.target.value }))}
              />
            </div>
            <div className="col-auto">
              <label className="form-label small fw-medium mb-1">Hasta</label>
              <input
                type="date"
                className="form-control form-control-sm rounded-3"
                value={filtros.fechaHasta}
                onChange={(e) => setFiltros((f) => ({ ...f, fechaHasta: e.target.value }))}
              />
            </div>
            <div className="col-auto d-flex gap-2">
              <button type="button" className="btn btn-brand btn-sm rounded-3" onClick={() => load()}>
                Consultar
              </button>
              <button
                type="button"
                className="btn btn-outline-success btn-sm rounded-3 d-flex align-items-center gap-1"
                onClick={exportarExcel}
                disabled={items.length === 0}
              >
                <FiDownload /> Excel
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
                  <th>Fecha</th>
                  <th>Documento</th>
                  <th>Tipo</th>
                  <th className="text-end">Entrada</th>
                  <th className="text-end">Salida</th>
                  <th className="text-end">Saldo</th>
                  <th className="text-end">Costo unit.</th>
                  <th className="text-end">Costo total</th>
                  <th>Almacén</th>
                  <th>Lote</th>
                  <th>Motivo</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={12} className="text-center text-secondary py-4">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={12} className="text-center text-secondary py-4">
                      {filtros.articuloUuid ? "Sin movimientos para los filtros seleccionados." : "Selecciona un artículo para ver su kárdex."}
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((m, idx) => (
                    <tr key={idx}>
                      <td className="small text-secondary text-nowrap">{formatoFecha(m.fecha)}</td>
                      <td className="fw-medium">{m.documento}</td>
                      <td className="small text-secondary">{m.tipo}</td>
                      <td className="text-end small text-success">{m.entrada ? num(m.entrada) : "—"}</td>
                      <td className="text-end small text-danger">{m.salida ? num(m.salida) : "—"}</td>
                      <td className={`text-end fw-medium ${m.saldo < 0 ? "text-danger" : ""}`}>{num(m.saldo)}</td>
                      <td className="text-end small">{num(m.costoUnitario)}</td>
                      <td className="text-end small">{num(m.costoTotal)}</td>
                      <td className="small text-secondary">{m.almacen?.nombre || "—"}</td>
                      <td className="small text-secondary">{m.lote || "—"}</td>
                      <td className="small text-secondary">{m.motivo?.nombre || "—"}</td>
                      <td className="small text-secondary">{m.usuario?.usuario || "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </RequirePermission>
  );
}
