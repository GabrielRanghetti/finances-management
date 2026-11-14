# Personal finance and wealth management app: plan

## Context

Gabriel wants one app to record every financial asset, income, expense and investment, see his whole net worth (patrimônio) over time, and control taxes and obligations. The repo is empty (only `README.md`), so this is a new build.

Decisions he made:

- Tax rules: Brazil, with assets abroad (Interactive Brokers).
- Audience: himself first, built so it can become a product for others. Real logins and per-user data isolation from day one; billing, LGPD paperwork and paid bank sync come later.
- Platform: one responsive web app, installable on the phone as a PWA.
- Stack: TypeScript end to end.
- Data entry: manual plus file import, with automatic sync where it is cheap.
- Hosting: cloud, private behind login.
- Extra scope for v1: debts and liabilities, budget and goals, obligations calendar with alerts, document vault.

What the research found:

- Kinvo, Gorila, Grana Capital and myProfit each cover investments or stock-exchange tax. None of the ones I found combines net worth, cash flow, Brazilian tax and foreign assets. That combination is the product's reason to exist.
- Automatic bank sync costs money. Pluggy has no free production tier (third-party quotes range from about US$149/month to R$2,500/month) and B3's Área do Investidor API is contract-only. Both wait for the product phase. Until then users import the spreadsheets that B3 and the banks already let them download.
- IBKR's Flex Web Service is free and read-only with a user token, limited to 365 days per query. It is the one automatic sync worth building early.
- Tax rules changed in 2026 (Lei 15.270: 10% withholding on dividends above R$50k/month from one company, minimum IRPF above R$600k/year; Lei 14.754 still governs assets abroad). Rules must be stored as data versioned by year.

## Approaches considered

1. Web app with PWA, TypeScript full stack (chosen). One codebase, no store review, good on large screens where imports and reports happen. iOS supports push for installed PWAs. Weaker on background sync and widgets, which this app does not need yet.
2. Web plus a React Native app. Better mobile feel and store presence for about 1.5x to 2x the front-end work. Deferred to the product phase; the API and domain logic stay reusable.
3. Native mobile first. Rejected: poor fit for data entry, file import and tax reports.

## Stack

| Concern | Choice | Why |
|---|---|---|
| App | Next.js (App Router), React, TypeScript | One language for UI, API, importers and tax engine |
| UI | Tailwind, shadcn/ui, Recharts | Standard, accessible components and charts |
| Database | PostgreSQL (Neon, São Paulo region) with Drizzle ORM | Relational data, exact `numeric` type, typed queries |
| Money | Integer cents for amounts, `numeric` for quantities and prices, `decimal.js` in code | Floats are never used for money |
| Auth | Better Auth with email/password, passkeys and TOTP 2FA | Financial data needs 2FA from the start |
| Files | S3-compatible bucket (Cloudflare R2), private, signed URLs | Document vault and import originals |
| Jobs | Vercel Cron | Daily quotes, FX rates, reminders |
| Alerts | Web Push (VAPID) and email (Resend) | Tax due dates |
| Hosting | Vercel | Managed, cheap at one user |
| Tests | Vitest, Playwright | Unit tests for money and tax logic, a few end-to-end flows |
| Market data | brapi.dev (B3 quotes), BCB PTAX API (FX), IBKR Flex (foreign positions) | Free or cheap; each behind a small adapter so it can be swapped |

UI language: Portuguese (pt-BR) with strings kept in one messages file so English can be added later.

## Architecture

A single Next.js app. Domain logic lives in plain TypeScript modules with no framework imports, so a future mobile app or worker can reuse it:

```
src/
  app/            routes and pages (dashboard, accounts, investments, budget, taxes, calendar, documents)
  domain/         pure logic: ledger, positions (preço médio), networth, budget, tax/
  domain/tax/     rules/<year>.ts (versioned rule data) + calculators
  importers/      ofx, csv, b3-xlsx, ibkr-flex; each returns the same normalized rows
  db/             Drizzle schema, migrations, user-scoped query helpers
  integrations/   quotes, fx, ibkr, push, email adapters
```

Data isolation: every table carries `user_id`. All queries go through helpers in `src/db/` that require the session user, and one test proves user A cannot read user B's rows through any route.

Core tables:

- `accounts` (bank, cash, credit card, brokerage, loan, property, vehicle, other; currency)
- `transactions` (date, amount, category, account, transfer pair, installment group)
- `categories`, `budgets`, `goals`, `recurring_rules`
- `instruments` (ação, FII, ETF, BDR, Tesouro, renda fixa, fundo, previdência, cripto, foreign stock/ETF)
- `trades` (buy/sell, quantity, price, fees, currency, FX rate, day-trade flag), `corporate_actions` (splits, bonuses, subscriptions), `income_events` (dividendo, JCP, rendimento, aluguel, juros; tax withheld)
- `valuations` (manual value history for property, vehicles and anything unquoted), `prices`, `fx_rates`
- `liabilities` (principal, rate, schedule) with payments as transactions
- `obligations` (type, due date, amount, status, linked payment), `documents` (file, year, linked entity)
- `tax_results` (period, bucket, base, tax due, loss carried forward)

Positions, average cost and net worth are derived from these tables on read, cached only if it gets slow.

## Features in v1

1. Accounts and cash flow: manual entry, OFX and CSV import with duplicate detection, categories, transfers, credit card installments.
2. Net worth: assets minus liabilities over time, by class, currency and institution, in BRL with foreign assets converted at PTAX.
3. Investments: trades, income, corporate actions, average cost, realized and unrealized gain, allocation. Import from the B3 Área do Investidor spreadsheet and IBKR Flex (file first, token sync after).
4. Debts: loans, financing and cards with balances and schedules.
5. Budget and goals: monthly budget by category, recurring bills, savings goals, cash-flow forecast.
6. Taxes:
   - Monthly variable income in Brazil: swing trade, day trade, FII and ETF buckets, the R$20k monthly sales exemption for shares, loss carryforward per bucket, withheld tax, DARF amount and due date.
   - Assets abroad under Lei 14.754: yearly gains and dividends at 15%, loss compensation, foreign tax credit, PTAX conversion.
   - Carnê-leão inputs for rent and foreign income.
   - Yearly IRPF helper: bens e direitos at 31/12 with acquisition cost, exempt, exclusive and taxable income totals, dívidas e ônus, in the order the Receita program asks for them.
   - Every result shows the rule and the entries behind it, and is labelled an estimate to confirm with an accountant.
7. Obligations calendar: DARF, carnê-leão, IRPF deadline and quotas, IPTU, IPVA, insurance, with push and email reminders and a paid trail.
8. Document vault: informes de rendimentos, notas de corretagem, receipts and contracts attached to the entries they prove, filtered by tax year.
9. Full data export (JSON and CSV) and account deletion, needed for trust now and for LGPD later.

## Gaps left for the roadmap

Open Finance sync through Pluggy and the B3 API, billing and plans, LGPD consent and terms, onboarding, a React Native shell, target allocation and rebalancing, performance against CDI, IPCA and Ibovespa, retirement and financial independence projections, PGBL deduction optimizer, family sharing, read-only access for an accountant, automatic categorization with AI, insurance register.

## Build order

Each phase ends with something usable and gets its own detailed plan and worker specs through `/orchestration` (Development and QA workers, Karpathy and ponytail rules, no attribution lines in commits).

0. Design doc and foundation. Commit this design to `docs/superpowers/specs/2026-11-14-finance-app-design.md`. Scaffold Next.js, Drizzle and Neon, auth with 2FA, user-scoped query helpers with the isolation test, PWA manifest, CI running lint, typecheck and tests, first deploy.
1. Ledger and net worth. Accounts, transactions, categories, liabilities, valuations, OFX/CSV import, net worth dashboard.
2. Investments. Instruments, trades, corporate actions, income, positions, quotes and FX jobs, B3 spreadsheet and IBKR Flex importers.
3. Budget, goals, recurring bills, forecast.
4. Taxes, obligations calendar, alerts, document vault, export.
5. Product phase (separate decision): billing, LGPD, Pluggy, onboarding, mobile shell.

## Verification

- Money and tax logic: Vitest unit tests with worked examples. Each tax calculator gets fixtures taken from official Receita Federal examples or a past DARF/IRPF of Gabriel's that he knows to be correct.
- Importers: fixture files (anonymized OFX, B3 spreadsheet, IBKR Flex XML) with expected normalized rows; importing the same file twice creates no duplicates.
- Isolation: a test that creates two users and asserts every list and detail route returns only the caller's data.
- End to end (Playwright): sign up with 2FA, add an account, import a statement, record a trade, see net worth change, see the DARF appear in the calendar.
- Reality check per phase: Gabriel loads his own data and compares net worth with his current spreadsheet and Investidor10 portfolio, and the tax output with his last declaration.

## Risks and things to confirm before coding them

- Tax correctness is the largest risk. Each rule (the R$20k exemption, crypto rules, the Lei 15.270 details, come-cotas) must be checked against the Receita source for the year before it is coded. My research covered the 2026 changes at a summary level only.
- Pluggy and B3 API prices are unconfirmed; get quotes before the product phase.
- brapi.dev limits and terms need checking for commercial use once there are other users.
- Selling a tax tool to others may carry regulatory and liability questions. Get legal advice before phase 5.
