import { getClient } from './client';

/**
 * Run a GraphQL query through the authenticated library client.
 * This keeps token loading, session validation, rate limiting, retries, and
 * error redaction in one place instead of duplicating raw fetch logic in each
 * CLI command.
 */
export async function runGraphQL<T = any>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const client = await getClient();
  return client.gqlCall<T>('cli', query, variables);
}

/** Run an explicitly requested GraphQL mutation through the shared client. */
export async function runGraphQLMutation<T = any>(
  mutation: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const client = await getClient();
  return client.gqlMutation<T>('cli', mutation, variables);
}
