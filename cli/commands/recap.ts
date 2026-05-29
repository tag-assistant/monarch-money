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

const RECAP_QUERY = `query ($startDate: Date!, $endDate: Date!) {
  recap(startDate: $startDate, endDate: $endDate) {
    id
    dateRangeStart
    dateRangeEnd
    summary
    sentiment
    createdAt
    updatedAt
    cards {
      module
      title
      headline
      message
      sentiment
      metrics
      richBlocks
      titleMarkdown
      headlineMarkdown
      messageMarkdown
    }
  }
}`;

export const recapCommand = new Command('recap')
  .description('AI-generated weekly financial recap')
  .requiredOption('--start <date>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--end <date>', 'End date (YYYY-MM-DD)')
  .action(async (options) => {
    try {
      const data = await runGraphQL(RECAP_QUERY, {
        startDate: options.start,
        endDate: options.end,
      });
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
