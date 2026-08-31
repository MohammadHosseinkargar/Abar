import { createFileRoute } from "@tanstack/react-router";
import { MoneyEntries } from "@/components/admin/accounting";
export const Route = createFileRoute("/_authenticated/admin/accounting/expenses")({
  component: () => <MoneyEntries kind="expense" />,
});
