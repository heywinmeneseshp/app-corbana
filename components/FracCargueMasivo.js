"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { FiDownload, FiUploadCloud } from "react-icons/fi";
import { apiFetch, apiUpload } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import ModalShell from "@/components/ModalShell";

const lista = (r) => (Array.isArray(r) ? r : r?.data || []);

// Descarga masiva y cargue masivo (crea y actualiza) del catálogo FRAC: una fila por grupo químico con su código
// y las reglas de uso del código. El mismo archivo descargado se puede editar y volver a subir.
export default function FracCargueMasivo({ onCambio }) {
  const [abierto, setAbierto] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);

  async function descargar() {
    setExportando(true);
    try {
      const [c, g] = await Promise.all([apiFetch("/frac-limites"), apiFetch("/frac-limites/grupos")]);
      const codigos = lista(c);
      const grupos = lista(g);
      const reglas = (f) => ({
        modo_accion: f.modoAccion || "",
        max_aplicaciones: f.maxAplicaciones ?? "",
        max_porcentaje: f.maxPorcentaje ?? "",
        max_consecutivas: f.maxConsecutivas ?? "",
        intervalo_minimo_dias: f.intervaloMinimoDias ?? "",
        solo_en_mezclas: f.soloEnMezclas ? "si" : "no",
        restricciones: f.restricciones || "",
      });
      const filas = [];
      for (const f of codigos) {
        const delCodigo = grupos.filter((x) => x.fracCodigo === f.fracCodigo);
        if (delCodigo.length === 0) filas.push({ frac: f.fracCodigo, grupo_quimico: "", ...reglas(f) });
        for (const x of delCodigo) filas.push({ frac: f.fracCodigo, grupo_quimico: x.nombre, ...reglas(f) });
      }
      const ws = XLSX.utils.json_to_sheet(filas);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "FRAC");
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const url = URL.createObjectURL(new Blob([buffer], { type: "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "frac_codigos_grupos_reglas.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      window.alert(err.message);
    } finally {
      setExportando(false);
    }
  }

  async function subir() {
    if (!archivo) return;
    setCargando(true);
    setError("");
    try {
      setResultado(await apiUpload("/frac-limites/bulk-upload", archivo));
      onCambio?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  const puedeEditar = hasPermission("ingrediente_activo.editar");

  return (
    <>
      <div className="d-flex gap-2">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary rounded-3 d-flex align-items-center gap-2"
          onClick={descargar}
          disabled={exportando}
          title="Descargar códigos, grupos químicos y reglas de uso en Excel"
        >
          <FiDownload /> {exportando ? "Generando..." : "Descargar Excel"}
        </button>
        {puedeEditar && (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary rounded-3 d-flex align-items-center gap-2"
            onClick={() => {
              setAbierto(true);
              setArchivo(null);
              setResultado(null);
              setError("");
            }}
            title="Cargar o actualizar códigos, grupos y reglas desde Excel/CSV"
          >
            <FiUploadCloud /> Cargue masivo
          </button>
        )}
      </div>

      {abierto && (
        <ModalShell title="Cargue masivo de FRAC" onClose={() => setAbierto(false)} width="40rem" height="auto">
          <p className="small text-secondary mb-3">
            Sube un .xlsx o .csv con las columnas <strong>frac</strong> (obligatoria), <strong>grupo_quimico</strong>, <strong>modo_accion</strong>,{" "}
            <strong>max_aplicaciones</strong>, <strong>max_porcentaje</strong>, <strong>max_consecutivas</strong>, <strong>intervalo_minimo_dias</strong>,{" "}
            <strong>solo_en_mezclas</strong> (si/no) y <strong>restricciones</strong>. Lo que ya existe se actualiza y lo nuevo se crea; una celda vacía no
            borra el dato actual. Lo más fácil: &quot;Descargar Excel&quot;, editarlo y volver a subirlo.
          </p>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="form-control rounded-3 mb-3"
            onChange={(e) => {
              setArchivo(e.target.files?.[0] || null);
              setResultado(null);
              setError("");
            }}
          />
          {error && <div className="alert alert-danger py-2 small">{error}</div>}
          {resultado && (
            <div className="alert alert-success py-2 small">
              Cargue terminado — códigos creados: {resultado.codigosCreados}, actualizados: {resultado.codigosActualizados}; grupos creados:{" "}
              {resultado.gruposCreados}, ya existentes: {resultado.gruposActualizados}
              {resultado.errores?.length > 0 && (
                <>
                  <div className="mt-2 fw-medium" style={{ color: "#b45309" }}>
                    {resultado.errores.length} fila(s) con error:
                  </div>
                  <ul className="mb-0 ps-3">
                    {resultado.errores.map((e, i) => (
                      <li key={i}>
                        Fila {e.fila}: {e.mensaje}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
          <div className="d-flex justify-content-end gap-2 mt-3">
            <button type="button" className="btn btn-sm btn-outline-secondary rounded-3" onClick={() => setAbierto(false)}>
              Cerrar
            </button>
            <button type="button" className="btn btn-brand btn-brand-verde btn-sm rounded-3" disabled={!archivo || cargando} onClick={subir}>
              {cargando ? "Subiendo..." : "Subir archivo"}
            </button>
          </div>
        </ModalShell>
      )}
    </>
  );
}
