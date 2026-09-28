import { readFileSync } from 'fs';
import { join } from 'path';

describe('current transaction rules GraphQL schema', () => {
  const source = readFileSync(
    join(__dirname, '../api/transactions/TransactionsAPI.ts'),
    'utf8'
  );

  test('uses the web TransactionRuleV2 fields instead of the removed legacy shape', () => {
    const method = source.slice(
      source.indexOf('async getTransactionRules()'),
      source.indexOf('async createTransactionRule(')
    );

    expect(method).toContain('query Web_GetTransactionRules');
    expect(method).toContain('merchantCriteria { operator value }');
    expect(method).toContain('originalStatementCriteria { operator value }');
    expect(method).toContain('merchantNameCriteria { operator value }');
    expect(method).toContain('setCategoryAction { id name icon }');
    expect(method).toContain('recentApplicationCount');
    expect(method).toContain('splitTransactionsAction');

    expect(method).not.toMatch(/\n\s+name\n/);
    expect(method).not.toContain('isEnabled');
    expect(method).not.toContain('conditions {');
    expect(method).not.toContain('actions {');
  });
});
