<script lang="ts">
  import { onMount } from 'svelte';
  import * as d3 from 'd3';
  import { Person, RelationshipType, Relationship, GroupNode } from '../models/PersonRelationship';
  import { Container, Button, Offcanvas, OffcanvasHeader, OffcanvasBody, ListGroup, ListGroupItem } from '@sveltestrap/sveltestrap';
  import RelationshipEditor from '../components/RelationshipEditor.svelte';
  import GroupEditor from '../components/GroupEditor.svelte';

  let people: Person[] = $state([]);
  let relationshipTypes: RelationshipType[] = $state([]);
  let relationships: Relationship[] = $state([]);
  let groups: GroupNode[] = $state([]);
  let drawer = $state(false);
  let graphEl: HTMLDivElement;

  let svgG: d3.Selection<SVGGElement, unknown, null, undefined>;
  let simulation: d3.Simulation<any, any>;

  let relEditorOpen = $state(false);
  let groupEditorOpen = $state(false);
  let groupToEdit: GroupNode | null = $state(null);

  onMount(async () => {
    people = await Person.loadFromIndexedDB();
    relationshipTypes = await RelationshipType.loadFromIndexedDB();
    groups = await GroupNode.loadFromIndexedDBWith(people, relationshipTypes);
    relationships = await Relationship.loadFromIndexedDBWith(people, groups, relationshipTypes);
    drawGraph();
  });

  function drawGraph() {
    if (!graphEl) return;

    d3.select(graphEl).selectAll('svg').remove();

    const width = graphEl.clientWidth || 800;
    const height = 720;

    const svg = d3.select(graphEl)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoom);
    const g = svg.append('g');
    svgG = g;

    const allEntities = [...people, ...groups];
    const allLinks: any[] = [
      ...relationships,
      ...groups.flatMap(group => group.members.map(member => ({
        source: group,
        target: member,
        dashed: true,
      })))
    ];

    simulation = d3.forceSimulation(allEntities as any)
      .force('link', d3.forceLink(allLinks as any).id((d: any) => d.id)
        .distance((d: any) => d.dashed ? 75 : 175))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const linkColor = '#999';

    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(allLinks)
      .enter().append('line')
      .attr('stroke-width', 1.5)
      .attr('stroke', linkColor)
      .attr('stroke-dasharray', (d: any) => d.dashed ? '4 2' : 'none')
      .attr('marker-end', (d: any) => d.dashed ? null : 'url(#arrow)');

    const linkText = g.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(relationships)
      .enter().append('text')
      .attr('dx', 10)
      .attr('dy', -5)
      .style('font-size', '10px')
      .style('fill', linkColor)
      .text((d: any) => d.relationshipType.name);

    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(allEntities)
      .enter().append('g')
      .call(d3.drag<SVGGElement, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any);

    node.filter((d: any) => !(d instanceof GroupNode))
      .append('image')
      .attr('href', (d: any) => d.thumbnailPhoto || './whobody.png')
      .attr('x', -15)
      .attr('y', -15)
      .attr('width', 30)
      .attr('height', 30);

    const groupNodeText = node.filter((d: any) => d instanceof GroupNode)
      .append('text')
      .attr('dx', 0)
      .attr('dy', 5)
      .style('font-size', '10px')
      .style('text-anchor', 'middle')
      .text((d: any) => d.relationshipType.name);

    groupNodeText.each(function(this: SVGTextElement) {
      const bbox = this.getBBox();
      if (this.parentNode) {
        d3.select(this.parentNode as Element).insert('rect', 'text')
          .attr('x', bbox.x - 2)
          .attr('y', bbox.y - 2)
          .attr('width', bbox.width + 4)
          .attr('height', bbox.height + 4)
          .attr('fill', 'white');
      }
    });

    node.append('text')
      .attr('dx', (d: any) => d instanceof GroupNode ? 0 : 20)
      .attr('dy', 5)
      .style('font-size', (d: any) => d instanceof GroupNode ? '10px' : '15px')
      .style('text-anchor', (d: any) => d instanceof GroupNode ? 'middle' : 'start')
      .text((d: any) => d instanceof GroupNode ? d.relationshipType.name : d.name);

    g.append('defs').append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', linkColor);

    simulation.nodes(allEntities)
      .on('tick', ticked);

    (simulation.force('link') as d3.ForceLink<any, any>).links(allLinks);
  }

  function ticked() {
    if (!svgG) return;
    const link = svgG.selectAll<SVGLineElement, any>('.links line');
    const linkText = svgG.selectAll<SVGTextElement, any>('.link-labels text');
    const node = svgG.selectAll<SVGGElement, any>('.nodes g');

    link
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y);

    linkText
      .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
      .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

    node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
  }

  function dragstarted(event: d3.D3DragEvent<SVGGElement, any, any>, d: any) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event: d3.D3DragEvent<SVGGElement, any, any>, d: any) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event: d3.D3DragEvent<SVGGElement, any, any>, d: any) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  function onRelationshipAdded(newRelationship: any) {
    if (newRelationship instanceof GroupNode) {
      groups = [...groups, newRelationship];
    } else {
      relationships = [...relationships, newRelationship];
    }
    updateGraph();
  }

  function onGroupUpdated(updatedGroup: GroupNode) {
    const index = groups.findIndex(g => g.id === updatedGroup.id);
    if (index !== -1) {
      const newGroups = [...groups];
      newGroups[index] = updatedGroup;
      groups = newGroups;
    }
    updateGraph();
  }

  function updateGraph() {
    simulation?.stop();
    drawGraph();
  }

  async function deleteRelationship(idx: number) {
    const relationship = relationships[idx];
    await Relationship.deleteFromIndexedDB(relationship.id);
    relationships = relationships.filter((_, i) => i !== idx);
    updateGraph();
  }

  async function deleteGroup(idx: number) {
    const group = groups[idx];
    await GroupNode.deleteFromIndexedDB(group.id);
    groups = groups.filter((_, i) => i !== idx);
    updateGraph();
  }

  function editGroup(idx: number) {
    groupToEdit = groups[idx];
    groupEditorOpen = true;
  }

  function openRelationshipEditor() {
    relEditorOpen = true;
  }
</script>

<Container fluid>
  <Button color="primary" style="position: fixed; bottom: 72px; right: 16px; width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 1000; font-size: 24px; padding: 0;" onclick={openRelationshipEditor}>
    <i class="bi bi-plus-lg"></i>
  </Button>
  <Button color="secondary" style="position: fixed; bottom: 140px; right: 16px; width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 1000; font-size: 24px; padding: 0;" onclick={() => drawer = !drawer}>
    <i class="bi bi-list"></i>
  </Button>

  <div bind:this={graphEl} class="graph"></div>

  <RelationshipEditor
    bind:open={relEditorOpen}
    people={people}
    relationshipTypes={relationshipTypes}
    groups={groups}
    onRelationshipAdded={(rel: any) => onRelationshipAdded(rel)}
  />

  <GroupEditor
    bind:open={groupEditorOpen}
    people={people}
    group={groupToEdit}
    onGroupUpdated={(g: GroupNode) => onGroupUpdated(g)}
  />

  <Offcanvas isOpen={drawer} toggle={() => drawer = !drawer}>
    <OffcanvasHeader toggle={() => drawer = !drawer}>
      关系列表
    </OffcanvasHeader>
    <OffcanvasBody>
      <h6 class="text-muted">独立关系</h6>
      <ListGroup flush>
        {#each relationships as rel, idx (rel.id)}
          <ListGroupItem>
            <div class="d-flex justify-content-between align-items-center">
              <div class="text-truncate me-2">
                {rel.sourceEntity.name} - {rel.targetEntity.name} ({rel.relationshipType.name})
              </div>
              <Button color="light" size="sm" onclick={() => deleteRelationship(idx)}>
                <i class="bi bi-trash"></i>
              </Button>
            </div>
          </ListGroupItem>
        {/each}
      </ListGroup>

      <h6 class="text-muted mt-3">群组关系</h6>
      <ListGroup flush>
        {#each groups as group, idx (group.id)}
          <ListGroupItem>
            <div class="d-flex justify-content-between align-items-center">
              <div class="text-truncate me-2">
                <div>{group.name} ({group.members.length} 人)</div>
                <small class="text-muted text-truncate d-block">
                  {group.members.map(m => m.name).join(', ')}
                </small>
              </div>
              <div class="d-flex">
                <Button color="light" size="sm" onclick={() => editGroup(idx)}>
                  <i class="bi bi-pencil"></i>
                </Button>
                <Button color="light" size="sm" onclick={() => deleteGroup(idx)}>
                  <i class="bi bi-trash"></i>
                </Button>
              </div>
            </div>
          </ListGroupItem>
        {/each}
      </ListGroup>
    </OffcanvasBody>
  </Offcanvas>
</Container>

<style>
  .graph {
    border: 1px solid #ccc;
    overflow: hidden;
    position: relative;
    min-height: 500px;
  }
</style>
