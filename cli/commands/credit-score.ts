import { Command } from 'commander';

import { runGraphQL } from '../graphql-client';
const CREDIT_SCORE_HISTORY_QUERY = `query Common_GetSpinwheelCreditScoreSnapshots {
  spinwheelUser {
    id
    user { id name displayName __typename }
    onboardingStatus
    onboardingErrorMessage
    spinwheelUserId
    creditScoreRefreshSubscriptionId
    creditScoreTrackingStatus
    isBillSyncTrackingEnabled
    __typename
  }
  creditScoreSnapshots {
    reportedDate
    score
    user { id __typename }
    __typename
  }
}`;

const CREDIT_REPORT_QUERY = `query Common_GetSpinwheelCreditReport {
  spinwheelUser {
    id
    user { id name displayName __typename }
    onboardingStatus
    onboardingErrorMessage
    isBillSyncTrackingEnabled
    __typename
  }
  creditReportLiabilityAccounts {
    spinwheelLiabilityId
    liabilityType
    isOpen
    currentTotalBalance
    account { id __typename }
    description
    termsFrequency
    spinwheelUser {
      id
      user { id name displayName profilePictureUrl __typename }
      __typename
    }
    accountType
    recurringTransactionStream {
      frequency
      reviewStatus
      baseDate
      dayOfTheMonth
      __typename
    }
    lastStatement { dueDate __typename }
    __typename
  }
}`;

export const creditScoreCommand = new Command('credit-score')
  .description('Credit score history and report');

creditScoreCommand
  .command('history')
  .description('Credit score snapshots over time')
  .action(async () => {
    try {
      const data = await runGraphQL(CREDIT_SCORE_HISTORY_QUERY);
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

creditScoreCommand
  .command('report')
  .description('Full credit report (liability accounts)')
  .action(async () => {
    try {
      const data = await runGraphQL(CREDIT_REPORT_QUERY);
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
