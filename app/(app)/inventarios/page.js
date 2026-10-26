"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiAlertTriangle, FiRefreshCw } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import RequirePermission from "@/components/RequirePermission";
import InventarioTabs from "@/components/inventario/InventarioTabs";

const ETIQUETA_TIPO = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AJUSTE_ENTRADA: "Ajuste (+)",
  AJUSTE_SALIDA: "Ajuste (−)",
  TRANSFERENCIA_ENTRADA: "Transferencia (+)",
  TRANSFERENCIA_SALIDA: "Transferencia (−)",
  ELABORACION_ENTRADA: "Elaboración (+)",
  ELABORACION_SALIDA: "Elaboración (−)",
};
const esEntrada = (tipo) => tipo.endsWith("ENTRADA");
const num = (v, d = 2) => Number(v || 0).toLocaleString("es", { maximumFractionDigits: d });

function formatoFecha(f) {
  if (!f) return "—";
  const [a, m, d] = String(f).slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

function Kpi({ titulo, valor, detalle, alerta }) {
  return (
    <div className="col-6 col-md-3">
      <div className="card border-0 shadow-sm rounded-4 p-3 h-100">
        <div className="small text-secondary">{titulo}</div>
        <div className={`h4 fw-bold mb-0 ${alerta ? "text-danger" : ""}`}>{valor}</div>
        {detalle && <div className="small text-secondary">{detalle}</div>}
      </div>
    </div>
  );
}

// Resumen de Inventarios: catálogo, valor, artículos bajo el stock mínimo y últimos movimientos (GET /inventarios/dashboard/resumen).
// Los indicadores de equipos, mantenimiento y proformas se muestran cuando esos módulos tengan datos.
export default function InventariosDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await apiFetch("/inventarios/dashboard/resumen"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const mov30 = data?.movimientos30Dias || [];
  const entradas30 = mov30.filter((m) => esEntrada(m.tipo)).reduce((a, m) => a + m.cantidad, 0);
  const salidas30 = mov30.filter((m) => !esEntrada(m.tipo)).reduce((a, m) => a + m.cantidad, 0);
  const hayMantenimiento = data && (data.equipos > 0 || data.ordenesAbiertas > 0 || data.proformas > 0);

  return (
    <RequirePermission code="menu.inventarios.dashboard">
      <div className="p-4 p-md-5">
        <InventarioTabs />
        <div className="mb-4 d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Inventarios</h1>
            <p className="text-secondary mb-0">Resumen del catálogo, existencias y movimientos.</p>
          </div>
          <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={load} disabled={loading} title="Actualizar">
            <FiRefreshCw />
          </button>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        {loading && !data && <p className="text-secondary">Cargando...</p>}

        {data && (
          <>
            <div className="row g-3 mb-3">
              <Kpi titulo="Artículos activos" valor={num(data.articulos, 0)} detalle={`${num(data.articulosConSaldo, 0)} con saldo`} />
              <Kpi titulo="Valor del inventario" valor={`$${num(data.valorInventario, 0)}`} detalle="Saldo × costo de compra" />
              <Kpi titulo="Bajo stock mínimo" valor={num(data.bajoStock, 0)} detalle="Artículos en o bajo el mínimo" alerta={data.bajoStock > 0} />
              <Kpi titulo="Movimientos (30 días)" valor={num(entradas30 + salidas30, 0)} detalle={`${num(entradas30, 0)} entradas · ${num(salidas30, 0)} salidas`} />
            </div>

            {hayMantenimiento && (
              <div className="row g-3 mb-3">
                <Kpi titulo="Equipos" valor={num(data.equipos, 0)} detalle={`${num(data.equiposFueraServicio, 0)} fuera de servicio`} alerta={data.equiposFueraServicio > 0} />
                <Kpi titulo="En mantenimiento" valor={num(data.equiposEnMantenimiento, 0)} />
                <Kpi titulo="Órdenes abiertas" valor={num(data.ordenesAbiertas, 0)} />
                <Kpi titulo="Proformas pendientes" valor={num(data.proformasPendientes, 0)} detalle={`${num(data.proformasAprobadas, 0)} aprobadas`} />
              </div>
            )}

            <div className="row g-3">
              <div className="col-12 col-lg-5">
                <div className="card border-0 shadow-sm rounded-4 h-100">
                  <div className="p-3 pb-2 d-flex align-items-center gap-2">
                    <FiAlertTriangle className={data.bajoStock > 0 ? "text-danger" : "text-secondary"} />
                    <h2 className="h6 fw-bold mb-0">Bajo stock mínimo</h2>
                  </div>
                  {data.bajoStockLista.length === 0 ? (
                    <p className="small text-secondary px-3 pb-3 mb-0">
                      Ningún artículo está bajo su mínimo. Define el stock mínimo en cada artículo para que aparezca aquí.
                    </p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm mb-0 align-middle small">
                        <thead className="table-light">
                          <tr>
                            <th>Artículo</th>
                            <th className="text-end">Saldo</th>
                            <th className="text-end">Mínimo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.bajoStockLista.map((a) => (
                            <tr key={a.uuid}>
                              <td>
                                <Link href={`/inventarios/kardex?articuloUuid=${a.uuid}`} className="text-decoration-none">
                                  {a.nombre}
                                </Link>
                                {a.codigo && <span className="text-secondary ms-1">({a.codigo})</span>}
                              </td>
                              <td className={`text-end fw-medium ${a.saldo <= 0 ? "text-danger" : ""}`}>
                                {num(a.saldo)} {a.unidad || ""}
                              </td>
                              <td className="text-end text-secondary">{num(a.stockMinimo)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="col-12 col-lg-7">
                <div className="card border-0 shadow-sm rounded-4 h-100">
                  <div className="p-3 pb-2 d-flex align-items-center justify-content-between">
                    <h2 className="h6 fw-bold mb-0">Últimos movimientos</h2>
                    <Link href="/inventarios/movimientos" className="small text-decoration-none">
                      Ver todos
                    </Link>
                  </div>
                  {data.ultimosMovimientos.length === 0 ? (
                    <p className="small text-secondary px-3 pb-3 mb-0">Aún no hay movimientos.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm mb-0 align-middle small">
                        <thead className="table-light">
                          <tr>
                            <th>Fecha</th>
                            <th>Documento</th>
                            <th>Tipo</th>
                            <th>Artículo</th>
                            <th className="text-end">Cantidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.ultimosMovimientos.map((m) => (
                            <tr key={m.uuid}>
                              <td className="text-nowrap text-secondary">{formatoFecha(m.fecha)}</td>
                              <td className="fw-medium">{m.documento}</td>
                              <td className={esEntrada(m.tipo) ? "text-success" : "text-danger"}>{ETIQUETA_TIPO[m.tipo] || m.tipo}</td>
                              <td>
                                <Link href={`/inventarios/kardex?articuloUuid=${m.articuloUuid}`} className="text-decoration-none">
                                  {m.articulo}
                                </Link>
                              </td>
                              <td className="text-end text-nowrap">
                                {num(m.cantidad)} {m.unidad || ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {data.proximosMantenimientos?.length > 0 && (
                <div className="col-12">
                  <div className="card border-0 shadow-sm rounded-4 p-3">
                    <h2 className="h6 fw-bold mb-2">Próximos mantenimientos</h2>
                    <ul className="small mb-0">
                      {data.proximosMantenimientos.map((p) => (
                        <li key={p.uuid}>
                          {formatoFecha(p.fechaProgramada)} — {p.equipo?.nombre || "Equipo"} {p.plan?.nombre ? `(${p.plan.nombre})` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </RequirePermission>
  );
}
