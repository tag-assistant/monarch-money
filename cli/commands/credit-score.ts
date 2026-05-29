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
