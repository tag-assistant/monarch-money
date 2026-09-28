import { Command } from 'commander';

import { runGraphQL } from '../graphql-client';
import { PAYCHECKS_LIST_QUERY, PAYCHECKS_SUMMARY_QUERY } from '../queries/paychecks';

export { PAYCHECKS_LIST_QUERY, PAYCHECKS_SUMMARY_QUERY } from '../queries/paychecks';

export const paychecksCommand = new Command('paychecks')
  .description('Paycheck information');

paychecksCommand
  .command('list')
  .description('List paychecks')
  .action(async () => {
    try {
      const data = await runGraphQL(PAYCHECKS_LIST_QUERY);
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

paychecksCommand
  .command('summary')
  .description('Paycheck summary (gross/net/deductions)')
  .action(async () => {
    try {
      const data = await runGraphQL(PAYCHECKS_SUMMARY_QUERY);
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
