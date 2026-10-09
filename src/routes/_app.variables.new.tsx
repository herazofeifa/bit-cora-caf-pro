import { createFileRoute, redirect } from "@tanstack/react-router";

// Old address kept working: sends to the equivalent screen.
export const Route = createFileRoute("/_app/variables/new")({
  beforeLoad: () => { throw redirect({ to: "/variables", search: { tab: "registrar" } }); },
});
