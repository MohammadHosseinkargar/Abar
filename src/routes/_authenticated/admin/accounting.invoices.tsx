import { createFileRoute } from "@tanstack/react-router";
import { Invoices } from "@/components/admin/accounting";
export const Route = createFileRoute("/_authenticated/admin/accounting/invoices")({
  component: Invoices,
});
