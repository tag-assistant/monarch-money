import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { getClient } from '../client';
import { printTable, printJSON, printError, formatCurrency } from '../utils/output';

export const cashflowCommand = new Command('cashflow')
  .description('Income vs expenses summary')
  .option('--month <YYYY-MM>', 'Month to show (default: current)')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora('Fetching cashflow...').start();
    try {
      const client = await getClient();
      
      let startDate: string, endDate: string;
      if (options.month) {
        const [y, m] = options.month.split('-').map(Number);
        startDate = `${y}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      } else {
        const now = new Date();
        const y = now.getFullYear(), m = now.getMonth() + 1;
        startDate = `${y}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      }

      const summary = await client.cashflow.getCashflowSummary({ startDate, endDate });
      spinner.stop();

      if (options.json) {
        printJSON(summary);
        return;
      }

      console.log(chalk.bold(`\nCashflow Summary (${startDate} to ${endDate}):\n`));
      console.log(`  ${chalk.green('Income:')}    ${formatCurrency(summary.sumIncome || 0)}`);
      console.log(`  ${chalk.red('Expenses:')}  ${formatCurrency(Math.abs(summary.sumExpense || 0))}`);
      console.log(`  ${chalk.cyan('Savings:')}   ${formatCurrency(summary.savings || 0)}`);
      console.log(`  ${chalk.cyan('Rate:')}      ${((summary.savingsRate || 0) * 100).toFixed(1)}%`);

      // Try to fetch category breakdown (may fail on some API versions)
      try {
        const data = await client.cashflow.getCashflow({ startDate, endDate });
        if (data.byCategoryGroup && data.byCategoryGroup.length > 0) {
          console.log(chalk.bold('\nBy Category Group:\n'));
          const rows = data.byCategoryGroup
            .filter((g: any) => Math.abs(g.summary?.sum || 0) > 0)
            .sort((a: any, b: any) => (a.summary?.sum || 0) - (b.summary?.sum || 0))
            .map((g: any) => [
              g.groupBy?.categoryGroup?.name || '?',
              g.groupBy?.categoryGroup?.type || '-',
              formatCurrency(g.summary?.sum || 0),
            ]);
          printTable(['Group', 'Type', 'Amount'], rows);
        }
      } catch {
        // Category breakdown not available
      }
    } catch (error) {
      spinner.fail('Failed to fetch cashflow');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
