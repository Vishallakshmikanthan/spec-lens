import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/jobs")({
  beforeLoad: () => {
    throw redirect({ to: "/app/monitor" });
  },
});
