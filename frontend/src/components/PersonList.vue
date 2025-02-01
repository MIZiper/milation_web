<template>
  <v-container>
    <v-btn icon class="fab" @click="openDialog" color="primary">
      <v-icon>mdi-plus</v-icon>
    </v-btn>
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
      <v-list-item v-for="(person, index) in people" :key="index" class="hover-item">
        <v-list-item-avatar>
          <v-img :src="person.photo || defaultPhoto" max-width="50" max-height="50"></v-img>
        </v-list-item-avatar>
        <v-list-item-content>
          <v-list-item-title>{{ person.name }}</v-list-item-title>
          <v-list-item-subtitle>{{ person.contact }}</v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action class="hover-actions">
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
import Person from '../models/Person';

export default {
  data() {
    return {
      dialog: false,
      editIndex: -1,
      person: new Person('', null, '', ''),
      people: JSON.parse(localStorage.getItem('people') || '[]'),
      defaultPhoto: 'path/to/default/photo.png'
    };
  },
  created() {
    this.loadPeople();
  },
  methods: {
    openDialog() {
      this.editIndex = -1;
      this.person = new Person('', null, '', '');
      this.dialog = true;
    },
    closeDialog() {
      this.dialog = false;
    },
    savePerson() {
      if (this.$refs.form.validate()) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.person.photo = e.target.result;
          if (this.editIndex === -1) {
            this.people.push(new Person(this.person.name, this.person.photo, this.person.contact, this.person.description));
          } else {
            this.people.splice(this.editIndex, 1, new Person(this.person.name, this.person.photo, this.person.contact, this.person.description));
          }
          localStorage.setItem('people', JSON.stringify(this.people));
          this.closeDialog();
        };
        if (this.person.photo) {
          reader.readAsDataURL(this.person.photo);
        } else {
          if (this.editIndex === -1) {
            this.people.push(new Person(this.person.name, null, this.person.contact, this.person.description));
          } else {
            this.people.splice(this.editIndex, 1, new Person(this.person.name, null, this.person.contact, this.person.description));
          }
          localStorage.setItem('people', JSON.stringify(this.people));
          this.closeDialog();
        }
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
    },
    loadPeople() {
      this.people = JSON.parse(localStorage.getItem('people') || '[]');
    }
  }
};
</script>

<style scoped>
.v-list-item {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  min-height: 100px;
  display: flex;
  align-items: center;
}
.v-list-item-avatar {
  margin-right: 16px;
}
.v-img {
  max-width: 50px;
  max-height: 50px;
}
.hover-item {
  position: relative;
}
.hover-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.3s;
}
.hover-item:hover .hover-actions {
  opacity: 1;
}
.fab {
  position: fixed;
  bottom: 16px;
  right: 16px;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>