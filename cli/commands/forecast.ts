import { Command } from 'commander';

import { runGraphQL } from '../graphql-client';
const FORECAST_SCENARIOS_QUERY = `query Web_ForecastScenarios {
  forecastScenarios {
    externalId
    name
    icon
    color
    order
    kpis
    __typename
  }
}`;

const FORECAST_SCENARIO_QUERY = `query Web_ForecastScenario($externalId: ID) {
  forecastScenario(externalId: $externalId) {
    externalId
    name
    icon
    color
    inflationRate
    projectionYears
    useActualsAsBaseline
    splitUncategorizedSavings
    dollarMode
    accounts {
      externalId
      monarchAccountId
      name
      signedBalance
      accountType
      accountSubtype
      logoUrl
      isSynthetic
      sourceEventExternalId
      systemAccountType
      isIncluded
      growthRate
      interestRate
      plannedPayment
      minimumPayment
      withdrawalTaxRate
      taxableWithdrawalPercent
      reduceExpensesForPaidOffDebt
      yearlyPaycheckContribution
      ownerUserId
      isNew
      isDeleted
      linkedGrowthRate
      linkedInterestRate
      linkedPlannedPayment
      linkedMinimumPayment
      __typename
    }
    participants {
      user { id displayName birthday profilePictureUrl __typename }
      lifeExpectancy
      isIncluded
      __typename
    }
    events {
      externalId
      eventKind
      name
      startYear
      isIncluded
      icon
      color
      isHidden
      isRequired
      config
      __typename
    }
    priorityRules {
      accountExternalId
      ruleType
      order
      config
      __typename
    }
    categoryVersions {
      settingsVersion
      eventsVersion
      accountsVersion
      participantsVersion
      priorityRulesVersion
      __typename
    }
    baselineIncome
    baselineExpenses
    __typename
  }
  me { id profile { completedForecastOnboardingAt __typename } __typename }
}`;

export const forecastCommand = new Command('forecast')
  .description('View forecast scenarios and projections')
  .option('--id <externalId>', 'Get a specific scenario by external ID')
  .action(async (options) => {
    try {
      if (options.id) {
        const data = await runGraphQL(FORECAST_SCENARIO_QUERY, { externalId: options.id });
        console.log(JSON.stringify(data, null, 2));
      } else {
        // List all scenarios, then fetch the default (first) one in detail
        const list = await runGraphQL(FORECAST_SCENARIOS_QUERY);
        const detail = await runGraphQL(FORECAST_SCENARIO_QUERY, { externalId: null });
        console.log(JSON.stringify({ scenarios: list.forecastScenarios, default: detail }, null, 2));
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
