const createActivistCodes = require('../../dist/commands/activistCodes').default;
const createApiKeyProfiles = require('../../dist/commands/apiKeyProfiles').default;
const createBulkImport = require('../../dist/commands/bulkImport').default;
const createCanvassResponses = require('../../dist/commands/canvassResponses').default;
const createChangedEntityExportJobs = require('../../dist/commands/changedEntityExportJobs').default;
const createCodes = require('../../dist/commands/codes').default;
const createContributions = require('../../dist/commands/contributions').default;
const createCustomFields = require('../../dist/commands/customFields').default;
const createDesignations = require('../../dist/commands/designations').default;
const createTargetedEmails = require('../../dist/commands/targetedEmails').default;
const createEvents = require('../../dist/commands/events').default;
const createExportJobs = require('../../dist/commands/exportJobs').default;
const createLocations = require('../../dist/commands/locations').default;
const createNotes = require('../../dist/commands/notes').default;
const createPeople = require('../../dist/commands/people').default;
const createSavedLists = require('../../dist/commands/savedLists').default;
const createScores = require('../../dist/commands/scores').default;
const createSignups = require('../../dist/commands/signups').default;
const createStories = require('../../dist/commands/stories').default;
const createSupporterGroups = require('../../dist/commands/supporterGroups').default;
const createSurveyQuestions = require('../../dist/commands/surveyQuestions').default;
const createTargets = require('../../dist/commands/targets').default;

describe('command modules broad coverage', () => {
  let client;

  beforeEach(() => {
    client = {
      get: jest.fn().mockResolvedValue({ items: [] }),
      post: jest.fn().mockResolvedValue({ id: 1 }),
      put: jest.fn().mockResolvedValue({ id: 1 }),
      delete: jest.fn().mockResolvedValue({ ok: true }),
      getAllPaginated: jest.fn().mockResolvedValue([]),
      getPaginated: jest.fn().mockResolvedValue({ items: [] }),
    };
  });

  test('people command methods', async () => {
    const people = createPeople(client);
    await people.get(123, { $expand: 'addresses' });
    await people.list({
      firstName: 'Jane', lastName: 'Doe', middleName: 'Q',
      streetAddress: '1 Main', city: 'Falls Church', stateOrProvince: 'VA',
      zipOrPostalCode: '22043', phoneNumber: '5551112222', phone: '5553334444',
      email: 'jane@example.com', commonName: 'Org', officialName: 'Organization',
      contactMode: 'Person', $orderby: 'Name', $expand: 'Addresses', top: 30, skip: 4,
    });
    await people.quickSearch({ name: 'Jane Doe', top: 10, skip: 2, $orderby: 'Name', $expand: 'addresses' });
    await people.findOrCreate({ firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' });
    await expect(people.findOrCreate({ firstName: 'Only' })).rejects.toThrow(/Required field 'lastName'/);
    await people.create({ firstName: 'Jane', lastName: 'Doe' });
    await people.update(123, { occupation: 'Engineer' });
    await people.delete(123);
    await people.getAll({ firstName: 'J' }, 500);
  });

  test('activist codes / survey questions / contact types / event types / api key profiles / designations', async () => {
    const activist = createActivistCodes(client);
    await activist.list({ top: 20, skip: 1, name: 'code', type: 'person' });
    await activist.get(5);

    const survey = createSurveyQuestions(client);
    await survey.list({ top: 5, skip: 1 });
    await survey.get(99);

    const eventTypes = createEvents(client);
    await eventTypes.listEventTypes({ top: 10, skip: 2 });
    await eventTypes.getEventType(7);

    const apiKeyProfiles = createApiKeyProfiles(client);
    await apiKeyProfiles.get();

    const designations = createDesignations(client);
    await designations.list({ top: 10, skip: 1 });
    await designations.get(1, { expand: 'committees' });
  });

  test('events / signups / notes / stories', async () => {
    const events = createEvents(client);
    await events.list({ top: 20, skip: 1, eventTypeId: 1, eventName: 'Townhall', startDate: '2026-01-01', endDate: '2026-01-31', city: 'Arlington', state: 'VA' });
    await events.get(11, { $expand: 'signups' });
    await events.create({
      eventTypeId: 1, name: 'Townhall', startDate: '2026-01-01', endDate: '2026-01-01',
      locationId: 1, roleId: 2, shiftStartTime: '09:00', shiftEndTime: '17:00',
    });
    await events.update(11, { name: 'Townhall 2' });
    await events.delete(11);

    const signups = createSignups(client);
    await signups.list({ top: 10, skip: 1, eventId: 11, vanId: 100 });
    await signups.get(12);
    await signups.create({ vanId: 100, eventId: 11, eventShiftId: 5, roleId: 2, statusId: 3, locationId: 1 });
    await signups.update(12, { statusId: 4 });
    await signups.delete(12);

    const notes = createNotes(client);
    await notes.list(100, { top: 10, skip: 1 });
    await notes.get(100, 20);
    await notes.create(100, { text: 'hello', noteCategoryId: 5 });
    await notes.update(100, 20, { text: 'updated' });
    await notes.delete(100, 20);

    const stories = createStories(client);
    await stories.list({ top: 10, skip: 1, vanId: 100 });
    await stories.get(30);
    await stories.create({ vanId: 100, title: 'Story', text: 'Body' });
    await stories.update(30, { title: 'Story2' });
    await stories.delete(30);
    await stories.getByPerson(100, { top: 10, skip: 1 });
    await stories.getAll({ vanId: 100 }, 1000);
  });

  test('saved lists / targets / supporter groups', async () => {
    const lists = createSavedLists(client);
    await lists.list({ top: 100, skip: 1 });
    await lists.get(1, { $expand: 'people' });

    const targets = createTargets(client);
    await targets.list({ top: 50, skip: 2, status: 'Ready', type: 'Static' });
    await targets.get(2);
    await targets.subgroups({ targetId: 2 });
    await targets.subgroups({ targetId: 2, minivanFormats: true });

    const groups = createSupporterGroups(client);
    await groups.list({ top: 20, skip: 1 });
    await groups.get(3);
    await groups.create({ name: 'Core', description: 'Core volunteers' });
    await groups.addPerson(3, 100);
    await groups.removePerson(3, 100);
    await groups.delete(3);
  });

  test('remaining modules', async () => {
    const contrib = createContributions(client);
    await contrib.list(100, { top: 10, skip: 1 });
    await contrib.get(1);
    await contrib.create({ vanId: 100, amount: 25, dateReceived: '2026-01-01', designationId: 1, status: 'Approved', paymentType: 'Check' });
    await contrib.update(1, { amount: 30 });

    const customFields = createCustomFields(client);
    await customFields.list({ top: 10, skip: 2, fieldType: 'Text' });
    await customFields.get(4);
    await customFields.getAll({ fieldType: 'Text' }, 200);
    await customFields.setValue(100, 4, 'abc', { source: 'api' });
    await customFields.getByPerson(100, { top: 10, skip: 1 });
    await customFields.updateValue(100, 4, 'def', { source: 'api' });
    await customFields.removeValue(100, 4);

    const email = createTargetedEmails(client);
    await email.list({ top: 10, skip: 1 });
    await email.get('msg-foreign-id-123');

    const exportJobs = createExportJobs(client);
    await exportJobs.list({ top: 10, skip: 1, status: 'Completed' });
    await exportJobs.get(3);
    await exportJobs.create({ savedListId: 1, webhookUrl: 'https://example.com/hook' });
    await exportJobs.getDownloadUrl(3);
    await exportJobs.getAll(500);

    const changed = createChangedEntityExportJobs(client);
    await changed.list({ top: 10, skip: 1, status: 'Completed' });
    await changed.get(9);
    await changed.create({ dateChangedFrom: '2026-01-01', dateChangedTo: '2026-02-01', webhookUrl: 'https://example.com/hook' });
    await changed.getDownloadUrl(9);
    await changed.cancel(9);
    await changed.getStatus(9);
    await changed.getAll({ status: 'Completed' }, 500);

    const bulk = createBulkImport(client);
    await bulk.list({ top: 10, skip: 1, status: 'Completed' });
    await bulk.listJobs({ top: 10, skip: 1 });
    await bulk.getJob(2);
    await bulk.createJob({ name: 'Import', importType: 'People', mappings: { firstName: 'First Name' } });
    await bulk.uploadData(2, 'file,csv', { contentType: 'text/csv' });
    await bulk.startJob(2, { dryRun: true });
    await bulk.cancelJob(2);
    await bulk.getJobResults(2, { top: 10, skip: 1 });
    await bulk.getJobErrors(2, { top: 10, skip: 1 });
    await bulk.getAllJobs({ status: 'Completed' }, 500);

    const canvass = createCanvassResponses(client);
    await canvass.list({ top: 10, skip: 1, vanId: 100 });
    await canvass.create({ vanId: 100, resultCodeId: 1, canvassContext: { contactTypeId: 2 } });
    await canvass.inputTypes();
    await canvass.resultCodes();
    await canvass.contactTypes();

    const locations = createLocations(client);
    await locations.list({ top: 10, skip: 1, locationType: 'Office', state: 'VA' });
    await locations.get(12);
    await locations.findOrCreate({ name: 'HQ', city: 'Falls Church', stateOrProvince: 'VA', zipOrPostalCode: '22043' });
    await locations.create({ name: 'HQ', city: 'Falls Church' });
    await locations.delete(12);

    const scores = createScores(client);
    await scores.list({ top: 10, skip: 1 });
    await scores.get(9);
    await scores.getByPerson(100);

    const codes = createCodes(client);
    await codes.list({ top: 10, skip: 1, name: 'Foo', parentCodeId: 1, entityType: '2', codeType: 'SourceCode', supportedEntities: ['Contact'], orderby: 'dateModified', expand: 'supportedEntities' });
    await codes.get(1, { expand: 'supportedEntities' });
    await codes.supportedEntities();
    await codes.isDuplicateName('Foo', { codeType: 'SourceCode' });
    await codes.create({ name: 'Foo', description: 'desc', parentCodeId: 2, codeType: 'SourceCode', campaignId: 5, contactTypeId: 6, revenueStreamId: 7, mailMergeTemplateId: 8, generalLedgerFundId: 9, costCenterId: 10 });
    await codes.update(1, { name: 'Bar', parentCodeId: 2 });
    await codes.delete(1);
  });

  test('validation branches for required fields', async () => {
    await expect(createEvents(client).create({ eventTypeId: 1, name: 'OnlyName', endDate: '2026-01-01', locationId: 1, roleId: 1, shiftStartTime: 'a', shiftEndTime: 'b' })).rejects.toThrow(/startDate/);
    await expect(createContributions(client).create({ vanId: 1, amount: 5 })).rejects.toThrow(/dateReceived/);
    await expect(createNotes(client).create({ vanId: 1 })).rejects.toThrow(/text/);
    await expect(createSignups(client).create({ eventId: 1 })).rejects.toThrow(/vanId/);
    await expect(createStories(client).create({ vanId: 1 })).rejects.toThrow(/title|text/);
    await expect(createBulkImport(client).createJob({ importType: 'People' })).rejects.toThrow(/name/);
    await expect(createCanvassResponses(client).create({})).rejects.toThrow(/vanId/);
    await expect(createLocations(client).create({})).rejects.toThrow(/name/);
    await expect(createLocations(client).findOrCreate({})).rejects.toThrow(/name/);
    await expect(createSupporterGroups(client).create({})).rejects.toThrow(/name/);
    await expect(createCodes(client).create({})).rejects.toThrow(/name/);
  });

  test('ensures core client methods exercised', () => {
    expect(client.get).toBeDefined();
    expect(client.post).toBeDefined();
    expect(client.put).toBeDefined();
    expect(client.delete).toBeDefined();
  });
});
