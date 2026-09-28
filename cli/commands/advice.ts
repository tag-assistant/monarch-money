import { Command } from 'commander';

import { runGraphQL } from '../graphql-client';
const ADVICE_QUERY = `query AdviceQuery_Web($categoryName: String) {
  essentials: adviceItems(group: "essential", category: $categoryName) {
    id
    title
    description
    category { name displayName color __typename }
    numTasksCompleted
    numTasksRemaining
    numTasks
    completedAt
    __typename
  }
  objectives: adviceItems(group: "objective", category: $categoryName) {
    id
    title
    description
    category { name displayName color __typename }
    numTasksCompleted
    numTasksRemaining
    numTasks
    completedAt
    __typename
  }
  adviceItemCategories { name displayName description __typename }
}`;

export const adviceCommand = new Command('advice')
  .description('Financial advice items')
  .option('--category <categoryName>', 'Filter by category name')
  .action(async (options) => {
    try {
      const variables: Record<string, any> = {};
      if (options.category) variables.categoryName = options.category;
      const data = await runGraphQL(ADVICE_QUERY, variables);
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
