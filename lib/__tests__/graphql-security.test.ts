import { readFileSync } from 'fs';
import { join } from 'path';

describe('GraphQL client response redaction', () => {
  const source = readFileSync(
    join(__dirname, '..', 'client', 'graphql', 'GraphQLClient.ts'),
    'utf8'
  );

  test('does not log or embed raw response bodies', () => {
    expect(source).not.toContain("logger.debug('GraphQL Response Body:', responseText)");
    expect(source).not.toContain('Invalid JSON response: ${responseText}');
    expect(source).toContain("logger.debug('GraphQL Response Body:', { bytes: responseText.length })");
    expect(source).toContain("throw new MonarchAPIError('Invalid JSON response from Monarch'");
  });
});
