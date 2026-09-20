<script lang="ts">
  import { Relationship, RelationshipType, GroupNode } from '../models/PersonRelationship';
  import { Modal, ModalHeader, ModalBody, ModalFooter, Button, FormGroup, Label } from '@sveltestrap/sveltestrap';

  interface Props {
    open: boolean;
    relationship: Relationship | null;
    relationshipTypes: RelationshipType[];
    onUpdated: () => void;
  }

  let { open = $bindable(), relationship, relationshipTypes, onUpdated }: Props = $props();

  let selectedType = $state('');
  let swapped = $state(false);

  let typeOptions = $derived(relationshipTypes.filter(rt => rt.target !== null));
  let sourceEntity = $derived(relationship ? (swapped ? relationship.targetEntity : relationship.sourceEntity) : null);
  let targetEntity = $derived(relationship ? (swapped ? relationship.sourceEntity : relationship.targetEntity) : null);

  $effect(() => {
    if (open && relationship) {
      selectedType = relationship.relationshipType.id;
      swapped = false;
    }
  });

  function closeDialog() {
    open = false;
  }

  function entityLabel(entity: { name: string } | null): string {
    if (!entity) return '';
    return entity instanceof GroupNode ? `${entity.name} (群组)` : entity.name;
  }

  async function saveRelationship() {
    if (!relationship || !sourceEntity || !targetEntity) return;
    const type = relationshipTypes.find(rt => rt.id === selectedType);
    if (!type) return;
    const updated = new Relationship(relationship.id, sourceEntity, targetEntity, type);
    await updated.saveToIndexedDB();
    onUpdated();
    closeDialog();
  }
</script>

<Modal isOpen={open} toggle={closeDialog}>
  <ModalHeader toggle={closeDialog}>
    编辑关系
  </ModalHeader>
  <ModalBody>
    <div class="mb-3 fw-bold">
      {entityLabel(sourceEntity)}
      <i class="bi bi-arrow-right"></i>
      {entityLabel(targetEntity)}
    </div>
    <FormGroup>
      <Label for="editRelType">关系类型</Label>
      <select id="editRelType" class="form-select" bind:value={selectedType}>
        {#each typeOptions as rt (rt.id)}
          <option value={rt.id}>{rt.name}</option>
        {/each}
      </select>
    </FormGroup>
    <Button color="secondary" size="sm" onclick={() => swapped = !swapped}>
      <i class="bi bi-arrow-down-up"></i> 交换方向
    </Button>
  </ModalBody>
  <ModalFooter>
    <Button color="secondary" onclick={closeDialog}>取消</Button>
    <Button color="primary" onclick={saveRelationship}>保存</Button>
  </ModalFooter>
</Modal>
