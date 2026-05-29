import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { getClient } from '../client';
import { printTable, printJSON, printError, formatCurrency } from '../utils/output';

function monthToDateRange(month?: string): { startDate: string; endDate: string } {
  const now = new Date();
  const y = month ? parseInt(month.split('-')[0]) : now.getFullYear();
  const m = month ? parseInt(month.split('-')[1]) : now.getMonth() + 1;
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  return { startDate: start, endDate: start };
}

export const budgetsCommand = new Command('budgets')
  .description('Budget management');

budgetsCommand
  .command('list')
  .description('Show all budgets with spent/remaining')
  .option('--month <YYYY-MM>', 'Month to show (default: current)')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora('Fetching budgets...').start();
    try {
      const client = await getClient();
      const { startDate, endDate } = monthToDateRange(options.month);
      const data = await client.budgets.getBudgets({ startDate, endDate });
      spinner.stop();

      if (options.json) {
        printJSON(data);
        return;
      }

      // Build category name lookup
      const catMap = new Map<string, string>();
      const groupMap = new Map<string, string>();
      for (const g of (data.categoryGroups || [])) {
        groupMap.set(g.id, g.name);
        for (const c of (g.categories || [])) {
          catMap.set(c.id, c.name);
        }
      }

      // Show totals
      const totals = data.budgetData?.totalsByMonth?.[0];
      if (totals) {
        console.log(chalk.bold(`\nBudget Summary for ${totals.month || startDate}:\n`));
        console.log(`  ${chalk.cyan('Income:')}     ${formatCurrency(totals.totalIncome?.actualAmount || 0)} of ${formatCurrency(totals.totalIncome?.plannedAmount || 0)} planned`);
        console.log(`  ${chalk.cyan('Expenses:')}   ${formatCurrency(Math.abs(totals.totalExpenses?.actualAmount || 0))} of ${formatCurrency(Math.abs(totals.totalExpenses?.plannedAmount || 0))} planned`);
        console.log(`  ${chalk.cyan('Remaining:')}  ${formatCurrency(totals.totalExpenses?.remainingAmount || 0)}`);
      }

      // Show per-category budgets
      const catBudgets = data.budgetData?.monthlyAmountsByCategory || [];
      const rows = catBudgets
        .filter((cb: any) => cb.monthlyAmounts?.[0]?.plannedCashFlowAmount !== 0)
        .map((cb: any) => {
          const ma = cb.monthlyAmounts?.[0] || {};
          const name = catMap.get(cb.category?.id) || cb.category?.id || '?';
          const planned = Math.abs(ma.plannedCashFlowAmount || 0);
          const actual = Math.abs(ma.actualAmount || 0);
          const remaining = ma.remainingAmount || 0;
          const pct = planned > 0 ? Math.round((actual / planned) * 100) : 0;
          return [name, formatCurrency(planned), formatCurrency(actual), formatCurrency(remaining), `${pct}%`];
        });

      if (rows.length > 0) {
        console.log(chalk.bold('\nCategory Budgets:\n'));
        printTable(['Category', 'Budget', 'Spent', 'Remaining', '% Used'], rows);
      }
    } catch (error) {
      spinner.fail('Failed to fetch budgets');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

budgetsCommand
  .command('get <id>')
  .description('Get specific budget/category details')
  .option('--month <YYYY-MM>', 'Month to show (default: current)')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    const spinner = ora('Fetching budget details...').start();
    try {
      const client = await getClient();
      const { startDate, endDate } = monthToDateRange(options.month);
      const data = await client.budgets.getBudgets({ startDate, endDate, categoryIds: [id] });
      spinner.stop();

      // Find matching category budget
      const match = data.budgetData?.monthlyAmountsByCategory?.find(
        (cb: any) => cb.category?.id === id
      );

      if (options.json) {
        printJSON(match || data);
        return;
      }

      if (!match) {
        // Try category group
        const groupMatch = data.budgetData?.monthlyAmountsByCategoryGroup?.find(
          (cg: any) => cg.categoryGroup?.id === id
        );
        if (groupMatch) {
          const ma = groupMatch.monthlyAmounts?.[0] || {};
          console.log(chalk.bold('\nCategory Group Budget:\n'));
          console.log(`  ${chalk.cyan('ID:')}        ${id}`);
          console.log(`  ${chalk.cyan('Planned:')}   ${formatCurrency(Math.abs(ma.plannedCashFlowAmount || 0))}`);
          console.log(`  ${chalk.cyan('Actual:')}    ${formatCurrency(Math.abs(ma.actualAmount || 0))}`);
          console.log(`  ${chalk.cyan('Remaining:')} ${formatCurrency(ma.remainingAmount || 0)}`);
          return;
        }
        printError(`Budget with ID ${id} not found`);
        process.exit(1);
      }

      const ma = match.monthlyAmounts?.[0] || {};
      // Find name
      let catName = id;
      for (const g of (data.categoryGroups || [])) {
        for (const c of (g.categories || [])) {
          if (c.id === id) { catName = c.name; break; }
        }
      }

      console.log(chalk.bold('\nBudget Details:\n'));
      console.log(`  ${chalk.cyan('Category:')}  ${catName}`);
      console.log(`  ${chalk.cyan('Month:')}     ${ma.month || startDate}`);
      console.log(`  ${chalk.cyan('Planned:')}   ${formatCurrency(Math.abs(ma.plannedCashFlowAmount || 0))}`);
      console.log(`  ${chalk.cyan('Actual:')}    ${formatCurrency(Math.abs(ma.actualAmount || 0))}`);
      console.log(`  ${chalk.cyan('Remaining:')} ${formatCurrency(ma.remainingAmount || 0)}`);
      console.log(`  ${chalk.cyan('Rollover:')}  ${formatCurrency(ma.previousMonthRolloverAmount || 0)}`);
    } catch (error) {
      spinner.fail('Failed to fetch budget details');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
