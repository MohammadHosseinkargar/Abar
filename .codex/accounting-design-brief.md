# Accounting admin module

Implement the accounting UI in the existing TanStack Start application. Target is the Persian RTL store administrator.

- Match `src/components/admin/kit.tsx`: compact neo-brutalist cards, 2px black borders, colored bars, high contrast, horizontal mobile-friendly admin navigation.
- Create actual application route files under `src/routes/_authenticated/admin/`, not standalone markup.
- Use the server functions exported by `src/lib/accounting.functions.ts` (if functions are not yet present, structure calls/imports consistently and do not create fake data).
- Required views: financial dashboard, invoices (list + editor with readonly catalogue search and manual items), manual incomes, expenses/categories, ledger, reports, and accounting settings.
- Invoice editor must make catalogue price visibly editable as invoice price and show line/total/payment calculations. Include print-friendly invoice view with print action; no client-side PDF library needed.
- Use existing Recharts for dashboard charts where data is available. Keep every view responsive with horizontal overflow only for tabular portions.
- Preserve the existing product pages and never include any stock or product mutation in this module.

Output: commit edits directly into the application routes/components, with a concise report of created files.
