import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { getClient } from '../client';
import { printTable, printJSON, printError, printSuccess, truncate, formatCurrency } from '../utils/output';

export const tagsCommand = new Command('tags')
  .description('Transaction tag management');

tagsCommand
  .command('list')
  .description('List all tags')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora('Fetching tags...').start();

    try {
      const client = await getClient();
      const tags = await client.transactions.getTransactionTags();

      spinner.stop();

      if (options.json) {
        printJSON(tags);
        return;
      }

      if (!tags || tags.length === 0) {
        console.log(chalk.yellow('No tags found'));
        return;
      }

      console.log(chalk.bold(`\n${tags.length} tag(s):\n`));

      printTable(
        ['ID', 'Name', 'Color', 'Transactions'],
        tags.map((t: any) => [
          t.id,
          t.name,
          t.color || '-',
          t.transactionCount ?? '-',
        ])
      );
    } catch (error) {
      spinner.fail('Failed to fetch tags');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

tagsCommand
  .command('create <name>')
  .description('Create a new tag')
  .option('-c, --color <color>', 'Tag color (hex)', '#4A90D9')
  .option('--json', 'Output as JSON')
  .action(async (name, options) => {
    const spinner = ora('Creating tag...').start();

    try {
      const client = await getClient();
      const tag = await client.transactions.createTransactionTag({
        name,
        color: options.color,
      });

      spinner.succeed(`Tag created: ${tag.id} (${tag.name})`);
      if (options.json) printJSON(tag);
    } catch (error) {
      spinner.fail('Failed to create tag');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
