---
name: monarch-money
description: "Austen's primary financial app. TypeScript CLI for Monarch Money — search transactions, manage categories, list accounts/budgets, track spending. Use for ANY finance question: spending analysis, budget checks, transaction lookups, bill tracking, net worth, investment balances."
metadata:
  clawdbot:
    requires:
      env: ["MONARCH_EMAIL", "MONARCH_PASSWORD"]
    install:
      - id: node
        kind: node
        package: "."
        bins: ["monarch-money"]
        label: "Install Monarch Money CLI"
---

# Monarch Money — Primary Finance App

Monarch Money is Austen's **primary financial tool**. All bank accounts, credit cards, investments, loans, and budgets are tracked here. Use this for ANY finance-related question.

## What's in Monarch

- **30 linked accounts** — Fidelity (401k, individual, Roth IRA, HSA), AMEX (Platinum, Blue Cash, Corporate), Capital One (auto loan, checking, savings, Savor), Chase (Sapphire Preferred, Freedom Unlimited), Robinhood (individual, managed, Roth IRA, trad IRA), USAA, Apple Cash, Venmo, Acorns, Marcus by Goldman Sachs, Wex HSA
- **Net worth:** ~$712K (investments ~$706K, cash ~$19K, minus ~$13K debt)
- **Budgets & goals** — monthly tracking across all categories
- **Transaction history** — 12,839+ transactions since May 2019, searchable
- **Recurring bills** — auto-detected subscriptions and recurring charges
- **Credit score** — tracked via Spinwheel partnership

## Account Snapshot (as of Feb 2026)

### Investments ($706K)
- Fidelity 401(K): $341K | Fidelity Individual: $243K
- Robinhood Individual: $39K | Fidelity 401(K) Roth: $23K
- Fidelity Roth IRA: $21K | Fidelity HSA: $15K
- Robinhood Managed: $15K | Robinhood Roth IRA: $5K
- Acorns: $3K | Robinhood Traditional IRA: $100

### Cash ($19K)
- Marcus Savings: $17K | Capital One Checking: $1.2K | Venmo: $408

### Debt ($13K)
- Capital One Auto Loan: $9.3K (CLA 45)
- Credit Cards: $3.5K total (AMEX Platinum $2K is the biggest chunk)

### Income
- GitHub salary: ~$132K/yr + $31.7K ESPP (MSFT)
- Roommate rent: $1,200/mo
- Monthly discretionary: ~$11,495/mo

### Key Spending Patterns
- **Uber Eats:** $450/mo avg, 900+ lifetime orders, $23.5K total since Aug 2022
- **Restaurants:** Pace ~$1,400/mo (very high)
- **Groceries:** Low (~$33/mo in Feb) — huge restaurant vs grocery imbalance
- Heavy Robinhood buy/sell activity inflates gross in/out numbers

## Authentication

### Session-Based Auth (Preferred)

Sessions stored at `~/.mm/session.json`, last up to 7 days. Most commands reuse the saved session.

```bash
# Check if session is still valid
monarch-money auth status

# If expired, re-login (auto-fetches email OTP from tag@austen.info inbox)
monarch-money auth login -e tag@austen.info -p "$MONARCH_PASSWORD"
```

### Login Flow

Monarch uses **email OTP** (not TOTP MFA). The login process:
1. CLI sends credentials to `api.monarch.com`
2. Monarch sends a 6-digit code to `tag@austen.info`
3. CLI auto-fetches the code via `gog gmail search` and completes login

If auto-fetch fails, provide the OTP manually:
```bash
monarch-money auth login -e tag@austen.info -p "$MONARCH_PASSWORD" --otp 123456
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONARCH_EMAIL` | Yes | `tag@austen.info` |
| `MONARCH_PASSWORD` | Yes | Stored in local vault (`scripts/vault.sh get monarch-money password`) |

### Credentials

- **Email:** tag@austen.info
- **Password:** In local vault — `scripts/vault.sh get monarch-money password`
- **Account type:** Household member (Taggert Stone) in "Austen Stone" household
- **User ID:** 235319839385912643
- **Household ID:** 178381781130126291
- **API URL:** `https://api.monarch.com` (**not** api.monarchmoney.com — that returns 525 SSL errors)

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
monarch-money cat list --show-ids   # With IDs (needed for tx update)
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
# Full export: all transactions → CSV (12,839+ rows, ~1.5MB)
node scripts/monarch-export.mjs
# Output: data/monarch/transactions_YYYY-MM-DD.csv

# Account balances → JSON
monarch-money acc list --json 2>/dev/null > data/monarch/accounts_YYYY-MM-DD.json
```

### Export Files (Pre-Downloaded)

For faster analysis, use local exports instead of API calls:

- **Transactions CSV:** `data/monarch/transactions_2026-02-10.csv` — 12,839 rows, May 2019 → Feb 2026
  - Columns: Date, Merchant, Category, Category Group, Account, Amount, Pending, Notes, Tags, Transaction ID
  - Negative amounts = spending, positive = income
  - Category Groups: `expense`, `income`, `transfer`
- **Accounts JSON:** `data/monarch/accounts_2026-02-10.json` — 30 accounts with full details

### Quick Analysis Patterns (using local CSV)

```bash
# Monthly spending by category for a given month
node -e "
const lines = require('fs').readFileSync('data/monarch/transactions_2026-02-10.csv','utf8').split('\n').slice(1);
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

### GraphQL API (Direct)

For custom queries beyond what the CLI supports:

```bash
TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.mm/session.json','utf8')).token)")

# Inline query (no orderBy — it causes API errors)
curl -s "https://api.monarch.com/graphql" \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"query{allTransactions(filters:{}){totalCount results(offset:0,limit:5){id amount date merchant{name}category{name}account{displayName}}}}"}'
```

**Investment holdings query (WITH account breakdown — critical for per-account analysis):**
```bash
# Get all holdings with security details, quantities, values, AND which account holds them
# This is the KEY query — it shows holdings per account, not just aggregated
curl -s "https://api.monarch.com/graphql" \
  -H "Authorization: Token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"query{aggregateHoldings{edges{node{id security{id name ticker currentPrice type}quantity totalValue holdings{id account{id displayName}}}}}}"}'
# NOTE: 401(k) pooled trust funds (VANG 500 INDEX TRUST etc) have no ticker — identify by name
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
const lines = require('fs').readFileSync('data/monarch/transactions_2026-02-10.csv','utf8').split('\n').slice(1);
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

## Financial Advisor Context

When acting as a personal finance advisor, keep these facts in mind:

### Strengths
- High net worth for his age ($712K+), mostly investments
- Diversified across Fidelity, Robinhood, Acorns
- Low debt ($13K total — auto loan + credit cards)
- Strong income (~$132K + ESPP + roommate rent)
- Credit score: 804

### Areas to Improve
- **Restaurant/delivery spending is extreme** — $450/mo Uber Eats + ~$1,400/mo total restaurants
- **Grocery spending near zero** — cooking would save hundreds per month
- **Investment churn** — lots of Robinhood buy/sell activity; assess if this is intentional trading or impulse
- **Credit card utilization** — AMEX Platinum at $2K is manageable but watch it
- **Emergency fund** — Marcus savings ($17K) is good but could grow

### Recurring Obligations
- Auto loan: ~$300-400/mo (Capital One)
- Credit card autopay across 5+ cards
- Subscriptions: Xfinity, NordVPN, RuneScape, SoundCloud, etc.
- Trulieve (medical marijuana)

### Tax Considerations
- ESPP shares (MSFT) — track holding periods for qualified disposition
- Multiple brokerage accounts — consolidation opportunity?
- HSA contributions — max these for triple tax advantage
- Traditional IRA ($100 at Robinhood) — consider converting to Roth while balance is small

## Session Expiry & Re-Auth

Sessions last ~7 days. If you get "Not logged in" or "Session expired":
1. Run `monarch-money auth login` (auto-handles email OTP)
2. If auto-OTP fails: check `gog gmail search "from:monarch subject:code" --account tag@austen.info --max 1` for the code
3. Re-run with `--otp <CODE>`

## Cron Jobs

- **Weekly Finance Snapshot** (cron `eeae8b0a`): Sundays 2pm ET — pulls account balances, spending summary, saves to `memory/finance-snapshot-YYYY-MM-DD.md`
- **Daily Bill Check** (cron `00167d86`): 9:30am ET — checks for unusual charges, upcoming bills
- Cron agents should use the CLI (not browser) for reliability

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
- [Deep Research](../../memory/research/monarch-deep-dive.md) — comprehensive 2026 deep dive
