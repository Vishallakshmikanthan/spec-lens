import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/symbol-studio")({
  beforeLoad: () => {
    throw redirect({ to: "/app/symbols" });
  },
});
