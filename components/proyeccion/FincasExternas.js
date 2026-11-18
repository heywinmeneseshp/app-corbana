"use client";

import { useEffect, useMemo, useState } from "react";
import { FiSave } from "react-icons/fi";
import { getExternas, guardarExternas } from "@/lib/proyeccion/api";

const fmt = (n) => (n == null || n === "" ? "" : Number(n).toLocaleString("es", { maximumFractionDigits: 0 }));

// Cajas de las fincas externas en la proyección anual: no se proyectan (no tienen racimos), se escriben a mano por semana y al guardar
// quedan registradas como su Estimación finca (semana de registro: la actual). Filas = semanas, columnas = fincas externas; se puede pegar
// una columna desde Excel en la primera celda y se reparte hacia abajo.
export default function FincasExternas({ escenarioUuid, puedeEditar, onGuardado }) {
  const [datos, setDatos] = useState(null);
  const [cambios, setCambios] = useState({}); // `${fincaUuid}|${semanaCodigo}` -> texto
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    try {
      setDatos(await getExternas(escenarioUuid));
      setCambios({});
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escenarioUuid]);

  const [hoy] = useState(() => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10));
  const valor = (f, s) => {
    const k = `${f}|${s}`;
    if (k in cambios) return cambios[k];
    const v = datos?.valores?.[f]?.[s];
    return v == null ? "" : String(v);
  };
  const totales = useMemo(() => {
    if (!datos) return { porFinca: {}, porSemana: {}, total: 0 };
    const porFinca = {};
    const porSemana = {};
    let total = 0;
    for (const s of datos.semanas) {
      for (const f of datos.fincas) {
        const k = `${f.uuid}|${s.codigo}`;
        const t = k in cambios ? cambios[k] : datos.valores?.[f.uuid]?.[s.codigo];
        const n = Number(String(t ?? "").replace(",", ".")) || 0;
        porFinca[f.uuid] = (porFinca[f.uuid] || 0) + n;
        porSemana[s.codigo] = (porSemana[s.codigo] || 0) + n;
        total += n;
      }
    }
    return { porFinca, porSemana, total };
  }, [datos, cambios]);

  // Pegar varias líneas desde Excel: llena la misma finca hacia abajo desde la semana donde se pegó.
  function pegar(e, fincaUuid, idxSemana) {
    const texto = e.clipboardData.getData("text");
    if (!texto.includes("\n")) return;
    e.preventDefault();
    const lineas = texto.split(/\r?\n/).filter((l, i, arr) => !(i === arr.length - 1 && l.trim() === ""));
    setCambios((prev) => {
      const n = { ...prev };
      lineas.forEach((l, i) => {
        const s = datos.semanas[idxSemana + i];
        if (s && s.fechaInicio > hoy) n[`${fincaUuid}|${s.codigo}`] = l.trim().replace(/\./g, "").replace(",", ".");
      });
      return n;
    });
  }

  async function guardar() {
    setError("");
    setAviso("");
    const items = Object.entries(cambios)
      .map(([k, t]) => {
        const [fincaUuid, semanaCodigo] = k.split("|");
        const limpio = String(t).trim().replace(",", ".");
        return { fincaUuid, semanaCodigo, cajas: limpio === "" ? null : Number(limpio) };
      })
      .filter((it) => it.cajas !== null);
    if (items.some((it) => Number.isNaN(it.cajas) || it.cajas < 0)) return setError("Hay valores que no son números válidos.");
    if (items.length === 0) return setAviso("No hay cambios para guardar.");
    setGuardando(true);
    try {
      const r = await guardarExternas(escenarioUuid, items);
      setAviso(`${r.guardadas} semana(s) guardadas como estimación de las fincas externas${r.omitidas?.length ? `; no se guardaron las semanas que ya iniciaron (${r.omitidas.join(", ")})` : ""}.`);
      await cargar();
      onGuardado?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!datos) return <p className="small text-secondary">{error || "Cargando..."}</p>;
  if (datos.fincas.length === 0) return <p className="small text-secondary">No hay fincas externas activas.</p>;

  const hayCambios = Object.keys(cambios).length > 0;
  return (
    <div>
      <p className="small text-secondary mb-2">
        Cajas de las fincas externas por semana. No se proyectan: escríbelas aquí (o pega una columna desde Excel en la primera semana) y al guardar quedan
        registradas como su <strong>Estimación finca</strong>, con la semana actual como semana de registro. En Resultados se suman aparte al total de cajas. Las
        semanas que ya iniciaron no se pueden cambiar.
      </p>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      {aviso && <div className="alert alert-info py-2 small">{aviso}</div>}
      {puedeEditar && (
        <div className="d-flex gap-2 mb-2">
          <button type="button" className="btn btn-brand btn-sm d-inline-flex align-items-center gap-1" disabled={!hayCambios || guardando} onClick={guardar}>
            <FiSave /> {guardando ? "Guardando..." : "Guardar como estimación"}
          </button>
          {hayCambios && (
            <button type="button" className="btn btn-link btn-sm text-secondary" onClick={() => setCambios({})}>
              Descartar cambios
            </button>
          )}
        </div>
      )}
      <div className="table-responsive" style={{ maxHeight: "60vh" }}>
        <table className="table table-sm table-bordered align-middle mb-0 text-center" style={{ fontSize: "0.82rem" }}>
          <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 2 }}>
            <tr>
              <th>Semana</th>
              {datos.fincas.map((f) => (
                <th key={f.uuid}>{f.nombre}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {datos.semanas.map((s, i) => {
              const iniciada = s.fechaInicio <= hoy;
              return (
                <tr key={s.codigo}>
                  <td className="text-nowrap">{s.codigo}</td>
                  {datos.fincas.map((f) => {
                    const k = `${f.uuid}|${s.codigo}`;
                    return (
                      <td key={f.uuid} style={{ padding: 2 }}>
                        {puedeEditar && !iniciada ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            className="form-control form-control-sm text-center border-0"
                            style={{ background: k in cambios ? "#fff7ed" : "transparent", fontSize: "0.82rem" }}
                            value={valor(f.uuid, s.codigo)}
                            onChange={(e) => setCambios((prev) => ({ ...prev, [k]: e.target.value }))}
                            onPaste={(e) => pegar(e, f.uuid, i)}
                          />
                        ) : (
                          <span className="text-secondary">{fmt(valor(f.uuid, s.codigo))}</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="fw-semibold">{fmt(totales.porSemana[s.codigo] || 0)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="table-light" style={{ position: "sticky", bottom: 0 }}>
            <tr className="fw-bold">
              <td>Total</td>
              {datos.fincas.map((f) => (
                <td key={f.uuid}>{fmt(totales.porFinca[f.uuid] || 0)}</td>
              ))}
              <td>{fmt(totales.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
