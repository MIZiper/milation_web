<template>
  <v-container>
    <v-btn @click="openDialog">添加人员</v-btn>
    <v-dialog v-model="dialog" max-width="500px">
      <v-card>
        <v-card-title>
          <span class="headline">{{ editIndex === -1 ? '添加人员' : '编辑人员' }}</span>
        </v-card-title>
        <v-card-text>
          <v-form ref="form">
            <v-text-field v-model="person.name" label="姓名" required></v-text-field>
            <v-file-input v-model="person.photo" label="照片" accept="image/*"></v-file-input>
            <v-text-field v-model="person.contact" label="联系方式" required></v-text-field>
            <v-textarea v-model="person.description" label="简介"></v-textarea>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue darken-1" text @click="closeDialog">取消</v-btn>
          <v-btn color="blue darken-1" text @click="savePerson">保存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <v-list>
      <v-list-item v-for="(person, index) in people" :key="index">
        <v-list-item-content>
          <v-list-item-title>{{ person.name }}</v-list-item-title>
          <v-list-item-subtitle>{{ person.contact }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-btn icon @click="editPerson(index)">
            <v-icon>mdi-pencil</v-icon>
          </v-btn>
          <v-btn icon @click="deletePerson(index)">
            <v-icon>mdi-delete</v-icon>
          </v-btn>
        </v-list-item-action>
      </v-list-item>
    </v-list>
  </v-container>
</template>

<script>
export default {
  data() {
    return {
      dialog: false,
      editIndex: -1,
      person: {
        name: '',
        photo: null,
        contact: '',
        description: ''
      },
      people: JSON.parse(localStorage.getItem('people') || '[]')
    };
  },
  methods: {
    openDialog() {
      this.editIndex = -1;
      this.person = { name: '', photo: null, contact: '', description: '' };
      this.dialog = true;
    },
    closeDialog() {
      this.dialog = false;
    },
    savePerson() {
      if (this.$refs.form.validate()) {
        if (this.editIndex === -1) {
          this.people.push({ ...this.person });
        } else {
          this.people.splice(this.editIndex, 1, { ...this.person });
        }
        localStorage.setItem('people', JSON.stringify(this.people));
        this.closeDialog();
      }
    },
    editPerson(index) {
      this.editIndex = index;
      this.person = { ...this.people[index] };
      this.dialog = true;
    },
    deletePerson(index) {
      this.people.splice(index, 1);
      localStorage.setItem('people', JSON.stringify(this.people));
    }
  }
};
</script>
