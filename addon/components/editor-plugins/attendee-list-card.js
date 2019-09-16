import { reads } from '@ember/object/computed';
import Component from '@ember/component';
import layout from '../../templates/components/editor-plugins/attendee-list-card';
import { inject as service } from '@ember/service';
import { A }  from '@ember/array';
import { computed }  from '@ember/object';
import EmberObject from '@ember/object';

/**
* Card displaying a hint of the Date plugin
*
* @module editor-attendee-list-plugin
* @class AttendeeListCard
* @extends Ember.Component
*/
export default Component.extend({
  layout,
  store: service(),
  attendees: A([]),

  availableMemberships: computed('attendees.[]', 'memberships.[]', function(){
    return this.memberships.filter(m => ! this.attendees.includes(m.member)).sortBy('member.firstname');
  }),

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
          <span resource="http://data.notable.redpencil.io/person/${member.get('id')}"
                typeof="foaf:Person"
                property="org:member">
            <span property="foaf:firstName">${member.get('firstname')} </span>
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

  async init() {
    this._super(...arguments);

    this.set('memberships', await this.store.query('membership', {
      include: 'member,member.organization'
    }));

    this.set('organizations', (await this.store.findAll('organization')).sortBy('title'));
    this.set('people', await this.store.query('person', {
      include: 'organization'
    }));
    this.set('roles', (await this.store.findAll('role')).sortBy('label'));

    this.set('status', EmberObject.create({
      isEditing: true,
      isAdding: false,
      isCreatingMembership: false,
      isCreatingPerson: false
    }));
  },

  setStatus (status) {
    this.status.set('isEditing', status === 'isEditing');
    this.status.set('isAdding', status === 'isAdding');
    this.status.set('isCreatingMembership', status === 'isCreatingMembership');
    this.status.set('isCreatingPerson', status === 'isCreatingPerson');
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

    async createMembership() {
      const membership = this.store.createRecord('membership', {
        member: this.selectedPerson,
        role: this.selectedRole
      });

      await membership.save();
    },

    async createPerson() {
      const person = this.store.createRecord('person', {
        firstname: this.newFirstname,
        lastname: this.newLastname,
        organization: this.selectedOrganization
      });
      await person.save();

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
