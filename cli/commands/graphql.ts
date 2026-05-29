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
  if (!token) {
    throw new Error('No token found in session. Run: monarch-money auth login');
  }
  return token;
}

async function runGraphQL(query: string, variables?: Record<string, any>): Promise<any> {
  const token = loadToken();
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Token ${token}`,
    },
    body: JSON.stringify({ query, variables: variables || {} }),
  });

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
  }

  const json: any = await resp.json();
  if (json.errors) {
    throw new Error(JSON.stringify(json.errors, null, 2));
  }
  return json.data;
}

export const graphqlCommand = new Command('graphql')
  .alias('gql')
  .description('Generic GraphQL explorer');

graphqlCommand
  .command('query <queryString>')
  .description('Run an arbitrary GraphQL query')
  .option('--vars <json>', 'Variables as JSON string')
  .action(async (queryString, options) => {
    try {
      const variables = options.vars ? JSON.parse(options.vars) : undefined;
      const data = await runGraphQL(queryString, variables);
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

graphqlCommand
  .command('mutation <mutationString>')
  .description('Run a GraphQL mutation')
  .option('--vars <json>', 'Variables as JSON string')
  .action(async (mutationString, options) => {
    try {
      const variables = options.vars ? JSON.parse(options.vars) : undefined;
      const data = await runGraphQL(mutationString, variables);
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

graphqlCommand
  .command('explore <typeName>')
  .description('Introspect a GraphQL type (may fail for non-admin)')
  .action(async (typeName) => {
    try {
      const query = `
        query IntrospectType($name: String!) {
          __type(name: $name) {
            name
            kind
            description
            fields {
              name
              description
              type {
                name
                kind
                ofType { name kind ofType { name kind } }
              }
              args {
                name
                type { name kind ofType { name kind } }
                defaultValue
              }
            }
            inputFields {
              name
              type { name kind ofType { name kind } }
              defaultValue
            }
            enumValues { name description }
          }
        }
      `;
      const data = await runGraphQL(query, { name: typeName });
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
