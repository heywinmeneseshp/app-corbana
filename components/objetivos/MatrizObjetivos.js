"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { FiChevronDown, FiChevronRight, FiSave, FiSearch } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";

// Matriz de objetivos: una fila por finca y una columna por tipo de evaluación; cada celda es la meta de evaluaciones POR SEMANA (se repite
// cada semana hasta que se cambie). Conteo de Hojas lleva además su rango de edades en columnas propias. Los lotes se abren debajo de su finca
// como excepciones: vacío = hereda la meta de la finca; con valor, el lote tiene meta propia y la de la finca no aplica para él.
// Todo lo editado se guarda en una sola petición.
const clave = (ambito, uuid, tipoUuid) => `${ambito}:${uuid}:${tipoUuid}`;
const texto = (v) => (v === null || v === undefined ? "" : String(v));
const VERDE = "#166534";
const POR_PAGINA = 50; // fincas por página

// Campo numérico discreto: vacío se ve como un hueco punteado y solo muestra borde al pasar el mouse o escribir.
function Campo({ valor, onChange, disabled, placeholder = "", ancho = 64, modificado = false, titulo }) {
  return (
    <input
      type="number"
      min="1"
      step="1"
      title={titulo}
      className="form-control form-control-sm text-center px-1 matriz-campo"
      style={{
        width: ancho,
        display: "inline-block",
        verticalAlign: "middle",
        borderStyle: valor === "" ? "dashed" : "solid",
        borderColor: modificado ? "#f59e0b" : valor === "" ? "#d1d5db" : "#9ca3af",
        backgroundColor: modificado ? "#fef3c7" : valor === "" ? "transparent" : "#fff",
        fontWeight: valor === "" ? 400 : 600,
      }}
      disabled={disabled}
      value={valor}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export default function MatrizObjetivos({ alGuardar }) {
  const puedeEditar = hasPermission("objetivo_evaluacion.crear") || hasPermission("objetivo_evaluacion.editar");
  const [datos, setDatos] = useState(null);
  const [cambios, setCambios] = useState({}); // clave -> { cantidad, edadMinima, edadMaxima } (textos)
  const [abiertas, setAbiertas] = useState(() => new Set());
  const [masivo, setMasivo] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [soloConMeta, setSoloConMeta] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const cargar = useCallback(async () => {
    setError("");
    try {
      setDatos(await apiFetch("/evaluaciones/objetivos/matriz"));
      setCambios({});
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const originalDe = (celdas, tipoUuid) => celdas?.[tipoUuid] || null;
  const valorDe = (k, orig) => {
    const c = cambios[k];
    return {
      cantidad: c ? c.cantidad : texto(orig?.cantidad),
      edadMinima: c ? c.edadMinima : texto(orig?.edadMinima),
      edadMaxima: c ? c.edadMaxima : texto(orig?.edadMaxima),
    };
  };
  const cambiar = (k, orig, parcial) =>
    setCambios((prev) => {
      const actual = prev[k] || { cantidad: texto(orig?.cantidad), edadMinima: texto(orig?.edadMinima), edadMaxima: texto(orig?.edadMaxima) };
      const nuevo = { ...actual, ...parcial };
      const igual = nuevo.cantidad === texto(orig?.cantidad) && nuevo.edadMinima === texto(orig?.edadMinima) && nuevo.edadMaxima === texto(orig?.edadMaxima);
      const copia = { ...prev };
      if (igual) delete copia[k];
      else copia[k] = nuevo;
      return copia;
    });

  const alternar = (uuid) =>
    setAbiertas((s) => {
      const n = new Set(s);
      if (n.has(uuid)) n.delete(uuid);
      else n.add(uuid);
      return n;
    });

  // «Poner a todas las fincas»: llena las que no tienen meta; las que ya tienen se reemplazan solo si se confirma.
  function aplicarATodas(tipo) {
    const v = (masivo[tipo.uuid] || "").trim();
    if (!/^[1-9]\d*$/.test(v)) {
      setError("Escribe una cantidad entera mayor o igual a 1 para aplicar a todas las fincas.");
      return;
    }
    setError("");
    const vacias = [];
    const conValor = [];
    for (const f of datos.fincas) {
      const k = clave("finca", f.uuid, tipo.uuid);
      const orig = originalDe(f.celdas, tipo.uuid);
      if (orig?.multiples) continue;
      (valorDe(k, orig).cantidad === "" ? vacias : conValor).push({ k, orig });
    }
    let objetivo = vacias;
    if (conValor.length > 0 && confirm(`${conValor.length} finca(s) ya tienen una meta de «${tipo.nombre}». ¿Reemplazarlas también por ${v}?`)) objetivo = [...vacias, ...conValor];
    for (const { k, orig } of objetivo) cambiar(k, orig, { cantidad: v });
    setMensaje(`${tipo.nombre}: ${objetivo.length} finca(s) quedaron en ${v}. Revisa y pulsa «Guardar cambios».`);
  }

  const lista = useMemo(() => {
    if (!datos) return [];
    const out = [];
    for (const f of datos.fincas) {
      for (const t of datos.tipos) {
        const k = clave("finca", f.uuid, t.uuid);
        if (cambios[k]) out.push({ k, ambito: "finca", uuid: f.uuid, tipo: t, orig: originalDe(f.celdas, t.uuid), nuevo: cambios[k] });
      }
      for (const l of f.lotes) {
        for (const t of datos.tipos) {
          const k = clave("lote", l.uuid, t.uuid);
          if (cambios[k]) out.push({ k, ambito: "lote", uuid: l.uuid, tipo: t, orig: originalDe(l.celdas, t.uuid), nuevo: cambios[k] });
        }
      }
    }
    return out;
  }, [datos, cambios]);

  const tieneMeta = (celdas, tipos) => tipos.some((t) => celdas?.[t.uuid]);
  const resumen = useMemo(() => {
    if (!datos) return null;
    const con = datos.fincas.filter((f) => tieneMeta(f.celdas, datos.tipos) || f.lotes.some((l) => tieneMeta(l.celdas, datos.tipos))).length;
    return { con, total: datos.fincas.length };
  }, [datos]);

  const fincasVisibles = useMemo(() => {
    if (!datos) return [];
    const q = busqueda.trim().toLocaleLowerCase("es");
    return datos.fincas.filter((f) => {
      if (q && !f.nombre.toLocaleLowerCase("es").includes(q)) return false;
      if (soloConMeta && !(tieneMeta(f.celdas, datos.tipos) || f.lotes.some((l) => tieneMeta(l.celdas, datos.tipos)))) return false;
      return true;
    });
  }, [datos, busqueda, soloConMeta]);

  const totalPaginas = Math.max(1, Math.ceil(fincasVisibles.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const fincasPagina = fincasVisibles.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);

  async function guardar() {
    setError("");
    setMensaje("");
    const celdas = [];
    let nuevas = 0;
    let modificadas = 0;
    let quitadas = 0;
    for (const c of lista) {
      const cant = c.nuevo.cantidad.trim();
      if (cant !== "" && !/^[1-9]\d*$/.test(cant)) {
        setError(`La cantidad de «${c.tipo.nombre}» debe ser un entero mayor o igual a 1.`);
        return;
      }
      const emin = c.nuevo.edadMinima.trim() === "" ? null : Number(c.nuevo.edadMinima);
      const emax = c.nuevo.edadMaxima.trim() === "" ? null : Number(c.nuevo.edadMaxima);
      if (emin !== null && emax !== null && emin > emax) {
        setError(`En «${c.tipo.nombre}», la edad mínima no puede ser mayor que la máxima.`);
        return;
      }
      if (cant === "") quitadas += c.orig ? 1 : 0;
      else if (c.orig) modificadas += 1;
      else nuevas += 1;
      if (cant === "" && !c.orig) continue;
      celdas.push({
        tipoEvaluacionUuid: c.tipo.uuid,
        ...(c.ambito === "finca" ? { fincaUuid: c.uuid } : { loteUuid: c.uuid }),
        cantidad: cant === "" ? null : Number(cant),
        ...(c.tipo.conEdades ? { edadMinima: emin, edadMaxima: emax } : {}),
      });
    }
    if (celdas.length === 0) return;
    if (!confirm(`Se guardarán los cambios: ${nuevas} nueva(s), ${modificadas} modificada(s), ${quitadas} quitada(s). ¿Continuar?`)) return;
    setGuardando(true);
    try {
      const r = await apiFetch("/evaluaciones/objetivos/matriz", { method: "PUT", body: JSON.stringify({ celdas }) });
      await cargar();
      setMensaje(`Guardado: ${r.creadas} creada(s), ${r.actualizadas} actualizada(s), ${r.quitadas} quitada(s).`);
      alGuardar?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!datos) return error ? <div className="alert alert-danger py-2 small">{error}</div> : <p className="text-secondary small">Cargando...</p>;

  // Celdas (<td>) de un tipo para una finca o un lote. Conteo de Hojas ocupa tres columnas: cantidad, edades y total.
  // Meta semanal de una celda: cantidad × número de edades del rango (si es Conteo de Hojas con rango completo), o la cantidad.
  const metaDe = (celdas, uuid, ambito, t) => {
    const v = valorDe(clave(ambito, uuid, t.uuid), originalDe(celdas, t.uuid));
    if (v.cantidad === "") return 0;
    const n = Number(v.cantidad);
    if (t.conEdades && v.edadMinima !== "" && v.edadMaxima !== "" && Number(v.edadMaxima) >= Number(v.edadMinima)) return n * (Number(v.edadMaxima) - Number(v.edadMinima) + 1);
    return n;
  };
  // Total por finca: su meta general + las metas propias de sus lotes.
  const totalFinca = (f, t) => metaDe(f.celdas, f.uuid, "finca", t) + f.lotes.reduce((n, l) => n + metaDe(l.celdas, l.uuid, "lote", t), 0);

  const celdasDe = (ambito, uuid, celdas, t, heredado, fondo, totalFilaFinca = null) => {
    const k = clave(ambito, uuid, t.uuid);
    const orig = originalDe(celdas, t.uuid);
    const v = valorDe(k, orig);
    const modificada = Boolean(cambios[k]);
    const borde = { borderLeft: "1px solid #eef0f3" };
    if (orig?.multiples) {
      return (
        <td key={t.uuid} colSpan={t.conEdades ? 3 : 2} className="text-center text-secondary" style={{ ...borde, fontSize: "0.72rem" }} title="Hay varios objetivos de este tipo con rangos de edad distintos: edítalos desde la pestaña Lista.">
          varios (ver Lista)
        </td>
      );
    }
    const cantidad = (
      <Campo valor={v.cantidad} onChange={(x) => cambiar(k, orig, { cantidad: x })} disabled={!puedeEditar} placeholder={heredado ? `↳ ${heredado}` : "+"} modificado={modificada} />
    );
    if (!t.conEdades) {
      const totalSimple = ambito === "finca" ? totalFilaFinca : null;
      return (
        <>
          <td key={`${t.uuid}-c`} className="text-center" style={{ ...borde, backgroundColor: fondo }}>
            {cantidad}
          </td>
          <td key={`${t.uuid}-t`} className="text-center text-nowrap" style={{ backgroundColor: fondo, color: VERDE, fontWeight: 600, fontSize: "0.78rem" }} title="Total por semana en la finca: su meta general más las metas propias de sus lotes">
            {totalSimple ? totalSimple : ""}
          </td>
        </>
      );
    }
    const activa = v.cantidad !== "";
    const total = activa && v.edadMinima !== "" && v.edadMaxima !== "" && Number(v.edadMaxima) >= Number(v.edadMinima) ? Number(v.cantidad) * (Number(v.edadMaxima) - Number(v.edadMinima) + 1) : null;
    return (
      <>
        <td key={`${t.uuid}-c`} className="text-center" style={{ ...borde, backgroundColor: fondo }}>
          {cantidad}
        </td>
        <td key={`${t.uuid}-e`} className="text-center text-nowrap" style={{ backgroundColor: fondo }}>
          {activa ? (
            <span className="d-inline-flex align-items-center gap-1">
              <Campo valor={v.edadMinima} onChange={(x) => cambiar(k, orig, { edadMinima: x })} disabled={!puedeEditar} placeholder="mín" ancho={52} titulo="Edad mínima de la planta (semanas desde el embolse)" />
              <span className="text-secondary">–</span>
              <Campo valor={v.edadMaxima} onChange={(x) => cambiar(k, orig, { edadMaxima: x })} disabled={!puedeEditar} placeholder="máx" ancho={52} titulo="Edad máxima de la planta (semanas desde el embolse)" />
            </span>
          ) : (
            <span className="text-secondary opacity-50">—</span>
          )}
        </td>
        <td key={`${t.uuid}-t`} className="text-center text-nowrap" style={{ backgroundColor: fondo, color: VERDE, fontWeight: 600, fontSize: "0.78rem" }} title="Meta total por semana: la cantidad se exige por cada edad del rango">
          {ambito === "finca" ? (totalFilaFinca ? totalFilaFinca : "") : total !== null ? total : ""}
        </td>
      </>
    );
  };

  return (
    <div>
      <style>{`.matriz-campo:hover:not(:disabled){border-style:solid!important;border-color:#6b7280!important}.matriz-campo::placeholder{color:#b6bcc6}.matriz-tabla td:not(:first-child),.matriz-tabla th:not(:first-child){text-align:center;vertical-align:middle}`}</style>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <div className="input-group input-group-sm" style={{ maxWidth: 240 }}>
          <span className="input-group-text bg-white">
            <FiSearch />
          </span>
          <input type="search" className="form-control" placeholder="Buscar finca" value={busqueda} onChange={(e) => (setBusqueda(e.target.value), setPagina(1))} />
        </div>
        <div className="form-check form-switch mb-0">
          <input className="form-check-input" type="checkbox" id="solo-con-meta" checked={soloConMeta} onChange={(e) => (setSoloConMeta(e.target.checked), setPagina(1))} />
          <label className="form-check-label small" htmlFor="solo-con-meta">
            Solo fincas con metas
          </label>
        </div>
        {resumen && (
          <span className="small text-secondary">
            {resumen.con} de {resumen.total} fincas con metas
          </span>
        )}
        {puedeEditar && (
          <button type="button" className="btn btn-brand btn-sm d-flex align-items-center gap-2 ms-auto" disabled={guardando || lista.length === 0} onClick={guardar}>
            <FiSave /> {guardando ? "Guardando..." : `Guardar cambios${lista.length ? ` (${lista.length})` : ""}`}
          </button>
        )}
      </div>
      <p className="text-secondary mb-2" style={{ fontSize: "0.78rem" }}>
        Evaluaciones <strong>por semana</strong>; la meta se repite cada semana hasta que la cambies. Vacío = sin objetivo. Abre una finca (▸) para ver sus lotes: vacío = hereda la de la finca; con valor, la del lote la reemplaza.
      </p>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {mensaje && !error && <div className="alert alert-success py-2 small">{mensaje}</div>}
      <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0 matriz-tabla" style={{ fontSize: "0.8rem", width: "auto", minWidth: "100%" }}>
            <thead className="table-light">
              <tr>
                <th className="ps-3" style={{ minWidth: 230 }} rowSpan={puedeEditar ? 1 : 1}>
                  Finca
                </th>
                {datos.tipos.map((t) => (
                  <th key={t.uuid} colSpan={t.conEdades ? 3 : 2} className="text-center text-nowrap" style={{ borderLeft: "1px solid #e5e7eb" }}>
                    {t.nombre}
                    <div className="fw-normal text-secondary" style={{ fontSize: "0.68rem" }}>{t.conEdades ? "cantidad · edades de la planta · total" : "cantidad · total finca"}</div>
                  </th>
                ))}
              </tr>
              {puedeEditar && (
                <tr>
                  <th className="ps-3 fw-normal text-secondary" style={{ fontSize: "0.7rem" }}>
                    Poner a todas las fincas
                  </th>
                  {datos.tipos.map((t) => (
                    <th key={t.uuid} colSpan={t.conEdades ? 3 : 2} className="text-center fw-normal" style={{ borderLeft: "1px solid #e5e7eb" }}>
                      <div className="d-inline-flex gap-1">
                        <Campo valor={masivo[t.uuid] || ""} onChange={(x) => setMasivo((m) => ({ ...m, [t.uuid]: x }))} ancho={56} />
                        <button type="button" className="btn btn-outline-secondary btn-sm px-2 py-0" style={{ fontSize: "0.72rem" }} onClick={() => aplicarATodas(t)} title="Aplicar a todas las fincas">
                          Aplicar
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {fincasPagina.map((f, i) => {
                const abierta = abiertas.has(f.uuid);
                const propios = f.lotes.filter((l) => tieneMeta(l.celdas, datos.tipos)).length;
                const fondo = i % 2 ? "#fafbfc" : undefined;
                return (
                  <Fragment key={f.uuid}>
                    <tr style={{ backgroundColor: fondo }}>
                      <td className="ps-3 text-nowrap" style={{ backgroundColor: fondo }}>
                        <button type="button" className="btn btn-link btn-sm p-0 me-1 text-secondary border-0" onClick={() => alternar(f.uuid)} title="Ver los lotes de esta finca">
                          {abierta ? <FiChevronDown /> : <FiChevronRight />}
                        </button>
                        <span className="fw-medium">{f.nombre}</span>
                        {propios > 0 && (
                          <span className="badge rounded-pill text-bg-light border ms-2 fw-normal" title="Lotes de esta finca con meta propia (reemplaza a la de la finca)">
                            {propios} lote{propios === 1 ? "" : "s"} propio{propios === 1 ? "" : "s"}
                          </span>
                        )}
                      </td>
                      {datos.tipos.map((t) => (
                        <Fragment key={t.uuid}>{celdasDe("finca", f.uuid, f.celdas, t, null, fondo, totalFinca(f, t))}</Fragment>
                      ))}
                    </tr>
                    {abierta &&
                      f.lotes.map((l) => (
                        <tr key={l.uuid} style={{ backgroundColor: "#f1f5f9" }}>
                          <td className="ps-5 text-secondary text-nowrap">↳ Lote {l.nombre}</td>
                          {datos.tipos.map((t) => {
                            const heredado = valorDe(clave("finca", f.uuid, t.uuid), originalDe(f.celdas, t.uuid)).cantidad;
                            return <Fragment key={t.uuid}>{celdasDe("lote", l.uuid, l.celdas, t, heredado, "#f1f5f9")}</Fragment>;
                          })}
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
              {fincasVisibles.length === 0 && (
                <tr>
                  <td colSpan={1 + datos.tipos.reduce((n, t) => n + (t.conEdades ? 3 : 2), 0)} className="text-center text-secondary py-4">
                    {datos.fincas.length === 0 ? "No hay fincas activas disponibles." : "Ninguna finca coincide con el filtro."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {fincasVisibles.length > POR_PAGINA && (
          <div className="d-flex align-items-center justify-content-between px-3 py-2 border-top small">
            <span className="text-secondary">
              Fincas {(paginaActual - 1) * POR_PAGINA + 1}–{Math.min(paginaActual * POR_PAGINA, fincasVisibles.length)} de {fincasVisibles.length}
            </span>
            <div className="d-flex align-items-center gap-2">
              <button type="button" className="btn btn-outline-secondary btn-sm py-0" disabled={paginaActual <= 1} onClick={() => setPagina(paginaActual - 1)}>
                Anterior
              </button>
              <span>
                {paginaActual} / {totalPaginas}
              </span>
              <button type="button" className="btn btn-outline-secondary btn-sm py-0" disabled={paginaActual >= totalPaginas} onClick={() => setPagina(paginaActual + 1)}>
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
