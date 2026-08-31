import { createFileRoute } from "@tanstack/react-router";
import { AccountingSettings, Categories } from "@/components/admin/accounting";
export const Route = createFileRoute("/_authenticated/admin/accounting/settings")({
  component: () => (
    <>
      <AccountingSettings />
      <div className="mt-6">
        <Categories />
      </div>
    </>
  ),
});
