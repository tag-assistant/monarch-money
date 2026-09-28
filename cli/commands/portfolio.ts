import { Command } from 'commander';

import { runGraphQL } from '../graphql-client';
const PORTFOLIO_QUERY = `query Web_GetPortfolio($portfolioInput: PortfolioInput) {
  portfolio(input: $portfolioInput) {
    performance {
      totalValue
      totalChangePercent
      totalChangeDollars
      oneDayChangePercent
      historicalChart { date returnPercent __typename }
      benchmarks {
        security { id ticker name oneDayChangePercent __typename }
        historicalChart { date returnPercent __typename }
        __typename
      }
      __typename
    }
    aggregateHoldings {
      edges {
        node {
          id
          quantity
          costBasis
          totalValue
          securityPriceChangeDollars
          securityPriceChangePercent
          lastSyncedAt
          holdings {
            id type typeDisplay name ticker closingPrice closingPriceUpdatedAt
            quantity value costBasis userCostBasis
            account {
              id mask icon logoUrl displayName order currentBalance
              institution { id name __typename }
              type { name display __typename }
              subtype { name display __typename }
              __typename
            }
            taxLots { id createdAt acquisitionDate acquisitionQuantity costBasisPerUnit __typename }
            __typename
          }
          security { id name ticker currentPrice currentPriceUpdatedAt closingPrice type typeDisplay categoryGroup __typename }
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
}`;

export const portfolioCommand = new Command('portfolio')
  .description('View investment portfolio performance and holdings')
  .option('--start <date>', 'Start date (YYYY-MM-DD)')
  .option('--end <date>', 'End date (YYYY-MM-DD)')
  .action(async (options) => {
    try {
      const portfolioInput: any = {};
      if (options.start) portfolioInput.startDate = options.start;
      if (options.end) portfolioInput.endDate = options.end;

      const variables = Object.keys(portfolioInput).length > 0 ? { portfolioInput } : { portfolioInput: null };
      const data = await runGraphQL(PORTFOLIO_QUERY, variables);
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
