"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSession } from "@/lib/auth";
import CorbanaLogo from "@/components/CorbanaLogo";
import styles from "./login.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [checkingSetup, setCheckingSetup] = useState(true);
  const [requiereSetup, setRequiereSetup] = useState(false);
  const [setupOk, setSetupOk] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/sistema/setup/estado`)
      .then((res) => res.json())
      .then((data) => setRequiereSetup(Boolean(data?.data?.requiereSetup)))
      .catch(() => {})
      .finally(() => setCheckingSetup(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Credenciales inválidas");
      }

      saveSession(data.data);
      router.push("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex min-vh-100">
      {/* Panel izquierdo: marca / features (oculto en mobile) */}
      <div className={`d-none d-lg-flex col-lg-6 position-relative text-white flex-column justify-content-between p-5 ${styles.brandBg}`}>
        <div className="d-flex align-items-center gap-2">
          <CorbanaLogo size={28} />
          <span className="fs-4 fw-semibold">Corbana</span>
        </div>

        <div style={{ maxWidth: "28rem" }}>
          <h1 className="display-5 fw-bold mb-3">Bienvenido a Corbana</h1>
          <p className="mb-5" style={{ color: "rgba(240,253,244,0.9)" }}>
            Inicia sesión para gestionar y optimizar tu producción agrícola y logística con Corbana.
          </p>

          <div className="d-flex flex-column gap-4">
            <Feature
              title="Monitoreo de Cultivos"
              text="Visualiza datos climáticos y de suelo en tiempo real para decisiones inteligentes."
              icon={
                <path d="M3 12h4l3 8 4-16 3 8h4" strokeLinecap="round" strokeLinejoin="round" />
              }
            />
            <Feature
              title="Optimización de Cosecha"
              text="Planifica y gestiona tus cosechas para máxima eficiencia."
              icon={
                <>
                  <path
                    d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"
                    strokeLinecap="round"
                  />
                  <circle cx="12" cy="12" r="3.2" />
                </>
              }
            />
            <Feature
              title="Logística Segura"
              text="Seguimiento y seguridad en cada paso, desde la finca hasta el mercado global."
              icon={
                <>
                  <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" strokeLinejoin="round" />
                  <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                </>
              }
            />
          </div>
        </div>

        <p className="small mb-0" style={{ color: "rgba(240,253,244,0.6)" }}>
          © 2026 Corbana. Todos los derechos reservados.
        </p>
      </div>

      {/* Panel derecho: formulario */}
      <div className="col-12 col-lg-6 d-flex flex-column min-vh-100 bg-white">
        <div className="d-flex justify-content-end p-4">
          <button type="button" className="btn btn-link text-secondary text-decoration-none d-flex align-items-center gap-2 p-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" strokeLinecap="round" />
            </svg>
            Español
          </button>
        </div>

        <div className="flex-grow-1 d-flex align-items-center justify-content-center px-4 px-sm-5">
          <div className="w-100" style={{ maxWidth: "24rem" }}>
            <div className="d-lg-none d-flex align-items-center gap-2 mb-4 text-brand">
              <CorbanaLogo size={26} />
              <span className="fs-5 fw-semibold">Corbana</span>
            </div>

            {checkingSetup ? (
              <p className="text-secondary small">Cargando...</p>
            ) : requiereSetup ? (
              <SetupForm
                onDone={(usuarioCreado) => {
                  setRequiereSetup(false);
                  setSetupOk(true);
                  setUsuario(usuarioCreado);
                }}
              />
            ) : (
              <>
                <h2 className="fw-bold mb-2">Inicia sesión</h2>
                <p className="text-secondary small mb-4">Ingresa tus credenciales para acceder a tu cuenta.</p>

                {setupOk && (
                  <div className="alert alert-success py-2 small">
                    Administrador creado correctamente. Ya podés iniciar sesión.
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label htmlFor="usuario" className="form-label small fw-medium">
                      Usuario
                    </label>
                    <input
                      id="usuario"
                      type="text"
                      required
                      autoComplete="username"
                      placeholder="Introduce tu usuario"
                      className="form-control rounded-3"
                      value={usuario}
                      onChange={(e) => setUsuario(e.target.value)}
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="password" className="form-label small fw-medium">
                      Contraseña
                    </label>
                    <div className="input-group">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="form-control rounded-start-3"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary rounded-end-3"
                        onClick={() => setShowPassword((v) => !v)}
                        tabIndex={-1}
                      >
                        {showPassword ? "Ocultar" : "Ver"}
                      </button>
                    </div>
                  </div>

                  <div className="d-flex align-items-center justify-content-between mb-3 small">
                    <div className="form-check">
                      <input className="form-check-input" type="checkbox" id="remember" />
                      <label className="form-check-label text-secondary" htmlFor="remember">
                        Recordarme
                      </label>
                    </div>
                    <a href="#" className="text-brand fw-medium text-decoration-none">
                      ¿Olvidaste tu contraseña?
                    </a>
                  </div>

                  {error && <div className="alert alert-danger py-2 small">{error}</div>}

                  <button type="submit" disabled={loading} className="btn btn-brand w-100 rounded-3 py-2 d-flex align-items-center justify-content-center gap-2">
                    {loading ? "Ingresando..." : "Iniciar sesión"}
                    {!loading && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 5l7 7-7 7M5 12h15" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SetupForm({ onDone }) {
  const [form, setForm] = useState({ usuario: "", nombre: "", apellido: "", email: "", password: "", confirmar: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const setField = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (form.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/sistema/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario: form.usuario,
          nombre: form.nombre,
          apellido: form.apellido,
          email: form.email,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "No se pudo completar la configuración inicial");
      }
      onDone(form.usuario);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2 className="fw-bold mb-2">Configuración inicial</h2>
      <p className="text-secondary small mb-4">
        Todavía no hay ningún usuario. Creá la cuenta del primer administrador para empezar a usar Corbana.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="row g-2">
          <div className="col-6 mb-3">
            <label className="form-label small fw-medium">Nombre</label>
            <input required className="form-control rounded-3" value={form.nombre} onChange={setField("nombre")} />
          </div>
          <div className="col-6 mb-3">
            <label className="form-label small fw-medium">Apellido</label>
            <input required className="form-control rounded-3" value={form.apellido} onChange={setField("apellido")} />
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label small fw-medium">Usuario</label>
          <input
            required
            minLength={3}
            autoComplete="username"
            className="form-control rounded-3"
            placeholder="Con qué usuario vas a iniciar sesión"
            value={form.usuario}
            onChange={setField("usuario")}
          />
        </div>

        <div className="mb-3">
          <label className="form-label small fw-medium">Email</label>
          <input
            type="email"
            required
            className="form-control rounded-3"
            value={form.email}
            onChange={setField("email")}
          />
        </div>

        <div className="mb-3">
          <label className="form-label small fw-medium">Contraseña</label>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="form-control rounded-3"
            placeholder="Mínimo 8 caracteres"
            value={form.password}
            onChange={setField("password")}
          />
        </div>

        <div className="mb-3">
          <label className="form-label small fw-medium">Confirmar contraseña</label>
          <input
            type="password"
            required
            autoComplete="new-password"
            className="form-control rounded-3"
            value={form.confirmar}
            onChange={setField("confirmar")}
          />
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <button type="submit" disabled={loading} className="btn btn-brand w-100 rounded-3 py-2">
          {loading ? "Creando..." : "Crear administrador"}
        </button>
      </form>
    </>
  );
}

function Feature({ title, text, icon }) {
  return (
    <div className="d-flex align-items-start gap-3">
      <div
        className="d-flex align-items-center justify-content-center rounded-3 flex-shrink-0"
        style={{ width: "2.5rem", height: "2.5rem", backgroundColor: "rgba(255,255,255,0.1)" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          {icon}
        </svg>
      </div>
      <div>
        <p className="fw-semibold small mb-1">{title}</p>
        <p className="small mb-0" style={{ color: "rgba(240,253,244,0.75)" }}>
          {text}
        </p>
      </div>
    </div>
  );
}
