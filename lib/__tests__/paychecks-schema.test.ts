import { parse, visit } from 'graphql';
import {
  PAYCHECKS_LIST_QUERY,
  PAYCHECKS_SUMMARY_QUERY,
} from '../../cli/queries/paychecks';

function selectedFields(query: string): string[] {
  const fields: string[] = [];
  visit(parse(query), {
    Field(node) {
      fields.push(node.name.value);
    },
  });
  return fields;
}

describe('current paycheck GraphQL schema', () => {
  test('list uses the live-verified minimal field shape', () => {
    const document = parse(PAYCHECKS_LIST_QUERY);
    const operation = document.definitions[0];
    expect(operation.kind).toBe('OperationDefinition');
    if (operation.kind === 'OperationDefinition') {
      expect(operation.name?.value).toBe('GetPaychecks');
      expect(operation.variableDefinitions).toHaveLength(0);
    }

    expect(selectedFields(PAYCHECKS_LIST_QUERY)).toEqual([
      'paychecks', 'id', '__typename',
    ]);
  });

  test('summary has a named operation and the verified response shape', () => {
    const document = parse(PAYCHECKS_SUMMARY_QUERY);
    const operation = document.definitions[0];
    expect(operation.kind).toBe('OperationDefinition');
    if (operation.kind === 'OperationDefinition') {
      expect(operation.name?.value).toBe('GetPaychecksSummary');
    }

    expect(selectedFields(PAYCHECKS_SUMMARY_QUERY)).toEqual([
      'paychecksSummary',
      'count',
      'totalGross',
      'totalDeductions',
      'totalNet',
      'deductionRate',
      'deductionsByType',
      'deductionType',
      'totalAmount',
    ]);
  });
});
