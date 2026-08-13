import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/evidence/$evidenceId")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/app/evidence", search: { doc: undefined, ev: params.evidenceId } });
  },
});
