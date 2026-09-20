<script lang="ts">
  import { GroupNode, Person, RelationshipType } from '../models/PersonRelationship';
  import { Modal, ModalHeader, ModalBody, ModalFooter, Button, FormGroup, Label, Input } from '@sveltestrap/sveltestrap';

  interface Props {
    open: boolean;
    people: Person[];
    group: GroupNode | null;
    relationshipTypes?: RelationshipType[];
    initialMemberIds?: string[];
    onGroupUpdated: (group: GroupNode) => void;
  }

  let { open = $bindable(), people, onGroupUpdated, group, relationshipTypes = [], initialMemberIds = [] }: Props = $props();

  let selectedMembers: string[] = $state([]);
  let memberError = $state('');
  let selectedType = $state('');
  let typeError = $state('');
  let memberSearch = $state('');

  let isCreate = $derived(group === null);
  let groupTypeOptions = $derived(relationshipTypes.filter(rt => rt.target === null));
  let wasOpen = $state(false);

  const collator = new Intl.Collator('zh-Hans-CN', { sensitivity: 'base' });
  let sortedPeople = $derived([...people].sort((a, b) => collator.compare(a.name, b.name)));
  let filteredPeople = $derived.by(() => {
    const needle = memberSearch.trim().toLowerCase();
    if (!needle) return sortedPeople;
    return sortedPeople.filter(p => p.name.toLowerCase().includes(needle));
  });

  $effect(() => {
    if (open && !wasOpen) {
      if (group) {
        selectedMembers = group.members.map(member => member.id);
        selectedType = group.relationshipType.id;
      } else {
        selectedMembers = [...initialMemberIds];
        selectedType = '';
      }
      memberError = '';
      typeError = '';
      memberSearch = '';
    }
    wasOpen = open;
  });

  function closeDialog() {
    open = false;
    selectedMembers = [];
    memberError = '';
    selectedType = '';
    typeError = '';
    memberSearch = '';
  }

  async function saveGroup() {
    if (selectedMembers.length < 2) {
      memberError = '群组至少包含两名成员';
      return;
    }
    const members = people.filter(p => selectedMembers.includes(p.id));
    if (group) {
      const updatedGroup = new GroupNode(group.id, members, group.relationshipType);
      await updatedGroup.saveToIndexedDB();
      onGroupUpdated(updatedGroup);
    } else {
      const relationshipType = relationshipTypes.find(rt => rt.id === selectedType);
      if (!relationshipType) {
        typeError = '请选择关系类型';
        return;
      }
      const newGroup = GroupNode.create(members, relationshipType);
      await newGroup.saveToIndexedDB();
      onGroupUpdated(newGroup);
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
    {isCreate ? '创建群组' : '编辑群组'}
  </ModalHeader>
  <ModalBody>
    {#if isCreate}
      <FormGroup>
        <Label for="groupType">关系类型</Label>
        <select id="groupType" class="form-select" bind:value={selectedType}>
          <option value="">请选择</option>
          {#each groupTypeOptions as rt (rt.id)}
            <option value={rt.id}>{rt.name}</option>
          {/each}
        </select>
        {#if groupTypeOptions.length === 0}
          <div class="form-text text-warning">暂无群组类型，请先在“关系类型”中添加只填单一名称的类型</div>
        {/if}
        {#if typeError}
          <div class="invalid-feedback d-block">{typeError}</div>
        {/if}
      </FormGroup>
    {/if}
    <FormGroup>
      <Label>包含成员</Label>
      <Input
        type="search"
        placeholder="搜索成员…"
        value={memberSearch}
        oninput={(e) => memberSearch = (e.target as HTMLInputElement).value}
        bsSize="sm"
        class="mb-2"
      />
      <div class="border rounded p-2" style="max-height: 300px; overflow-y: auto;">
        {#each filteredPeople as p (p.id)}
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
