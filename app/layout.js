import "./globals.css";
import QueryProvider from "@/components/QueryProvider";

export const metadata = {
  title: "Corbana",
  description: "Plataforma de gestión agrícola y logística de Corbana",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
