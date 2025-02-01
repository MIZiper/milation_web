<template>
  <v-dialog v-model="dialog" max-width="500px">
    <v-card>
      <v-card-title>
        <span class="headline">编辑关系类型</span>
      </v-card-title>
      <v-card-text>
        <v-form ref="form">
          <v-text-field v-model="newRelationshipType" label="新关系类型" @keyup.enter="addRelationshipType"></v-text-field>
          <v-list>
            <v-list-item v-for="(type, index) in relationshipTypes" :key="index">
              <v-list-item-content>{{ type }}</v-list-item-content>
              <v-list-item-action>
                <v-btn icon @click="deleteRelationshipType(index)">
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </v-list-item-action>
            </v-list-item>
          </v-list>
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue darken-1" text @click="closeDialog">关闭</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
export default {
  data() {
    return {
      dialog: false,
      newRelationshipType: '',
      relationshipTypes: JSON.parse(localStorage.getItem('relationshipTypes') || '["群体关系", "单体关系"]')
    };
  },
  methods: {
    openDialog() {
      this.dialog = true;
    },
    closeDialog() {
      this.dialog = false;
    },
    addRelationshipType() {
      if (this.newRelationshipType && !this.relationshipTypes.includes(this.newRelationshipType)) {
        this.relationshipTypes.push(this.newRelationshipType);
        localStorage.setItem('relationshipTypes', JSON.stringify(this.relationshipTypes));
        this.newRelationshipType = '';
      }
    },
    deleteRelationshipType(index) {
      this.relationshipTypes.splice(index, 1);
      localStorage.setItem('relationshipTypes', JSON.stringify(this.relationshipTypes));
    }
  }
};
</script>

<style scoped>
</style>
