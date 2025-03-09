<template>
    <v-dialog v-model="dialog" max-width="600px">
        <v-card>
            <v-card-title>
                <span class="headline">编辑群组</span>
            </v-card-title>
            <v-card-text>
                <v-form ref="form">
                    <v-select v-model="selectedMembers" :items="people" item-title="name" item-value="id" label="包含成员"
                        multiple chips clearable :rules="[membersRule]"></v-select>
                </v-form>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn color="blue darken-1" text @click="closeDialog">取消</v-btn>
                <v-btn color="blue darken-1" text @click="saveGroup">保存</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script>
import { GroupNode, Person } from '../models/PersonRelationship';

export default {
    props: {
        people: Array,
    },
    data() {
        return {
            dialog: false,
            selectedMembers: [],
            group: null,
        };
    },
    methods: {
        openDialog(group) {
            this.selectedMembers = group ? group.members.map(member => member.id) : [];
            this.group = group;
            this.dialog = true;
        },
        closeDialog() {
            this.dialog = false;
        },
        saveGroup() {
            if (this.$refs.form.validate()) {
                const members = this.people.filter(person => this.selectedMembers.includes(person.id));
                if (members.length < 2) {
                    this.$emit('error', '群组至少包含两名成员');
                    return;
                }
                const updatedGroup = new GroupNode(this.group.id, members, this.group.relationshipType);
                updatedGroup.saveToIndexedDB();
                this.$emit('group-updated', updatedGroup);
                this.closeDialog();
            }
        },
        membersRule(value) {
            return value.length >= 2 || '群组至少包含两名成员';
        }
    }
};
</script>
