import { createFileRoute } from "@tanstack/react-router";
import { Reports } from "@/components/admin/accounting";
export const Route = createFileRoute("/_authenticated/admin/accounting/reports")({
  component: Reports,
});
