<template>
  <v-dialog v-model="dialog" max-width="600px">
    <v-card>
      <v-card-title>编辑关系类型</v-card-title>
      <v-card-text>
        <!-- <v-form ref="form"> -->
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
          <v-list-item density="compact" v-for="(relationshipType, index) in relationshipTypes" :key="index">
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
        <!-- </v-form> -->
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue darken-1" text @click="closeDialog">关闭</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
import { RelationshipType } from '../models/PersonRelationship';

export default {
  data() {
    return {
      dialog: true,
      relationshipType: new RelationshipType('', null),
      relationshipTypes: [],
    };
  },
  created() {
    this.relationshipTypes = JSON.parse(localStorage.getItem('relationshipTypes')) || [];
  },
  methods: {
    openDialog() {
      this.dialog = true;
    },
    closeDialog() {
      this.dialog = false;
    },
    addRelationshipType() {
      if (this.relationshipType.source) {
        const newRelationshipType = new RelationshipType(
          this.relationshipType.source, this.relationshipType.target || null
        );
        this.relationshipTypes.push(newRelationshipType);
        localStorage.setItem('relationshipTypes', JSON.stringify(this.relationshipTypes));
        this.relationshipType = new RelationshipType('', null);
      }
    },
    deleteRelationshipType(index) {
      this.relationshipTypes.splice(index, 1);
      localStorage.setItem('relationshipTypes', JSON.stringify(this.relationshipTypes));
    }
  }
};
</script>

<style scoped></style>
