import { createFileRoute } from "@tanstack/react-router";
import { SymbolStudio } from "@/routes/app.symbol-studio-component";

export const Route = createFileRoute("/app/symbol-studio")({
  component: SymbolStudio,
});
