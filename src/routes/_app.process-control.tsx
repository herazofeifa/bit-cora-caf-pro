import { createFileRoute, redirect } from "@tanstack/react-router";

// Old address kept working: sends to the equivalent screen.
export const Route = createFileRoute("/_app/process-control")({
  beforeLoad: () => { throw redirect({ to: "/processes", search: { tab: "activos" } }); },
});
