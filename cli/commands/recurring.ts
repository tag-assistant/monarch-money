import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { getClient } from '../client';
import { printTable, printJSON, printError, formatCurrency } from '../utils/output';

export const recurringCommand = new Command('recurring')
  .description('Recurring transactions and upcoming bills');

recurringCommand
  .command('streams')
  .description('List all recurring transaction streams')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora('Fetching recurring streams...').start();
    try {
      const client = await getClient();
      const streams = await client.recurring.getRecurringStreams();
      spinner.stop();

      if (options.json) {
        printJSON(streams);
        return;
      }

      if (!streams || streams.length === 0) {
        console.log(chalk.yellow('No recurring streams found'));
        return;
      }

      console.log(chalk.bold(`\n${streams.length} recurring stream(s):\n`));

      printTable(
        ['ID', 'Name', 'Amount', 'Frequency', 'Type', 'Active'],
        streams.map((s: any) => {
          const stream = s.stream || s;
          return [
            stream.id,
            (stream.name || stream.merchant?.name || 'Unknown').substring(0, 30),
            formatCurrency(Math.abs(stream.amount || 0)),
            stream.frequency || '-',
            stream.recurringType || '-',
            stream.isActive !== false ? chalk.green('Yes') : chalk.red('No'),
          ];
        })
      );
    } catch (error) {
      spinner.fail('Failed to fetch recurring streams');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

recurringCommand
  .command('upcoming')
  .description('Show upcoming recurring bills')
  .option('--days <days>', 'Number of days to look ahead', '30')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora('Fetching upcoming bills...').start();
    try {
      const client = await getClient();
      const now = new Date();
      const startDate = now.toISOString().split('T')[0];
      const end = new Date(now.getTime() + parseInt(options.days) * 86400000);
      const endDate = end.toISOString().split('T')[0];

      const items = await client.recurring.getUpcomingRecurringItems({ startDate, endDate });
      spinner.stop();

      if (options.json) {
        printJSON(items);
        return;
      }

      if (!items || items.length === 0) {
        console.log(chalk.yellow(`No upcoming bills in the next ${options.days} days`));
        return;
      }

      console.log(chalk.bold(`\n${items.length} upcoming bill(s) in the next ${options.days} days:\n`));

      const totalAmount = items.reduce((sum: number, i: any) => sum + Math.abs(i.amount || 0), 0);

      printTable(
        ['Date', 'Name', 'Amount', 'Category', 'Account', 'Paid?'],
        items.map((i: any) => [
          i.date || '-',
          (i.stream?.merchant?.name || 'Unknown').substring(0, 25),
          formatCurrency(Math.abs(i.amount || 0)),
          i.category?.name || '-',
          (i.account?.displayName || '-').substring(0, 20),
          i.isPast ? chalk.green('✓') : chalk.yellow('Upcoming'),
        ])
      );

      console.log(chalk.bold(`\nTotal upcoming: ${formatCurrency(totalAmount)}`));
    } catch (error) {
      spinner.fail('Failed to fetch upcoming bills');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
