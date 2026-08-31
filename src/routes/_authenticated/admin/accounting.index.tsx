import { createFileRoute } from "@tanstack/react-router";
import { FinanceDashboard } from "@/components/admin/accounting";
export const Route = createFileRoute("/_authenticated/admin/accounting/")({
  component: FinanceDashboard,
});
