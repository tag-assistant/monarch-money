import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { getClient } from '../client';
import { 
  printTable, 
  printJSON, 
  printSuccess, 
  printError,
  formatCurrency, 
  formatDate, 
  truncate 
} from '../utils/output';

export const transactionsCommand = new Command('transactions')
  .alias('tx')
  .description('Transaction management');

transactionsCommand
  .command('search')
  .description('Search transactions')
  .option('-m, --merchant <name>', 'Filter by merchant name')
  .option('-c, --category <name>', 'Filter by category name')
  .option('-a, --account <name>', 'Filter by account name')
  .option('--start <date>', 'Start date (YYYY-MM-DD)')
  .option('--end <date>', 'End date (YYYY-MM-DD)')
  .option('--min <amount>', 'Minimum amount')
  .option('--max <amount>', 'Maximum amount')
  .option('-l, --limit <n>', 'Limit results', '20')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora('Searching transactions...').start();
    
    try {
      const client = await getClient();
      
      const searchOptions: any = {
        limit: parseInt(options.limit),
      };
      
      if (options.merchant) {
        searchOptions.search = options.merchant;
      }
      if (options.start) {
        searchOptions.startDate = options.start;
      }
      if (options.end) {
        searchOptions.endDate = options.end;
      }
      if (options.min) {
        searchOptions.absAmountRange = [parseFloat(options.min), undefined];
      }
      if (options.max) {
        const range = searchOptions.absAmountRange || [undefined, undefined];
        searchOptions.absAmountRange = [range[0], parseFloat(options.max)];
      }

      const result = await client.transactions.getTransactions(searchOptions);

      spinner.stop();

      // Filter by category/account if specified (client-side filtering)
      let transactions = result.transactions || [];
      
      if (options.category) {
        const categoryLower = options.category.toLowerCase();
        transactions = transactions.filter((t: any) => 
          t.category?.name?.toLowerCase().includes(categoryLower)
        );
      }
      
      if (options.account) {
        const accountLower = options.account.toLowerCase();
        transactions = transactions.filter((t: any) => 
          t.account?.displayName?.toLowerCase().includes(accountLower)
        );
      }

      if (options.json) {
        printJSON(transactions);
        return;
      }

      if (transactions.length === 0) {
        console.log(chalk.yellow('No transactions found'));
        return;
      }

      console.log(chalk.bold(`\nFound ${transactions.length} transaction(s):\n`));
      
      printTable(
        ['ID', 'Date', 'Merchant', 'Amount', 'Category', 'Account'],
        transactions.map((t: any) => [
          t.id,
          formatDate(t.date),
          truncate(t.merchant?.name || 'Unknown', 25),
          formatCurrency(t.amount),
          truncate(t.category?.name || 'Uncategorized', 20),
          truncate(t.account?.displayName || 'Unknown', 15),
        ])
      );
    } catch (error) {
      spinner.fail('Search failed');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

transactionsCommand
  .command('get <id>')
  .description('Get transaction details')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    const spinner = ora('Fetching transaction...').start();
    
    try {
      const client = await getClient();
      let transaction: any = null;

      try {
        // Primary: get full transaction details
        transaction = await client.transactions.getTransactionDetails(id);
      } catch {
        // Fallback: page through recent transactions and match by ID
        const pageSize = 100;
        const maxPages = 10; // 1000 transactions
        for (let page = 0; page < maxPages; page++) {
          const result = await client.transactions.getTransactions({
            limit: pageSize,
            offset: page * pageSize,
          });
          transaction = (result.transactions || []).find((t: any) => t.id === id);
          if (transaction || !result.hasMore) break;
        }
      }

      spinner.stop();

      if (!transaction) {
        printError(`Transaction ${id} not found`);
        process.exit(1);
      }

      if (options.json) {
        printJSON(transaction);
        return;
      }

      console.log(chalk.bold('\nTransaction Details:\n'));
      console.log(`  ${chalk.cyan('ID:')}        ${transaction.id}`);
      console.log(`  ${chalk.cyan('Date:')}      ${formatDate(transaction.date)}`);
      console.log(`  ${chalk.cyan('Merchant:')}  ${transaction.merchant?.name || 'Unknown'}`);
      console.log(`  ${chalk.cyan('Amount:')}    ${formatCurrency(transaction.amount)}`);
      console.log(`  ${chalk.cyan('Category:')} ${transaction.category?.name || 'Uncategorized'}`);
      console.log(`  ${chalk.cyan('Account:')}  ${transaction.account?.displayName || 'Unknown'}`);
      if (transaction.notes) {
        console.log(`  ${chalk.cyan('Notes:')}    ${transaction.notes}`);
      }
    } catch (error) {
      spinner.fail('Fetch failed');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

transactionsCommand
  .command('update <id>')
  .description('Update a transaction')
  .option('-c, --category <id>', 'Set category by ID')
  .option('-n, --notes <text>', 'Set notes')
  .option('-t, --tag <id>', 'Add tag by ID (can specify multiple)', undefined)
  .option('--tags <ids>', 'Set tag IDs (comma-separated)')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    const spinner = ora('Updating transaction...').start();
    
    try {
      const client = await getClient();
      
      const updates: any = {};
      
      if (options.category) {
        updates.categoryId = options.category;
      }
      if (options.notes !== undefined) {
        updates.notes = options.notes;
      }

      // Handle tags
      if (options.tags) {
        const tagIds = options.tags.split(',').map((t: string) => t.trim());
        try {
          await client.transactions.setTransactionTags(id, tagIds);
        } catch (e: any) {
          spinner.warn(`Tag update may have failed: ${e.message}`);
        }
      } else if (options.tag) {
        // Add single tag — get existing tags first then append
        try {
          const details = await client.transactions.getTransactionDetails(id);
          const existingTagIds = (details as any).tags?.map((t: any) => t.id) || [];
          if (!existingTagIds.includes(options.tag)) {
            existingTagIds.push(options.tag);
          }
          await client.transactions.setTransactionTags(id, existingTagIds);
        } catch (e: any) {
          spinner.warn(`Tag update may have failed: ${e.message}`);
        }
      }

      if (Object.keys(updates).length > 0) {
        await client.transactions.updateTransaction(id, updates);
      }

      spinner.succeed(`Transaction ${id} updated`);
      
      if (options.json) {
        printJSON({ success: true, id, updates });
      }
    } catch (error) {
      spinner.fail('Update failed');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

transactionsCommand
  .command('categorize <transactionId> <categoryId>')
  .description('Set transaction category')
  .action(async (transactionId, categoryId) => {
    const spinner = ora('Setting category...').start();
    
    try {
      const client = await getClient();
      await client.transactions.updateTransaction(transactionId, { categoryId });
      spinner.succeed(`Category set for transaction ${transactionId}`);
    } catch (error) {
      spinner.fail('Failed to set category');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

transactionsCommand
  .command('create')
  .description('Create a manual transaction')
  .requiredOption('-a, --account <id>', 'Account ID')
  .requiredOption('-m, --merchant <name>', 'Merchant name')
  .requiredOption('-A, --amount <number>', 'Amount (e.g., 12.34)')
  .requiredOption('-d, --date <YYYY-MM-DD>', 'Transaction date')
  .option('-c, --category <id>', 'Category ID')
  .option('-n, --notes <text>', 'Notes')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora('Creating transaction...').start();

    try {
      const client = await getClient();
      const amount = parseFloat(options.amount);
      if (Number.isNaN(amount)) {
        spinner.fail('Amount must be a number');
        process.exit(1);
      }

      const tx = await client.transactions.createTransaction({
        accountId: options.account,
        merchantName: options.merchant,
        amount,
        date: options.date,
        categoryId: options.category,
        notes: options.notes,
      });

      spinner.succeed(`Transaction created (${tx.id})`);

      if (options.json) {
        printJSON(tx);
      }
    } catch (error) {
      spinner.fail('Create failed');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

transactionsCommand
  .command('bulk-categorize')
  .description('Recategorize all matching transactions')
  .requiredOption('-m, --merchant <name>', 'Merchant name to match')
  .requiredOption('-c, --category <id>', 'Category ID to assign')
  .option('-l, --limit <n>', 'Max transactions to process', '100')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora(`Finding transactions for "${options.merchant}"...`).start();

    try {
      const client = await getClient();

      // Search for matching transactions
      const result = await client.transactions.getTransactions({
        search: options.merchant,
        limit: parseInt(options.limit),
      });

      const txs = (result.transactions || []).filter((t: any) =>
        t.merchant?.name?.toLowerCase().includes(options.merchant.toLowerCase())
      );

      if (txs.length === 0) {
        spinner.info('No matching transactions found');
        return;
      }

      spinner.text = `Categorizing ${txs.length} transaction(s)...`;

      const ids = txs.map((t: any) => t.id);

      // Use the bulk update mutation (same as updateTransaction uses)
      const gql = (client as any).graphql || (client as any)._graphql;
      const mutation = `mutation Common_BulkUpdateTransactionsMutation($selectedTransactionIds:[ID!]$excludedTransactionIds:[ID!]$allSelected:Boolean!$expectedAffectedTransactionCount:Int!$updates:TransactionUpdateParams!$filters:TransactionFilterInput){bulkUpdateTransactions(selectedTransactionIds:$selectedTransactionIds excludedTransactionIds:$excludedTransactionIds updates:$updates allSelected:$allSelected expectedAffectedTransactionCount:$expectedAffectedTransactionCount filters:$filters){success affectedCount errors{message}}}`;

      const bulkResult = await gql.mutation(mutation, {
        selectedTransactionIds: ids,
        excludedTransactionIds: [],
        allSelected: false,
        expectedAffectedTransactionCount: ids.length,
        updates: { categoryId: options.category },
        filters: { transactionVisibility: 'non_hidden_transactions_only' },
      });

      const affected = bulkResult.bulkUpdateTransactions?.affectedCount || 0;
      spinner.succeed(`Categorized ${affected} transaction(s) for "${options.merchant}"`);

      if (options.json) {
        printJSON({ affected, transactionIds: ids });
      }
    } catch (error) {
      spinner.fail('Bulk categorize failed');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

transactionsCommand
  .command('bulk-review')
  .description('Mark transactions as reviewed in bulk')
  .option('-s, --status <status>', 'Review status to set', 'reviewed')
  .option('-l, --limit <n>', 'Max transactions to process', '50')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora('Finding transactions needing review...').start();

    try {
      const client = await getClient();

      // Fetch recent transactions and filter for needs-review
      const result = await client.transactions.getTransactions({
        limit: parseInt(options.limit),
      });

      const txs = (result.transactions || []).filter((t: any) => t.needsReview);

      if (txs.length === 0) {
        spinner.info('No transactions needing review');
        return;
      }

      spinner.text = `Marking ${txs.length} transaction(s) as ${options.status}...`;

      const ids = txs.map((t: any) => t.id);
      const gql = (client as any).graphql || (client as any)._graphql;
      const mutation = `mutation Common_BulkUpdateTransactionsMutation($selectedTransactionIds:[ID!]$excludedTransactionIds:[ID!]$allSelected:Boolean!$expectedAffectedTransactionCount:Int!$updates:TransactionUpdateParams!$filters:TransactionFilterInput){bulkUpdateTransactions(selectedTransactionIds:$selectedTransactionIds excludedTransactionIds:$excludedTransactionIds updates:$updates allSelected:$allSelected expectedAffectedTransactionCount:$expectedAffectedTransactionCount filters:$filters){success affectedCount errors{message}}}`;

      const bulkResult = await gql.mutation(mutation, {
        selectedTransactionIds: ids,
        excludedTransactionIds: [],
        allSelected: false,
        expectedAffectedTransactionCount: ids.length,
        updates: { reviewStatus: options.status },
        filters: { transactionVisibility: 'non_hidden_transactions_only' },
      });

      const affected = bulkResult.bulkUpdateTransactions?.affectedCount || 0;
      spinner.succeed(`Marked ${affected} transaction(s) as ${options.status}`);

      if (options.json) {
        printJSON({ affected, transactionIds: ids });
      }
    } catch (error) {
      spinner.fail('Bulk review failed');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

transactionsCommand
  .command('delete <id>')
  .description('Delete a transaction')
  .option('--yes', 'Confirm deletion')
  .option('--json', 'Output as JSON')
  .action(async (id, options) => {
    if (!options.yes) {
      printError('Deletion requires --yes');
      process.exit(1);
    }

    const spinner = ora('Deleting transaction...').start();

    try {
      const client = await getClient();
      const deleted = await client.transactions.deleteTransaction(id);
      if (deleted) {
        spinner.succeed(`Transaction deleted (${id})`);
      } else {
        spinner.fail('Delete failed');
        process.exit(1);
      }

      if (options.json) {
        printJSON({ success: true, id });
      }
    } catch (error) {
      spinner.fail('Delete failed');
      printError(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
