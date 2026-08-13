import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/components/$mpn")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/app/components", search: { mpn: params.mpn } });
  },
});
