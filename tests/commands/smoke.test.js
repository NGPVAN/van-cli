const createPeople = require('../../dist/commands/people').default;
const createEvents = require('../../dist/commands/events').default;
const createSavedLists = require('../../dist/commands/savedLists').default;
const createExportJobs = require('../../dist/commands/exportJobs').default;
const createContributions = require('../../dist/commands/contributions').default;
const createSignups = require('../../dist/commands/signups').default;
const createNotes = require('../../dist/commands/notes').default;
const createScores = require('../../dist/commands/scores').default;
const createTargets = require('../../dist/commands/targets').default;
const createStories = require('../../dist/commands/stories').default;
const createEmails = require('../../dist/commands/emails').default;
const createBulkImport = require('../../dist/commands/bulkImport').default;
const createChangedEntityExportJobs = require('../../dist/commands/changedEntityExportJobs').default;
const createLocations = require('../../dist/commands/locations').default;
const createSupporterGroups = require('../../dist/commands/supporterGroups').default;

describe('command module wiring tests', () => {
  let client;

  beforeEach(() => {
    client = {
      get: jest.fn().mockResolvedValue({ items: [] }),
      post: jest.fn().mockResolvedValue({ id: 1 }),
      put: jest.fn().mockResolvedValue({ id: 1 }),
      delete: jest.fn().mockResolvedValue({}),
      getAllPaginated: jest.fn().mockResolvedValue([]),
    };
  });

  it('supports representative method calls across modules', async () => {
    await createPeople(client).find({ firstName: 'Jane' });
    await createPeople(client).quickSearch({ name: 'Jane Doe' });
    await createPeople(client).findOrCreate({ firstName: 'Jane', lastName: 'Doe' });
    await createEvents(client).list({ top: 10, skip: 0 });
    await createSavedLists(client).addPerson(12, 34);
    await createExportJobs(client).create({ savedListId: 11, webhookUrl: 'https://hooks.example.com/van' });
    await createContributions(client).get(9);
    await createSignups(client).create({ eventId: 4, vanId: 5 });
    await createNotes(client).create({ vanId: 4, text: 'note' });
    await createScores(client).apply(3, 2, 99);
    await createTargets(client).list({ targetType: 'Voter' });
    await createStories(client).create({ vanId: 1, text: 'story' });
    await createEmails(client).create({ name: 'Email 1', subject: 'Hello', body: '<p>Hi</p>' });
    await createBulkImport(client).createJob({ name: 'Import 1', importType: 'People', mappings: { firstName: 'First Name' } });
    await createChangedEntityExportJobs(client).create({ dateChangedFrom: '2026-01-01' });
    await createLocations(client).find({ city: 'Boston' });
    await createSupporterGroups(client).create({ name: 'Core Team' });

    expect(client.post).toHaveBeenCalled();
    expect(client.get).toHaveBeenCalled();
  });

  it('export-jobs create always includes type:4 in the POST body', async () => {
    await createExportJobs(client).create({ savedListId: 42, webhookUrl: 'https://hooks.example.com/van' });

    expect(client.post).toHaveBeenCalledWith('/exportJobs', expect.objectContaining({
      savedListId: 42,
      type: 4,
      webhookUrl: 'https://hooks.example.com/van',
    }));
  });

  it('export-jobs create respects a caller-supplied type', async () => {
    await createExportJobs(client).create({ savedListId: 42, type: 7, webhookUrl: 'https://hooks.example.com/van' });

    expect(client.post).toHaveBeenCalledWith('/exportJobs', expect.objectContaining({ type: 7 }));
  });

  it('maps people quickSearch params to /people/quickSearch', async () => {
    await createPeople(client).quickSearch({ name: 'Jane Doe', top: 5, skip: 2, $orderby: 'Name' });

    expect(client.get).toHaveBeenCalledWith('/people/quickSearch', {
      name: 'Jane Doe',
      $top: 5,
      $skip: 2,
      $orderby: 'Name'
    });
  });
});
