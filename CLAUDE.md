# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Rules

- **Never read or modify `.env` or `.env.local`**, through any tool (Read, Edit, Write, or Bash — `cat`, `grep`, `sed`, etc.). These hold live secrets (`DATABASE_URL`, `AUTH_SECRET`). This is also enforced at the permission layer in [.claude/settings.json](.claude/settings.json).
- **Always enter plan mode before making any change** and only start editing after the plan is approved. This project defaults to plan mode (`permissions.defaultMode: "plan"` in [.claude/settings.json](.claude/settings.json)); do not bypass it even for small changes.

## About

FinFamily — a personal/family finance web app (Next.js App Router, Portuguese-language UI). Tracks bank accounts and credit cards, income/expense/transfer transactions, budgets, and an investment portfolio (stocks, FIIs, crypto, fixed income) with allocation targets.

## Commands

```bash
npm run dev          # start dev server (runs `prisma generate` first via predev)
npm run build         # production build (runs `prisma generate` first via prebuild)
npm run lint          # eslint

npm run db:migrate    # prisma migrate dev — create/apply a migration
npm run db:push       # push schema changes without a migration
npm run db:generate   # regenerate Prisma client into src/generated/prisma
npm run db:studio     # Prisma Studio
npm run db:seed       # run prisma/seed.ts via tsx
npm run db:reset      # prisma migrate reset
```

There is no test suite configured in this repo.

## Architecture

**Stack**: Next.js 16 (App Router, React 19), NextAuth v5 (beta) with the Credentials provider + Prisma adapter, Prisma 7 with the `@prisma/adapter-pg` driver adapter over `pg`, Tailwind v4, Radix UI primitives, react-hook-form + Zod, Recharts.

**Prisma client is generated to a non-default location**: `src/generated/prisma` (not `node_modules/@prisma/client`), configured via `generator client { output = "../src/generated/prisma" }` in [prisma/schema.prisma](prisma/schema.prisma). Always import Prisma types from `@/generated/prisma`, and re-export app-facing enum types through [src/types/index.ts](src/types/index.ts) rather than importing `@/generated/prisma` throughout the UI layer. Prisma config (schema path, migrations path, datasource URL) lives in [prisma.config.ts](prisma.config.ts), not in `package.json`.

**Data access has two distinct layers, don't blur them**:
- [src/lib/queries.ts](src/lib/queries.ts) — read-only data-fetching functions (`server-only`), called from Server Components (pages). Each function takes `userId` explicitly rather than reading the session itself. This is also where derived/computed values live (account balances computed from transaction history, dashboard KPIs, net-worth time series, investment gain/loss calcs) — the DB only stores an opening `balance`/`avgPrice`; current values are always calculated at read time.
- [src/actions/*.actions.ts](src/actions/) — `"use server"` mutations, one file per domain (`transaction`, `account`, `budget`, `category`, `credit-card`, `family`, `investment`, `user`, `auth`, `query`). Every action: calls `getRequiredUserId()` from [src/lib/session.ts](src/lib/session.ts) first, parses input with a Zod schema from [src/lib/validations/index.ts](src/lib/validations/index.ts), scopes every Prisma query with `userId` (never trust an id from the client alone — re-check ownership via `findFirst({ where: { id, userId } })`), calls `revalidatePath(...)` on success, and returns `ActionResult<T>` (`{ success: true, data?, budgetAlert? } | { success: false, error }` from [src/types/index.ts](src/types/index.ts)) instead of throwing — client components branch on `result.success`.

**Auth**: [src/lib/auth.config.ts](src/lib/auth.config.ts) holds the edge-safe config (pages, JWT session strategy, the `authorized` callback that gates all routes) and is imported by both [src/middleware.ts](src/middleware.ts) (route protection at the edge) and [src/lib/auth.ts](src/lib/auth.ts) (the full config with the Prisma adapter and Credentials provider, which can't run on the edge). Route protection is global and allowlist-based: everything requires a session except `/`, `/login`, and `/api/auth/*` — see the `authorized` callback rather than per-page checks. There is no public sign-up route: this is a single-user personal deployment, and the only user is created via [prisma/seed.ts](prisma/seed.ts) (`SEED_USER_NAME`/`SEED_USER_EMAIL`/`SEED_USER_PASSWORD`). Server Components/Actions get the user id via `auth()`; don't duplicate that logic — use `getRequiredUserId()` / `getOptionalUserId()` from [src/lib/session.ts](src/lib/session.ts).

**Money and dates**: all monetary columns are `Decimal` in Postgres; Prisma returns `Decimal` objects that query/action code converts to `Number(...)` before sending to client components — keep doing this at the query-layer boundary rather than passing Decimals into client code. Dates use `date-fns` for month/year range math (`startOfMonth`, `subMonths`, etc.); budgets and cash-flow are always scoped by `{ month, year }` rather than arbitrary ranges.

**Route structure**: `src/app/(auth)/` (login/register, unauthenticated layout) and `src/app/(app)/` (dashboard, `fluxo-de-caixa` (cash flow) + its `cartoes`/`orcamentos` sub-pages, `investimentos`, `configuracoes`) are separate route groups with separate layouts. `(app)/layout.tsx` is a Server Component that redirects to `/login` if unauthenticated, then wraps children in `AppLayoutClient` (client-side shell: sidebar/topbar).

**Component conventions**: `src/components/ui/` are Radix-based primitives (shadcn-style, no `components.json` — added manually). Feature components follow a `*Client.tsx` (client component owning state/interactivity for a page) + `*FormDialog.tsx` (create/edit modal, react-hook-form + zodResolver against the matching schema in `validations/index.ts`) pattern per domain, e.g. `TransactionsClient` + `TransactionFormDialog`, `BudgetsClient` + `BudgetFormDialog`. `src/components/shared/PrivacyContext.tsx` + `PrivacyValue.tsx` implement a global "hide monetary values" toggle used across dashboard/cash-flow/investment displays.

**Transaction model nuances**: a `TRANSFER` moves money between two `BankAccount`s (`bankAccountId` → `destinationAccountId`) and has no `categoryId`; `INCOME`/`EXPENSE` are categorized and single-account. Installment purchases (`installments > 1`) are expanded into N separate monthly `Transaction` rows sharing a `parentId` (the first installment's own id) — only the parent/original row of a series can be edited or deleted, and deleting the parent deletes the whole series. Budgets (`Budget`) are per `categoryId` + `month` + `year`; `checkBudget()` in [transaction.actions.ts](src/actions/transaction.actions.ts) runs after create/update of an `EXPENSE` and returns a `budgetAlert` message (not an error) when the category's budget is exceeded or ≥90% used.

**Categories** can be global system defaults (`userId: null`) or user-created (`userId: <id>`); queries fetch with `OR: [{ userId }, { userId: null }]`.
