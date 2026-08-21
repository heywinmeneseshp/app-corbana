"use client";

import { useState } from "react";
import Link from "next/link";
import { useMarca } from "@/lib/marca";
import AppLogo from "@/components/AppLogo";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export default function ForgotPasswordPage() {
  const { nombreApp } = useMarca();
  const [usuarioOrEmail, setUsuarioOrEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioOrEmail }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "No se pudo procesar la solicitud");
      }
      // Siempre se muestra el mismo mensaje, exista o no el usuario/email —
      // el backend responde igual en ambos casos a propósito.
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex min-vh-100 align-items-center justify-content-center bg-white px-4">
      <div className="w-100" style={{ maxWidth: "24rem" }}>
        <div className="d-flex align-items-center gap-2 mb-4 text-brand">
          <AppLogo size={26} />
          <span className="fs-5 fw-semibold">{nombreApp}</span>
        </div>

        {sent ? (
          <>
            <h2 className="fw-bold mb-2">Revisa tu correo</h2>
            <p className="text-secondary small mb-4">
              Si el usuario o correo que ingresaste existe en el sistema, te enviamos una nueva contraseña
              temporal. Ingresá con ella y cambiala apenas puedas.
            </p>
            <Link href="/login" className="btn btn-brand w-100 rounded-3 py-2 d-inline-block text-center">
              Volver a iniciar sesión
            </Link>
          </>
        ) : (
          <>
            <h2 className="fw-bold mb-2">¿Olvidaste tu contraseña?</h2>
            <p className="text-secondary small mb-4">
              Ingresá tu usuario o correo y te enviaremos una nueva contraseña temporal.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="usuarioOrEmail" className="form-label small fw-medium">
                  Usuario o correo
                </label>
                <input
                  id="usuarioOrEmail"
                  type="text"
                  required
                  autoFocus
                  placeholder="Tu usuario o email"
                  className="form-control rounded-3"
                  value={usuarioOrEmail}
                  onChange={(e) => setUsuarioOrEmail(e.target.value)}
                />
              </div>

              {error && <div className="alert alert-danger py-2 small">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-brand w-100 rounded-3 py-2 mb-3"
              >
                {loading ? "Enviando..." : "Enviar nueva contraseña"}
              </button>

              <Link href="/login" className="d-block text-center small text-secondary text-decoration-none">
                Volver a iniciar sesión
              </Link>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
