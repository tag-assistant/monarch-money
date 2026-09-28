import { Command } from 'commander';

import { runGraphQL, runGraphQLMutation } from '../graphql-client';
export const graphqlCommand = new Command('graphql')
  .alias('gql')
  .description('Generic GraphQL explorer');

graphqlCommand
  .command('query <queryString>')
  .description('Run an arbitrary GraphQL query')
  .option('--vars <json>', 'Variables as JSON string')
  .action(async (queryString, options) => {
    try {
      const variables = options.vars ? JSON.parse(options.vars) : undefined;
      const data = await runGraphQL(queryString, variables);
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

graphqlCommand
  .command('mutation <mutationString>')
  .description('Run a GraphQL mutation')
  .option('--vars <json>', 'Variables as JSON string')
  .action(async (mutationString, options) => {
    try {
      const variables = options.vars ? JSON.parse(options.vars) : undefined;
      const data = await runGraphQLMutation(mutationString, variables);
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

graphqlCommand
  .command('explore <typeName>')
  .description('Introspect a GraphQL type (may fail for non-admin)')
  .action(async (typeName) => {
    try {
      const query = `
        query IntrospectType($name: String!) {
          __type(name: $name) {
            name
            kind
            description
            fields {
              name
              description
              type {
                name
                kind
                ofType { name kind ofType { name kind } }
              }
              args {
                name
                type { name kind ofType { name kind } }
                defaultValue
              }
            }
            inputFields {
              name
              type { name kind ofType { name kind } }
              defaultValue
            }
            enumValues { name description }
          }
        }
      `;
      const data = await runGraphQL(query, { name: typeName });
      console.log(JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
