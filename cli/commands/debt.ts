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

const FORECAST_SCENARIO_QUERY = `query Web_ForecastScenario($externalId: ID) {
  forecastScenario(externalId: $externalId) {
    externalId
    name
    accounts {
      externalId
      monarchAccountId
      name
      signedBalance
      accountType
      accountSubtype
      isSynthetic
      isIncluded
      growthRate
      interestRate
      plannedPayment
      minimumPayment
      reduceExpensesForPaidOffDebt
      linkedInterestRate
      linkedPlannedPayment
      linkedMinimumPayment
      __typename
    }
    priorityRules {
      accountExternalId
      ruleType
      order
      config
      __typename
    }
    __typename
  }
}`;

export const debtCommand = new Command('debt')
  .description('View debt accounts and paydown projections');

debtCommand
  .command('accounts')
  .description('List debt accounts with interest rates and balances')
  .option('--scenario <id>', 'Forecast scenario external ID')
  .action(async (options) => {
    try {
      const data = await runGraphQL(FORECAST_SCENARIO_QUERY, { externalId: options.scenario || null });
      const scenario = data.forecastScenario;
      if (!scenario) {
        console.error('No forecast scenario found. Set up forecasting in Monarch first.');
        process.exit(1);
      }

      // Filter to debt accounts (negative balance or has interestRate)
      const debtAccounts = scenario.accounts.filter((a: any) =>
        a.signedBalance < 0 || a.interestRate > 0 || a.accountType === 'liability'
      );

      console.log(JSON.stringify(debtAccounts, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

debtCommand
  .command('plan')
  .description('View debt paydown plan (priority rules and projections)')
  .option('--scenario <id>', 'Forecast scenario external ID')
  .action(async (options) => {
    try {
      const data = await runGraphQL(FORECAST_SCENARIO_QUERY, { externalId: options.scenario || null });
      const scenario = data.forecastScenario;
      if (!scenario) {
        console.error('No forecast scenario found. Set up forecasting in Monarch first.');
        process.exit(1);
      }

      // Debt accounts with their paydown info
      const debtAccounts = scenario.accounts.filter((a: any) =>
        a.signedBalance < 0 || a.interestRate > 0 || a.accountType === 'liability'
      );

      const plan = {
        scenarioName: scenario.name,
        scenarioId: scenario.externalId,
        debtAccounts: debtAccounts.map((a: any) => ({
          name: a.name,
          externalId: a.externalId,
          balance: a.signedBalance,
          interestRate: a.interestRate,
          plannedPayment: a.plannedPayment,
          minimumPayment: a.minimumPayment,
          reduceExpensesForPaidOffDebt: a.reduceExpensesForPaidOffDebt,
        })),
        priorityRules: scenario.priorityRules,
      };

      console.log(JSON.stringify(plan, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
