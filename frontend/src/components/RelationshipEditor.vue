<template>
  <v-dialog v-model="dialog" max-width="600px">
    <v-card>
      <v-card-title>
        <span class="headline">编辑关系</span>
      </v-card-title>
      <v-card-text>
        <v-form ref="form">
          <v-row>
            <v-col cols="9" class="pa-0">
              <v-select v-model="relationship.source" :items="people" item-title="name" label="此" required></v-select>
            </v-col>
            <v-spacer></v-spacer>
            <v-btn @click="swapSourceAndTarget">
              <v-icon>mdi-swap-vertical</v-icon>
            </v-btn>
          </v-row>
          <v-row>
            <v-spacer></v-spacer>
            <v-col cols="6" class="pa-0">
              <v-select density="compact" v-model="relationship.type" :items="relationshipTypes" item-title="name" label="关系类型" required></v-select>
            </v-col>
            <v-spacer></v-spacer>
          </v-row>
          <v-row>
            <v-spacer></v-spacer>
            <v-col cols="9" class="pa-0">
              <v-select v-model="relationship.target" :items="people" item-title="name" label="彼" required></v-select>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue darken-1" text @click="closeDialog">取消</v-btn>
        <v-btn color="blue darken-1" text @click="saveRelationship">保存</v-btn>
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
      people: Person.loadFromLocalStorage(),
      relationshipTypes: RelationshipType.loadFromLocalStorage(),
      relationship: {
        source: null,
        target: null,
        type: null,
      },
      relationships: Relationship.loadFromLocalStorage(),
    };
  },
  methods: {
    openDialog() {
      this.dialog = true;
    },
    closeDialog() {
      this.dialog = false;
    },
    saveRelationship() {
      if (this.$refs.form.validate()) {
        const relationship = new Relationship(
          this.relationship.source,
          this.relationship.target,
          this.relationship.type
        );
        this.relationships.push(relationship);
        Relationship.saveToLocalStorage(this.relationships);
        this.closeDialog();
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
