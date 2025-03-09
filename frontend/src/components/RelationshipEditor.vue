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
              <v-select v-model="relationship.source" :items="allEntities" item-title="name" item-value="id" label="此" required></v-select>
            </v-col>
            <v-spacer></v-spacer>
            <v-btn @click="swapSourceAndTarget">
              <v-icon>mdi-swap-vertical</v-icon>
            </v-btn>
          </v-row>
          <v-row>
            <v-spacer></v-spacer>
            <v-col cols="6" class="pa-0">
              <v-select density="compact" v-model="relationship.type" :items="filteredRelationshipTypes" item-title="name" item-value="id" label="关系类型" required></v-select>
            </v-col>
            <v-spacer></v-spacer>
          </v-row>
          <v-row>
            <v-spacer></v-spacer>
            <v-col cols="9" class="pa-0">
              <v-select v-model="relationship.target" :items="allEntities" item-title="name" item-value="id" label="彼" required></v-select>
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
import { RelationshipType, Person, Relationship, GroupNode } from '../models/PersonRelationship';

export default {
  props: {
    people: Array,
    relationshipTypes: Array,
    relationships: Array,
    groups: Array // Add groups as a prop
  },
  data() {
    return {
      dialog: false,
      relationship: {
        source: null,
        target: null,
        type: null,
      },
    };
  },
  computed: {
    allEntities() {
      return [...this.people, ...this.groups];
    },
    filteredRelationshipTypes() {
      const sourceIsGroup = this.groups.some(group => group.id === this.relationship.source);
      const targetIsGroup = this.groups.some(group => group.id === this.relationship.target);
      if (sourceIsGroup || targetIsGroup) {
        return this.relationshipTypes.filter(type => type.target !== null);
      }
      return this.relationshipTypes;
    }
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
        const sourceEntity = this.allEntities.find(entity => entity.id === this.relationship.source);
        const targetEntity = this.allEntities.find(entity => entity.id === this.relationship.target);
        const relationshipType = this.relationshipTypes.find(type => type.id === this.relationship.type);

        if (sourceEntity && targetEntity && relationshipType) {
          const relationship = Relationship.create(
            sourceEntity,
            targetEntity,
            relationshipType
          );
          await relationship.saveToIndexedDB(); // or group node
          this.$emit('relationship-added', relationship); // Emit event with the new relationship
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
