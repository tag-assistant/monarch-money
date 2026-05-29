import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { getClient } from '../client';
import { printTable, printJSON, printError, formatCurrency, truncate } from '../utils/output';

export const goalsCommand = new Command('goals')
  .description('Financial goals tracking');

goalsCommand
  .command('list')
  .description('List all financial goals')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora('Fetching goals...').start();

    try {
      const client = await getClient();
      const gql = (client as any).graphql || (client as any)._graphql;

      let goals: any[];
      // Try GoalV2 first (newer Monarch schema)
      try {
        const data = await gql.query(`{
          goalsV2 {
            id
            name
            targetAmount
            currentAmount
            targetDate
            type
            completedAt
            archivedAt
            plannedContributions { amount frequency }
            accountAllocations { account { id displayName } currentBalance }
          }
        }`);
        goals = data.goalsV2 || [];
      } catch {
        // Fallback: try simpler goals query
        try {
          const data2 = await gql.query(`{ goals { id name targetAmount currentAmount targetDate type status } }`);
          goals = data2.goals || [];
        } catch {
          // Last resort: try savingsGoals
          const data3 = await gql.query(`{ savingsGoals { id name targetAmount currentAmount targetDate } }`);
          goals = data3.savingsGoals || [];
        }
      }

      spinner.stop();

      if (options.json) {
        printJSON(goals);
        return;
      }

      if (!goals || goals.length === 0) {
        console.log(chalk.yellow('No goals found'));
        return;
      }

      console.log(chalk.bold(`\n🎯 ${goals.length} goal(s):\n`));

      printTable(
        ['ID', 'Name', 'Target', 'Current', 'Progress', 'Target Date'],
        goals.map((g: any) => {
          const target = g.targetAmount || 0;
          const current = g.currentAmount || 0;
          const pct = target > 0 ? ((current / target) * 100).toFixed(1) : '-';
          return [
            g.id,
            truncate(g.name || '-', 25),
            formatCurrency(target),
            formatCurrency(current),
            `${pct}%`,
            g.targetDate || '-',
          ];
        })
      );
    } catch (error) {
      spinner.fail('Failed to fetch goals');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

goalsCommand
  .command('get <id>')
  .description('Get goal details')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    const spinner = ora('Fetching goal...').start();

    try {
      const client = await getClient();
      const gql = (client as any).graphql || (client as any)._graphql;

      let goal: any;
      try {
        const data = await gql.query(`query($id: ID!) {
          goalV2(id: $id) {
            id name targetAmount currentAmount targetDate type completedAt archivedAt
            plannedContributions { amount frequency startDate }
            accountAllocations { account { id displayName currentBalance } currentBalance targetAmount }
          }
        }`, { id });
        goal = data.goalV2;
      } catch {
        try {
          const data2 = await gql.query(`query($id: ID!) { goal(id: $id) { id name targetAmount currentAmount targetDate type status } }`, { id });
          goal = data2.goal;
        } catch {
          throw new Error('Goals API not available or goal not found');
        }
      }

      spinner.stop();

      if (!goal) {
        printError(`Goal ${id} not found`);
        process.exit(1);
      }

      if (options.json) {
        printJSON(goal);
        return;
      }

      const target = goal.targetAmount || 0;
      const current = goal.currentAmount || 0;
      const pct = target > 0 ? ((current / target) * 100).toFixed(1) : '0';

      console.log(chalk.bold('\n🎯 Goal Details\n'));
      console.log(`  ${chalk.cyan('ID:')}          ${goal.id}`);
      console.log(`  ${chalk.cyan('Name:')}        ${goal.name}`);
      console.log(`  ${chalk.cyan('Target:')}      ${formatCurrency(target)}`);
      console.log(`  ${chalk.cyan('Current:')}     ${formatCurrency(current)}`);
      console.log(`  ${chalk.cyan('Progress:')}    ${pct}%`);
      console.log(`  ${chalk.cyan('Target Date:')} ${goal.targetDate || '-'}`);
      if (goal.type) console.log(`  ${chalk.cyan('Type:')}        ${goal.type}`);
      if (goal.completedAt) console.log(`  ${chalk.cyan('Completed:')}   ${goal.completedAt}`);

      if (goal.accountAllocations?.length > 0) {
        console.log(chalk.bold('\n  Linked Accounts:'));
        goal.accountAllocations.forEach((a: any) => {
          console.log(`    • ${a.account?.displayName || 'Unknown'}: ${formatCurrency(a.currentBalance || 0)}`);
        });
      }
    } catch (error) {
      spinner.fail('Failed to fetch goal');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
