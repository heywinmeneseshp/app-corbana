"use client";

// Configuración de quién recibe los correos de Programación de Aspersiones (solo Administrador):
//   1. Finca (Para): ROLES filtrados por finca — cada usuario con ese rol que tenga asignada la finca de la aspersión (o que no
//      tenga fincas asignadas: ve todas). Es «la finca».
//   2. En copia: usuarios puntuales y correos externos; reciben de todas las fincas.
//   3. Pista: sus correos se configuran en Sanidad Vegetal → Pistas (reciben su propio aviso).
// Más el Excel del «Enviar semana». La vista previa por finca resuelve en vivo (con los cambios sin guardar) a quién le llegaría,
// y avisa lo que haría perder un correo: usuarios sin correo, roles sin nadie en esa finca, finca sin destinatarios.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FiAlertTriangle, FiCheckCircle, FiHome, FiInfo, FiMail, FiNavigation, FiUsers, FiXCircle } from "react-icons/fi";
import ModalShell from "@/components/ModalShell";
import TagPicker from "@/components/TagPicker";
import { apiFetch, apiFetchTodos } from "@/lib/api";

const ADMIN = "Administrador";
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

const nombreCompleto = (u) => `${u.nombre || ""} ${u.apellido || ""}`.trim() || u.usuario;
const separarCorreos = (texto) =>
  String(texto || "")
    .split(/[,;\s]+/)
    .map((c) => c.trim())
    .filter(Boolean);

function Paso({ numero, icono: Icono, titulo, subtitulo, children, color = "#166534", fondo = "#f0fdf4" }) {
  return (
    <div className="border rounded-3 h-100 d-flex flex-column" style={{ borderColor: "#e2e8f0" }}>
      <div className="d-flex align-items-start gap-2 px-3 pt-3 pb-2 rounded-top-3" style={{ backgroundColor: fondo }}>
        <span
          className="rounded-circle d-inline-flex align-items-center justify-content-center fw-bold flex-shrink-0"
          style={{ width: 24, height: 24, backgroundColor: color, color: "#fff", fontSize: "0.75rem" }}
        >
          {numero}
        </span>
        <div>
          <div className="fw-semibold small d-flex align-items-center gap-1" style={{ color }}>
            <Icono size={14} /> {titulo}
          </div>
          <div className="text-secondary" style={{ fontSize: "0.72rem", lineHeight: 1.35 }}>
            {subtitulo}
          </div>
        </div>
      </div>
      <div className="px-3 py-3 flex-grow-1">{children}</div>
    </div>
  );
}

// Campo de correos externos: se escriben separados por coma y se muestran como etiquetas (en rojo los mal escritos).
function CorreosExternos({ valor, onChange }) {
  const correos = separarCorreos(valor);
  return (
    <>
      <input
        type="text"
        className="form-control form-control-sm rounded-3"
        placeholder="correo@empresa.com, otro@empresa.com"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
      />
      {correos.length > 0 && (
        <div className="d-flex flex-wrap gap-1 mt-2">
          {correos.map((c, i) => {
            const ok = EMAIL_RE.test(c);
            return (
              <span
                key={`${c}-${i}`}
                className="badge rounded-pill fw-normal"
                style={{ backgroundColor: ok ? "#f1f5f9" : "#fee2e2", color: ok ? "#334155" : "#b91c1c" }}
                title={ok ? undefined : "Correo mal escrito: no se guardará así"}
              >
                {!ok && <FiAlertTriangle size={10} className="me-1" />}
                {c}
              </span>
            );
          })}
        </div>
      )}
      <div className="form-text" style={{ fontSize: "0.7rem" }}>
        Separados por coma. Para personas que no tienen usuario en el sistema.
      </div>
    </>
  );
}

export default function ConfigDestinatariosModal({ onClose }) {
  const [tab, setTab] = useState("aviso");
  const [roles, setRoles] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [fincas, setFincas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // Configuración editable y la guardada (para saber si hay cambios sin guardar).
  const [aviso, setAviso] = useState({ rolesUuids: [], usuariosUuids: [], rolesCopiaUuids: [], correos: "" });
  const [resumen, setResumen] = useState({ rolesUuids: [], usuariosUuids: [], correos: "" });
  const [original, setOriginal] = useState(null);
  const [fincaPrevia, setFincaPrevia] = useState("");

  useEffect(() => {
    Promise.all([
      apiFetch("/roles?limit=100").catch(() => ({ items: [] })),
      apiFetchTodos("/users?limit=100").catch(() => ({ items: [] })),
      apiFetch("/fincas?limit=100&soloOperativas=true").catch(() => ({ items: [] })),
      apiFetch("/aspersiones/destinatarios"),
      apiFetch("/aspersiones/resumen-semanal/destinatarios"),
    ])
      .then(([rolesRes, usuariosRes, fincasRes, destRes, resumenRes]) => {
        setRoles([...(rolesRes.items || [])].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
        setUsuarios(usuariosRes.items || []);
        const listaFincas = [...(fincasRes.items || [])].filter((f) => !f.esExterna).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        setFincas(listaFincas);
        setFincaPrevia(listaFincas[0]?.uuid || "");
        const a = {
          rolesUuids: destRes.rolesUuids || [],
          usuariosUuids: destRes.usuariosUuids || [],
          rolesCopiaUuids: destRes.rolesCopiaUuids || [],
          correos: (destRes.correos || []).join(", "),
        };
        const r = { rolesUuids: resumenRes.rolesUuids || [], usuariosUuids: resumenRes.usuariosUuids || [], correos: (resumenRes.correos || []).join(", ") };
        setAviso(a);
        setResumen(r);
        setOriginal(JSON.stringify({ a, r }));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const hayCambios = original !== null && original !== JSON.stringify({ a: aviso, r: resumen });

  const rolItems = useMemo(() => roles.map((r) => ({ uuid: r.uuid, label: r.nombre })), [roles]);
  const usuarioItems = useMemo(
    () => usuarios.filter((u) => u.estado !== false).map((u) => ({ uuid: u.uuid, label: nombreCompleto(u), sublabel: u.email || "Sin correo" })),
    [usuarios],
  );
  const seleccion = (items, uuids) => items.filter((i) => uuids.includes(i.uuid));

  // Vista previa: a quién le llegaría el aviso de una aspersión de la finca elegida (con los cambios sin guardar).
  const previa = useMemo(() => {
    if (!fincaPrevia) return null;
    const finca = fincas.find((f) => f.uuid === fincaPrevia);
    const activos = usuarios.filter((u) => u.estado !== false);
    const para = [];
    const rolesSinNadie = [];
    for (const rolUuid of aviso.rolesUuids) {
      const rol = roles.find((r) => r.uuid === rolUuid);
      const delRol = activos.filter((u) => (u.roles || []).some((r) => r.uuid === rolUuid));
      const enFinca = delRol.filter((u) => {
        const esAdmin = (u.roles || []).some((r) => r.nombre === ADMIN);
        const asignadas = (u.fincas || []).map((f) => f.uuid);
        return esAdmin || asignadas.length === 0 || asignadas.includes(fincaPrevia);
      });
      if (!enFinca.length) rolesSinNadie.push(rol?.nombre || "Rol");
      for (const u of enFinca) {
        if (!para.some((p) => p.uuid === u.uuid)) {
          para.push({ uuid: u.uuid, nombre: nombreCompleto(u), email: u.email, detalle: rol?.nombre, todas: !(u.fincas || []).length });
        }
      }
    }
    const copiaUsuarios = [];
    for (const u of activos) {
      if (para.some((p) => p.uuid === u.uuid)) continue;
      const rolCopia = (u.roles || []).find((r) => aviso.rolesCopiaUuids.includes(r.uuid));
      if (aviso.usuariosUuids.includes(u.uuid)) copiaUsuarios.push({ uuid: u.uuid, nombre: nombreCompleto(u), email: u.email, detalle: "Usuario en copia" });
      else if (rolCopia) copiaUsuarios.push({ uuid: u.uuid, nombre: nombreCompleto(u), email: u.email, detalle: `${rolCopia.nombre} (rol en copia)` });
    }
    const copiaCorreos = separarCorreos(aviso.correos)
      .filter((c) => EMAIL_RE.test(c))
      .map((c) => ({ uuid: c, nombre: c, email: c, detalle: "Correo externo" }));
    const conCorreo = (l) => l.filter((x) => x.email);
    const sinCorreo = [...para, ...copiaUsuarios].filter((x) => !x.email);
    return {
      finca,
      para,
      copia: [...copiaUsuarios, ...copiaCorreos],
      total: new Set([...conCorreo(para), ...conCorreo(copiaUsuarios), ...copiaCorreos].map((x) => x.email.toLowerCase())).size,
      paraConCorreo: conCorreo(para).length,
      sinCorreo,
      rolesSinNadie,
    };
  }, [fincaPrevia, fincas, usuarios, roles, aviso]);

  function cerrar() {
    if (hayCambios && !confirm("Tienes cambios sin guardar. ¿Cerrar sin guardar?")) return;
    onClose();
  }

  async function guardar() {
    setError("");
    setMensaje("");
    const malos = [...separarCorreos(aviso.correos), ...separarCorreos(resumen.correos)].filter((c) => !EMAIL_RE.test(c));
    if (malos.length) {
      setError(`Revisa estos correos, están mal escritos: ${malos.join(", ")}`);
      return;
    }
    setGuardando(true);
    try {
      const cuerpo = (c) => ({
        correos: separarCorreos(c.correos),
        rolesUuids: c.rolesUuids,
        usuariosUuids: c.usuariosUuids,
        ...(c.rolesCopiaUuids ? { rolesCopiaUuids: c.rolesCopiaUuids } : {}),
      });
      await Promise.all([
        apiFetch("/aspersiones/destinatarios", { method: "PUT", body: JSON.stringify(cuerpo(aviso)) }),
        apiFetch("/aspersiones/resumen-semanal/destinatarios", { method: "PUT", body: JSON.stringify(cuerpo(resumen)) }),
      ]);
      setOriginal(JSON.stringify({ a: aviso, r: resumen }));
      setMensaje("Cambios guardados.");
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const Persona = ({ p }) => (
    <li className="d-flex align-items-center gap-2 py-1 border-bottom" style={{ borderColor: "#f1f5f9", fontSize: "0.78rem" }}>
      {p.email ? <FiCheckCircle size={13} className="text-success flex-shrink-0" /> : <FiXCircle size={13} className="text-danger flex-shrink-0" />}
      <span className="fw-medium text-truncate">{p.nombre}</span>
      <span className="text-secondary text-truncate">{p.email || "sin correo: no le llegará"}</span>
      <span className="ms-auto text-secondary text-nowrap" style={{ fontSize: "0.7rem" }}>
        {p.detalle}
        {p.todas ? " · todas las fincas" : ""}
      </span>
    </li>
  );

  return (
    <ModalShell title="Destinatarios de los correos de aspersiones" onClose={cerrar} width="64rem" height="92vh">
      {loading ? (
        <p className="text-secondary small mb-0">Cargando...</p>
      ) : (
        <>
          <ul className="nav nav-tabs small mb-3">
            {[
              ["aviso", "Aviso de aspersión"],
              ["resumen", "Resumen semanal (Excel)"],
            ].map(([key, label]) => (
              <li key={key} className="nav-item">
                <button type="button" className={`nav-link ${tab === key ? "active fw-semibold" : "text-secondary"}`} onClick={() => setTab(key)}>
                  {label}
                </button>
              </li>
            ))}
          </ul>

          {tab === "aviso" && (
            <>
              {/* Cómo funciona: qué correo sale y a quién en cada momento del flujo. */}
              <div className="rounded-3 p-3 mb-3" style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                <div className="fw-semibold small mb-2 d-flex align-items-center gap-1">
                  <FiInfo size={14} /> Cómo funciona
                </div>
                <div className="row g-2" style={{ fontSize: "0.75rem" }}>
                  <div className="col-md-4">
                    <div className="fw-semibold">Al enviar el aviso</div>
                    <div className="text-secondary">
                      Solo con la aspersión <strong>revisada</strong>. Le llega a la <strong>finca</strong> (1) y a los de <strong>copia</strong> (2). La <strong>pista</strong> (3) recibe su propio aviso con las hectáreas.
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="fw-semibold">Al cancelar una aspersión ya enviada</div>
                    <div className="text-secondary">
                      El aviso de cancelación le llega a <strong>todos</strong>: finca, copia y pista, más quien la programó y quien la revisó.
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="fw-semibold">Al cancelar sin haber enviado el aviso</div>
                    <div className="text-secondary">
                      Solo a los de <strong>copia</strong>, a quien la programó y a quien la revisó: la finca y la pista nunca se enteraron.
                    </div>
                  </div>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-lg-4">
                  <Paso numero={1} icono={FiHome} titulo="Finca (Para)" subtitulo="Roles que representan a la finca, por ejemplo Administrador de finca.">
                    <TagPicker
                      items={rolItems}
                      selected={seleccion(rolItems, aviso.rolesUuids)}
                      onChange={(n) => setAviso((s) => ({ ...s, rolesUuids: n.map((x) => x.uuid) }))}
                      placeholder="Agregar rol..."
                    />
                    <div className="form-text" style={{ fontSize: "0.7rem" }}>
                      Le llega a cada usuario con ese rol que tenga <strong>asignada la finca</strong> de la aspersión. Quien no tiene fincas asignadas recibe de todas.
                    </div>
                  </Paso>
                </div>
                <div className="col-lg-4">
                  <Paso numero={2} icono={FiUsers} titulo="En copia" subtitulo="Reciben los avisos de todas las fincas." color="#0e7490" fondo="#ecfeff">
                    <label className="form-label small fw-medium mb-1">Roles</label>
                    <TagPicker
                      items={rolItems}
                      selected={seleccion(rolItems, aviso.rolesCopiaUuids)}
                      onChange={(n) => setAviso((s) => ({ ...s, rolesCopiaUuids: n.map((x) => x.uuid) }))}
                      placeholder="Agregar rol..."
                    />
                    <div className="form-text mb-3" style={{ fontSize: "0.7rem" }}>
                      Todos los usuarios con ese rol, sin importar sus fincas.
                    </div>
                    <label className="form-label small fw-medium mb-1">Usuarios</label>
                    <TagPicker
                      items={usuarioItems}
                      selected={seleccion(usuarioItems, aviso.usuariosUuids)}
                      onChange={(n) => setAviso((s) => ({ ...s, usuariosUuids: n.map((x) => x.uuid) }))}
                      placeholder="Agregar usuario..."
                    />
                    <label className="form-label small fw-medium mb-1 mt-3">Correos externos</label>
                    <CorreosExternos valor={aviso.correos} onChange={(v) => setAviso((s) => ({ ...s, correos: v }))} />
                  </Paso>
                </div>
                <div className="col-lg-4">
                  <Paso numero={3} icono={FiNavigation} titulo="Pista" subtitulo="La pista de la que sale la aspersión." color="#475569" fondo="#f1f5f9">
                    <p className="small text-secondary mb-2">
                      Los correos de cada pista se configuran en la pista misma. Reciben un aviso aparte, con la pista y las hectáreas a asperjar, y la firma del representante de pista.
                    </p>
                    <Link href="/sanidad-vegetal/pistas" className="small text-decoration-none">
                      Ir a Sanidad Vegetal → Pistas
                    </Link>
                  </Paso>
                </div>
              </div>

              {/* Vista previa por finca, con los cambios sin guardar. */}
              <div className="border rounded-3 p-3" style={{ borderColor: "#e2e8f0" }}>
                <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                  <div className="fw-semibold small d-flex align-items-center gap-1">
                    <FiMail size={14} /> ¿A quién le llega? Vista previa para
                  </div>
                  <select className="form-select form-select-sm rounded-3" style={{ maxWidth: "16rem" }} value={fincaPrevia} onChange={(e) => setFincaPrevia(e.target.value)}>
                    {fincas.map((f) => (
                      <option key={f.uuid} value={f.uuid}>
                        {f.nombre}
                      </option>
                    ))}
                  </select>
                  {previa && (
                    <span className="small text-secondary ms-auto">
                      {previa.total} correo(s) en total{hayCambios ? " · incluye los cambios sin guardar" : ""}
                    </span>
                  )}
                </div>

                {previa && (
                  <>
                    {previa.paraConCorreo === 0 && (
                      <div className="alert alert-danger py-2 small mb-2 d-flex gap-2">
                        <FiAlertTriangle className="flex-shrink-0 mt-1" />
                        <span>
                          <strong>{previa.finca?.nombre}</strong> no recibiría el aviso: ningún usuario de los roles de la finca tiene asignada esta finca y correo. Agrega el rol o asigna la finca al usuario en Maestros → Usuarios.
                        </span>
                      </div>
                    )}
                    {previa.rolesSinNadie.length > 0 && previa.paraConCorreo > 0 && (
                      <div className="alert alert-warning py-2 small mb-2 d-flex gap-2">
                        <FiAlertTriangle className="flex-shrink-0 mt-1" />
                        <span>Nadie con el rol {previa.rolesSinNadie.join(", ")} tiene asignada esta finca.</span>
                      </div>
                    )}
                    {previa.sinCorreo.length > 0 && (
                      <div className="alert alert-warning py-2 small mb-2 d-flex gap-2">
                        <FiAlertTriangle className="flex-shrink-0 mt-1" />
                        <span>
                          {previa.sinCorreo.length} usuario(s) no tienen correo y no les llegará: {previa.sinCorreo.map((p) => p.nombre).join(", ")}. Agrégales el correo en Maestros → Usuarios.
                        </span>
                      </div>
                    )}
                    <div className="row g-3">
                      <div className="col-md-6">
                        <div className="small fw-semibold mb-1" style={{ color: "#166534" }}>
                          Finca (Para) · {previa.para.length}
                        </div>
                        {previa.para.length === 0 ? (
                          <div className="small text-secondary">Nadie.</div>
                        ) : (
                          <ul className="list-unstyled mb-0">
                            {previa.para.map((p) => (
                              <Persona key={p.uuid} p={p} />
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="col-md-6">
                        <div className="small fw-semibold mb-1" style={{ color: "#0e7490" }}>
                          En copia · {previa.copia.length}
                        </div>
                        {previa.copia.length === 0 ? (
                          <div className="small text-secondary">Nadie.</div>
                        ) : (
                          <ul className="list-unstyled mb-0">
                            {previa.copia.map((p) => (
                              <Persona key={p.uuid} p={p} />
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {tab === "resumen" && (
            <>
              <div className="rounded-3 p-3 mb-3" style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", fontSize: "0.78rem" }}>
                <div className="fw-semibold small mb-1 d-flex align-items-center gap-1">
                  <FiInfo size={14} /> Cómo funciona
                </div>
                <span className="text-secondary">
                  Con el botón <strong>Enviar semana</strong> del Calendario se envía un solo Excel con la programación de <strong>todas las fincas</strong> de la semana. Aquí no se filtra por finca: cada rol, usuario o correo que agregues lo recibe completo.
                </span>
              </div>
              <div className="row g-3">
                <div className="col-md-4">
                  <Paso numero={1} icono={FiUsers} titulo="Roles" subtitulo="Todos los usuarios activos con ese rol.">
                    <TagPicker
                      items={rolItems}
                      selected={seleccion(rolItems, resumen.rolesUuids)}
                      onChange={(n) => setResumen((s) => ({ ...s, rolesUuids: n.map((x) => x.uuid) }))}
                      placeholder="Agregar rol..."
                    />
                  </Paso>
                </div>
                <div className="col-md-4">
                  <Paso numero={2} icono={FiUsers} titulo="Usuarios" subtitulo="Usuarios puntuales." color="#0e7490" fondo="#ecfeff">
                    <TagPicker
                      items={usuarioItems}
                      selected={seleccion(usuarioItems, resumen.usuariosUuids)}
                      onChange={(n) => setResumen((s) => ({ ...s, usuariosUuids: n.map((x) => x.uuid) }))}
                      placeholder="Agregar usuario..."
                    />
                  </Paso>
                </div>
                <div className="col-md-4">
                  <Paso numero={3} icono={FiMail} titulo="Correos externos" subtitulo="Personas sin usuario en el sistema." color="#475569" fondo="#f1f5f9">
                    <CorreosExternos valor={resumen.correos} onChange={(v) => setResumen((s) => ({ ...s, correos: v }))} />
                  </Paso>
                </div>
              </div>
            </>
          )}

          {error && <div className="alert alert-danger py-2 small mt-3 mb-0">{error}</div>}

          <div className="d-flex flex-wrap align-items-center gap-2 border-top pt-3 mt-3">
            {hayCambios ? (
              <span className="badge rounded-pill" style={{ backgroundColor: "#fef3c7", color: "#b45309" }}>
                Cambios sin guardar
              </span>
            ) : (
              mensaje && (
                <span className="small text-success d-flex align-items-center gap-1">
                  <FiCheckCircle /> {mensaje}
                </span>
              )
            )}
            <button type="button" className="btn btn-sm btn-link text-secondary text-decoration-none ms-auto" onClick={cerrar}>
              Cerrar
            </button>
            <button type="button" className="btn btn-brand btn-sm rounded-3" disabled={guardando || !hayCambios} onClick={guardar}>
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
