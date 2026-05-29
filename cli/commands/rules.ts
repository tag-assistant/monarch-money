import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { getClient } from '../client';
import { printTable, printJSON, printError, printSuccess, truncate } from '../utils/output';

export const rulesCommand = new Command('rules')
  .description('Transaction auto-categorization rules');

rulesCommand
  .command('list')
  .description('List all transaction rules')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora('Fetching transaction rules...').start();

    try {
      const client = await getClient();

      // Try the existing API first, fall back to raw GraphQL
      let rules: any[];
      try {
        rules = await client.transactions.getTransactionRules();
      } catch {
        // The existing API query may not match the actual schema.
        // Try the real Monarch schema (CreateTransactionRuleV2 style)
        spinner.text = 'Trying alternative rules query...';
        const gql = (client as any).graphql || (client as any)._graphql;
        const query = `{ transactionRules { id merchantCriteria { name } categoryAction { id name } sendNotification applyToExistingTransactions createdAt } }`;
        try {
          const data = await gql.query(query);
          rules = data.transactionRules || [];
        } catch {
          // Last resort: minimal query
          const data2 = await gql.query(`{ transactionRules { id } }`);
          rules = data2.transactionRules || [];
        }
      }

      spinner.stop();

      if (options.json) {
        printJSON(rules);
        return;
      }

      if (!rules || rules.length === 0) {
        console.log(chalk.yellow('No transaction rules found'));
        return;
      }

      console.log(chalk.bold(`\n${rules.length} rule(s):\n`));

      printTable(
        ['ID', 'Name/Merchant', 'Enabled', 'Priority', 'Actions'],
        rules.map((r: any) => [
          r.id,
          truncate(r.name || r.merchantCriteria?.name || '-', 30),
          r.isEnabled !== undefined ? (r.isEnabled ? '✓' : '✗') : '-',
          r.priority ?? '-',
          r.actions ? r.actions.map((a: any) => `${a.type}→${a.value}`).join(', ') :
            r.categoryAction ? `category→${r.categoryAction.name}` : '-',
        ])
      );
    } catch (error) {
      spinner.fail('Failed to fetch rules');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

rulesCommand
  .command('create')
  .description('Create an auto-categorization rule')
  .requiredOption('-m, --merchant <name>', 'Merchant name to match')
  .requiredOption('-c, --category <id>', 'Category ID to assign')
  .option('--apply-existing', 'Apply to existing transactions')
  .option('--notify', 'Send notification when rule matches')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora('Creating transaction rule...').start();

    try {
      const client = await getClient();
      const gql = (client as any).graphql || (client as any)._graphql;

      // Try the V2 mutation that matches the Monarch web app
      const mutation = `
        mutation Web_CreateTransactionRuleV2($input: CreateTransactionRuleV2Input!) {
          createTransactionRuleV2(input: $input) {
            transactionRule {
              id
              merchantCriteria { name }
              categoryAction { id name }
              createdAt
            }
            errors { message }
          }
        }
      `;

      let result: any;
      try {
        result = await gql.mutation(mutation, {
          input: {
            merchantCriteria: { name: options.merchant },
            categoryAction: { id: options.category },
            applyToExistingTransactions: options.applyExisting || false,
            sendNotification: options.notify || false,
          }
        });
      } catch {
        // Fallback: try the simpler API
        spinner.text = 'Trying alternative create mutation...';
        const rule = await client.transactions.createTransactionRule({
          name: `Auto: ${options.merchant} → category`,
          conditions: [{ field: 'merchant_name', operator: 'contains', value: options.merchant }],
          actions: [{ type: 'set_category', value: options.category }],
        });
        spinner.succeed(`Rule created: ${rule.id}`);
        if (options.json) printJSON(rule);
        return;
      }

      const created = result.createTransactionRuleV2;
      if (created?.errors?.length > 0) {
        throw new Error(created.errors[0].message);
      }

      spinner.succeed(`Rule created: ${created?.transactionRule?.id || 'OK'}`);
      if (options.json) printJSON(created?.transactionRule);
    } catch (error) {
      spinner.fail('Failed to create rule');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

rulesCommand
  .command('delete <id>')
  .description('Delete a transaction rule')
  .option('--yes', 'Confirm deletion')
  .action(async (id, options) => {
    if (!options.yes) {
      printError('Deletion requires --yes flag');
      process.exit(1);
    }

    const spinner = ora('Deleting rule...').start();
    try {
      const client = await getClient();
      await client.transactions.deleteTransactionRule(id);
      spinner.succeed(`Rule ${id} deleted`);
    } catch (error) {
      spinner.fail('Failed to delete rule');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
