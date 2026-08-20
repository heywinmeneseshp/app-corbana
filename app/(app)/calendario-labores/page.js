"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import CalendarToolbar from "@/components/calendario-labores/CalendarToolbar";
import WeekRangeSelector from "@/components/calendario-labores/WeekRangeSelector";
import CalendarFilters, { FILTROS_VACIOS, contarFiltrosActivos } from "@/components/calendario-labores/CalendarFilters";
import CalendarLegend from "@/components/calendario-labores/CalendarLegend";
import WeekHeader from "@/components/calendario-labores/WeekHeader";
import LotRow from "@/components/calendario-labores/LotRow";
import CreateLaborDialog from "@/components/calendario-labores/CreateLaborDialog";
import EditLaborDialog from "@/components/calendario-labores/EditLaborDialog";
import { agruparPorSemanaYLote } from "@/lib/laborCalendarBuilder";
import VistaCalendarioRBC from "./VistaCalendarioRBC";

const VISTAS = [
  { value: "anual", label: "Anual por semanas" },
  { value: "semanal", label: "Semanal" },
  { value: "diaria", label: "Diaria" },
];

function fechaISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function horaHHmm(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function CalendarioLaboresPage() {
  const [fincas, setFincas] = useState([]);
  const [fincaUuid, setFincaUuid] = useState("");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [vista, setVista] = useState("anual");
  const [fechaFoco, setFechaFoco] = useState(new Date());
  const [rangoSemanas, setRangoSemanas] = useState({ desde: 1, hasta: 53 });

  const [semanas, setSemanas] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [ocurrencias, setOcurrencias] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [labores, setLabores] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [crearPrefill, setCrearPrefill] = useState(null); // { fechaInicio, loteUuid, hora } | null
  const [ocurrenciaSeleccionada, setOcurrenciaSeleccionada] = useState(null);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);

  useEffect(() => {
    (async () => {
      try {
        const [{ items: fincasData }, { items: categoriasData }, { items: laboresData }] = await Promise.all([
          apiFetch("/fincas?limit=100&soloOperativas=true"),
          apiFetch("/categorias-labor?limit=100"),
          apiFetch("/labores?limit=100"),
        ]);
        setFincas(fincasData);
        setCategorias(categoriasData);
        setLabores(laboresData);
        if (fincasData.length > 0) setFincaUuid((prev) => prev || fincasData[0].uuid);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!fincaUuid) return;
    apiFetch(`/fincas/${fincaUuid}/lotes?limit=100&incluirGrupo=true`)
      .then(({ items }) => setLotes(items))
      .catch((err) => setError(err.message));
  }, [fincaUuid]);

  useEffect(() => {
    apiFetch(`/semanas?anio=${anio}&limit=100`)
      .then(({ items }) => setSemanas(items.slice().sort((a, b) => a.numeroSemana - b.numeroSemana)))
      .catch((err) => setError(err.message));
  }, [anio]);

  // Rango de semanas visibles por defecto: desde la semana que contiene hoy
  // (o S01 si el año no es el actual) hasta la última semana generada. Se
  // recalcula cada vez que cambian las semanas del año (ej. al navegar).
  useEffect(() => {
    if (semanas.length === 0) return;
    const hoyIso = fechaISO(new Date());
    const semanaActual = semanas.find((s) => hoyIso >= s.fechaInicio && hoyIso <= s.fechaFin);
    const desde = semanaActual ? semanaActual.numeroSemana : semanas[0].numeroSemana;
    const hasta = semanas[semanas.length - 1].numeroSemana;
    setRangoSemanas({ desde, hasta });
  }, [semanas]);

  async function cargarOcurrencias() {
    if (!fincaUuid) return;
    setLoading(true);
    setError("");
    try {
      const { items } = await apiFetch(`/labor-ocurrencias?fincaUuid=${fincaUuid}&anio=${anio}`);
      setOcurrencias(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarOcurrencias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fincaUuid, anio]);

  // Si cambia el año seleccionado, la fecha de foco de las vistas Semanal y
  // Diaria se reubica dentro de ese año.
  useEffect(() => {
    if (fechaFoco.getFullYear() !== anio) {
      setFechaFoco(new Date(anio, 0, 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio]);

  const ocurrenciasFiltradas = useMemo(() => {
    const hoyIso = fechaISO(new Date());
    return ocurrencias.filter((oc) => {
      if (filtros.loteUuids.length && !filtros.loteUuids.includes(oc.lote?.uuid)) return false;
      if (filtros.categoriaUuids.length && !filtros.categoriaUuids.includes(oc.labor?.categoria?.uuid)) return false;
      if (filtros.laborUuids.length && !filtros.laborUuids.includes(oc.labor?.uuid)) return false;
      if (filtros.estado === "VENCIDA") return oc.estado === "PROGRAMADA" && oc.fecha < hoyIso;
      if (filtros.estado === "PROGRAMADA") return oc.estado === "PROGRAMADA" && oc.fecha >= hoyIso;
      if (filtros.estado !== "TODAS" && oc.estado !== filtros.estado) return false;
      return true;
    });
  }, [ocurrencias, filtros]);

  const semanasVisibles = useMemo(
    () => semanas.filter((s) => s.numeroSemana >= rangoSemanas.desde && s.numeroSemana <= rangoSemanas.hasta),
    [semanas, rangoSemanas],
  );

  const mapaCeldas = useMemo(
    () => agruparPorSemanaYLote(ocurrenciasFiltradas, semanasVisibles),
    [ocurrenciasFiltradas, semanasVisibles],
  );

  // La leyenda solo muestra las labores que efectivamente están en pantalla
  // (ya filtradas), no todo el maestro — así el color siempre significa algo
  // visible.
  const laboresEnPantalla = useMemo(() => {
    const porUuid = new Map();
    for (const oc of ocurrenciasFiltradas) {
      if (oc.labor && !porUuid.has(oc.labor.uuid)) porUuid.set(oc.labor.uuid, oc.labor);
    }
    return [...porUuid.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [ocurrenciasFiltradas]);

  const puedeCrear = hasPermission("labor_programacion.crear");
  const puedeEditar = hasPermission("labor_programacion.editar");

  // Arrastrar/redimensionar siempre edita SOLO esa ocurrencia puntual
  // (alcance=ESTA) — igual que editarla a mano desde el diálogo con "Solo
  // este evento" — nunca mueve el resto de la serie.
  async function moverOcurrencia(resource, start, end) {
    const body = { alcance: "ESTA", fecha: fechaISO(start) };
    if (resource.hora) {
      body.hora = horaHHmm(start);
      body.duracionMinutos = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
    }
    try {
      await apiFetch(`/labor-ocurrencias/${resource.uuid}`, { method: "PUT", body: JSON.stringify(body) });
      cargarOcurrencias();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleNavigate(nuevaFecha) {
    setFechaFoco(nuevaFecha);
    const nuevoAnio = nuevaFecha.getFullYear();
    if (nuevoAnio !== anio) setAnio(nuevoAnio);
  }

  function handleSelectSlot(slotInfo) {
    if (!puedeCrear) return;
    setCrearPrefill({
      fechaInicio: fechaISO(slotInfo.start),
      loteUuid: lotes[0]?.uuid || "",
      hora: vista === "diaria" || vista === "semanal" ? horaHHmm(slotInfo.start) : "",
    });
  }

  return (
    <RequirePermission code="menu.labores.calendario">
      <div className="p-4 p-md-5">
        <div className="mb-3">
          <h1 className="fw-bold h3 mb-1">Calendario de Labores</h1>
          <p className="text-secondary mb-0">Programa labores puntuales o recurrentes por lote.</p>
        </div>

        <div className="mb-3">
          <CalendarToolbar
            fincas={fincas}
            fincaUuid={fincaUuid}
            onFincaChange={setFincaUuid}
            anio={anio}
            onAnioChange={setAnio}
            puedeCrear={puedeCrear}
            onNuevaLabor={() => setCrearPrefill({ fechaInicio: fechaISO(new Date()), loteUuid: lotes[0]?.uuid || "", hora: "" })}
            onAbrirFiltros={() => setFiltrosAbiertos(true)}
            filtrosActivos={contarFiltrosActivos(filtros)}
          />
        </div>

        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-2">
          <div className="btn-group" role="group">
            {VISTAS.map((v) => (
              <button
                key={v.value}
                type="button"
                className={`btn btn-sm ${vista === v.value ? "btn-brand" : "btn-outline-secondary"}`}
                onClick={() => setVista(v.value)}
              >
                {v.label}
              </button>
            ))}
          </div>

          {vista === "anual" && (
            <div className="d-flex flex-wrap align-items-center gap-2">
              <WeekRangeSelector semanas={semanas} desde={rangoSemanas.desde} hasta={rangoSemanas.hasta} onChange={setRangoSemanas} />
            </div>
          )}
        </div>

        <div className="mb-3">
          <CalendarLegend labores={laboresEnPantalla} />
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        {!fincaUuid && <div className="alert alert-warning py-2 small">No hay fincas disponibles.</div>}

        {fincaUuid && vista === "anual" && semanas.length === 0 && !loading && (
          <div className="alert alert-warning py-2 small">
            No hay semanas generadas para {anio}. Ve a Maestros → Semanas para generarlas primero.
          </div>
        )}

        {fincaUuid && vista === "anual" && semanas.length > 0 && (
          <div className="border rounded-4 overflow-hidden bg-white">
            <div className="table-responsive">
              <table className="table mb-0 align-middle" style={{ minWidth: semanasVisibles.length * 140 + 160 }}>
                <WeekHeader semanas={semanasVisibles} />
                <tbody>
                  {lotes.map((lote) => (
                    <LotRow
                      key={lote.uuid}
                      lote={lote}
                      semanas={semanasVisibles}
                      mapaCeldas={mapaCeldas}
                      puedeCrear={puedeCrear}
                      onEmptyClick={(semana, loteFila) =>
                        setCrearPrefill({ fechaInicio: semana.fechaInicio, loteUuid: loteFila.uuid, hora: "" })
                      }
                      onLaborClick={setOcurrenciaSeleccionada}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {fincaUuid && (vista === "semanal" || vista === "diaria") && (
          <VistaCalendarioRBC
            vista={vista}
            ocurrencias={ocurrenciasFiltradas}
            fechaFoco={fechaFoco}
            onNavigate={handleNavigate}
            puedeCrear={puedeCrear}
            puedeEditar={puedeEditar}
            onSelectSlot={handleSelectSlot}
            onSelectEvent={setOcurrenciaSeleccionada}
            onMoverOcurrencia={moverOcurrencia}
            semanas={semanas}
          />
        )}

        {crearPrefill && (
          <CreateLaborDialog
            fincas={fincas}
            fincaInicialUuid={fincaUuid}
            labores={labores}
            categorias={categorias}
            fechaInicial={crearPrefill.fechaInicio}
            loteInicialUuid={crearPrefill.loteUuid}
            horaInicial={crearPrefill.hora}
            onClose={() => setCrearPrefill(null)}
            onLaborCreada={(nuevaLabor) =>
              setLabores((prev) => [...prev, nuevaLabor].sort((a, b) => a.nombre.localeCompare(b.nombre)))
            }
            onCategoriaCreada={(nuevaCategoria) =>
              setCategorias((prev) => [...prev, nuevaCategoria].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre)))
            }
            onCreated={() => {
              setCrearPrefill(null);
              cargarOcurrencias();
            }}
          />
        )}

        {ocurrenciaSeleccionada && (
          <EditLaborDialog
            ocurrencia={ocurrenciaSeleccionada}
            onClose={() => setOcurrenciaSeleccionada(null)}
            onChanged={() => {
              setOcurrenciaSeleccionada(null);
              cargarOcurrencias();
            }}
          />
        )}

        {filtrosAbiertos && (
          <CalendarFilters
            lotes={lotes}
            categorias={categorias}
            labores={labores}
            filtros={filtros}
            onChange={setFiltros}
            onClose={() => setFiltrosAbiertos(false)}
          />
        )}
      </div>
    </RequirePermission>
  );
}
