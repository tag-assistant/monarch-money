import { Command } from 'commander';

import { runGraphQL } from '../graphql-client';
const SCHEDULE_C_QUERY = `query ($taxYear: Int!) {
  scheduleCLineItems(taxYear: $taxYear) {
    key
    lineNumber
    description
    lineType
    sortOrder
    isNotTracked
    displayInfo
  }
}`;

const TAX_LOTS_QUERY = `query GetTaxLots($portfolioInput: PortfolioInput) {
  portfolio(input: $portfolioInput) {
    aggregateHoldings {
      edges {
        node {
          id
          quantity
          costBasis
          totalValue
          security {
            id
            name
            ticker
            currentPrice
            type
            typeDisplay
            __typename
          }
          holdings {
            id
            name
            ticker
            quantity
            value
            costBasis
            userCostBasis
            account {
              id
              displayName
              __typename
            }
            taxLots {
              id
              createdAt
              acquisitionDate
              acquisitionQuantity
              costBasisPerUnit
              __typename
            }
            __typename
          }
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
}`;

export const taxCommand = new Command('tax')
  .description('Tax-related data (Schedule C, tax lots)');

taxCommand
  .command('schedule-c')
  .description('Schedule C line items by year')
  .requiredOption('--year <year>', 'Tax year', parseInt)
  .action(async (options) => {
    try {
      const data = await runGraphQL(SCHEDULE_C_QUERY, { taxYear: options.year });
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

taxCommand
  .command('lots')
  .description('Per-lot cost basis and unrealized gains')
  .action(async () => {
    try {
      const data = await runGraphQL(TAX_LOTS_QUERY);
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
