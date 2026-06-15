<script lang="ts">
  import { RelationshipType, Person, Relationship, GroupNode } from '../models/PersonRelationship';
  import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Row, Col, Input } from '@sveltestrap/sveltestrap';

  interface Props {
    open: boolean;
    people: Person[];
    relationshipTypes: RelationshipType[];
    groups: GroupNode[];
  }

  let { open = $bindable(), people, relationshipTypes, groups, onRelationshipAdded }: Props & { onRelationshipAdded: (rel: any) => void } = $props();

  let source = $state('');
  let target = $state('');
  let type = $state('');
  let formValid = $state(true);
  let sourceError = $state('');

  let allEntities = $derived([...people, ...groups]);
  let allEntityOptions = $derived(allEntities.map(e => ({ value: e.id, label: `${e.name}${e instanceof Person ? '' : ' (群组)'}` })));

  let filteredRelationshipTypes = $derived(() => {
    const sourceIsGroup = groups.some(group => group.id === source);
    const targetIsGroup = groups.some(group => group.id === target);
    if (sourceIsGroup || targetIsGroup) {
      return relationshipTypes.filter(rt => rt.target !== null);
    }
    return relationshipTypes;
  });

  let filteredTypeOptions = $derived(filteredRelationshipTypes().map(rt => ({ value: rt.id, label: rt.name })));

  function closeDialog() {
    open = false;
    source = '';
    target = '';
    type = '';
    sourceError = '';
    formValid = true;
  }

  function validateForm(): boolean {
    if (!source) {
      sourceError = '请选择来源';
      formValid = false;
      return false;
    }
    if (!target) {
      sourceError = '请选择目标';
      formValid = false;
      return false;
    }
    if (!type) {
      sourceError = '请选择关系类型';
      formValid = false;
      return false;
    }
    sourceError = '';
    formValid = true;
    return true;
  }

  async function addRelationship() {
    if (!validateForm()) return;

    const sourceEntity = allEntities.find(entity => entity.id === source);
    const targetEntity = allEntities.find(entity => entity.id === target);
    const relationshipType = relationshipTypes.find(rt => rt.id === type);

    if (sourceEntity && targetEntity && relationshipType) {
      const relationship = Relationship.create(sourceEntity, targetEntity, relationshipType);
      await relationship.saveToIndexedDB();
      onRelationshipAdded(relationship);
      source = '';
      target = '';
      type = '';
      closeDialog();
    } else {
      console.error('Invalid relationship data');
    }
  }

  function swapSourceAndTarget() {
    const s = source;
    source = target;
    target = s;
  }
</script>

<Modal isOpen={open} toggle={closeDialog}>
  <ModalHeader toggle={closeDialog}>
    添加关系
  </ModalHeader>
  <ModalBody>
    <Row class="align-items-end mb-3">
      <Col xs="9">
        <label class="form-label" for="relSource">此</label>
        <select id="relSource" class="form-select" bind:value={source}>
          <option value="">请选择</option>
          {#each allEntityOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </Col>
      <Col xs="auto">
        <Button color="secondary" onclick={swapSourceAndTarget}>
          <i class="bi bi-arrow-down-up"></i>
        </Button>
      </Col>
    </Row>
    <Row class="mb-3 justify-content-center">
      <Col xs="6">
        <label class="form-label" for="relType">关系类型</label>
        <select id="relType" class="form-select" bind:value={type}>
          <option value="">请选择</option>
          {#each filteredTypeOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
        {#if sourceError}
          <div class="invalid-feedback d-block">{sourceError}</div>
        {/if}
      </Col>
    </Row>
    <Row class="justify-content-end mb-3">
      <Col xs="9">
        <label class="form-label" for="relTarget">彼</label>
        <select id="relTarget" class="form-select" bind:value={target}>
          <option value="">请选择</option>
          {#each allEntityOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </Col>
    </Row>
  </ModalBody>
  <ModalFooter>
    <Button color="secondary" onclick={closeDialog}>取消</Button>
    <Button color="primary" onclick={addRelationship}>添加</Button>
  </ModalFooter>
</Modal>
