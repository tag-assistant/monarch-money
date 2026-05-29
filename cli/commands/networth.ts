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

      const assets = accounts.filter((a: any) => (a.currentBalance || 0) > 0);
      const liabilities = accounts.filter((a: any) => (a.currentBalance || 0) < 0);

      const totalAssets = assets.reduce((s: number, a: any) => s + (a.currentBalance || 0), 0);
      const totalLiabilities = liabilities.reduce((s: number, a: any) => s + (a.currentBalance || 0), 0);
      const netWorth = totalAssets + totalLiabilities;

      if (options.json) {
        printJSON({ netWorth, totalAssets, totalLiabilities: Math.abs(totalLiabilities), accountCount: accounts.length });
        return;
      }

      console.log(chalk.bold('\n💰 Net Worth Summary\n'));
      console.log(`  ${chalk.cyan('Net Worth:')}      ${formatCurrency(netWorth)}`);
      console.log(`  ${chalk.cyan('Total Assets:')}   ${formatCurrency(totalAssets)}`);
      console.log(`  ${chalk.cyan('Liabilities:')}    ${formatCurrency(Math.abs(totalLiabilities))}`);
      console.log(`  ${chalk.cyan('Accounts:')}       ${accounts.length}`);
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

      const months = parseInt(options.months);
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - months * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      let history: any[];
      try {
        history = await client.insights.getNetWorthHistory({ startDate, endDate });
      } catch {
        // Fallback: try direct GraphQL with different query shapes
        const gql = (client as any).graphql || (client as any)._graphql;
        try {
          const data = await gql.query(
            `query($startDate: Date!, $endDate: Date!) { snapshotsByDateRange(startDate: $startDate, endDate: $endDate) { date netWorth } }`,
            { startDate, endDate }
          );
          history = data.snapshotsByDateRange || [];
        } catch {
          // Try accounts snapshot approach
          const data2 = await gql.query(
            `query($startDate: Date!, $endDate: Date!) { accountSnapshotsByDateRange(startDate: $startDate, endDate: $endDate) { date totalBalance } }`,
            { startDate, endDate }
          );
          history = (data2.accountSnapshotsByDateRange || []).map((h: any) => ({
            date: h.date,
            netWorth: h.totalBalance,
          }));
        }
      }

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
