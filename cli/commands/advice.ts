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

const ADVICE_QUERY = `query AdviceQuery_Web($categoryName: String) {
  essentials: adviceItems(group: "essential", category: $categoryName) {
    id
    title
    description
    category { name displayName color __typename }
    numTasksCompleted
    numTasksRemaining
    numTasks
    completedAt
    __typename
  }
  objectives: adviceItems(group: "objective", category: $categoryName) {
    id
    title
    description
    category { name displayName color __typename }
    numTasksCompleted
    numTasksRemaining
    numTasks
    completedAt
    __typename
  }
  adviceItemCategories { name displayName description __typename }
}`;

export const adviceCommand = new Command('advice')
  .description('Financial advice items')
  .option('--category <categoryName>', 'Filter by category name')
  .action(async (options) => {
    try {
      const variables: Record<string, any> = {};
      if (options.category) variables.categoryName = options.category;
      const data = await runGraphQL(ADVICE_QUERY, variables);
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
