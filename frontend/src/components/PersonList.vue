<template>
  <v-container>
    <v-btn icon class="fab" @click="newPerson" color="primary">
      <v-icon>mdi-plus</v-icon>
    </v-btn>
    <v-dialog v-model="dialog" max-width="600px">
      <v-card>
        <v-card-title>{{ editIndex === -1 ? '添加人员' : '编辑人员' }}</v-card-title>
        <v-card-text>
          <v-form ref="form">
            <v-img v-if="person.photo && typeof person.photo === 'string'" :src="person.photo" max-width="200"
              max-height="200" class="mb-3"></v-img>
            <v-text-field v-model="person.name" label="姓名" required></v-text-field>
            <v-file-input label="照片" @update:modelValue="changePhoto" prepend-icon="mdi-camera"
              accept="image/*"></v-file-input>
            <v-text-field v-model="person.contact" label="联系方式"></v-text-field>
            <v-text-field v-model="person.birthYear" label="出生年份"></v-text-field>
            <v-textarea v-model="person.notes" label="备注"></v-textarea>
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
        <v-row>
          <v-col cols="auto">
            <v-img :src="person.photo || defaultPhoto" style="background-color: lightgray;" width="100"
              height="100"></v-img>
          </v-col>
          <v-col>
            <v-list-item-title>
              <v-icon>mdi-account</v-icon>
              {{ person.name }}
            </v-list-item-title>
            <v-list-item-subtitle>
              <v-icon>mdi-information</v-icon>
              <span v-if="person.birthYear">
                出生年份：{{ person.birthYear }}
              </span>
              <span v-if="person.contact">
                联系方式：{{ person.contact }}
              </span>
            </v-list-item-subtitle>
            {{ person.notes }}
          </v-col>
        </v-row>
        <v-list-item-action class="hover-actions">
          <v-btn>
            <v-icon>mdi-account-details</v-icon>
          </v-btn>
          <v-btn @click="editPerson(index)">
            <v-icon>mdi-pencil</v-icon>
          </v-btn>
          <v-btn @click="deletePerson(index)">
            <v-icon>mdi-delete</v-icon>
          </v-btn>
        </v-list-item-action>
      </v-list-item>
    </v-list>
  </v-container>
</template>

<script>
import { Person } from '../models/PersonRelationship';

export default {
  data() {
    return {
      dialog: false,
      editIndex: -1,
      person: null,
      people: Person.loadFromLocalStorage(),
      defaultPhoto: '/ApplicationIcon.png',
    };
  },
  methods: {
    newPerson() {
      this.editIndex = -1;
      this.person = new Person('', null);
      this.dialog = true;
    },
    closeDialog() {
      this.dialog = false;
    },
    editPerson(index) {
      this.editIndex = index;
      this.person = { ...this.people[index] };
      this.dialog = true;
    },
    deletePerson(index) {
      this.people.splice(index, 1);
      Person.saveToLocalStorage(this.people);
    },
    changePhoto(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.person.photo = e.target.result;
      };
      reader.readAsDataURL(file);
    },
    savePerson() {
      if (this.$refs.form.validate()) {
        const newPerson = new Person(this.person.name, this.person.photo, this.person.birthYear, this.person.contact, this.person.notes);
        if (this.editIndex === -1) {
          this.people.push(newPerson);
        } else {
          this.people.splice(this.editIndex, 1, newPerson);
        }
        Person.saveToLocalStorage(this.people);
        this.closeDialog();
      }
      this.dialog = false;
    }
  }
};
</script>

<style scoped>
.v-list-item {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  min-height: 100px;
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
  bottom: 72px;
  right: 16px;
  width: 56px;
  height: 56px;
  z-index: 1000;
}
</style>