"use client";

import { useEffect, useState } from "react";
import { FiAlertTriangle, FiCheckCircle, FiCalendar, FiTrendingDown, FiTrendingUp, FiSend, FiX } from "react-icons/fi";
import BotonConfiguracion from "@/components/BotonConfiguracion";
import { apiFetch } from "@/lib/api";
import { esAdministrador } from "@/lib/laborEstados";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";
import TagPicker from "@/components/TagPicker";

const ESTILO_MOTIVO = {
  yli_bajo: { color: "#b45309", fondo: "#fffbeb", borde: "#fde68a", icono: <FiTrendingDown size={14} /> },
  indice_alto: { color: "#be123c", fondo: "#fff1f2", borde: "#fecdd3", icono: <FiTrendingUp size={14} /> },
  sb_h3_alto: { color: "#be123c", fondo: "#fff1f2", borde: "#fecdd3", icono: <FiTrendingUp size={14} /> },
  sb_h5_alto: { color: "#be123c", fondo: "#fff1f2", borde: "#fecdd3", icono: <FiTrendingUp size={14} /> },
};

export default function SanidadAlertasPage() {
  const [semanas, setSemanas] = useState([]);
  const [semanaUuid, setSemanaUuid] = useState(""); // "" = por defecto, la semana anterior a la actual (la resuelve el backend)
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalConfig, setModalConfig] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [avisoEnvio, setAvisoEnvio] = useState("");
  const [pestana, setPestana] = useState("indicadores"); // "indicadores" | "aspersiones"
  const [alertasFrac, setAlertasFrac] = useState(null);
  const [detalleFrac, setDetalleFrac] = useState(null); // alerta FRAC abierta para ver el detalle
  const esAdmin = esAdministrador();

  useEffect(() => {
    apiFetch("/frac-limites/alertas")
      .then((res) => setAlertasFrac(Array.isArray(res) ? res : res?.data || []))
      .catch(() => setAlertasFrac([]));
  }, []);

  async function handleEnviarAhora() {
    if (!data?.semana) return;
    setEnviando(true);
    setAvisoEnvio("");
    try {
      const res = await apiFetch("/evaluaciones/alertas-semana/enviar", {
        method: "POST",
        body: JSON.stringify({ semanaUuid: data.semana.uuid }),
      });
      setAvisoEnvio(res.message);
    } catch (err) {
      setAvisoEnvio(err.message);
    } finally {
      setEnviando(false);
    }
  }

  useEffect(() => {
    const hoyIso = new Date().toISOString().slice(0, 10);
    apiFetch("/semanas?limit=100")
      .then((res) =>
        setSemanas(
          (res.items || [])
            .filter((s) => s.fechaInicio <= hoyIso) // no mostrar semanas futuras; la semana en curso sí se puede elegir
            .sort((a, b) => a.anio - b.anio || a.numeroSemana - b.numeroSemana),
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (semanaUuid) params.set("semanaUuid", semanaUuid);
    apiFetch(`/evaluaciones/alertas-semana${params.toString() ? `?${params.toString()}` : ""}`)
      .then((res) => {
        if (cancelado) return;
        setData(res);
        // Una vez que el backend resuelve la semana por defecto, se refleja
        // en el select para que el usuario vea cuál está viendo.
        if (!semanaUuid && res.semana) setSemanaUuid(res.semana.uuid);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelado) return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [semanaUuid]);

  return (
    <RequirePermission code="menu.sanidad_vegetal.alertas">
      <div className="p-3 p-md-4">
        <div className="d-flex align-items-center gap-2 mb-1">
          <FiAlertTriangle size={20} className="text-secondary" />
          <h1 className="fw-bold h4 mb-0">Alertas de Sanidad Vegetal</h1>
        </div>
        <p className="text-secondary small mb-3" style={{ minHeight: "2.6rem" }}>
          {pestana === "indicadores"
            ? "Fincas con YLI por debajo de 8, Índice de Infección por encima de 33% o Suma Bruta por Hoja por encima del umbral configurado (ver Gráficos → Suma Bruta), en la semana seleccionada."
            : "Fincas que incumplen las reglas FRAC de manejo de resistencia (máximo de aplicaciones, %, consecutivas, intervalo y uso en mezcla) en los últimos 12 meses."}
        </p>

        {avisoEnvio && (
          <div className="small text-info-emphasis d-flex align-items-center justify-content-between mb-2">
            {avisoEnvio}
            <button type="button" className="btn btn-sm btn-link p-0 text-secondary" onClick={() => setAvisoEnvio("")}>
              <FiX />
            </button>
          </div>
        )}

        {modalConfig && <ModalConfigDestinatarios onClose={() => setModalConfig(false)} />}

        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3 pb-2 border-bottom">
          <ul className="nav nav-pills gap-1">
            {[
              { id: "indicadores", label: "Indicadores", n: data?.alertas?.length },
              { id: "aspersiones", label: "Aspersiones (FRAC)", n: alertasFrac?.length },
            ].map((t) => (
              <li className="nav-item" key={t.id}>
                <button
                  type="button"
                  className={`nav-link btn-sm py-1 px-3 ${pestana === t.id ? "active" : ""}`}
                  onClick={() => setPestana(t.id)}
                >
                  {t.label}
                  {t.n > 0 && <span className="ms-2 fw-semibold">{t.n}</span>}
                </button>
              </li>
            ))}
          </ul>
          <div className="d-flex align-items-center gap-2">
            {/* Los controles de semana/envío se ocultan (no se quitan) en la otra pestaña para que nada se mueva. */}
            <select
                className={`form-select form-select-sm ${pestana === "indicadores" ? "" : "invisible"}`}
                style={{ width: 130 }}
                value={semanaUuid}
                onChange={(e) => setSemanaUuid(e.target.value)}
                title="Semana"
              >
                {semanas.map((sm) => (
                  <option key={sm.uuid} value={sm.uuid}>
                    {sm.codigo}
                  </option>
                ))}
              </select>
            {esAdmin && (
              <button
                type="button"
                className={`btn btn-sm btn-link text-secondary text-decoration-none p-1 d-inline-flex align-items-center gap-1 ${pestana === "indicadores" ? "" : "invisible"}`}
                onClick={handleEnviarAhora}
                disabled={enviando || !data?.semana || pestana !== "indicadores"}
                title="Enviar por correo las alertas de la semana seleccionada, ahora mismo"
              >
                <FiSend size={15} /> {enviando ? "Enviando..." : "Enviar ahora"}
              </button>
            )}
            {esAdmin && (
              <BotonConfiguracion alto={31} onClick={() => setModalConfig(true)} title="Configurar destinatarios del correo de alertas" />
            )}
          </div>
        </div>

        {pestana === "aspersiones" && <AlertasFrac alertas={alertasFrac} onSeleccionar={setDetalleFrac} />}
        {detalleFrac && <DetalleAlertaFrac alerta={detalleFrac} onClose={() => setDetalleFrac(null)} />}

        {pestana === "indicadores" && error && <div className="alert alert-danger py-2 small rounded-3">{error}</div>}

        {pestana === "indicadores" && loading && (
          <div className="d-flex justify-content-center align-items-center py-5 text-secondary">
            <div className="spinner-border spinner-border-sm me-2" role="status"></div>
            <span className="small">Cargando alertas...</span>
          </div>
        )}

        {pestana === "indicadores" && !loading && !error && data && !data.semana && (
          <p className="text-secondary small py-5 text-center mb-0">
            Todavía no hay ninguna semana cerrada para evaluar.
          </p>
        )}

        {pestana === "indicadores" && !loading && !error && data?.semana && (
          <>
            <div className="d-flex align-items-center gap-2 mb-3">
              <span className="badge rounded-pill border bg-light text-dark px-3 py-2 fw-medium">
                <FiCalendar className="me-1" style={{ marginTop: -2 }} />
                Semana evaluada: {data.semana.codigo}
              </span>
              <span className="text-secondary small">
                ({data.semana.fechaInicio} — {data.semana.fechaFin})
              </span>
            </div>

            {data.alertas.length === 0 ? (
              <div className="card border-0 rounded-2 p-5 text-center">
                <FiCheckCircle size={32} className="text-success mx-auto mb-2" />
                <p className="text-secondary mb-0">
                  Ninguna finca superó los umbrales de alerta en la semana {data.semana.codigo}.
                </p>
              </div>
            ) : (
              <div className="row g-3">
                {data.alertas.map((a) => (
                  <div className="col-12 col-md-6 col-xl-4" key={a.fincaUuid}>
                    <div className="card border-0 rounded-2 p-3 h-100">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <h2 className="h6 fw-bold mb-0">{a.fincaNombre}</h2>
                        <span className="badge rounded-pill text-bg-danger">{a.motivos.length} alerta(s)</span>
                      </div>
                      <div className="d-flex flex-wrap gap-3 mb-3 small text-secondary">
                        <span>YLI: <strong className="text-dark">{a.promedioYli ?? "—"}</strong></span>
                        <span>Índice: <strong className="text-dark">{a.promedioIndice != null ? `${a.promedioIndice}%` : "—"}</strong></span>
                        {a.promedioSbH3 != null && (
                          <span>SB H3: <strong className="text-dark">{a.promedioSbH3}</strong></span>
                        )}
                        {a.promedioSbH5 != null && (
                          <span>SB H5: <strong className="text-dark">{a.promedioSbH5}</strong></span>
                        )}
                      </div>
                      <div className="d-flex flex-column gap-2">
                        {a.motivos.map((m) => {
                          const estilo = ESTILO_MOTIVO[m.tipo] || ESTILO_MOTIVO.indice_alto;
                          return (
                            <div
                              key={m.tipo}
                              className="d-flex align-items-center gap-2 rounded-3 px-3 py-2 small fw-medium"
                              style={{ background: estilo.fondo, border: `1px solid ${estilo.borde}`, color: estilo.color }}
                            >
                              {estilo.icono}
                              {m.mensaje}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </RequirePermission>
  );
}

// Fincas que superaron el límite de aplicaciones de un grupo FRAC en los
// últimos 12 meses (los límites se configuran en Sanidad Vegetal → Ingredientes
// Activos → "Límites FRAC"). Independiente de la semana elegida arriba.
function AlertasFrac({ alertas, onSeleccionar }) {
  if (alertas === null) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5 text-secondary">
        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
        <span className="small">Cargando alertas...</span>
      </div>
    );
  }
  if (alertas.length === 0) {
    return (
      <div className="card border-0 rounded-2 p-5 text-center">
        <FiCheckCircle size={32} className="text-success mx-auto mb-2" />
        <p className="text-secondary mb-0">Ninguna finca incumple las reglas FRAC de manejo de resistencia en los últimos 12 meses.</p>
      </div>
    );
  }

  return (
    <div className="card border-0 rounded-2 mb-3 overflow-hidden">
      <div className="px-3 py-2 d-flex align-items-center justify-content-between" style={{ background: "#fef2f2", borderBottom: "1px solid #fecaca" }}>
        <span className="fw-semibold small d-flex align-items-center gap-2" style={{ color: "#b91c1c" }}>
          <FiAlertTriangle /> Reglas FRAC de manejo de resistencia incumplidas (últimos 12 meses)
        </span>
        <span className="badge rounded-pill text-bg-danger">{alertas.length}</span>
      </div>
      <div className="table-responsive">
        <table className="table table-sm align-middle mb-0 small">
          <thead>
            <tr className="text-secondary">
              <th className="fw-medium">Finca</th>
              <th className="fw-medium">Grupo FRAC</th>
              <th className="fw-medium">Ingredientes</th>
              <th className="fw-medium">Regla</th>
              <th className="fw-medium">Detalle</th>
              <th className="fw-medium">Última</th>
            </tr>
          </thead>
          <tbody>
            {alertas.map((a) => (
              <tr key={`${a.fincaId}-${a.fracCodigo}-${a.tipo}`} style={{ cursor: "pointer" }} onClick={() => onSeleccionar(a)} title="Ver el detalle de las aspersiones">
                <td className="fw-medium">{a.fincaNombre}</td>
                <td>
                  <span className="badge bg-success-subtle text-success-emphasis border border-success-subtle">{a.fracCodigo}</span>
                </td>
                <td className="text-secondary">{a.ingredientes || "—"}</td>
                <td className="text-secondary">{a.regla}</td>
                <td className="fw-medium text-danger">{a.detalle}</td>
                <td className="text-secondary">{a.ultimaFecha ? String(a.ultimaFecha).slice(0, 10) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Detalle de una alerta FRAC: todas las aspersiones de la finca en los últimos 12 meses (en orden),
// con las del grupo resaltadas y marcadas las que incumplen la regla — para poder comprobarla.
function DetalleAlertaFrac({ alerta, onClose }) {
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState("");
  const [soloGrupo, setSoloGrupo] = useState(true);

  useEffect(() => {
    const qs = new URLSearchParams({ fincaUuid: alerta.fincaUuid, fracCodigo: alerta.fracCodigo, tipo: alerta.tipo });
    apiFetch(`/frac-limites/alertas/detalle?${qs}`)
      .then((res) => setDetalle(res?.data || res))
      .catch((err) => setError(err.message));
  }, [alerta]);

  const filas = detalle ? detalle.aspersiones.filter((a) => !soloGrupo || a.tieneGrupo) : [];
  const r = detalle?.reglas;

  return (
    <ModalShell title={`${alerta.fincaNombre} — FRAC ${alerta.fracCodigo}`} onClose={onClose} width="90vw" height="90vh">
      <div className="small mb-2">
        <span className="text-secondary">{alerta.regla}:</span> <strong className="text-danger">{alerta.detalle}</strong>
      </div>
      {detalle && (
        <div className="small text-secondary mb-2">
          {detalle.modoAccion}
          {r && (
            <>
              {" · "}Reglas: {r.max != null ? `máx. ${r.max} aplicaciones` : "sin máx. de aplicaciones"}
              {r.maxPct != null ? `, máx. ${r.maxPct}%` : ""}
              {r.maxConsecutivas != null ? `, seguidas máx. ${r.maxConsecutivas}` : ""}
              {r.intervaloDias != null ? `, mínimo ${r.intervaloDias} días entre aplicaciones` : ""}
              {r.soloEnMezclas ? ", solo en mezcla" : ""}
            </>
          )}
          {" · "}
          {detalle.aplicacionesDelGrupo} de {detalle.totalAspersiones} aplicaciones de la finca llevan este grupo (últimos 12 meses). Las partes de un mismo ciclo (una aplicación hecha en varios días) cuentan como una sola aplicación.
        </div>
      )}
      {error && <div className="small text-danger py-2">{error}</div>}
      {!detalle && !error && <div className="small text-secondary py-3">Cargando detalle...</div>}
      {detalle && (
        <>
          <label className="small text-secondary d-flex align-items-center gap-2 mb-2">
            <input type="checkbox" className="form-check-input mt-0" checked={soloGrupo} onChange={(e) => setSoloGrupo(e.target.checked)} />
            Mostrar solo las aspersiones de este grupo
          </label>
          <div className="table-responsive" style={{ maxHeight: "calc(90vh - 15rem)", overflowY: "auto" }}>
            <table className="table table-sm align-middle mb-0 small text-center">
              <thead style={{ position: "sticky", top: 0, background: "#fff" }}>
                <tr className="text-secondary">
                  <th className="fw-medium text-nowrap" style={{ width: "1%" }}>Fecha</th>
                  <th className="fw-medium text-nowrap" style={{ width: "1%" }}>N.°</th>
                  <th className="fw-medium text-nowrap" style={{ width: "1%" }} title="Aplicación (ciclo) a la que pertenece; las partes de un ciclo cuentan como una sola aplicación">Ciclo</th>
                  <th className="fw-medium text-nowrap">Mezcla</th>
                  <th className="fw-medium text-nowrap">Insumos del grupo</th>
                  <th className="fw-medium text-nowrap">Ingredientes</th>
                  <th className="fw-medium text-nowrap" style={{ width: "1%" }}>Otros</th>
                  <th className="fw-medium text-nowrap" style={{ width: "1%" }}>Ha</th>
                  <th className="fw-medium text-nowrap" style={{ width: "1%" }}>Aeronave</th>
                  <th className="fw-medium text-nowrap" style={{ width: "1%" }} title="Días desde la aplicación anterior de este grupo">
                    Días
                  </th>
                  <th className="fw-medium">Incumple</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((a) => (
                  <tr key={a.uuid} style={{ background: a.marca ? "#fef2f2" : a.tieneGrupo ? "#f0fdf4" : undefined, opacity: a.tieneGrupo ? 1 : 0.55 }}>
                    <td className="text-nowrap">{a.fecha}</td>
                    <td className="text-secondary text-nowrap">{a.numero}</td>
                    <td className="text-nowrap" title={a.ciclo ? `Ciclo en varias partes: ${a.ciclo}` : undefined}>
                      {a.cicloN ? `${a.cicloN}${a.cicloParte ? ` (parte ${a.cicloParte})` : ""}` : "—"}
                    </td>
                    <td className="text-nowrap">{a.mezcla}</td>
                    <td className="fw-medium text-nowrap">{a.insumosGrupo || "—"}</td>
                    <td className="text-secondary text-nowrap">{a.ingredientesGrupo || "—"}</td>
                    <td className="text-secondary text-nowrap">{a.otrosGrupos || "—"}</td>
                    <td className="text-nowrap">{Number(a.hectareas).toLocaleString("es-CO")}</td>
                    <td className="text-nowrap" title={a.aeronave || undefined}>
                      {a.medio === "DRON" ? "Dron" : a.medio === "AVION" ? "Avión" : "—"}
                    </td>
                    <td className="text-nowrap">{a.diasDesdeAnterior ?? "—"}</td>
                    <td className="text-danger fw-medium">{a.marca || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </ModalShell>
  );
}

function nombreCompleto(u) {
  return `${u.nombre} ${u.apellido}`.trim();
}

// Configura quién recibe el correo semanal de alertas — correos sueltos,
// roles completos (cualquier usuario con ese rol) y usuarios puntuales,
// igual patrón que "Configurar rol revisor" de Evaluación de Labores
// (ver ReporteLabores.js).
function ModalConfigDestinatarios({ onClose }) {
  const [roles, setRoles] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [correosTexto, setCorreosTexto] = useState("");
  const [rolesSel, setRolesSel] = useState([]);
  const [usuariosSel, setUsuariosSel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch("/roles?limit=100").catch(() => ({ items: [] })),
      apiFetch("/users?limit=100").catch(() => ({ items: [] })),
      apiFetch("/evaluaciones/alertas-destinatarios"),
    ])
      .then(([rolesRes, usuariosRes, destRes]) => {
        const rolesItems = rolesRes.items || [];
        const usuariosItems = usuariosRes.items || [];
        setRoles(rolesItems);
        setUsuarios(usuariosItems);
        setCorreosTexto((destRes.correos || []).join(", "));
        // TagPicker trabaja con objetos { uuid, label, sublabel } — hay que
        // rehidratar los uuids guardados contra la lista completa (mismo
        // patrón que ReporteLabores.js). Guardar los uuids crudos hacía que
        // el PUT mandara objetos y el backend respondiera "Invalid value".
        setRolesSel(
          rolesItems
            .filter((r) => (destRes.rolesUuids || []).includes(r.uuid))
            .map((r) => ({ uuid: r.uuid, label: r.nombre })),
        );
        setUsuariosSel(
          usuariosItems
            .filter((u) => (destRes.usuariosUuids || []).includes(u.uuid))
            .map((u) => ({ uuid: u.uuid, label: nombreCompleto(u), sublabel: u.email })),
        );
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleGuardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError("");
    setGuardado(false);
    try {
      const correos = correosTexto
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      await apiFetch("/evaluaciones/alertas-destinatarios", {
        method: "PUT",
        body: JSON.stringify({
          correos,
          rolesUuids: rolesSel.map((r) => r.uuid),
          usuariosUuids: usuariosSel.map((u) => u.uuid),
        }),
      });
      setGuardado(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ModalShell title="Destinatarios de las alertas por correo" onClose={onClose} size="lg">
      <p className="small text-secondary mb-3">
        Cada vez que inicia una semana, el sistema envía automáticamente un correo con las fincas que quedaron en
        alerta la semana anterior. También puedes usar el botón &ldquo;Enviar ahora&rdquo; para mandarlo de
        inmediato. Nadie recibe nada mientras no haya al menos un destinatario configurado acá.
      </p>
      <p className="small text-secondary mb-3">
        <strong>Importante:</strong> el correo <strong>no se filtra por finca</strong> — todos los destinatarios de
        abajo (correos sueltos, cualquier usuario con alguno de estos roles, o los usuarios puntuales) reciben
        exactamente el mismo correo con <strong>todas</strong> las fincas en alerta del sistema, sin importar las
        fincas que tenga asignadas cada uno.
      </p>

      {loading ? (
        <p className="text-secondary small mb-0">Cargando...</p>
      ) : (
        <form onSubmit={handleGuardar}>
          {error && <div className="alert alert-danger py-2 small">{error}</div>}

          <label className="form-label small fw-medium">Correos sueltos</label>
          <input
            type="text"
            className="form-control"
            placeholder="correo1@ejemplo.com, correo2@ejemplo.com"
            value={correosTexto}
            onChange={(e) => {
              setCorreosTexto(e.target.value);
              setGuardado(false);
            }}
          />
          <p className="form-text small text-secondary mb-0">Uno o varios correos separados por coma.</p>

          <div className="mt-3">
            <label className="form-label small fw-medium">Roles</label>
            <TagPicker
              items={roles.map((r) => ({ uuid: r.uuid, label: r.nombre }))}
              selected={rolesSel}
              onChange={(nuevos) => {
                setRolesSel(nuevos);
                setGuardado(false);
              }}
              placeholder="Buscar rol para agregar..."
            />
            <p className="form-text small text-secondary mb-0">
              Cualquier usuario con este rol recibe el correo, sin importar la finca.
            </p>
          </div>

          <div className="mt-3">
            <label className="form-label small fw-medium">Usuarios</label>
            <TagPicker
              items={usuarios.map((u) => ({ uuid: u.uuid, label: nombreCompleto(u), sublabel: u.email }))}
              selected={usuariosSel}
              onChange={(nuevos) => {
                setUsuariosSel(nuevos);
                setGuardado(false);
              }}
              placeholder="Buscar usuario para agregar..."
            />
          </div>

          <div className="d-flex gap-2 mt-4">
            <button type="submit" className="btn btn-brand btn-sm rounded-3 flex-grow-1" disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" className="btn btn-sm btn-link text-secondary text-decoration-none" onClick={onClose}>
              Cerrar
            </button>
          </div>
          {guardado && <p className="small text-success mb-0 mt-2">Guardado.</p>}
        </form>
      )}
    </ModalShell>
  );
}
