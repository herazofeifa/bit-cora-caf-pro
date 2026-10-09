import { createFileRoute, redirect } from "@tanstack/react-router";

// Old address kept working: sends to the equivalent screen.
export const Route = createFileRoute("/_app/operacion/")({
  beforeLoad: () => { throw redirect({ to: "/dashboard" }); },
});
