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

      const rules = await client.transactions.getTransactionRules();

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

      const describeCriteria = (r: any): string => {
        const parts: string[] = [];
        for (const [label, criterion] of [
          ['merchant', r.merchantCriteria],
          ['merchant name', r.merchantNameCriteria],
          ['statement', r.originalStatementCriteria],
        ] as const) {
          if (criterion) parts.push(`${label} ${criterion.operator} ${criterion.value}`);
        }
        if (r.amountCriteria) {
          const amount = r.amountCriteria.value ??
            (r.amountCriteria.valueRange ? `${r.amountCriteria.valueRange.lower ?? ''}–${r.amountCriteria.valueRange.upper ?? ''}` : '');
          parts.push(`${r.amountCriteria.isExpense ? 'debit' : 'credit'} ${r.amountCriteria.operator} ${amount}`);
        }
        if (r.categories?.length) parts.push(`category=${r.categories.map((x: any) => x.name).join('|')}`);
        if (r.accounts?.length) parts.push(`account=${r.accounts.map((x: any) => x.displayName).join('|')}`);
        return parts.join('; ') || '-';
      };

      const describeActions = (r: any): string => {
        const parts: string[] = [];
        if (r.setMerchantAction) parts.push(`rename→${r.setMerchantAction.name}`);
        if (r.setCategoryAction) parts.push(`category→${r.setCategoryAction.name}`);
        if (r.addTagsAction?.length) parts.push(`tags→${r.addTagsAction.map((x: any) => x.name).join('|')}`);
        if (r.linkGoalAction) parts.push(`goal→${r.linkGoalAction.name}`);
        if (r.linkSavingsGoalAction) parts.push(`savings goal→${r.linkSavingsGoalAction.name}`);
        if (r.setHideFromReportsAction != null) parts.push(`hide=${r.setHideFromReportsAction}`);
        if (r.reviewStatusAction) parts.push(`review→${r.reviewStatusAction}`);
        if (r.sendNotificationAction) parts.push('notify');
        if (r.splitTransactionsAction) parts.push(`split (${r.splitTransactionsAction.splitsInfo?.length || 0})`);
        return parts.join(', ') || '-';
      };

      printTable(
        ['Order', 'Criteria', 'Actions', 'Applied', 'Last applied'],
        rules.map((r: any) => [
          r.order ?? '-',
          truncate(describeCriteria(r), 55),
          truncate(describeActions(r), 50),
          r.recentApplicationCount ?? 0,
          r.lastAppliedAt || '-',
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
