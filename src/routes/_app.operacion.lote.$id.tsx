import { createFileRoute, redirect } from "@tanstack/react-router";

// Old address kept working: sends to the equivalent screen.
export const Route = createFileRoute("/_app/operacion/lote/$id")({
  beforeLoad: ({ params }) => { throw redirect({ to: "/lots/$id", params: { id: params.id } }); },
});
