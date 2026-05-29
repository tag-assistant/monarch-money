import { Command } from 'commander';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const SESSION_FILE = join(homedir(), '.mm', 'session.json');
const API_URL = 'https://api.monarch.com/graphql';

function loadToken(): string {
  if (!existsSync(SESSION_FILE)) {
    throw new Error('Not logged in. Run: monarch-money auth login');
  }
  const session = JSON.parse(readFileSync(SESSION_FILE, 'utf-8'));
  const token = session.token || session.accessToken;
  if (!token) throw new Error('No token found in session.');
  return token;
}

async function runGraphQL(query: string, variables?: Record<string, any>): Promise<any> {
  const token = loadToken();
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${token}` },
    body: JSON.stringify({ query, variables: variables || {} }),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
  const json: any = await resp.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

const PAYCHECKS_LIST_QUERY = `query GetPaychecks {
  paychecks {
    id
    title
    employer
    frequency
    grossPay
    netPay
    payDate
    deductions {
      id
      name
      amount
      category
      __typename
    }
    __typename
  }
}`;

const PAYCHECKS_SUMMARY_QUERY = `query GetPaychecksSummary {
  paychecksSummary {
    totalGrossPay
    totalNetPay
    totalDeductions
    paychecksCount
    averageGrossPay
    averageNetPay
    __typename
  }
}`;

export const paychecksCommand = new Command('paychecks')
  .description('Paycheck information');

paychecksCommand
  .command('list')
  .description('List all paychecks')
  .action(async () => {
    try {
      const data = await runGraphQL(PAYCHECKS_LIST_QUERY);
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

paychecksCommand
  .command('summary')
  .description('Paycheck summary (gross/net/deductions)')
  .action(async () => {
    try {
      const data = await runGraphQL(PAYCHECKS_SUMMARY_QUERY);
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
