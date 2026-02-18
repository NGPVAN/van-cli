// @ts-nocheck

import { program } from 'commander';
import chalk from 'chalk';
import VanApiClient from './client';
import { version } from '../package.json';

// Check for required environment variables
if (!process.env.VAN_API_KEY) {
  console.error(chalk.red('Error: VAN_API_KEY environment variable is required'));
  console.error(chalk.yellow('Set it in your shell: export VAN_API_KEY="your-api-key|0"'));
  process.exit(1);
}

// Create global client instance
const client = new VanApiClient();

// Utility function to format and output results
function outputResult(data, options = {}) {
  if (options.pretty) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(JSON.stringify(data));
  }
}

// Error handler
function handleError(error) {
  if (error.status && error.details) {
    console.error(chalk.red(`VAN API Error (${error.status}):`));
    console.error(chalk.red(JSON.stringify(error.details, null, 2)));
  } else {
    console.error(chalk.red(`Error: ${error.message}`));
  }
  process.exit(1);
}

// Set up the main program
program
  .name('van')
  .description('NGP VAN API CLI tool')
  .version(version)
  .option('-p, --pretty', 'Pretty print JSON output');

// People commands
const peopleCmd = program
  .command('people')
  .description('Manage people');

peopleCmd
  .command('get <vanId>')
  .description('Get a person by VAN ID')
  .option('-e, --expand <fields>', 'Expand related fields (comma-separated)')
  .action(async (vanId, options) => {
    try {
      const params = {};
      if (options.expand) {
        params.$expand = options.expand;
      }
      const person = await client.get(`/people/${vanId}`, params);
      outputResult(person, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

peopleCmd
  .command('find')
  .description('Find people by criteria')
  .option('-f, --firstName <name>', 'First name')
  .option('-l, --lastName <name>', 'Last name')
  .option('-e, --email <email>', 'Email address')
  .option('-p, --phone <phone>', 'Phone number')
  .option('--top <count>', 'Number of results (max 50)', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .option('--expand <fields>', 'Expand related fields (comma-separated)')
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };
      
      if (options.firstName) params.firstName = options.firstName;
      if (options.lastName) params.lastName = options.lastName;
      if (options.email) params.email = options.email;
      if (options.phone) params.phone = options.phone;
      if (options.expand) params.$expand = options.expand;
      
      const results = await client.get('/people', params);
      outputResult(results, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

peopleCmd
  .command('find-or-create')
  .description('Find or create a person')
  .requiredOption('-f, --firstName <name>', 'First name')
  .requiredOption('-l, --lastName <name>', 'Last name')
  .option('-e, --email <email>', 'Email address')
  .option('-p, --phone <phone>', 'Phone number')
  .action(async (options) => {
    try {
      const data = {
        firstName: options.firstName,
        lastName: options.lastName
      };
      
      if (options.email) data.email = options.email;
      if (options.phone) data.phone = options.phone;
      
      const result = await client.post('/people/findOrCreate', data);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Activist Codes commands
const activistCodesCmd = program
  .command('activist-codes')
  .description('Manage activist codes');

activistCodesCmd
  .command('list')
  .description('List all activist codes')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };
      const codes = await client.get('/activistCodes', params);
      outputResult(codes, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Survey Questions commands
const surveyQuestionsCmd = program
  .command('survey-questions')
  .description('Manage survey questions');

surveyQuestionsCmd
  .command('list')
  .description('List all survey questions')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };
      const questions = await client.get('/surveyQuestions', params);
      outputResult(questions, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Events commands
const eventsCmd = program
  .command('events')
  .description('Manage events');

eventsCmd
  .command('list')
  .description('List events')
  .option('--startDate <date>', 'Start date filter (YYYY-MM-DD)')
  .option('--endDate <date>', 'End date filter (YYYY-MM-DD)')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };
      
      if (options.startDate) params.startDate = options.startDate;
      if (options.endDate) params.endDate = options.endDate;
      
      const events = await client.get('/events', params);
      outputResult(events, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Saved Lists commands
const savedListsCmd = program
  .command('saved-lists')
  .description('Manage saved lists');

savedListsCmd
  .command('list')
  .description('List saved lists')
  .option('--top <count>', 'Number of results (max 100)', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: Math.min(options.top, 100), // VAN limits saved lists to 100
        $skip: options.skip
      };
      const lists = await client.get('/savedLists', params);
      outputResult(lists, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Export Jobs commands
const exportJobsCmd = program
  .command('export-jobs')
  .description('Manage export jobs');

exportJobsCmd
  .command('create')
  .description('Create an export job')
  .requiredOption('-s, --savedListId <id>', 'Saved list ID to export', parseInt)
  .option('-w, --webhookUrl <url>', 'Webhook URL for completion notification')
  .action(async (options) => {
    try {
      const data = {
        savedListId: options.savedListId
      };
      
      if (options.webhookUrl) data.webhookUrl = options.webhookUrl;
      
      const job = await client.post('/exportJobs', data);
      outputResult(job, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Canvass Responses commands
const canvassResponsesCmd = program
  .command('canvass-responses')
  .description('Manage canvass responses');

canvassResponsesCmd
  .command('create')
  .description('Create a canvass response')
  .requiredOption('-v, --vanId <id>', 'Person VAN ID', parseInt)
  .requiredOption('-r, --resultCodeId <id>', 'Result code ID', parseInt)
  .option('-c, --canvassContext <context>', 'Canvass context')
  .action(async (options) => {
    try {
      const data = {
        vanId: options.vanId,
        resultCodeId: options.resultCodeId
      };
      
      if (options.canvassContext) data.canvassContext = options.canvassContext;
      
      const response = await client.post('/canvassResponses', data);
      outputResult(response, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Notes commands
const notesCmd = program
  .command('notes')
  .description('Manage notes');

notesCmd
  .command('create')
  .description('Create a note')
  .requiredOption('-v, --vanId <id>', 'Person VAN ID', parseInt)
  .requiredOption('-t, --text <text>', 'Note text')
  .option('-c, --category <category>', 'Note category')
  .action(async (options) => {
    try {
      const data = {
        vanId: options.vanId,
        text: options.text
      };
      
      if (options.category) data.category = options.category;
      
      const note = await client.post('/notes', data);
      outputResult(note, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Contributions commands
const contributionsCmd = program
  .command('contributions')
  .description('Manage contributions');

contributionsCmd
  .command('list')
  .description('List contributions')
  .option('--startDate <date>', 'Start date filter (YYYY-MM-DD)')
  .option('--endDate <date>', 'End date filter (YYYY-MM-DD)')
  .option('--vanId <id>', 'Person VAN ID filter', parseInt)
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };
      
      if (options.startDate) params.startDate = options.startDate;
      if (options.endDate) params.endDate = options.endDate;
      if (options.vanId) params.vanId = options.vanId;
      
      const contributions = await client.get('/contributions', params);
      outputResult(contributions, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

contributionsCmd
  .command('get <contributionId>')
  .description('Get a contribution by ID')
  .action(async (contributionId, options) => {
    try {
      const contribution = await client.get(`/contributions/${contributionId}`);
      outputResult(contribution, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Signups commands
const signupsCmd = program
  .command('signups')
  .description('Manage event signups');

signupsCmd
  .command('list')
  .description('List signups')
  .option('--eventId <id>', 'Event ID filter', parseInt)
  .option('--vanId <id>', 'Person VAN ID filter', parseInt)
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };
      
      if (options.eventId) params.eventId = options.eventId;
      if (options.vanId) params.vanId = options.vanId;
      
      const signups = await client.get('/signups', params);
      outputResult(signups, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

signupsCmd
  .command('create')
  .description('Create a new signup')
  .requiredOption('-e, --eventId <id>', 'Event ID', parseInt)
  .requiredOption('-v, --vanId <id>', 'Person VAN ID', parseInt)
  .option('-r, --role <role>', 'Person role at event')
  .option('-s, --status <status>', 'Signup status')
  .action(async (options) => {
    try {
      const data = {
        eventId: options.eventId,
        vanId: options.vanId
      };
      
      if (options.role) data.role = options.role;
      if (options.status) data.status = options.status;
      
      const signup = await client.post('/signups', data);
      outputResult(signup, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Scores commands
const scoresCmd = program
  .command('scores')
  .description('Manage scores');

scoresCmd
  .command('list')
  .description('List score types')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };
      const scores = await client.get('/scores', params);
      outputResult(scores, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

scoresCmd
  .command('apply')
  .description('Apply a score to a person')
  .requiredOption('-v, --vanId <id>', 'Person VAN ID', parseInt)
  .requiredOption('-s, --scoreId <id>', 'Score type ID', parseInt)
  .requiredOption('--value <value>', 'Score value', parseFloat)
  .action(async (options) => {
    try {
      const data = {
        scoreId: options.scoreId,
        value: options.value
      };
      
      const result = await client.post(`/people/${options.vanId}/scores`, data);
      outputResult(result, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Custom Fields commands
const customFieldsCmd = program
  .command('custom-fields')
  .description('Manage custom fields');

customFieldsCmd
  .command('list')
  .description('List custom fields')
  .option('--fieldType <type>', 'Field type filter')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };
      
      if (options.fieldType) params.fieldType = options.fieldType;
      
      const fields = await client.get('/customFields', params);
      outputResult(fields, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Locations commands
const locationsCmd = program
  .command('locations')
  .description('Manage locations');

locationsCmd
  .command('list')
  .description('List locations')
  .option('--locationType <type>', 'Location type filter')
  .option('--state <state>', 'State filter')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };
      
      if (options.locationType) params.locationType = options.locationType;
      if (options.state) params.state = options.state;
      
      const locations = await client.get('/locations', params);
      outputResult(locations, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

locationsCmd
  .command('find')
  .description('Find locations by criteria')
  .option('-n, --name <name>', 'Location name')
  .option('-c, --city <city>', 'City name')
  .option('-s, --state <state>', 'State')
  .option('-z, --zip <zip>', 'ZIP code')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };
      
      if (options.name) params.name = options.name;
      if (options.city) params.city = options.city;
      if (options.state) params.state = options.state;
      if (options.zip) params.zip = options.zip;
      
      const results = await client.get('/locations/find', params);
      outputResult(results, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Bulk Import commands
const bulkImportCmd = program
  .command('bulk-import')
  .description('Manage bulk import jobs');

bulkImportCmd
  .command('list')
  .description('List bulk import jobs')
  .option('--status <status>', 'Job status filter')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };
      
      if (options.status) params.status = options.status;
      
      const jobs = await client.get('/bulkImportJobs', params);
      outputResult(jobs, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Changed Entity Export Jobs commands
const changedEntityExportCmd = program
  .command('changed-entity-exports')
  .description('Manage changed entity export jobs');

changedEntityExportCmd
  .command('list')
  .description('List changed entity export jobs')
  .option('--status <status>', 'Job status filter')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };
      
      if (options.status) params.status = options.status;
      
      const jobs = await client.get('/changedEntityExportJobs', params);
      outputResult(jobs, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

changedEntityExportCmd
  .command('create')
  .description('Create a changed entity export job')
  .requiredOption('-f, --dateChangedFrom <date>', 'Start date for changes (YYYY-MM-DD)')
  .option('-t, --dateChangedTo <date>', 'End date for changes (YYYY-MM-DD)')
  .option('-w, --webhookUrl <url>', 'Webhook URL for completion notification')
  .action(async (options) => {
    try {
      const data = {
        dateChangedFrom: options.dateChangedFrom
      };
      
      if (options.dateChangedTo) data.dateChangedTo = options.dateChangedTo;
      if (options.webhookUrl) data.webhookUrl = options.webhookUrl;
      
      const job = await client.post('/changedEntityExportJobs', data);
      outputResult(job, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Contact Types commands
const contactTypesCmd = program
  .command('contact-types')
  .description('Manage contact types');

contactTypesCmd
  .command('list')
  .description('List contact types')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };
      const types = await client.get('/contactTypes', params);
      outputResult(types, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Event Types commands
const eventTypesCmd = program
  .command('event-types')
  .description('Manage event types');

eventTypesCmd
  .command('list')
  .description('List event types')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };
      const types = await client.get('/eventTypes', params);
      outputResult(types, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Supporter Groups commands
const supporterGroupsCmd = program
  .command('supporter-groups')
  .description('Manage supporter groups');

supporterGroupsCmd
  .command('list')
  .description('List supporter groups')
  .option('--top <count>', 'Number of results', val => parseInt(val, 10), 50)
  .option('--skip <count>', 'Number of results to skip', val => parseInt(val, 10), 0)
  .action(async (options) => {
    try {
      const params = {
        $top: options.top,
        $skip: options.skip
      };
      const groups = await client.get('/supporterGroups', params);
      outputResult(groups, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

supporterGroupsCmd
  .command('create')
  .description('Create a new supporter group')
  .requiredOption('-n, --name <name>', 'Group name')
  .option('-d, --description <desc>', 'Group description')
  .action(async (options) => {
    try {
      const data = {
        name: options.name
      };
      
      if (options.description) data.description = options.description;
      
      const group = await client.post('/supporterGroups', data);
      outputResult(group, program.opts());
    } catch (error) {
      handleError(error);
    }
  });

// Parse command line arguments
program.parseAsync(process.argv);
