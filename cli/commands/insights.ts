import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { getClient } from '../client';
import { printTable, printJSON, printError } from '../utils/output';

export const insightsCommand = new Command('insights')
  .description('Spending insights and trends')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora('Fetching insights...').start();
    try {
      const client = await getClient();
      const insights = await client.insights.getInsights();
      spinner.stop();

      if (options.json) {
        printJSON(insights);
        return;
      }

      if (!insights || insights.length === 0) {
        console.log(chalk.yellow('No insights available'));
        return;
      }

      console.log(chalk.bold(`\n${insights.length} insight(s):\n`));

      for (const insight of insights) {
        const priority = insight.priority >= 3 ? chalk.red('HIGH') : insight.priority >= 2 ? chalk.yellow('MED') : chalk.gray('LOW');
        console.log(`  ${priority} ${chalk.bold(insight.title)}`);
        console.log(`    ${insight.description}`);
        if (insight.actionRequired) {
          console.log(`    ${chalk.yellow('⚡ Action required')}`);
        }
        console.log();
      }
    } catch (error) {
      spinner.fail('Failed to fetch insights');
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('400')) {
        console.log(chalk.yellow('Insights API not available for this account'));
      } else {
        printError(msg);
        process.exit(1);
      }
    }
  });
