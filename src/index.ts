import VanApiClient from './client';
import createPeople from './commands/people';
import createActivistCodes from './commands/activistCodes';
import createSurveyQuestions from './commands/surveyQuestions';
import createEvents from './commands/events';
import createSavedLists from './commands/savedLists';
import createExportJobs from './commands/exportJobs';
import createCanvassResponses from './commands/canvassResponses';
import createContributions from './commands/contributions';
import createSignups from './commands/signups';
import createNotes from './commands/notes';
import createScores from './commands/scores';
import createCustomFields from './commands/customFields';
import createCodes from './commands/codes';
import createTargets from './commands/targets';
import createStories from './commands/stories';
import createEmails from './commands/emails';
import createBulkImport from './commands/bulkImport';
import createChangedEntityExportJobs from './commands/changedEntityExportJobs';
import createLocations from './commands/locations';
import createContactTypes from './commands/contactTypes';
import createEventTypes from './commands/eventTypes';
import createSupporterGroups from './commands/supporterGroups';
import type { VanApiClientOptions } from './types';

export class VanApi {
  client: VanApiClient;
  people: ReturnType<typeof createPeople>;
  activistCodes: ReturnType<typeof createActivistCodes>;
  surveyQuestions: ReturnType<typeof createSurveyQuestions>;
  events: ReturnType<typeof createEvents>;
  savedLists: ReturnType<typeof createSavedLists>;
  exportJobs: ReturnType<typeof createExportJobs>;
  canvassResponses: ReturnType<typeof createCanvassResponses>;
  contributions: ReturnType<typeof createContributions>;
  signups: ReturnType<typeof createSignups>;
  notes: ReturnType<typeof createNotes>;
  scores: ReturnType<typeof createScores>;
  customFields: ReturnType<typeof createCustomFields>;
  codes: ReturnType<typeof createCodes>;
  targets: ReturnType<typeof createTargets>;
  stories: ReturnType<typeof createStories>;
  emails: ReturnType<typeof createEmails>;
  bulkImport: ReturnType<typeof createBulkImport>;
  changedEntityExportJobs: ReturnType<typeof createChangedEntityExportJobs>;
  locations: ReturnType<typeof createLocations>;
  contactTypes: ReturnType<typeof createContactTypes>;
  eventTypes: ReturnType<typeof createEventTypes>;
  supporterGroups: ReturnType<typeof createSupporterGroups>;

  constructor(options: VanApiClientOptions | string = {}, appName?: string) {
    this.client = new VanApiClient(options, appName);

    this.people = createPeople(this.client);
    this.activistCodes = createActivistCodes(this.client);
    this.surveyQuestions = createSurveyQuestions(this.client);
    this.events = createEvents(this.client);
    this.savedLists = createSavedLists(this.client);
    this.exportJobs = createExportJobs(this.client);
    this.canvassResponses = createCanvassResponses(this.client);
    this.contributions = createContributions(this.client);
    this.signups = createSignups(this.client);
    this.notes = createNotes(this.client);
    this.scores = createScores(this.client);
    this.customFields = createCustomFields(this.client);
    this.codes = createCodes(this.client);
    this.targets = createTargets(this.client);
    this.stories = createStories(this.client);
    this.emails = createEmails(this.client);
    this.bulkImport = createBulkImport(this.client);
    this.changedEntityExportJobs = createChangedEntityExportJobs(this.client);
    this.locations = createLocations(this.client);
    this.contactTypes = createContactTypes(this.client);
    this.eventTypes = createEventTypes(this.client);
    this.supporterGroups = createSupporterGroups(this.client);
  }
}

let defaultInstance: VanApi | null = null;

export function configure(config: VanApiClientOptions): VanApi {
  defaultInstance = new VanApi(config);
  return defaultInstance;
}

export function getDefaultInstance(): VanApi {
  if (!defaultInstance) {
    if (!process.env.VAN_API_KEY) {
      throw new Error('VAN_API_KEY is required before using the default instance');
    }

    defaultInstance = new VanApi({
      apiKey: process.env.VAN_API_KEY,
      appName: process.env.VAN_APP_NAME,
    });
  }

  return defaultInstance;
}

export { VanApiClient };
export type { VanApiClientOptions } from './types';
