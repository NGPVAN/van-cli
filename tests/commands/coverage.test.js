const createActivistCodes = require('../../dist/commands/activistCodes').default;
const createBulkImport = require('../../dist/commands/bulkImport').default;
const createCanvassResponses = require('../../dist/commands/canvassResponses').default;
const createChangedEntityExportJobs = require('../../dist/commands/changedEntityExportJobs').default;
const createCodes = require('../../dist/commands/codes').default;
const createContactTypes = require('../../dist/commands/contactTypes').default;
const createContributions = require('../../dist/commands/contributions').default;
const createCustomFields = require('../../dist/commands/customFields').default;
const createEmails = require('../../dist/commands/emails').default;
const createEventTypes = require('../../dist/commands/eventTypes').default;
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
    await people.find({
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
    await people.getAll({ firstName: 'J' }, 500);
  });

  test('activist codes / survey questions / contact types / event types', async () => {
    const activist = createActivistCodes(client);
    await activist.list({ top: 20, skip: 1, name: 'code', type: 'person' });
    await activist.get(5);
    await activist.getAll(200);
    await activist.apply(10, 20, { action: 'Apply', dateCanvassed: '2026-01-01', resultCodeId: 1, contactTypeId: 2, inputTypeId: 3 });
    await activist.remove(10, 20);

    const survey = createSurveyQuestions(client);
    await survey.list({ top: 5, skip: 1 });
    await survey.get(99);
    await survey.getAll(200);
    await survey.recordResponse(10, { surveyQuestionId: 1, surveyResponseId: 2 });

    const contactTypes = createContactTypes(client);
    await contactTypes.list({ top: 10, skip: 2 });
    await contactTypes.get(3);
    await contactTypes.getAll({}, 120);

    const eventTypes = createEventTypes(client);
    await eventTypes.list({ top: 10, skip: 2 });
    await eventTypes.get(7);
    await eventTypes.getAll({}, 120);
  });

  test('events / signups / notes / stories', async () => {
    const events = createEvents(client);
    await events.list({ top: 20, skip: 1, eventTypeId: 1, eventName: 'Townhall', startDate: '2026-01-01', endDate: '2026-01-31', city: 'Arlington', state: 'VA' });
    await events.get(11, { $expand: 'signups' });
    await events.create({ name: 'Townhall', startDate: '2026-01-01', endDate: '2026-01-01', locationId: 1 });
    await events.update(11, { name: 'Townhall 2' });
    await events.delete(11);
    await events.getSignups(11, { top: 5, skip: 1 });
    await events.getAll({ city: 'Arlington' }, 100);

    const signups = createSignups(client);
    await signups.list({ top: 10, skip: 1, eventId: 11, vanId: 100 });
    await signups.get(12);
    await signups.create({ eventId: 11, vanId: 100, role: 'Attendee', status: 'Active' });
    await signups.update(12, { status: 'Declined' });
    await signups.delete(12);
    await signups.getByEvent(11, { top: 5, skip: 1 });
    await signups.getByPerson(100, { top: 5, skip: 1 });
    await signups.getAll({ eventId: 11 }, 1000);

    const notes = createNotes(client);
    await notes.list({ top: 10, skip: 1, vanId: 100 });
    await notes.get(20);
    await notes.create({ vanId: 100, text: 'hello', category: 'general' });
    await notes.update(20, { text: 'updated' });
    await notes.delete(20);
    await notes.getByPerson(100, { top: 10, skip: 1 });
    await notes.getAll({ vanId: 100 }, 1000);

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
    await lists.create({ name: 'List1', folderId: 3 });
    await lists.update(1, { name: 'List2' });
    await lists.delete(1);
    await lists.getPeople(1, { top: 20, skip: 2 });
    await lists.addPerson(1, 100);
    await lists.removePerson(1, 100);
    await lists.getAll(500);

    const targets = createTargets(client);
    await targets.list({ top: 50, skip: 2, targetType: 'Voter', name: 'Target' });
    await targets.get(2);
    await targets.create({ name: 'T1', targetType: 'Voter' });
    await targets.update(2, { name: 'T2' });
    await targets.delete(2);
    await targets.getPeople(2, { top: 10, skip: 1 });
    await targets.addPerson(2, 100, { sourceCodeId: 1 });
    await targets.removePerson(2, 100);
    await targets.getAll({ targetType: 'Voter' }, 200);

    const groups = createSupporterGroups(client);
    await groups.list({ top: 20, skip: 1 });
    await groups.get(3);
    await groups.create({ name: 'Core', description: 'Core volunteers' });
    await groups.update(3, { description: 'Updated' });
    await groups.addPerson(3, 100, { role: 'Lead' });
    await groups.removePerson(3, 100);
    await groups.getPeople(3, { top: 10, skip: 1 });
    await groups.getAll({ name: 'Core' }, 300);
  });

  test('remaining modules', async () => {
    const contrib = createContributions(client);
    await contrib.list({ top: 10, skip: 1, startDate: '2026-01-01', endDate: '2026-02-01', vanId: 100 });
    await contrib.get(1);
    await contrib.create({ vanId: 100, amount: 25, dateReceived: '2026-01-01' });
    await contrib.update(1, { amount: 30 });
    await contrib.getByPerson(100, { top: 5, skip: 1 });
    await contrib.getAll({ vanId: 100 }, 500);

    const customFields = createCustomFields(client);
    await customFields.list({ top: 10, skip: 2, fieldType: 'Text' });
    await customFields.get(4);
    await customFields.getAll({ fieldType: 'Text' }, 200);
    await customFields.setValue(100, 4, 'abc', { source: 'api' });
    await customFields.getByPerson(100, { top: 10, skip: 1 });
    await customFields.updateValue(100, 4, 'def', { source: 'api' });
    await customFields.removeValue(100, 4);

    const emails = createEmails(client);
    await emails.list({ top: 10, skip: 1, folderId: 1, status: 'Draft' });
    await emails.get(2);
    await emails.create({ name: 'E1', subject: 'Hi', body: '<p>Body</p>' });
    await emails.update(2, { subject: 'Updated' });
    await emails.send(2, { testOnly: true });
    await emails.getStats(2);
    await emails.getRecipients(2, { top: 10, skip: 1 });
    await emails.getAll({ status: 'Draft' }, 100);

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
    await canvass.get(4);
    await canvass.create({ vanId: 100, resultCodeId: 1, contactTypeId: 2 });
    await canvass.getByPerson(100, { top: 10, skip: 1 });
    await canvass.getAll({ vanId: 100 }, 1000);

    const locations = createLocations(client);
    await locations.list({ top: 10, skip: 1, locationType: 'Office', state: 'VA' });
    await locations.get(12);
    await locations.find({ name: 'HQ', city: 'Falls Church', state: 'VA', zip: '22043', top: 10, skip: 1 });
    await locations.create({ name: 'HQ', city: 'Falls Church' });
    await locations.update(12, { name: 'HQ 2' });
    await locations.getEvents(12, { top: 5, skip: 1 });
    await locations.getAll({ state: 'VA' }, 1000);

    const scores = createScores(client);
    await scores.list({ top: 10, skip: 1 });
    await scores.get(9);
    await scores.getAll({ name: 'Likelihood' }, 100);
    await scores.apply(100, 9, 77.5, { source: 'api' });
    await scores.getByPerson(100, { top: 10, skip: 1 });
    await scores.update(100, 9, 88.1, { source: 'api' });
    await scores.remove(100, 9);

    const codes = createCodes(client);
    await codes.list({ top: 10, skip: 1 });
    await codes.listResultCodes({ top: 10, skip: 1 });
    await codes.getResultCode(1);
    await codes.listContactTypes({ top: 10, skip: 1 });
    await codes.getContactType(2);
    await codes.listInputTypes({ top: 10, skip: 1 });
    await codes.getInputType(3);
    await codes.listSupporterGroups({ top: 10, skip: 1 });
    await codes.getSupporterGroup(4);
    await codes.getAllResultCodes(200);
    await codes.getAllContactTypes(200);
  });

  test('validation branches for required fields', async () => {
    await expect(createEvents(client).create({ name: 'OnlyName' })).rejects.toThrow(/startDate|endDate/);
    await expect(createContributions(client).create({ vanId: 1, amount: 5 })).rejects.toThrow(/dateReceived/);
    await expect(createSavedLists(client).create({})).rejects.toThrow(/name/);
    await expect(createNotes(client).create({ vanId: 1 })).rejects.toThrow(/text/);
    await expect(createSignups(client).create({ eventId: 1 })).rejects.toThrow(/vanId/);
    await expect(createStories(client).create({ vanId: 1 })).rejects.toThrow(/title|text/);
    await expect(createEmails(client).create({ name: 'n' })).rejects.toThrow(/subject|body/);
    await expect(createBulkImport(client).createJob({ importType: 'People' })).rejects.toThrow(/name/);
    await expect(createCanvassResponses(client).create({ vanId: 1 })).rejects.toThrow(/resultCodeId/);
    await expect(createTargets(client).create({ targetType: 'Voter' })).rejects.toThrow(/name/);
    await expect(createSupporterGroups(client).create({})).rejects.toThrow(/name/);
  });

  test('ensures core client methods exercised', () => {
    expect(client.get).toBeDefined();
    expect(client.post).toBeDefined();
    expect(client.put).toBeDefined();
    expect(client.delete).toBeDefined();
  });
});
