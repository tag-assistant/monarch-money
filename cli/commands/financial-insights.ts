import { Command } from 'commander';

import { runGraphQL } from '../graphql-client';
const FINANCIAL_INSIGHTS_QUERY = `query {
  financialInsights(statuses: [new, accepted, in_progress]) {
    id
    merchantNameDisplay
    merchantLogoUrl
    dashboardSubtitle
    description
    reasoning
    effort
    status
    savingsEstimateLow
    savingsEstimateHigh
    capturedSavingsLow
    currentAnnualCost
    recurringStreamSnapshot
    nextChargeDate
    score
    opportunityType
    suggestedActionType
    relatedMerchants { name logoUrl merchantId }
  }
  financialInsightSummary {
    totalCapturedSavings
    completedCount
    totalIdentifiedSavingsLow
    totalIdentifiedSavingsHigh
    acceptedCount
    inProgressCount
    newCount
  }
}`;

export const financialInsightsCommand = new Command('financial-insights')
  .alias('fi')
  .description('Financial insights (merchant spending, savings opportunities)')
  .description('Financial insights (merchant spending, savings opportunities)')
  .action(async () => {
    try {
      const data = await runGraphQL(FINANCIAL_INSIGHTS_QUERY);
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
