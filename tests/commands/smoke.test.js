const createPeople = require('../../dist/commands/people').default;
const createEvents = require('../../dist/commands/events').default;
const createSavedLists = require('../../dist/commands/savedLists').default;
const createExportJobs = require('../../dist/commands/exportJobs').default;
const createFolders = require('../../dist/commands/folders').default;
const createContributions = require('../../dist/commands/contributions').default;
const createSignups = require('../../dist/commands/signups').default;
const createNotes = require('../../dist/commands/notes').default;
const createScores = require('../../dist/commands/scores').default;
const createTargets = require('../../dist/commands/targets').default;
const createStories = require('../../dist/commands/stories').default;
const createTargetedEmails = require('../../dist/commands/targetedEmails').default;
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
    await createPeople(client).list({ firstName: 'Jane' });
    await createPeople(client).quickSearch({ name: 'Jane Doe' });
    await createPeople(client).findOrCreate({ firstName: 'Jane', lastName: 'Doe' });
    await createEvents(client).list({ top: 10, skip: 0 });
    await createExportJobs(client).create({ savedListId: 11, webhookUrl: 'https://hooks.example.com/van' });
    await createContributions(client).get(9);
    await createSignups(client).create({ eventId: 4, vanId: 5, eventShiftId: 3, roleId: 3, statusId: 5, locationId: 3 });
    await createNotes(client).create(4, { text: 'note' });
    await createScores(client).getByPerson(3);
    await createTargets(client).list({ targetType: 'Voter' });
    client.post.mockResolvedValueOnce({ storyId: 1 });
    await createStories(client).create({ vanId: 1, title: 'Story', storyText: 'story', storyStatusId: 1 });
    await createTargetedEmails(client).list({ top: 10, skip: 0 });
    await createBulkImport(client).createJob({ name: 'Import 1', importType: 'People', mappings: { firstName: 'First Name' } });
    await createChangedEntityExportJobs(client).create({ dateChangedFrom: '2026-01-01' });
    await createLocations(client).list({ name: 'Boston' });
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

  it('export-jobs create wraps ids in objects and sends only known input properties', async () => {
    await createExportJobs(client).create({
      savedListId: '42', webhookUrl: 'https://hooks.example.com/van',
      surveyQuestionIds: ' 12, 34 ,56', activistCodeIds: '7', customFieldIds: [8], districtFieldIds: '9',
      exportJobId: 1, status: 'Completed', downloadUrl: 'x', canvassFileRequestId: 1, surveyQuestions: [{ surveyQuestionId: 99 }],
    });

    expect(client.post).toHaveBeenCalledWith('/exportJobs', {
      savedListId: 42,
      type: 4,
      webhookUrl: 'https://hooks.example.com/van',
      surveyQuestions: [{ surveyQuestionId: 12 }, { surveyQuestionId: 34 }, { surveyQuestionId: 56 }],
      activistCodes: [{ activistCodeId: 7 }],
      customFields: [{ customFieldId: 8 }],
      districtFields: [{ districtFieldId: 9 }],
    });
  });

  it('export-jobs create leaves out id lists that are not given', async () => {
    await createExportJobs(client).create({ savedListId: 42, webhookUrl: 'https://hooks.example.com/van', districtFieldIds: '9' });

    expect(client.post).toHaveBeenCalledWith('/exportJobs', {
      savedListId: 42, type: 4, webhookUrl: 'https://hooks.example.com/van', districtFields: [{ districtFieldId: 9 }],
    });
  });

  it('export-jobs create allows at most 10 ids across all lists', async () => {
    const base = { savedListId: 42, webhookUrl: 'https://hooks.example.com/van', surveyQuestionIds: '1,2,3,4,5', activistCodeIds: '1,2,3,4,5' };
    await createExportJobs(client).create(base);
    await expect(createExportJobs(client).create({ ...base, districtFieldIds: '1' })).rejects.toThrow(/At most 10 ids .* got 11/);
    expect(client.post).toHaveBeenCalledTimes(1);
  });

  it('export-jobs responses drop canvassFileRequest* aliases and lead with exportJobId/status', async () => {
    client.get.mockResolvedValueOnce({ canvassFileRequestId: 5, canvassFileRequestGuid: 'g', exportJobGuid: 'g', downloadUrl: null, status: 'Error', errorCode: 'NoRecords', exportJobId: 5 });

    const job = await createExportJobs(client).get(5);

    expect(client.get).toHaveBeenCalledWith('/exportJobs/5');
    expect(Object.keys(job)).toEqual(['exportJobId', 'status', 'errorCode', 'downloadUrl', 'exportJobGuid']);
  });

  it('maps saved-lists list filters to /savedLists query params', async () => {
    await createSavedLists(client).list({ text: 'Door', folderId: '12', maxDoorCount: '0', maxPeopleCount: '250', isFollowed: 'false', top: '100', skip: '20' });

    expect(client.get).toHaveBeenCalledWith('/savedLists', {
      $top: 100, $skip: 20, text: 'Door', folderId: 12, maxDoorCount: 0, maxPeopleCount: 250, isFollowed: false,
    });
    await expect(createSavedLists(client).list({ top: '101' })).rejects.toThrow(/top must be an integer between 1 and 100/);
  });

  it('maps folders list ids to a single comma-delimited query value', async () => {
    await createFolders(client).list({ ids: '1, 2,3', writableOnly: true });
    await createFolders(client).list({ writableOnly: false });

    expect(client.get).toHaveBeenNthCalledWith(1, '/folders', { $top: 50, $skip: 0, ids: '1,2,3', writableOnly: true });
    expect(client.get).toHaveBeenNthCalledWith(2, '/folders', { $top: 50, $skip: 0 });
  });

  it('maps people quickSearch params to /people/quickSearch', async () => {
    await createPeople(client).quickSearch({ name: 'Jane Doe', $expand: 'emails,phones' });

    expect(client.get).toHaveBeenCalledWith('/people/quickSearch', {
      name: 'Jane Doe',
      $expand: 'emails,phones'
    });
  });
});
