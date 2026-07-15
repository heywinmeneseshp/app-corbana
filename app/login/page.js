"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

      localStorage.setItem("corbana_access_token", data.data.accessToken);
      localStorage.setItem("corbana_refresh_token", data.data.refreshToken);
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
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 21C7 21 3 17.5 3 12.5C3 7 7.5 3 13 3C13 9 9.5 12.5 5 13.5C7.5 15.5 11 16 12 21Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
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
              text="Planifica y gestiona tus cosechas con inteligencia artificial para máxima eficiencia."
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
          © 2026 Corbana. Innovación Agrícola y Tecnológica Global.
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
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 21C7 21 3 17.5 3 12.5C3 7 7.5 3 13 3C13 9 9.5 12.5 5 13.5C7.5 15.5 11 16 12 21Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="fs-5 fw-semibold">Corbana</span>
            </div>

            <h2 className="fw-bold mb-2">Inicia sesión</h2>
            <p className="text-secondary small mb-4">Ingresa tus credenciales para acceder a tu cuenta.</p>

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

            <p className="text-center text-secondary small mt-4">
              ¿No tienes una cuenta?{" "}
              <a href="#" className="text-brand fw-semibold text-decoration-none">
                Regístrate
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
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
