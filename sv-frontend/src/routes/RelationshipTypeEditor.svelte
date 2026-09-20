<script lang="ts">
  import { RelationshipType } from '../models/PersonRelationship';
  import { Container, Row, Col, Input, Button, ListGroup, ListGroupItem } from '@sveltestrap/sveltestrap';
  import { onMount } from 'svelte';

  let sourceVal = $state('');
  let targetVal = $state('');
  let relationshipTypes: RelationshipType[] = $state([]);

  onMount(async () => {
    relationshipTypes = await RelationshipType.loadFromIndexedDB();
  });

  async function addRelationshipType() {
    if (sourceVal) {
      const newRelationshipType = RelationshipType.create(
        sourceVal,
        targetVal || null
      );
      relationshipTypes = [...relationshipTypes, newRelationshipType];
      await newRelationshipType.saveToIndexedDB();
      sourceVal = '';
      targetVal = '';
    }
  }

  async function deleteRelationshipType(idx: number) {
    const rt = relationshipTypes[idx];
    relationshipTypes = relationshipTypes.filter((_, i) => i !== idx);
    await RelationshipType.deleteFromIndexedDB(rt.id);
  }
</script>

<Container>
  <Row class="align-items-end mb-4">
    <Col>
      <label class="form-label" for="rtSource">关系类型</label>
      <Input id="rtSource" type="text" placeholder="关系类型" bind:value={sourceVal} />
    </Col>
    <Col md="4">
      <label class="form-label" for="rtTarget">（选填）关系类型</label>
      <Input id="rtTarget" type="text" placeholder="选填" bind:value={targetVal} />
    </Col>
    <Col xs="auto">
      <Button color="primary" onclick={addRelationshipType}>
        <i class="bi bi-plus-lg"></i> 添加
      </Button>
    </Col>
  </Row>

  <ListGroup flush>
    {#each relationshipTypes as rt, idx (rt.id)}
      <ListGroupItem>
        <div class="d-flex justify-content-between align-items-center">
          <span>{rt.name}</span>
          <Button color="light" size="sm" onclick={() => deleteRelationshipType(idx)}>
            <i class="bi bi-trash"></i>
          </Button>
        </div>
      </ListGroupItem>
    {/each}
    {#if relationshipTypes.length === 0}
      <ListGroupItem class="text-center text-muted py-5">
        暂无关系类型
      </ListGroupItem>
    {/if}
  </ListGroup>
</Container>
