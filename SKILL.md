---
name: monarch-money
description: "Primary personal-finance app. TypeScript CLI for Monarch Money — search transactions, manage categories, list accounts/budgets, track spending. Use for ANY finance question: spending analysis, budget checks, transaction lookups, bill tracking, net worth, investment balances."
metadata:
  openclaw:
    requires:
      bins: ["monarch-money"]
    install:
      - id: node
        kind: node
        package: "."
        bins: ["monarch-money"]
        label: "Install Monarch Money CLI"
---

# Monarch Money — Primary Finance App

Monarch Money is the user's **primary financial tool**. All bank accounts, credit cards, investments, loans, and budgets are tracked here. Use this for ANY finance-related question.

## Safety and current status

- The official Monarch MCP has been discontinued. This CLI and its raw GraphQL command are the supported access path.
- Read-only commands are safe to run. Commands such as `tx update/create/delete`, `acc refresh`, `receipts split`, `rules create/delete`, `tags create`, and `graphql mutation` change live financial data and require explicit authorization.
- Prefer environment variables or the existing `~/.mm/session.json`; do not put passwords, OTPs, or session tokens on command lines or in logs.

## What's in Monarch

- Linked bank, card, investment, and loan accounts; budgets and goals; searchable transaction history; recurring bills; credit score.
- Balances and holdings change constantly: always query live instead of relying on notes.

## Authentication

### Session-Based Auth (Preferred)

Sessions stored at `~/.mm/session.json`, last up to 7 days. Most commands reuse the saved session.

```bash
# Check if session is still valid
monarch-money auth status

# If expired, re-login (auto-fetches the email OTP from the MONARCH_EMAIL inbox)
monarch-money auth login -e "$MONARCH_EMAIL" -p "$MONARCH_PASSWORD"
```

### Login Flow

Monarch uses **email OTP** (not TOTP MFA). The login process:
1. CLI sends credentials to `api.monarch.com`
2. Monarch sends a 6-digit code to the account email (`$MONARCH_EMAIL`)
3. CLI auto-fetches the code via `gog gmail search` and completes login

If auto-fetch fails, provide the OTP manually:
```bash
monarch-money auth login -e "$MONARCH_EMAIL" -p "$MONARCH_PASSWORD" --otp 123456
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONARCH_EMAIL` | For login | Monarch account email |
| `MONARCH_PASSWORD` | For login | Load from your password manager at runtime; never commit it |

## CLI Commands

### Check Setup

```bash
monarch-money doctor        # Diagnostic checks
monarch-money auth status   # Session validity
```

### Transactions

```bash
# Recent transactions
monarch-money tx search --limit 20

# By date range
monarch-money tx search --start 2026-01-01 --end 2026-01-31

# By merchant
monarch-money tx search --merchant "Uber Eats"

# By category
monarch-money tx search --category "Restaurants"

# By amount range
monarch-money tx search --min 100 --max 500

# Combined filters
monarch-money tx search --merchant "Amazon" --start 2026-02-01 --limit 50

# JSON output (for analysis/scripts)
monarch-money tx search --limit 100 --json

# Get specific transaction
monarch-money tx get <transaction_id>

# Update transaction category
monarch-money tx update <id> --category <category_id>

# Update merchant name
monarch-money tx update <id> --merchant "New Name"

# Add notes
monarch-money tx update <id> --notes "My notes"

# Create manual transaction
monarch-money tx create

# Delete transaction
monarch-money tx delete <id>
```

### Categories

```bash
monarch-money cat list              # List all categories
monarch-money cat list              # IDs are included in table/JSON output
monarch-money cat search "Food"     # Search categories
```

### Accounts

```bash
monarch-money acc list              # All accounts with balances
monarch-money acc list --json       # JSON output
monarch-money acc get <id>          # Account details
```

### Receipt Splitting

```bash
monarch-money receipts template                    # Print split template
monarch-money receipts split <transactionId>       # Split by receipt items
```

## Data Export (Full History)

### Automated Export Script

```bash
# Full export: all transactions → CSV (full history)
node scripts/monarch-export.mjs
# Output: data/monarch/transactions_YYYY-MM-DD.csv

# Account balances → JSON
monarch-money acc list --json 2>/dev/null > data/monarch/accounts_YYYY-MM-DD.json
```

### Export Files (Pre-Downloaded)

For faster analysis, use local exports instead of API calls:

- **Transactions CSV:** `data/monarch/transactions_YYYY-MM-DD.csv`
  - Columns: Date, Merchant, Category, Category Group, Account, Amount, Pending, Notes, Tags, Transaction ID
  - Negative amounts = spending, positive = income
  - Category Groups: `expense`, `income`, `transfer`
- **Accounts JSON:** `data/monarch/accounts_YYYY-MM-DD.json`

### Quick Analysis Patterns (using local CSV)

```bash
# Monthly spending by category for a given month
node -e "
const lines = require('fs').readFileSync('data/monarch/transactions_YYYY-MM-DD.csv','utf8').split('\n').slice(1);
const byCat = {};
lines.forEach(line => {
  // parse CSV (handle quoted fields)
  const parts = []; let inQ = false, cur = '';
  for (const ch of line) { if (ch==='\"'){inQ=!inQ;continue} if (ch===','&&!inQ){parts.push(cur);cur='';continue} cur+=ch; } parts.push(cur);
  if (!parts[0]?.startsWith('2026-01')) return;
  const cat = parts[2], amt = parseFloat(parts[5])||0;
  if (amt >= 0) return;
  byCat[cat] = (byCat[cat]||0) + Math.abs(amt);
});
Object.entries(byCat).sort((a,b)=>b[1]-a[1]).forEach(([c,a])=>console.log(c.padEnd(35)+'\$'+a.toFixed(2)));
"

# Spending trend for a merchant over time
monarch-money tx search --merchant "Uber Eats" --start 2025-01-01 --json 2>/dev/null | \
  node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); \
  const byMonth={}; d.forEach(t=>{const m=t.date.slice(0,7); byMonth[m]=(byMonth[m]||0)+Math.abs(t.amount)}); \
  Object.entries(byMonth).sort().forEach(([m,a])=>console.log(m+': \$'+a.toFixed(2)))"
```

### GraphQL API

Use the CLI so session tokens never appear in shell history or process arguments:

```bash
monarch-money graphql query 'query { me { id } }'
```

**Investment holdings query (WITH account breakdown — critical for per-account analysis):**
```bash
monarch-money portfolio
```

**GraphQL quirks:**
- `orderBy` parameter causes API errors — omit it (results come in recent-first order by default)
- Use `offset` and `limit` for pagination (max ~500 per batch)
- `filters: {}` returns all; add `search`, `startDate`, `endDate`, `categories`, etc. to filter
- Holdings data is aggregated across accounts — each `aggregateHolding` has a `holdings` array showing which accounts hold it
- Some 401(K) positions don't have tickers (pooled trust funds like "VANG 500 INDEX TRUST")
- Holdings export: `data/monarch/holdings_*.json`

## Common Tasks

### "How much did I spend on X this month?"

```bash
monarch-money tx search --category "Restaurants" --start 2026-02-01 --json 2>/dev/null | \
  node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); \
  console.log('Total: \$' + d.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0).toFixed(2) + ' (' + d.filter(t=>t.amount<0).length + ' transactions)')"
```

### "What's my net worth?"

```bash
monarch-money acc list --json 2>/dev/null | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
let nw = 0;
d.filter(a=>a.includeBalanceInNetWorth).forEach(a => nw += a.currentBalance);
console.log('Net Worth: \$' + nw.toLocaleString('en-US',{minimumFractionDigits:2}));"
```

### "Any large charges recently?"

```bash
monarch-money tx search --min 100 --limit 20
```

### "What did I spend at Uber Eats?"

```bash
monarch-money tx search --merchant "Uber Eats" --start 2026-01-01
```

### "Month-over-month spending comparison"

```bash
# Use local CSV for fast multi-month analysis
node -e "
const lines = require('fs').readFileSync('data/monarch/transactions_YYYY-MM-DD.csv','utf8').split('\n').slice(1);
const byMonth = {};
lines.forEach(line => {
  const parts = []; let inQ=false,cur='';
  for(const ch of line){if(ch==='\"'){inQ=!inQ;continue}if(ch===','&&!inQ){parts.push(cur);cur='';continue}cur+=ch;}parts.push(cur);
  const month = parts[0]?.slice(0,7);
  const amt = parseFloat(parts[5])||0;
  const catGroup = parts[3];
  if(!month||catGroup!=='expense') return;
  byMonth[month] = (byMonth[month]||0) + Math.abs(amt);
});
Object.entries(byMonth).sort().slice(-12).forEach(([m,a])=>console.log(m+': \$'+a.toLocaleString('en-US',{minimumFractionDigits:0})));
"
```

### "Weekly financial snapshot"

```bash
# Get this week's transactions, account balances, and compute summary
monarch-money acc list --json 2>/dev/null > /tmp/acc.json
monarch-money tx search --start $(date -d '7 days ago' +%Y-%m-%d) --limit 200 --json 2>/dev/null > /tmp/week-txns.json
# Then analyze with node for category breakdown, net worth, large transactions, etc.
```

## Session Expiry & Re-Auth

Sessions last ~7 days. If you get "Not logged in" or "Session expired":
1. Run `monarch-money auth login` (auto-handles email OTP)
2. If auto-OTP fails: check `gog gmail search "from:monarch subject:code" --account "$MONARCH_EMAIL" --max 1` for the code
3. Re-run with `--otp <CODE>`

## Data Files

- **Session:** `~/.mm/session.json`
- **CLI config:** `~/.mm/cli-config.json`
- **Full transaction export:** `data/monarch/transactions_*.csv` (refresh with `scripts/monarch-export.mjs`)
- **Account snapshots:** `data/monarch/accounts_*.json`
- **Finance snapshots:** `memory/finance-snapshot-*.md`
- **Daily log:** `memory/finance-daily-log.md`

## Library Usage (TypeScript)

```typescript
import { MonarchClient } from 'monarch-money';

const client = new MonarchClient({ baseURL: 'https://api.monarch.com' });
client.loadSession();

const txns = await client.transactions.getTransactions({ limit: 10 });
const accounts = await client.accounts.getAll();
const categories = await client.categories.getCategories();
```

## Error Handling

| Error | Fix |
|-------|-----|
| "Not logged in" | `monarch-money auth login` |
| "Session expired" | `monarch-money auth login` |
| "Email OTP required" | Auto-handled; or pass `--otp <CODE>` |
| 525 SSL error | Wrong API URL or Monarch outage — use `api.monarch.com` |
| JSON parse error | Redirect stderr: `monarch-money ... --json 2>/dev/null` (spinner text leaks into stdout) |

## Deep-Dive Addendum (Apr 2026)

### Important: codebase supports more than this doc previously listed

`lib/client/graphql/operations.ts` is only a **subset**. Many advanced operations are implemented directly in API modules (especially `lib/api/transactions/TransactionsAPI.ts`, `lib/api/recurring/RecurringAPI.ts`, `lib/api/cashflow/CashflowAPI.ts`).

### Advanced capabilities already in this skill code

- **Transaction rules:** list/create/update/delete/preview + delete-all
- **Bulk transaction ops:** bulk update, bulk delete, bulk notes, bulk category/tag edits
- **Recurring intelligence:** recurring streams, upcoming recurring items, aggregated recurring items, review stream, mark-not-recurring
- **Tags & categories:** full CRUD + set/add/remove tags on transaction
- **Merchant workflows:** merchant search/details/edit-related queries
- **Splits:** get/update transaction split data
- **Cashflow analytics:** `aggregates` by category, categoryGroup, account, merchant, month + summary
- **Institution diagnostics:** credentials + account mapping view + refresh status
- **Insights surfaces:** credit score snapshots, notifications, subscription details

### High-value GraphQL patterns to keep handy

#### 1) Recurring streams
```graphql
query Common_GetRecurringStreams($includeLiabilities: Boolean) {
  recurringTransactionStreams(includeLiabilities: $includeLiabilities) {
    id
    frequency
    isActive
    merchant { id name }
    amount
    nextOccurrenceDate
  }
}
```

#### 2) Cashflow aggregate (category + merchant)
```graphql
query Web_GetCashFlowPage($filters: TransactionFilterInput) {
  byCategory: aggregates(filters: $filters, groupBy: ["category"]) {
    groupBy { category { id name group { id type } } }
    summary { sum }
  }
  byMerchant: aggregates(filters: $filters, groupBy: ["merchant"], limit: 50) {
    groupBy { merchant { id name } }
    summary { sum }
  }
}
```

#### 3) Bulk transaction update
```graphql
mutation Common_BulkUpdateTransactionsMutation(
  $selectedTransactionIds:[ID!]
  $excludedTransactionIds:[ID!]
  $allSelected:Boolean!
  $expectedAffectedTransactionCount:Int!
  $updates:TransactionUpdateParams!
  $filters:TransactionFilterInput
) {
  bulkUpdateTransactions(
    selectedTransactionIds:$selectedTransactionIds
    excludedTransactionIds:$excludedTransactionIds
    updates:$updates
    allSelected:$allSelected
    expectedAffectedTransactionCount:$expectedAffectedTransactionCount
    filters:$filters
  ) {
    success
    affectedCount
    errors { message }
  }
}
```

### Official product updates worth tracking

From `monarch.com/whats-new` and related pages:
- AI Assistant
- Reimagined goals
- Equity tracking
- Receipt scanning
- Shared Views (yours/mine/ours household framing)
- Saved reports
- Credit score tracking
- Connectivity dashboard
- Monarch extension (Amazon/Target itemization-style workflows)

### Community power-user tactics (from Reddit/help snippets)

- Build aggressive rules (review status, split defaults, merchant renames, category/tag assignment)
- Use yearly CSV exports + pivots to seed next-year budgets quickly
- Create distinct merchant variants when one merchant has multiple recurring charges
- Use recurring + review thresholds to cut transaction triage workload

### Ecosystem notes (GitHub)

Useful repos to monitor:
- `hammem/monarchmoney` (Python baseline)
- `keithah/monarchmoney-enhanced` + `keithah/monarchmoney-ts` (newer fork direction)
- `pbassham/monarch-money-api` (JS)
- MCP ecosystem (`*-monarch-mcp*`) for assistant integrations

### Known reliability hazards

- Endpoint drift: always use `https://api.monarch.com/graphql` (not legacy `api.monarchmoney.com`)
- Community wrappers may break when web app GraphQL changes
- Reddit/help pages often block bot fetches; rely on indexed snippets when needed

## References

- [API.md](references/API.md) — GraphQL API details
- [TROUBLESHOOTING.md](references/TROUBLESHOOTING.md) — Common issues
