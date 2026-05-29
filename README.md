# monarch-money

TypeScript library and CLI for [Monarch Money](https://www.monarchmoney.com/) budget management.

## Features

- Full API client for Monarch Money's GraphQL API
- CLI tool for querying accounts, transactions, budgets, and more
- Token-based authentication with MFA/TOTP support
- Programmatic library for building automations

## Installation

```bash
npm install -g monarch-money
```

Or clone and build:

```bash
git clone https://github.com/tag-assistant/monarch-money.git
cd monarch-money
npm install
npm run build
```

## Usage

### CLI

```bash
# Login (interactive)
monarch-money login

# List accounts
monarch-money accounts

# List transactions
monarch-money transactions --limit 20

# Check net worth
monarch-money net-worth
```

### Library

```typescript
import { MonarchClient } from 'monarch-money';

const client = new MonarchClient();
await client.login(email, password, { mfaCode });

const accounts = await client.getAccounts();
console.log(accounts);
```

## Authentication

Set environment variables or use `monarch-money login`:

```bash
export MONARCH_TOKEN=<your-session-token>
```

## License

MIT
