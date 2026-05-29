#!/usr/bin/env node

import { Command } from 'commander';
import { transactionsCommand } from './commands/transactions';
import { categoriesCommand } from './commands/categories';
import { accountsCommand } from './commands/accounts';
import { authCommand } from './commands/auth';
import { receiptsCommand } from './commands/receipts';
import { doctorCommand } from './commands/doctor';
import { testCommand } from './commands/test';
import { recurringCommand } from './commands/recurring';
import { budgetsCommand } from './commands/budgets';
import { cashflowCommand } from './commands/cashflow';
import { insightsCommand } from './commands/insights';
import { graphqlCommand } from './commands/graphql';
import { rulesCommand } from './commands/rules';
import { tagsCommand } from './commands/tags';
import { networthCommand } from './commands/networth';
import { goalsCommand } from './commands/goals';
import { forecastCommand } from './commands/forecast';
import { portfolioCommand } from './commands/portfolio';
import { reportsCommand } from './commands/reports';
import { recapCommand } from './commands/recap';
import { debtCommand } from './commands/debt';
import { adviceCommand } from './commands/advice';
import { financialInsightsCommand } from './commands/financial-insights';
import { paychecksCommand } from './commands/paychecks';
import { taxCommand } from './commands/tax';
import { creditScoreCommand } from './commands/credit-score';

const program = new Command();

program
  .name('monarch-money')
  .description('CLI for Monarch Money budget management')
  .version('1.0.0');

// Add subcommands
program.addCommand(authCommand);
program.addCommand(transactionsCommand);
program.addCommand(categoriesCommand);
program.addCommand(accountsCommand);
program.addCommand(receiptsCommand);
program.addCommand(doctorCommand);
program.addCommand(testCommand);
program.addCommand(recurringCommand);
program.addCommand(budgetsCommand);
program.addCommand(cashflowCommand);
program.addCommand(insightsCommand);
program.addCommand(graphqlCommand);
program.addCommand(rulesCommand);
program.addCommand(tagsCommand);
program.addCommand(networthCommand);
program.addCommand(goalsCommand);
program.addCommand(forecastCommand);
program.addCommand(portfolioCommand);
program.addCommand(reportsCommand);
program.addCommand(recapCommand);
program.addCommand(debtCommand);
program.addCommand(adviceCommand);
program.addCommand(financialInsightsCommand);
program.addCommand(paychecksCommand);
program.addCommand(taxCommand);
program.addCommand(creditScoreCommand);

program.parse();
