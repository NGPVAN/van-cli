import VanApiClient from './client';
import createActivistCodes from './commands/activistCodes';
import createApiKeyProfiles from './commands/apiKeyProfiles';
import createBulkImport from './commands/bulkImport';
import createCanvassResponses from './commands/canvassResponses';
import createChangedEntityExportJobs from './commands/changedEntityExportJobs';
import createCodes from './commands/codes';
import createContributions from './commands/contributions';
import createCustomFields from './commands/customFields';
import createDesignations from './commands/designations';
import createTargetedEmails from './commands/targetedEmails';
import createEvents from './commands/events';
import createEventTypes from './commands/eventTypes';
import createExportJobs from './commands/exportJobs';
import createLocations from './commands/locations';
import createNotes from './commands/notes';
import createPeople from './commands/people';
import createSavedLists from './commands/savedLists';
import createScores from './commands/scores';
import createSignups from './commands/signups';
import createStories from './commands/stories';
import createSupporterGroups from './commands/supporterGroups';
import createSurveyQuestions from './commands/surveyQuestions';
import createTargets from './commands/targets';
import type { VanApiClientOptions } from './types';

export class VanApi {
  client: VanApiClient;
  activistCodes: ReturnType<typeof createActivistCodes>;
  apiKeyProfiles: ReturnType<typeof createApiKeyProfiles>;
  bulkImport: ReturnType<typeof createBulkImport>;
  canvassResponses: ReturnType<typeof createCanvassResponses>;
  changedEntityExportJobs: ReturnType<typeof createChangedEntityExportJobs>;
  codes: ReturnType<typeof createCodes>;
  contributions: ReturnType<typeof createContributions>;
  customFields: ReturnType<typeof createCustomFields>;
  designations: ReturnType<typeof createDesignations>;
  targetedEmails: ReturnType<typeof createTargetedEmails>;
  events: ReturnType<typeof createEvents>;
  eventTypes: ReturnType<typeof createEventTypes>;
  exportJobs: ReturnType<typeof createExportJobs>;
  locations: ReturnType<typeof createLocations>;
  notes: ReturnType<typeof createNotes>;
  people: ReturnType<typeof createPeople>;
  savedLists: ReturnType<typeof createSavedLists>;
  scores: ReturnType<typeof createScores>;
  signups: ReturnType<typeof createSignups>;
  stories: ReturnType<typeof createStories>;
  supporterGroups: ReturnType<typeof createSupporterGroups>;
  surveyQuestions: ReturnType<typeof createSurveyQuestions>;
  targets: ReturnType<typeof createTargets>;

  constructor(options: VanApiClientOptions | string = {}, appName?: string) {
    this.client = new VanApiClient(options, appName);
    this.activistCodes = createActivistCodes(this.client);
    this.apiKeyProfiles = createApiKeyProfiles(this.client);
    this.bulkImport = createBulkImport(this.client);
    this.canvassResponses = createCanvassResponses(this.client);
    this.changedEntityExportJobs = createChangedEntityExportJobs(this.client);
    this.codes = createCodes(this.client);
    this.contributions = createContributions(this.client);
    this.customFields = createCustomFields(this.client);
    this.designations = createDesignations(this.client);
    this.targetedEmails = createTargetedEmails(this.client);
    this.events = createEvents(this.client);
    this.eventTypes = createEventTypes(this.client);
    this.exportJobs = createExportJobs(this.client);
    this.locations = createLocations(this.client);
    this.notes = createNotes(this.client);
    this.people = createPeople(this.client);
    this.savedLists = createSavedLists(this.client);
    this.scores = createScores(this.client);
    this.signups = createSignups(this.client);
    this.stories = createStories(this.client);
    this.supporterGroups = createSupporterGroups(this.client);
    this.surveyQuestions = createSurveyQuestions(this.client);
    this.targets = createTargets(this.client);
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
