// @ts-nocheck

import type { VanApiClientLike } from '../types';

/**
 * Events API endpoints
 * Handles event management, signups, and related operations
 */

const create = function(client: VanApiClientLike) {
  return {
    /**
     * List events
     * @param {Object} options - Optional parameters
     * @param {string} options.startDate - Start date filter (YYYY-MM-DD)
     * @param {string} options.endDate - End date filter (YYYY-MM-DD)
     * @param {number} options.top - Number of results
     * @param {number} options.skip - Number of results to skip
     * @param {string} options.$expand - Comma-separated fields to expand
     * @returns {Promise<Object>} List of events
     */
    async list(options = {}) {
      const params = {
        $top: options.top || 50,
        $skip: options.skip || 0
      };
      
      if (options.startDate) params.startingAfter = options.startDate;
      if (options.endDate) params.startingBefore = options.endDate;
      if (options.$expand) params.$expand = options.$expand;

      return client.get('/events', params);
    },
    
    /**
     * Get a specific event by ID
     * @param {number} eventId - The event ID
     * @param {Object} options - Optional parameters
     * @param {string} options.$expand - Comma-separated fields to expand
     * @returns {Promise<Object>} Event object
     */
    async get(eventId, options = {}) {
      return client.get(`/events/${eventId}`, options);
    },
    
    async create(eventData) {
      const requiredFields = ['eventTypeId', 'name', 'startDate', 'endDate', 'locationId', 'roleId', 'shiftStartTime', 'shiftEndTime'];
      for (const field of requiredFields) {
        if (!eventData[field]) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }

      const body = {
        eventType: { eventTypeId: eventData.eventTypeId },
        name: eventData.name,
        shortName: eventData.shortName || eventData.name,
        startDate: eventData.startDate,
        endDate: eventData.endDate,
        locations: [{ locationId: eventData.locationId }],
        roles: [{ roleId: eventData.roleId }],
        shifts: [{ startTime: eventData.shiftStartTime, endTime: eventData.shiftEndTime }],
      };

      return client.post('/events', body);
    },
    
    /**
     * Update an event
     * @param {number} eventId - The event ID
     * @param {Object} eventData - Updated event data
     * @returns {Promise<Object>} Updated event object
     */
    async update(eventId, eventData) {
      const existing = await client.get(`/events/${eventId}`);

      if (eventData.eventTypeId !== undefined) existing.eventType = { eventTypeId: eventData.eventTypeId };
      if (eventData.name !== undefined) existing.name = eventData.name;
      if (eventData.shortName !== undefined) existing.shortName = eventData.shortName;
      if (eventData.startDate !== undefined) existing.startDate = eventData.startDate;
      if (eventData.endDate !== undefined) existing.endDate = eventData.endDate;
      if (eventData.locationId !== undefined) existing.locations = [{ locationId: eventData.locationId }];
      if (eventData.roleId !== undefined) existing.roles = [{ roleId: eventData.roleId }];
      if (eventData.shiftStartTime !== undefined || eventData.shiftEndTime !== undefined) {
        const shift = (existing.shifts && existing.shifts[0]) ? { ...existing.shifts[0] } : {};
        if (eventData.shiftStartTime !== undefined) shift.startTime = eventData.shiftStartTime;
        if (eventData.shiftEndTime !== undefined) shift.endTime = eventData.shiftEndTime;
        existing.shifts = [shift];
      }

      return client.put(`/events/${eventId}`, existing);
    },
    
    /**
     * Delete an event
     * @param {number} eventId - The event ID
     * @returns {Promise<Object>} Response
     */
    async delete(eventId) {
      try {
        await client.delete(`/events/${eventId}`);
        return `Event ${eventId} deleted`;
      } catch (error) {
        throw new Error(`Failed to delete event ${eventId}`, { cause: error });
      }
    },
  };
};

export default create;