<template>
  <v-dialog v-model="dialog" max-width="500px">
    <v-card>
      <v-card-title>
        <span class="headline">编辑关系</span>
      </v-card-title>
      <v-card-text>
        <v-form ref="form">
          <v-row>
            <v-col cols="9" class="pa-0">
              <v-select v-model="relationship.source" :items="people" item-title="name" label="彼" required></v-select>
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
              <v-select v-model="relationship.target" :items="people" item-title="name" label="此" required></v-select>
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
export default {
  data() {
    return {
      dialog: true,

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
  created() {
    this.people = JSON.parse(localStorage.getItem('people')) || [];
    this.relationshipTypes = JSON.parse(localStorage.getItem('relationshipTypes')) || [];
    this.relationships = JSON.parse(localStorage.getItem('relationships')) || [];
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
        const relationship = { ...this.relationship };
        this.relationships.push(relationship);
        this.storeRelationships();
        this.closeDialog();
      }
    },
    storeRelationships() {
      localStorage.setItem('relationships', JSON.stringify(this.relationships));
    },
    swapSourceAndTarget() {
      const source = this.relationship.source;
      this.relationship.source = this.relationship.target;
      this.relationship.target = source;
    },
  }
};
</script>

<style scoped>
</style>
