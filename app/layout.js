import "./globals.css";

export const metadata = {
  title: "Corbana",
  description: "Plataforma de gestión agrícola y logística de Corbana",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
