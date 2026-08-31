# Evaluation — Attempt 1

## Overall Verdict: NEEDS REVISION

## Overall Assessment

The accounting area follows the existing compact neo-brutalist administration system consistently: heavy black rules, colour bars, monospace figures, and concise card layouts. The source review suggests a workable information structure, but it still reads mostly as a generic collection of existing `Panel`, `Stat`, and form primitives rather than a deliberately composed financial workspace, and several required high-value views are too thin to feel ready for day-to-day use.

Browser evidence was unavailable: the local Vite process exited before `http://127.0.0.1:4179/admin/accounting` accepted a connection. Scores are therefore based on the rendered React structure and class-level responsive behaviour in the supplied source; this should be rechecked visually at desktop, tablet, and mobile once the application runs.

## Scores

| Criterion | Score | Status | Weight | Notes |
|-----------|-------|--------|--------|-------|
| Design Quality | 2/3 | PASS | HIGH | The consistent `AdminHeader`/colour-bar/card language fits the stated neo-brutalist brief and the rest of the admin panel. Financial priority is flattened, however: ten same-weight metric cards and one chart do not establish a clear primary reading path. |
| Originality | 1/3 | FAIL | HIGH | Apart from the provided kit primitives, the pages rely on standard grids, lists, and tables. There is no accounting-specific visual composition such as an income-vs-expense summary, receivables callout, period comparison, or invoice document layout to make this module memorable and purpose-built. |
| Craft | 1/3 | PASS | MEDIUM | Spacing and borders are largely coherent, and tables have explicit overflow containers. The dashboard chart is `min-w-[540px]` inside a regular `Panel` with no local `overflow-x-auto`; on a 375px viewport it can expand the page horizontally, contrary to the brief's rule that only tabular portions may overflow. |
| Functionality | 1/3 | PASS | MEDIUM | Basic forms, empty states, labels, and destructive action confirmations are present. But the dashboard range control is not passed to `accountingDashboard`, the requested custom range is absent, and the print action prints the editable back-office form rather than a customer-ready invoice view. The reports and entry forms also expose only a small subset of the filters/fields requested. |

## What's Working Well

- The dashboard, list screens, and editor use the same high-contrast visual grammar as `kit.tsx`, so the new section should feel native to the current panel rather than a transplanted template.
- Invoice rows make the distinction between catalogue price and editable invoice price explicit, then keep a live row amount and summary strip visible. This supports the key mental model of a saved price snapshot.
- The invoice editor uses an overflow wrapper around its dense 850px line-item table while keeping the customer fields and totals in responsive grids.
- Empty, loading, destructive, and status states are visually accounted for; the small coloured `Tag` treatment is a clear fit for payment and transaction type badges.

## Issues Found

### Issue 1: No accounting-specific visual hierarchy on the financial dashboard

- **What**: All ten metrics use identical cards and receive almost equal emphasis. The page has one undifferentiated chart below them, with no prominent net-profit/receivables result, period comparison, or visual grouping of sales, costs, and cash collection.
- **Where**: `FinanceDashboard` metric grid and chart panel in `src/components/admin/accounting.tsx`.
- **Why it matters**: A finance dashboard should let an administrator identify the business outcome and urgent outstanding balances at a glance; a ten-card wall makes the first scan slow and generic.
- **Suggested fix**: Make net profit and outstanding receivables two larger hero cards, group the remaining metrics into sales/cost/cash blocks, and add period-over-period deltas or short explanatory labels. Keep the existing neo-brutalist tokens but give the layout a financial narrative.

### Issue 2: The invoice "print" output is an edit form, not a professional invoice document

- **What**: `window.print()` is attached to the invoice editor itself. That page contains editable inputs, catalogue controls, action buttons, and admin header rather than a clean recipient-facing document with business details and an invoice identity.
- **Where**: `InvoiceEditor` print button and enclosing `Panel` in `src/components/admin/accounting.tsx`.
- **Why it matters**: This fails the intended customer-sendable invoice experience and can expose internal editing controls in a printed/exported document.
- **Suggested fix**: Build a separate print-only invoice document/view with business logo and contact details, invoice number/date, customer block, static line table, totals/payment status, notes, and footer. Hide all admin navigation and controls in print CSS; provide a preview action alongside print.

### Issue 3: Mobile overflow can escape its intended component

- **What**: The chart container is `min-w-[540px]`, but its immediate `Panel` parent is `overflow-hidden`, not an intentional horizontally scrollable chart region.
- **Where**: Financial dashboard chart panel.
- **Why it matters**: On phones this likely causes clipping (or, depending on ancestor sizing, page-level horizontal overflow), while the brief permits horizontal overflow only for tables.
- **Suggested fix**: Remove the fixed minimum width and make chart labels/data adapt to the available width, or provide a mobile-specific compact chart. If a fixed chart width is essential, place it in an explicitly labelled, local overflow wrapper and verify no page-level overflow occurs.

### Issue 4: Key requested screens and filters are visually incomplete

- **What**: Reports render only six statistics plus week/month/year. The dashboard omits the custom date range, and the manual expense form omits category, quantity, unit, and unit price. Settings omit visible logo, currency, and invoice-style controls.
- **Where**: `Reports`, `FinanceDashboard`, `MoneyEntries`, and `AccountingSettings`.
- **Why it matters**: The navigation promises a full accounting module, but operators cannot discover or use much of the requested reporting and data-entry capability from the presented UI.
- **Suggested fix**: Add a compact filter bar shared by dashboard/reports (preset, custom dates, category, type, method, product/customer, payment status), category selection and quantity/unit/price calculation for expenses, plus settings controls for logo/currency/accent. Present detailed reports in responsive tables or drill-down panels, not only headline cards.

### Issue 5: The time filter currently gives a misleading interaction cue

- **What**: Changing `range` changes the React Query key but `accountingDashboard` is called with an empty payload every time.
- **Where**: `FinanceDashboard` query function.
- **Why it matters**: The visible selector implies that the numbers and chart update by period, yet the request does not carry the selection. This is a trust issue in a finance UI.
- **Suggested fix**: Pass `{ range }` (or the selected explicit dates) to the server function, show the selected period near the numbers, and add a clear loading/error transition after filter changes.

## Priority Fixes for Next Attempt

1. Create a dedicated invoice preview/print document and ensure it contains only customer-facing information and static amounts.
2. Recompose the dashboard around net profit and receivables, then make the chart mobile-safe without page-level horizontal overflow.
3. Complete the filter and field affordances that the navigation promises, especially custom dates/reports and detailed expense entry; wire the selected range into the dashboard request.

## Should the next attempt REFINE or PIVOT?

**REFINE.** The visual direction is appropriate and already aligned to the existing admin kit. The next pass needs accounting-specific hierarchy, complete decision-critical interactions, and a proper document presentation rather than replacing the overall aesthetic.
