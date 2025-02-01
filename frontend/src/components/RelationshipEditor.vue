<template>
  <v-dialog v-model="dialog" max-width="500px">
    <v-card>
      <v-card-title>
        <span class="headline">编辑关系</span>
      </v-card-title>
      <v-card-text>
        <v-form ref="form">
          <v-select v-model="relationship.source" :items="people" item-text="name" label="来源" required></v-select>
          <v-select v-model="relationship.target" :items="people" item-text="name" label="目标"></v-select>
          <v-text-field v-model="newRelationshipType" label="自定义关系类型" @keyup.enter="addRelationshipType"></v-text-field>
          <v-select v-model="relationship.type" :items="relationshipTypes" label="关系类型" required></v-select>
          <v-checkbox v-model="relationship.directed" label="有向关系"></v-checkbox>
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
import RelationshipType from '../models/RelationshipType';

export default {
  props: {
    people: Array,
    relationships: Array
  },
  data() {
    return {
      dialog: false,
      relationship: {
        source: null,
        target: null,
        type: '',
        directed: false
      },
      newRelationshipType: '',
      relationshipTypes: JSON.parse(localStorage.getItem('relationshipTypes') || '["群体关系", "单体关系"]')
    };
  },
  methods: {
    openDialog() {
      this.relationship = { source: null, target: null, type: '', directed: false };
      this.dialog = true;
    },
    closeDialog() {
      this.dialog = false;
    },
    saveRelationship() {
      if (this.$refs.form.validate()) {
        const relationship = new RelationshipType(this.relationship.source, this.relationship.target);
        this.$emit('save-relationship', relationship);
        this.closeDialog();
        this.storeRelationships();
      }
    },
    addRelationshipType() {
      if (this.newRelationshipType && !this.relationshipTypes.includes(this.newRelationshipType)) {
        this.relationshipTypes.push(this.newRelationshipType);
        localStorage.setItem('relationshipTypes', JSON.stringify(this.relationshipTypes));
        this.newRelationshipType = '';
      }
    },
    storeRelationships() {
      localStorage.setItem('relationships', JSON.stringify(this.relationships));
    }
  }
};
</script>

<style scoped>
</style>
