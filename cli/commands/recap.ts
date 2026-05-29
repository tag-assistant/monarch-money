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

const CASHFLOW_QUERY = `query Common_GetCashFlowDashboard($filters: TransactionFilterInput) {
  byDay: aggregates(filters: $filters, fillEmptyValues: true, groupBy: ["day"]) {
    summary { sumExpense __typename }
    groupBy { day __typename }
    __typename
  }
}`;

const REPORTS_SUMMARY_QUERY = `query Common_GetReportsData($filters: TransactionFilterInput!, $groupBy: [ReportsGroupByEntity!], $includeCategory: Boolean = false, $includeCategoryGroup: Boolean = false, $includeMerchant: Boolean = false, $includeBusinessEntity: Boolean = false, $includeBudgetVariability: Boolean = false, $fillEmptyValues: Boolean = true) {
  reports(groupBy: $groupBy, filters: $filters, sortBy: sum_expense, fillEmptyValues: $fillEmptyValues) {
    groupBy {
      date
      ...ReportsCategoryFields @include(if: $includeCategory)
      __typename
    }
    summary { ...ReportsSummaryFields __typename }
    __typename
  }
  aggregates(filters: $filters, fillEmptyValues: $fillEmptyValues) {
    summary { ...ReportsSummaryFields __typename }
    __typename
  }
}
fragment ReportsCategoryFields on ReportsGroupByData { category { id name icon group { id name type __typename } __typename } __typename }
fragment ReportsSummaryFields on TransactionsSummary { sum avg count max sumIncome sumExpense savings savingsRate first last __typename }`;

const REVIEW_QUERY = `query Common_GetReviewSummaryByUser {
  byNeedsReviewByUser: aggregates(
    groupBy: ["needsReviewByUser"]
    filters: {needsReview: true, transactionVisibility: all_transactions}
  ) {
    groupBy { needsReviewByUser { id name __typename } __typename }
    summary { count __typename }
    __typename
  }
}`;

export const recapCommand = new Command('recap')
  .description('Weekly financial recap (cashflow summary, top categories, pending reviews)')
  .option('--start <date>', 'Start date (YYYY-MM-DD, default: 7 days ago)')
  .option('--end <date>', 'End date (YYYY-MM-DD, default: today)')
  .action(async (options) => {
    try {
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const startDate = options.start || weekAgo.toISOString().slice(0, 10);
      const endDate = options.end || now.toISOString().slice(0, 10);

      const filters = { startDate, endDate, categoryType: 'expense', transactionVisibility: 'non_hidden_transactions_only' };

      const [cashflow, reports, review] = await Promise.all([
        runGraphQL(CASHFLOW_QUERY, { filters: { startDate, endDate } }),
        runGraphQL(REPORTS_SUMMARY_QUERY, {
          filters,
          groupBy: ['category'],
          includeCategory: true,
          includeCategoryGroup: false,
          includeMerchant: false,
          includeBusinessEntity: false,
          includeBudgetVariability: false,
          fillEmptyValues: true,
        }),
        runGraphQL(REVIEW_QUERY),
      ]);

      const recap = {
        period: { startDate, endDate },
        cashflow: cashflow,
        topCategories: reports,
        pendingReview: review,
      };

      console.log(JSON.stringify(recap, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
