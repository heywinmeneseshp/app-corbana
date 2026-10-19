"use client";

// Ícono "i" junto al título de un módulo: al hacer clic abre una ventana con
// la explicación de cómo funciona. `secciones`: [{ titulo, texto?, items? }].
import { useState } from "react";
import { createPortal } from "react-dom";
import { FiInfo } from "react-icons/fi";
import ModalShell from "@/components/ModalShell";

export default function InfoModulo({ titulo, secciones }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-link p-0 ms-2 text-secondary d-inline-flex align-middle"
        onClick={() => setAbierto(true)}
        aria-label="¿Cómo funciona?"
        title="¿Cómo funciona?"
      >
        <FiInfo size={16} />
      </button>
      {abierto &&
        createPortal(
        <ModalShell title={titulo} onClose={() => setAbierto(false)} size="lg">
          <div className="small fw-normal text-body">
            {secciones.map((s, i) => (
              <div key={i} className={i < secciones.length - 1 ? "mb-3" : ""}>
                <p className="fw-semibold mb-1">{s.titulo}</p>
                {s.texto && <p className="text-secondary mb-1">{s.texto}</p>}
                {s.items && (
                  <ul className="text-secondary ps-3 mb-0">
                    {s.items.map((it, j) => (
                      <li key={j}>{it}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </ModalShell>,
        document.body,
        )}
    </>
  );
}
