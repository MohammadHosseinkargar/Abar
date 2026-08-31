import { createFileRoute } from "@tanstack/react-router";
import { Ledger } from "@/components/admin/accounting";
export const Route = createFileRoute("/_authenticated/admin/accounting/transactions")({
  component: Ledger,
});
