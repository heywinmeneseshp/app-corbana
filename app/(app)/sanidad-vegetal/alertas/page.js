"use client";

import { useEffect, useState } from "react";
import { FiAlertTriangle, FiCheckCircle, FiCalendar, FiTrendingDown, FiTrendingUp, FiSettings, FiSend, FiX } from "react-icons/fi";
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
  const esAdmin = esAdministrador();

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
      <div className="p-4 p-md-5">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
          <div className="d-flex align-items-center gap-3">
            <span
              className="rounded-circle d-flex align-items-center justify-content-center text-white"
              style={{ width: 42, height: 42, background: "linear-gradient(135deg,#f59e0b,#dc2626)" }}
            >
              <FiAlertTriangle size={20} />
            </span>
            <div>
              <h1 className="fw-bold h3 mb-1">Alertas de Sanidad Vegetal</h1>
              <p className="text-secondary mb-0">
                Fincas con YLI por debajo de 8, Índice de Infección por encima de 33%, o Suma Bruta por Hoja por
                encima del umbral configurado (ver Gráficos → Suma Bruta), en la semana seleccionada.
              </p>
            </div>
          </div>
          <div className="d-flex align-items-end gap-2">
            {esAdmin && (
              <>
                <button
                  type="button"
                  className="btn btn-outline-secondary rounded-3 d-flex align-items-center gap-1"
                  onClick={handleEnviarAhora}
                  disabled={enviando || !data?.semana}
                  title="Enviar por correo las alertas de la semana seleccionada, ahora mismo"
                >
                  <FiSend /> {enviando ? "Enviando..." : "Enviar ahora"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary rounded-3 d-flex align-items-center justify-content-center"
                  style={{ width: 38 }}
                  onClick={() => setModalConfig(true)}
                  title="Configurar destinatarios del correo de alertas"
                >
                  <FiSettings />
                </button>
              </>
            )}
            <div>
              <label className="form-label small fw-medium text-secondary mb-1">Semana</label>
              <select
                className="form-select form-select-sm rounded-3 shadow-sm"
                style={{ width: 180 }}
                value={semanaUuid}
                onChange={(e) => setSemanaUuid(e.target.value)}
              >
                {semanas.map((s) => (
                  <option key={s.uuid} value={s.uuid}>
                    {s.codigo}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {avisoEnvio && (
          <div className="alert alert-info py-2 small rounded-3 d-flex align-items-center justify-content-between">
            {avisoEnvio}
            <button type="button" className="btn btn-sm btn-link p-0 text-secondary" onClick={() => setAvisoEnvio("")}>
              <FiX />
            </button>
          </div>
        )}

        {modalConfig && <ModalConfigDestinatarios onClose={() => setModalConfig(false)} />}

        {error && <div className="alert alert-danger py-2 small rounded-3">{error}</div>}

        {loading && (
          <div className="d-flex justify-content-center align-items-center py-5 text-secondary">
            <div className="spinner-border spinner-border-sm me-2" role="status"></div>
            <span className="small">Cargando alertas...</span>
          </div>
        )}

        {!loading && !error && data && !data.semana && (
          <p className="text-secondary small py-5 text-center mb-0">
            Todavía no hay ninguna semana cerrada para evaluar.
          </p>
        )}

        {!loading && !error && data?.semana && (
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
              <div className="card border-0 shadow-sm rounded-4 p-5 text-center">
                <FiCheckCircle size={32} className="text-success mx-auto mb-2" />
                <p className="text-secondary mb-0">
                  Ninguna finca superó los umbrales de alerta en la semana {data.semana.codigo}.
                </p>
              </div>
            ) : (
              <div className="row g-3">
                {data.alertas.map((a) => (
                  <div className="col-12 col-md-6 col-xl-4" key={a.fincaUuid}>
                    <div className="card border-0 shadow-sm rounded-4 p-3 h-100">
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
        setRoles(rolesRes.items || []);
        setUsuarios(usuariosRes.items || []);
        setCorreosTexto((destRes.correos || []).join(", "));
        setRolesSel(destRes.rolesUuids || []);
        setUsuariosSel(destRes.usuariosUuids || []);
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
        body: JSON.stringify({ correos, rolesUuids: rolesSel, usuariosUuids: usuariosSel }),
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
            <button type="submit" className="btn btn-brand rounded-3 flex-grow-1" disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar"}
            </button>
            <button type="button" className="btn btn-outline-secondary rounded-3" onClick={onClose}>
              Cerrar
            </button>
          </div>
          {guardado && <p className="small text-success mb-0 mt-2">Guardado.</p>}
        </form>
      )}
    </ModalShell>
  );
}
