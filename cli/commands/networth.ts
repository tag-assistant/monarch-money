import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { getClient } from '../client';
import { printTable, printJSON, printError, formatCurrency, formatDate } from '../utils/output';

export const networthCommand = new Command('networth')
  .alias('nw')
  .description('Net worth tracking');

networthCommand
  .command('current')
  .description('Show current net worth')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora('Fetching net worth...').start();

    try {
      const client = await getClient();

      // Get accounts and sum them up for current net worth
      const accounts = await client.accounts.getAll({});

      spinner.stop();

      const includedAccounts = accounts.filter((a: any) => a.includeBalanceInNetWorth !== false);
      const assets = includedAccounts.filter((a: any) => (a.currentBalance || 0) > 0);
      const liabilities = includedAccounts.filter((a: any) => (a.currentBalance || 0) < 0);

      const totalAssets = assets.reduce((s: number, a: any) => s + (a.currentBalance || 0), 0);
      const totalLiabilities = liabilities.reduce((s: number, a: any) => s + (a.currentBalance || 0), 0);
      const netWorth = totalAssets + totalLiabilities;

      if (options.json) {
        printJSON({ netWorth, totalAssets, totalLiabilities: Math.abs(totalLiabilities), accountCount: includedAccounts.length });
        return;
      }

      console.log(chalk.bold('\n💰 Net Worth Summary\n'));
      console.log(`  ${chalk.cyan('Net Worth:')}      ${formatCurrency(netWorth)}`);
      console.log(`  ${chalk.cyan('Total Assets:')}   ${formatCurrency(totalAssets)}`);
      console.log(`  ${chalk.cyan('Liabilities:')}    ${formatCurrency(Math.abs(totalLiabilities))}`);
      console.log(`  ${chalk.cyan('Accounts:')}       ${includedAccounts.length}`);
    } catch (error) {
      spinner.fail('Failed to fetch net worth');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

networthCommand
  .command('history')
  .description('Show net worth history over time')
  .option('--months <n>', 'Number of months to show', '12')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora('Fetching net worth history...').start();

    try {
      const client = await getClient();

      const months = Number(options.months);
      if (!Number.isInteger(months) || months < 1 || months > 1200) {
        throw new Error('--months must be an integer between 1 and 1200');
      }

      const end = new Date();
      const start = new Date(end);
      start.setUTCMonth(start.getUTCMonth() - months);
      const endDate = end.toISOString().split('T')[0];
      const startDate = start.toISOString().split('T')[0];

      // Monarch replaced netWorthHistory and the older snapshot fallbacks with
      // aggregateSnapshots(AggregateSnapshotFilters). Keep one canonical path.
      const history = await client.accounts.getNetWorthHistory(startDate, endDate);

      spinner.stop();

      if (options.json) {
        printJSON(history);
        return;
      }

      if (!history || history.length === 0) {
        console.log(chalk.yellow('No net worth history data available'));
        return;
      }

      console.log(chalk.bold(`\n📈 Net Worth History (${months} months)\n`));

      // Sample to ~20 points max for readability
      const step = Math.max(1, Math.floor(history.length / 20));
      const sampled = history.filter((_: any, i: number) => i % step === 0 || i === history.length - 1);

      printTable(
        ['Date', 'Net Worth', 'Assets', 'Liabilities'],
        sampled.map((h: any) => [
          formatDate(h.date),
          formatCurrency(h.netWorth || 0),
          h.assets ? formatCurrency(h.assets) : '-',
          h.liabilities ? formatCurrency(Math.abs(h.liabilities || 0)) : '-',
        ])
      );

      // Show change
      if (history.length >= 2) {
        const first = history[0]?.netWorth || 0;
        const last = history[history.length - 1]?.netWorth || 0;
        const change = last - first;
        const pct = first !== 0 ? ((change / Math.abs(first)) * 100).toFixed(1) : '∞';
        console.log(`\n  ${chalk.cyan('Change:')} ${formatCurrency(change)} (${pct}%)`);
      }
    } catch (error) {
      spinner.fail('Failed to fetch net worth history');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
