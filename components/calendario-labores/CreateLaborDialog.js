"use client";

import { useEffect, useRef, useState } from "react";
import { FiPlus, FiX } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import ModalShell from "@/components/ModalShell";
import CreateLaborQuickModal from "./CreateLaborQuickModal";

const FRECUENCIAS = [
  { value: "DIARIA", label: "Diaria" },
  { value: "SEMANAL", label: "Semanal" },
  { value: "MENSUAL", label: "Mensual" },
  { value: "ANUAL", label: "Anual" },
];

// Diálogo de creación de una programación (labor puntual o recurrente, con
// 1 o varios lotes). Misma lógica que el resto del módulo: POST /labor-series.
export default function CreateLaborDialog({
  fincas,
  fincaInicialUuid,
  labores,
  categorias,
  fechaInicial,
  loteInicialUuid,
  horaInicial,
  onClose,
  onCreated,
  onLaborCreada,
  onCategoriaCreada,
}) {
  const [fincaUuid, setFincaUuid] = useState(fincaInicialUuid);
  const [lotesFinca, setLotesFinca] = useState([]);
  const esPrimeraCargaLotes = useRef(true);

  const [laborUuid, setLaborUuid] = useState(labores[0]?.uuid || "");
  const [crearLaborAbierto, setCrearLaborAbierto] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(fechaInicial);
  const [hora, setHora] = useState(horaInicial || "");
  const [duracionMinutos, setDuracionMinutos] = useState("");
  const [numeroColaboradores, setNumeroColaboradores] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [esRecurrente, setEsRecurrente] = useState(false);
  const [modoLotes, setModoLotes] = useState("UNICO");
  const [loteUuid, setLoteUuid] = useState(loteInicialUuid);
  const [loteUuidsSeleccion, setLoteUuidsSeleccion] = useState(loteInicialUuid ? [loteInicialUuid] : []);
  const [loteParaAgregar, setLoteParaAgregar] = useState("");

  const [frecuencia, setFrecuencia] = useState("SEMANAL");
  const [intervalo, setIntervalo] = useState(1);
  const [terminaEn, setTerminaEn] = useState("nunca"); // nunca | fecha | repeticiones
  const [fechaFin, setFechaFin] = useState("");
  const [numRepeticiones, setNumRepeticiones] = useState(4);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Al cambiar de finca (incluida la carga inicial) se traen sus lotes. Si
  // el cambio lo hizo el usuario a mitad del formulario, los lotes ya
  // elegidos pueden no pertenecer a la finca nueva, así que se limpian.
  useEffect(() => {
    if (!fincaUuid) return;
    apiFetch(`/fincas/${fincaUuid}/lotes?limit=100&incluirGrupo=true`)
      .then(({ items }) => {
        setLotesFinca(items);
        if (!esPrimeraCargaLotes.current) {
          setLoteUuid(items[0]?.uuid || "");
          setLoteUuidsSeleccion([]);
        }
        esPrimeraCargaLotes.current = false;
      })
      .catch((err) => setFormError(err.message));
  }, [fincaUuid]);

  function toggleRecurrente(valor) {
    setEsRecurrente(valor);
    if (!valor) setModoLotes("UNICO");
  }

  function agregarLote() {
    if (!loteParaAgregar || loteUuidsSeleccion.includes(loteParaAgregar)) return;
    setLoteUuidsSeleccion((prev) => [...prev, loteParaAgregar]);
    setLoteParaAgregar("");
  }

  function quitarLote(uuid) {
    setLoteUuidsSeleccion((prev) => prev.filter((u) => u !== uuid));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");

    if (modoLotes !== "UNICO" && loteUuidsSeleccion.length < 2) {
      setFormError("Selecciona al menos 2 lotes para este modo.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        laborUuid,
        fincaUuid,
        modoLotes,
        fechaInicio,
        esRecurrente,
      };
      if (modoLotes === "UNICO") body.loteUuid = loteUuid;
      else body.loteUuids = loteUuidsSeleccion;
      if (hora) body.hora = hora;
      if (duracionMinutos !== "") body.duracionMinutos = Number(duracionMinutos);
      if (numeroColaboradores !== "") body.numeroColaboradores = Number(numeroColaboradores);
      if (observaciones) body.observaciones = observaciones;
      if (esRecurrente) {
        body.frecuencia = frecuencia;
        body.intervalo = Number(intervalo) || 1;
        if (terminaEn === "fecha") body.fechaFin = fechaFin;
        if (terminaEn === "repeticiones") body.numRepeticiones = Number(numRepeticiones);
      }

      await apiFetch("/labor-series", { method: "POST", body: JSON.stringify(body) });
      onCreated();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const lotesDisponiblesParaAgregar = lotesFinca.filter((l) => !loteUuidsSeleccion.includes(l.uuid));

  return (
    <ModalShell title="Nueva labor" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label small fw-medium">
            Finca <span className="text-danger">*</span>
          </label>
          <select className="form-select rounded-3" required value={fincaUuid} onChange={(e) => setFincaUuid(e.target.value)}>
            {fincas.map((f) => (
              <option key={f.uuid} value={f.uuid}>
                {f.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <div className="d-flex align-items-center justify-content-between">
            <label className="form-label small fw-medium mb-0">
              Labor <span className="text-danger">*</span>
            </label>
            {hasPermission("labor.crear") && (
              <button
                type="button"
                className="btn btn-sm btn-link p-0 text-decoration-none d-flex align-items-center gap-1"
                onClick={() => setCrearLaborAbierto(true)}
              >
                <FiPlus size={12} /> Nueva labor
              </button>
            )}
          </div>
          <select className="form-select rounded-3 mt-1" required value={laborUuid} onChange={(e) => setLaborUuid(e.target.value)}>
            {labores.map((l) => (
              <option key={l.uuid} value={l.uuid}>
                {l.categoria ? `${l.categoria.nombre} — ${l.nombre}` : l.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-6">
            <label className="form-label small fw-medium">
              Fecha inicio <span className="text-danger">*</span>
            </label>
            <input
              type="date"
              className="form-control rounded-3"
              required
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
            />
          </div>
          <div className="col-3">
            <label className="form-label small fw-medium">Hora</label>
            <input type="time" className="form-control rounded-3" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
          <div className="col-3">
            <label className="form-label small fw-medium">Duración (min)</label>
            <input
              type="number"
              min={1}
              className="form-control rounded-3"
              value={duracionMinutos}
              onChange={(e) => setDuracionMinutos(e.target.value)}
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label small fw-medium">Número de colaboradores</label>
          <input
            type="number"
            min={1}
            className="form-control rounded-3"
            value={numeroColaboradores}
            onChange={(e) => setNumeroColaboradores(e.target.value)}
            placeholder="Cuántos colaboradores hacen falta"
          />
        </div>

        <div className="mb-3">
          <label className="form-label small fw-medium">Observaciones</label>
          <textarea
            className="form-control rounded-3"
            rows={2}
            maxLength={500}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
          />
        </div>

        <div className="form-check mb-3">
          <input
            type="checkbox"
            className="form-check-input"
            id="es-recurrente"
            checked={esRecurrente}
            onChange={(e) => toggleRecurrente(e.target.checked)}
          />
          <label className="form-check-label small fw-medium" htmlFor="es-recurrente">
            ¿Se repite?
          </label>
        </div>

        {esRecurrente && (
          <div className="border rounded-3 p-3 mb-3 bg-light">
            <div className="row g-3 mb-2">
              <div className="col-6">
                <label className="form-label small fw-medium">Frecuencia</label>
                <select className="form-select rounded-3" value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)}>
                  {FRECUENCIAS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-6">
                <label className="form-label small fw-medium">Cada</label>
                <div className="input-group">
                  <input
                    type="number"
                    min={1}
                    className="form-control rounded-start-3"
                    value={intervalo}
                    onChange={(e) => setIntervalo(e.target.value)}
                  />
                  <span className="input-group-text">
                    {frecuencia === "DIARIA" && "día(s)"}
                    {frecuencia === "SEMANAL" && "semana(s)"}
                    {frecuencia === "MENSUAL" && "mes(es)"}
                    {frecuencia === "ANUAL" && "año(s)"}
                  </span>
                </div>
              </div>
            </div>

            <label className="form-label small fw-medium d-block">Termina</label>
            <div className="d-flex flex-column gap-2 mb-3">
              <div className="form-check">
                <input
                  type="radio"
                  className="form-check-input"
                  id="termina-nunca"
                  checked={terminaEn === "nunca"}
                  onChange={() => setTerminaEn("nunca")}
                />
                <label className="form-check-label small" htmlFor="termina-nunca">
                  Nunca
                </label>
              </div>
              <div className="form-check d-flex align-items-center gap-2">
                <input
                  type="radio"
                  className="form-check-input"
                  id="termina-fecha"
                  checked={terminaEn === "fecha"}
                  onChange={() => setTerminaEn("fecha")}
                />
                <label className="form-check-label small" htmlFor="termina-fecha">
                  En fecha
                </label>
                <input
                  type="date"
                  className="form-control form-control-sm rounded-3"
                  style={{ maxWidth: 160 }}
                  disabled={terminaEn !== "fecha"}
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  required={terminaEn === "fecha"}
                />
              </div>
              <div className="form-check d-flex align-items-center gap-2">
                <input
                  type="radio"
                  className="form-check-input"
                  id="termina-repeticiones"
                  checked={terminaEn === "repeticiones"}
                  onChange={() => setTerminaEn("repeticiones")}
                />
                <label className="form-check-label small" htmlFor="termina-repeticiones">
                  Después de
                </label>
                <input
                  type="number"
                  min={1}
                  className="form-control form-control-sm rounded-3"
                  style={{ maxWidth: 90 }}
                  disabled={terminaEn !== "repeticiones"}
                  value={numRepeticiones}
                  onChange={(e) => setNumRepeticiones(e.target.value)}
                  required={terminaEn === "repeticiones"}
                />
                <span className="small">repeticiones</span>
              </div>
            </div>

            <label className="form-label small fw-medium d-block">Lotes</label>
            <div className="d-flex flex-column gap-2 mb-2">
              <div className="form-check">
                <input
                  type="radio"
                  className="form-check-input"
                  id="modo-unico"
                  checked={modoLotes === "UNICO"}
                  onChange={() => setModoLotes("UNICO")}
                />
                <label className="form-check-label small" htmlFor="modo-unico">
                  Un solo lote
                </label>
              </div>
              <div className="form-check">
                <input
                  type="radio"
                  className="form-check-input"
                  id="modo-rotacion"
                  checked={modoLotes === "ROTACION"}
                  onChange={() => setModoLotes("ROTACION")}
                />
                <label className="form-check-label small" htmlFor="modo-rotacion">
                  Rotar entre varios lotes (cada ocurrencia cae en el siguiente lote de la lista)
                </label>
              </div>
              <div className="form-check">
                <input
                  type="radio"
                  className="form-check-input"
                  id="modo-simultaneo"
                  checked={modoLotes === "SIMULTANEO"}
                  onChange={() => setModoLotes("SIMULTANEO")}
                />
                <label className="form-check-label small" htmlFor="modo-simultaneo">
                  Varios lotes, todos juntos (misma fecha, un registro por cada lote)
                </label>
              </div>
            </div>

            {modoLotes !== "UNICO" && (
              <div>
                <div className="d-flex gap-2 mb-2">
                  <select
                    className="form-select form-select-sm rounded-3"
                    value={loteParaAgregar}
                    onChange={(e) => setLoteParaAgregar(e.target.value)}
                  >
                    <option value="">Agregar lote...</option>
                    {lotesDisponiblesParaAgregar.map((l) => (
                      <option key={l.uuid} value={l.uuid}>
                        {l.nombre}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={agregarLote}>
                    Agregar
                  </button>
                </div>
                <ol className="small mb-0 ps-3">
                  {loteUuidsSeleccion.map((uuid) => {
                    const lote = lotesFinca.find((l) => l.uuid === uuid);
                    return (
                      <li key={uuid} className="d-flex align-items-center gap-2">
                        {lote?.nombre || uuid}
                        <button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={() => quitarLote(uuid)}>
                          <FiX />
                        </button>
                      </li>
                    );
                  })}
                </ol>
                {modoLotes === "ROTACION" && (
                  <p className="small text-secondary mt-2 mb-0">
                    Ejemplo: ocurrencia 1 → {lotesFinca.find((l) => l.uuid === loteUuidsSeleccion[0])?.nombre || "?"}, ocurrencia 2 →{" "}
                    {lotesFinca.find((l) => l.uuid === loteUuidsSeleccion[1])?.nombre || "?"}, ...
                  </p>
                )}
                {modoLotes === "SIMULTANEO" && (
                  <p className="small text-secondary mt-2 mb-0">
                    Cada vez que se repita la labor se creará un registro por cada uno de los {loteUuidsSeleccion.length} lotes, el
                    mismo día.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {modoLotes === "UNICO" && (
          <div className="mb-3">
            <label className="form-label small fw-medium">
              Lote <span className="text-danger">*</span>
            </label>
            <select className="form-select rounded-3" required value={loteUuid} onChange={(e) => setLoteUuid(e.target.value)}>
              {lotesFinca.map((l) => (
                <option key={l.uuid} value={l.uuid}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

        <div className="d-flex justify-content-end gap-2">
          <button type="button" className="btn btn-outline-secondary rounded-3" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-brand rounded-3" disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>

      {crearLaborAbierto && (
        <CreateLaborQuickModal
          categorias={categorias}
          onClose={() => setCrearLaborAbierto(false)}
          onCreated={(nuevaLabor) => {
            onLaborCreada(nuevaLabor);
            setLaborUuid(nuevaLabor.uuid);
            setCrearLaborAbierto(false);
          }}
          onCategoriaCreada={onCategoriaCreada}
        />
      )}
    </ModalShell>
  );
}
