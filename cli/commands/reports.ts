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

const REPORTS_QUERY = `query Common_GetReportsData($filters: TransactionFilterInput!, $groupBy: [ReportsGroupByEntity!], $groupByTimeframe: ReportsGroupByTimeframe, $sortBy: ReportsSortBy, $includeCategory: Boolean = false, $includeCategoryGroup: Boolean = false, $includeMerchant: Boolean = false, $includeBusinessEntity: Boolean = false, $includeBudgetVariability: Boolean = false, $fillEmptyValues: Boolean = true) {
  reports(groupBy: $groupBy, groupByTimeframe: $groupByTimeframe, filters: $filters, sortBy: $sortBy, fillEmptyValues: $fillEmptyValues) {
    groupBy {
      date
      ...ReportsCategoryFields @include(if: $includeCategory)
      ...ReportsCategoryGroupFields @include(if: $includeCategoryGroup)
      ...ReportsMerchantFields @include(if: $includeMerchant)
      ...ReportsBusinessEntityFields @include(if: $includeBusinessEntity)
      ...ReportsBudgetVariabilityFields @include(if: $includeBudgetVariability)
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
fragment ReportsCategoryGroupFields on ReportsGroupByData { categoryGroup { id name type __typename } __typename }
fragment ReportsMerchantFields on ReportsGroupByData { merchant { id name __typename } __typename }
fragment ReportsBusinessEntityFields on ReportsGroupByData { businessEntity { id name color icon logoUrl __typename } __typename }
fragment ReportsBudgetVariabilityFields on ReportsGroupByData { budgetVariability { id name __typename } __typename }
fragment ReportsSummaryFields on TransactionsSummary { sum avg count max sumIncome sumExpense savings savingsRate first last __typename }`;

export const reportsCommand = new Command('reports')
  .description('View aggregated spending/income reports')
  .option('--start <date>', 'Start date (YYYY-MM-DD)')
  .option('--end <date>', 'End date (YYYY-MM-DD)')
  .option('--group-by <entity>', 'Group by: category, merchant, account, timeframe', 'category')
  .option('--sort-by <sort>', 'Sort by: sum_expense, sum_income, sum, avg', 'sum_expense')
  .option('--type <type>', 'Category type filter: expense, income', 'expense')
  .action(async (options) => {
    try {
      const now = new Date();
      const startDate = options.start || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const endDate = options.end || now.toISOString().slice(0, 10);

      const groupByMap: Record<string, string> = {
        category: 'category',
        merchant: 'merchant',
        account: 'account',
        timeframe: 'month',
      };
      const groupByEntity = groupByMap[options.groupBy] || options.groupBy;

      const includeFlags: Record<string, boolean> = {
        includeCategory: groupByEntity === 'category',
        includeCategoryGroup: false,
        includeMerchant: groupByEntity === 'merchant',
        includeBusinessEntity: groupByEntity === 'account',
        includeBudgetVariability: false,
      };

      const variables: any = {
        filters: {
          startDate,
          endDate,
          categoryType: options.type,
          transactionVisibility: 'non_hidden_transactions_only',
        },
        groupBy: [groupByEntity],
        sortBy: options.sortBy,
        ...includeFlags,
        fillEmptyValues: true,
      };

      // If grouping by timeframe, use groupByTimeframe instead
      if (options.groupBy === 'timeframe') {
        variables.groupBy = [];
        variables.groupByTimeframe = 'month';
      }

      const data = await runGraphQL(REPORTS_QUERY, variables);
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
