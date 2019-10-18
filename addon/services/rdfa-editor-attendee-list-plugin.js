/* eslint-disable require-yield */
import { getOwner } from '@ember/application';
import Service from '@ember/service';
import EmberObject, { computed } from '@ember/object';
import { task } from 'ember-concurrency';
import { inject as service } from '@ember/service';

/**
 * Service responsible for correct annotation of dates
 *
 * @module editor-attendee-list-plugin
 * @class RdfaEditorAttendeeListPlugin
 * @constructor
 * @extends EmberService
 */
const RdfaEditorAttendeeListPlugin = Service.extend({
  store: service(),

  attendees: computed (function() {
    return this.store.peekAll('person').sortBy('firstname');
  }),

  async searchAttendees(firstname) {
    const key = firstname.trim().replace(/\n/g, ' ').split(/\s+/)[0];
    return  await this.store.query('membership', {
      include: 'member,member.organization',
      'filter[member][firstname]': key.replace(/\u200b|\u200b$/, '')
    });
  },

  async createMembership() {
    const membership = this.store.createRecord('membership', {
      member: this.selectedPerson,
      role: this.selectedRole
    });
    await membership.save();
  },

  async createPerson( options ) {
    const person = this.store.createRecord('person', options);
    await person.save();
  },

  async init(){
    this._super(...arguments);
    getOwner(this).resolveRegistration('config:environment');

    this.set('memberships', await this.store.query('membership', {
      include: 'member,member.organization'
    }));

    this.set('organizations', (await this.store.findAll('organization')).sortBy('title'));
    this.set('people', await this.store.query('person', {
      include: 'organization'
    }));
    this.set('roles', (await this.store.findAll('role')).sortBy('label'));
  },

  /**
   * task to handle the incoming events from the editor dispatcher
   *
   * @method execute
   *
   * @param {string} hrId Unique identifier of the event in the hintsRegistry
   * @param {Array} contexts RDFa contexts of the text snippets the event applies on
   * @param {Object} hintsRegistry Registry of hints in the editor
   * @param {Object} editor The RDFa editor instance
   *
   * @public
   */
  execute: task(function * (hrId, contexts, hintsRegistry, editor) {
    const hints = [];
    contexts
      .filter (this.detectRelevantContext)
      .forEach (context => {
        hintsRegistry.removeHintsInRegion(context.region, hrId, this.get('who'));
        hints.pushObjects(this.generateHintsForContext(context));
      });

    const cards = hints.map (hint => this.generateCard(hrId, hintsRegistry, editor, hint));
    if (cards.length > 0) {
      hintsRegistry.addHints (hrId, this.get('who'), cards);
    }
  }),

  /**
   * Given context object, tries to detect a context the plugin can work on
   *
   * @method detectRelevantContext
   *
   * @param {Object} context Text snippet at a specific location with an RDFa context
   *
   * @return {String} URI of context if found, else empty string.
   *
   * @private
   */
  detectRelevantContext (context) {
    const lastTriple = context.context.slice(-1)[0];

    const isRel = isRelevant(lastTriple);
    return isRel;

    function isRelevant (triple) {
      return triple.predicate === 'a' &&
             triple.object === 'http://data.notable.redpencil.io/#AttendeeList';
    }
  },

  /**
   * Maps location of substring back within reference location
   *
   * @method normalizeLocation
   *
   * @param {[int,int]} [start, end] Location withing string
   * @param {[int,int]} [start, end] reference location
   *
   * @return {[int,int]} [start, end] absolute location
   *
   * @private
   */
  normalizeLocation(location, reference){
    return [location[0] + reference[0], location[1] + reference[0]];
  },

  /**
   * Generates a card given a hint
   *
   * @method generateCard
   *
   * @param {string} hrId Unique identifier of the event in the hintsRegistry
   * @param {Object} hintsRegistry Registry of hints in the editor
   * @param {Object} editor The RDFa editor instance
   * @param {Object} hint containing the hinted string and the location of this string
   *
   * @return {Object} The card to hint for a given template
   *
   * @private
   */
  generateCard(hrId, hintsRegistry, editor, hint){
    const obj = EmberObject.create({
      info: {
        context: hint.context,
        label: this.get('who'),
        location: hint.location,
        plainValue: hint.text,
        typeof: 'http://data.notable.redpencil.io/#AttendeeList',
        hrId, hintsRegistry, editor
      },
      location: hint.location,
      card: this.get('who')
    });
    return obj;
  },

  /**
   * Generates a hint, given a context
   *
   * @method generateHintsForContext
   *
   * @param {Object} context Text snippet at a specific location with an RDFa context
   *
   * @return {Object} [{text, location, context, resource }]
   *
   * @private
   */
  generateHintsForContext(context){
    const triple = context.context.slice(-1)[0];
    const hints = [];
    const resource = triple.subject;
    const text = context.text || '';
    const location = context.region;
    hints.push({ text, location, context, resource });
    return hints;
  }
});

RdfaEditorAttendeeListPlugin.reopen({
  who: 'editor-plugins/attendee-list-card'
});
export default RdfaEditorAttendeeListPlugin;
