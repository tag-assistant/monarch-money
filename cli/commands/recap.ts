import { Command } from 'commander';

import { runGraphQL } from '../graphql-client';
const RECAP_QUERY = `query ($startDate: Date!, $endDate: Date!) {
  recap(startDate: $startDate, endDate: $endDate) {
    id
    dateRangeStart
    dateRangeEnd
    summary
    sentiment
    createdAt
    updatedAt
    cards {
      module
      title
      headline
      message
      sentiment
      metrics
      richBlocks
      titleMarkdown
      headlineMarkdown
      messageMarkdown
    }
  }
}`;

export const recapCommand = new Command('recap')
  .description('AI-generated weekly financial recap')
  .requiredOption('--start <date>', 'Start date (YYYY-MM-DD)')
  .requiredOption('--end <date>', 'End date (YYYY-MM-DD)')
  .action(async (options) => {
    try {
      const data = await runGraphQL(RECAP_QUERY, {
        startDate: options.start,
        endDate: options.end,
      });
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
