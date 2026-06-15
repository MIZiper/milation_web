<script lang="ts">
  import { GroupNode, Person } from '../models/PersonRelationship';
  import { Modal, ModalHeader, ModalBody, ModalFooter, Button, FormGroup, Label } from '@sveltestrap/sveltestrap';

  interface Props {
    open: boolean;
    people: Person[];
    group: GroupNode | null;
    onGroupUpdated: (group: GroupNode) => void;
  }

  let { open = $bindable(), people, onGroupUpdated, group }: Props = $props();

  let selectedMembers: string[] = $state([]);
  let memberError = $state('');

  $effect(() => {
    if (open && group) {
      selectedMembers = group.members.map(member => member.id);
    }
  });

  function closeDialog() {
    open = false;
    selectedMembers = [];
    memberError = '';
  }

  function saveGroup() {
    if (selectedMembers.length < 2) {
      memberError = '群组至少包含两名成员';
      return;
    }
    const members = people.filter(p => selectedMembers.includes(p.id));
    if (group) {
      const updatedGroup = new GroupNode(group.id, members, group.relationshipType);
      updatedGroup.saveToIndexedDB();
      onGroupUpdated(updatedGroup);
    }
    closeDialog();
  }

  function toggleMember(id: string) {
    if (selectedMembers.includes(id)) {
      selectedMembers = selectedMembers.filter(m => m !== id);
    } else {
      selectedMembers = [...selectedMembers, id];
    }
    if (selectedMembers.length >= 2) {
      memberError = '';
    }
  }
</script>

<Modal isOpen={open} toggle={closeDialog}>
  <ModalHeader toggle={closeDialog}>
    编辑群组
  </ModalHeader>
  <ModalBody>
    <FormGroup>
      <Label>包含成员</Label>
      <div class="border rounded p-2" style="max-height: 300px; overflow-y: auto;">
        {#each people as p (p.id)}
          <div class="form-check">
            <input
              class="form-check-input"
              type="checkbox"
              id={`member-${p.id}`}
              checked={selectedMembers.includes(p.id)}
              onchange={() => toggleMember(p.id)}
            />
            <label class="form-check-label" for={`member-${p.id}`}>
              {p.name}
            </label>
          </div>
        {/each}
      </div>
      {#if memberError}
        <div class="invalid-feedback d-block">{memberError}</div>
      {/if}
    </FormGroup>
  </ModalBody>
  <ModalFooter>
    <Button color="secondary" onclick={closeDialog}>取消</Button>
    <Button color="primary" onclick={saveGroup}>保存</Button>
  </ModalFooter>
</Modal>
