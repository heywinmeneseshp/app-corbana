export default function ModalShell({ title, onClose, children, size }) {
  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
      style={{ backgroundColor: "rgba(15,23,42,0.4)", zIndex: 1050 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-4 shadow p-4 w-100" style={{ maxWidth: size === "lg" ? "36rem" : "28rem" }}>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h3 className="h5 fw-bold mb-0">{title}</h3>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Cerrar"></button>
        </div>
        {children}
      </div>
    </div>
  );
}
