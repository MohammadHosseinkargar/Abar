import { createFileRoute } from "@tanstack/react-router";
import { MoneyEntries } from "@/components/admin/accounting";
export const Route = createFileRoute("/_authenticated/admin/accounting/incomes")({
  component: () => <MoneyEntries kind="income" />,
});
