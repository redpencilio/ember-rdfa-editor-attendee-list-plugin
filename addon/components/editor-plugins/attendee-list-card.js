import { reads } from '@ember/object/computed';
import Component from '@ember/component';
import layout from '../../templates/components/editor-plugins/attendee-list-card';
import { inject as service } from '@ember/service';
import { A }  from '@ember/array';
import { computed }  from '@ember/object';
import EmberObject from '@ember/object';
import { task } from 'ember-concurrency';

/**
* Card displaying a hint of the Date plugin
*
* @module editor-attendee-list-plugin
* @class AttendeeListCard
* @extends Ember.Component
*/
export default Component.extend({
  layout,
  hintsPlugin: service('rdfa-editor-attendee-list-plugin'),
  attendees: A([]),

  currentValue: computed('info.plainValue', function() {
    this.searchAttendees.perform();
    return this.info.plainValue;
  }),

  async searchAttendeesOld() {
    const firstname = this.info.plainValue;
    const allMatching = await this.hintsPlugin.searchAttendees(firstname);
    try {
      this.set('candidateAttendees', allMatching.filter(a => this.stringify(a) !== firstname.trim()));
    } catch (err) {
      //
    }
  },

  searchAttendees: task(function * () {
    const firstname = this.info.plainValue;
    const allMatching = yield this.hintsPlugin.searchAttendees(firstname);
    this.set('candidateAttendees', allMatching.filter(a => this.stringify(a) !== firstname.trim()));
  }),

  stringify (attendee) {
    return `${attendee.get('member.firstname')} ${attendee.get('member.lastname')} - ${attendee.get('member.organization.title')}`;
  },

  nonMemberPeople: computed('people.[]', function(){
    const memberPeople = this.memberships.toArray().flatMap(m => m.member);
    return this.people.filter( p => ! memberPeople.includes(p)).sortBy('firstname');
  }),

  sortedAttendees: computed('attendees.[]', function(){
    // TODO: Sort based on member.firstname
    return this.attendees;
  }),

  innerHTML: computed('attendees.[]', function(){
    // Each attendee is an object of type membership
    const list = this.attendees
      .map(attendee => attendee.get('member'))
      .map(member => `
        <li property="notable:meetingAttendee"
            typeof="org:Membership">
          <span resource="http://data.notable.redpencil.io/persons/${member.get('id')}"
                typeof="foaf:Person"
                property="org:member">
            <span property="foaf:firstName">${member.get('firstname')}</span>
            <span> </span>
            <span property="foaf:LastName">${member.get('lastname')}</span>
            <span> - </span>
            <span property="org:memberOf"
                  typeof="org:Organization">
              <span property="skos:label">
                ${member.get('organization.title')}
              </span>
            </span>
          </span>
        </li>`);

    return `
      <div class="text-gray-500 italic">
        <i class="edit icon"></i> Edit the list
      </div>
      <ul>
        ${list.join('')}
      </ul>`;
  }),

  readyToCreateMembership: computed('selectedPerson', 'selectedRole', function(){
    return this.selectedPerson && this.selectedRole;
  }),

  readyToCreatePerson: computed('selectedPerson', 'selectedRole', function(){
    return (this.newFirstname && this.newFirstname !== '') &&
           (this.newLastName && this.newLastName !== '') &&
           this.selectedOrganization;
  }),

  /**
   * Region on which the card applies
   * @property location
   * @type [number,number]
   * @private
  */
  location: reads('info.location'),

  /**
   * Unique identifier of the event in the hints registry
   * @property hrId
   * @type Object
   * @private
  */
  hrId: reads('info.hrId'),

  /**
   * The RDFa editor instance
   * @property editor
   * @type RdfaEditor
   * @private
  */
  editor: reads('info.editor'),

  /**
   * Hints registry storing the cards
   * @property hintsRegistry
   * @type HintsRegistry
   * @private
  */
  hintsRegistry: reads('info.hintsRegistry'),

  memberships: reads('hintsPlugin.memberships'),
  organizations: reads('hintsPlugin.organizations'),
  roles: reads('hintsPlugin.roles'),

  setStatus (status) {
    this.status.set('isEditing', status === 'isEditing');
    this.status.set('isSelecting', status === 'isSelecting');
    this.status.set('isCreatingMembership', status === 'isCreatingMembership');
    this.status.set('isCreatingPerson', status === 'isCreatingPerson');
  },

  async init() {
    this._super(...arguments);

    this.set('candidateAttendees', A([]));

    this.set('status', EmberObject.create({
      isEditing: false,
      isSelecting: true,
      isCreatingMembership: false,
      isCreatingPerson: false
    }));
  },

  actions: {
    addAttendee (membership) {
      this.attendees.pushObject(membership);
      this.setStatus('isEditing');
    },

    commit() {
      const mappedLocation = this.get('hintsRegistry').updateLocationToCurrentIndex(this.get('hrId'), this.get('location'));
      this.get('hintsRegistry').removeHintsAtLocation(mappedLocation, this.get('hrId'), 'editor-plugins/attendee-list-card');

      const selection = this.editor.selectContext(mappedLocation, { typeof: this.info.typeof });
      this.editor.update(selection, {
        set: {
          innerHTML: this.innerHTML
        }
      });
      this.hintsRegistry.removeHintsAtLocation(this.location, this.hrId, this.who);
    },

    async insert(){
      const mappedLocation = this.get('hintsRegistry').updateLocationToCurrentIndex(this.get('hrId'), this.get('location'));
      this.get('hintsRegistry').removeHintsAtLocation(mappedLocation, this.get('hrId'), 'editor-plugins/attendee-list-card');
      const sel = window.getSelection();
      const range = sel.getRangeAt(0);
      const li = range.startContainer.parentNode;
      li.innerHTML = `
        <span property="notable:meetingAttendee"
            typeof="org:Membership"
            resource="http://data.notable.redpencil.io/membership/${this.selectedMembership.id}">
          ${this.stringify( this.selectedMembership)}
        </span>
      `;
      this.hintsRegistry.removeHintsAtLocation(this.location, this.hrId, this.who);
    },

    async createMembership() {
      await this.hintsPlugin.createMembership();
    },

    async createPerson() {
      await this.hintsPlugin.createPerson({
        firstname: this.newFirstname,
        lastname: this.newLastname,
        organization: this.selectedOrganization
      });
      this.setStatus( 'isCreatingMembership' );
    },

    removeAttendee (attendee) {
      this.attendees.removeObject(attendee);
    },

    setOrganization (event) {
      this.set('selectedOrganization', this.organizations.find(o => o.id == event.currentTarget.value));
    },
    
    setPerson (event) {
      this.set('selectedPerson', this.people.find(p => p.id == event.currentTarget.value));
    },
    
    setRole (event) {
      this.set('selectedRole', this.roles.find(r => r.id == event.currentTarget.value));
    },

    setStatus (status) {
      this.setStatus(status);
    }
  }
});
