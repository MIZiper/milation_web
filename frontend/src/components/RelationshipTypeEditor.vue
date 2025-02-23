<template>
  <v-container>
    <v-row>
      <v-col>
        <v-text-field density="compact" v-model="relationshipType.source" label="关系类型"></v-text-field>
      </v-col>
      <v-col cols="4">
        <v-text-field density="compact" v-model="relationshipType.target" label="（选填）关系类型"></v-text-field>
      </v-col>
      <v-col cols="auto">
        <v-btn @click="addRelationshipType">添加</v-btn>
      </v-col>
    </v-row>
    <v-list>
      <v-list-item v-for="(relationshipType, index) in relationshipTypes" :key="index">
        <v-row>
          <v-col>
            <v-list-item-title>{{ relationshipType.name }}</v-list-item-title> </v-col>
          <v-col cols="auto">
            <v-list-item-action>
              <v-btn variant="text" @click="deleteRelationshipType(index)">
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </v-list-item-action>
          </v-col>
        </v-row>
      </v-list-item>
    </v-list>
  </v-container>
</template>

<script>
import { RelationshipType } from '../models/PersonRelationship';

export default {
  data() {
    return {
      relationshipType: {
        source: '',
        target: '',
      },
      relationshipTypes: [],
    };
  },
  async created() {
    this.relationshipTypes = await RelationshipType.loadFromIndexedDB();
  },
  methods: {
    async addRelationshipType() {
      if (this.relationshipType.source) {
        const newRelationshipType = RelationshipType.create(
          this.relationshipType.source,
          this.relationshipType.target || null
        );
        this.relationshipTypes.push(newRelationshipType);
        await newRelationshipType.saveToIndexedDB();
        this.relationshipType = { source: '', target: '' };
      }
    },
    async deleteRelationshipType(index) {
      this.relationshipTypes.splice(index, 1);
      await RelationshipType.saveToIndexedDB(this.relationshipTypes);
    }
  }
};
</script>

<style scoped></style>
