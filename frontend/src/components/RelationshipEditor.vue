<template>
  <v-dialog v-model="dialog" max-width="600px">
    <v-card>
      <v-card-title>
        <span class="headline">添加关系</span>
      </v-card-title>
      <v-card-text>
        <v-form ref="form">
          <v-row>
            <v-col cols="9" class="pa-0">
              <v-select v-model="relationship.source" :items="people" item-title="name" item-value="id" label="此" required></v-select>
            </v-col>
            <v-spacer></v-spacer>
            <v-btn @click="swapSourceAndTarget">
              <v-icon>mdi-swap-vertical</v-icon>
            </v-btn>
          </v-row>
          <v-row>
            <v-spacer></v-spacer>
            <v-col cols="6" class="pa-0">
              <v-select density="compact" v-model="relationship.type" :items="relationshipTypes" item-title="name" item-value="id" label="关系类型" required></v-select>
            </v-col>
            <v-spacer></v-spacer>
          </v-row>
          <v-row>
            <v-spacer></v-spacer>
            <v-col cols="9" class="pa-0">
              <v-select v-model="relationship.target" :items="people" item-title="name" item-value="id" label="彼" required></v-select>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue darken-1" text @click="closeDialog">取消</v-btn>
        <v-btn color="blue darken-1" text @click="addRelationship">添加</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { RelationshipType, Person, Relationship } from '../models/PersonRelationship';

export default {
  data() {
    return {
      dialog: false,
      people: [],
      relationshipTypes: [],
      relationship: {
        source: null,
        target: null,
        type: null,
      },
      relationships: [],
    };
  },
  async created() {
    this.people = await Person.loadFromIndexedDB();
    this.relationshipTypes = await RelationshipType.loadFromIndexedDB();
    this.relationships = await Relationship.loadFromIndexedDB();
  },
  methods: {
    openDialog() {
      this.dialog = true;
    },
    closeDialog() {
      this.dialog = false;
    },
    async addRelationship() {
      if (this.$refs.form.validate()) {
        const sourcePerson = this.people.find(person => person.id === this.relationship.source);
        const targetPerson = this.people.find(person => person.id === this.relationship.target);
        const relationshipType = this.relationshipTypes.find(type => type.id === this.relationship.type);

        if (sourcePerson && targetPerson && relationshipType) {
          const relationship = Relationship.create(
            sourcePerson,
            targetPerson,
            relationshipType
          );
          this.relationships.push(relationship);
          await relationship.saveToIndexedDB();
          this.relationship = {
            source: null,
            target: null,
            type: null,
          };
          this.closeDialog();
        } else {
          // Handle error: invalid source, target, or type
          console.error('Invalid relationship data');
        }
      }
    },
    swapSourceAndTarget() {
      const source = this.relationship.source;
      this.relationship.source = this.relationship.target;
      this.relationship.target = source;
    }
  }
};
</script>

<style scoped>
</style>
