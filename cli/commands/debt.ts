import { Command } from 'commander';

import { runGraphQL } from '../graphql-client';
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
