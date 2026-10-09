import { createFileRoute, Link } from "@tanstack/react-router";

// Old public address by lot code. Public sheets now use a private token (QR /t/…),
// so a lot code alone never reveals data.
export const Route = createFileRoute("/public/lot/$code")({
  head: () => ({ meta: [
    { title: "Ficha de lote — Bitácora Café Pro" },
    { name: "description", content: "Las fichas públicas de lote se abren desde su código QR." },
    { property: "og:title", content: "Ficha de lote — Bitácora Café Pro" },
    { property: "og:description", content: "Escanea el QR del saco o del lote para ver su origen." },
    { name: "robots", content: "noindex" },
  ] }),
  component: () => (
    <main className="min-h-screen grid place-items-center p-6 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="font-serif text-3xl">Ficha no encontrada</h1>
        <p className="text-muted-foreground">Las fichas públicas se abren escaneando el código QR del lote o del saco.</p>
        <Link to="/" className="underline">Ir al inicio</Link>
      </div>
    </main>
  ),
});
