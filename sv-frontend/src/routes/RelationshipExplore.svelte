<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import * as d3 from 'd3';
  import { Person, RelationshipType, Relationship, GroupNode } from '../models/PersonRelationship';
  import { Container, Button, Modal, ModalHeader, ModalBody, Input } from '@sveltestrap/sveltestrap';
  import { navigate, route } from '../router';

  type Entity = Person | GroupNode;

  let people: Person[] = $state([]);
  let relationshipTypes: RelationshipType[] = $state([]);
  let groups: GroupNode[] = $state([]);
  let relationships: Relationship[] = $state([]);

  let focus: Entity | null = $state(null);
  let history: Entity[] = $state([]);
  let pickerOpen = $state(false);
  let pickerSearch = $state('');
  let loaded = $state(false);
  let lastFocusParam: string | null = null;

  let graphEl: HTMLDivElement;
  let svgG: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  let simulation: d3.Simulation<any, any> | null = null;
  let dragMoved = false;

  // Node positions live in a stable "world" coordinate space and are reused
  // across focus changes, so existing objects don't jump around.
  const positionCache = new Map<string, { x: number; y: number }>();
  let currentTransform: d3.ZoomTransform = d3.zoomIdentity;
  let framed = false;
  const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.3, 3])
    .on('zoom', (event) => {
      currentTransform = event.transform;
      if (svgG) svgG.attr('transform', event.transform.toString());
    });

  const collator = new Intl.Collator('zh-Hans-CN', { sensitivity: 'base' });

  let pickerOptions = $derived(
    [...people, ...groups]
      .filter(e => e.name.toLowerCase().includes(pickerSearch.trim().toLowerCase()))
      .sort((a, b) => {
        const aGroup = a instanceof GroupNode ? 1 : 0;
        const bGroup = b instanceof GroupNode ? 1 : 0;
        if (aGroup !== bGroup) return aGroup - bGroup;
        return collator.compare(a.name, b.name);
      })
  );

  onMount(async () => {
    people = await Person.loadFromIndexedDB();
    relationshipTypes = await RelationshipType.loadFromIndexedDB();
    groups = await GroupNode.loadFromIndexedDBWith(people, relationshipTypes);
    relationships = await Relationship.loadFromIndexedDBWith(people, groups, relationshipTypes);
    loaded = true;
    if (typeof route.search.focus !== 'string') {
      pickerOpen = true;
    }
  });

  // Entering from the person list with ?focus=<id> starts the exploration there.
  $effect(() => {
    if (!loaded) return;
    const target = typeof route.search.focus === 'string' ? route.search.focus : '';
    if (target === (lastFocusParam ?? '')) return;
    lastFocusParam = target || null;
    if (!target) return;
    const entity = [...people, ...groups].find(e => e.id === target);
    if (entity) {
      untrack(() => {
        focus = entity;
        history = [];
        pickerOpen = false;
        drawEgo();
      });
    }
  });

  function setFocus(entity: Entity) {
    if (focus && focus.id === entity.id) {
      pickerOpen = false;
      return;
    }
    if (focus) history = [...history, focus];
    focus = entity;
    pickerOpen = false;
    drawEgo();
  }

  function goBack() {
    if (history.length === 0) return;
    const stack = [...history];
    focus = stack.pop()!;
    history = stack;
    drawEgo();
  }

  function openPicker() {
    pickerSearch = '';
    pickerOpen = true;
  }

  function buildEgo(f: Entity) {
    const entityById = new Map<string, Entity>();
    for (const person of people) entityById.set(person.id, person);
    for (const group of groups) entityById.set(group.id, group);

    const edges: any[] = [];
    const membershipsOfPerson = new Map<string, GroupNode[]>();
    for (const group of groups) {
      for (const member of group.members) {
        if (group.id === member.id) continue;
        edges.push({ a: group.id, b: member.id, kind: 'member' });
        const list = membershipsOfPerson.get(member.id);
        if (list) list.push(group);
        else membershipsOfPerson.set(member.id, [group]);
      }
    }

    const relationNeighbors = new Map<string, string[]>();
    const addRel = (from: string, to: string) => {
      const list = relationNeighbors.get(from);
      if (list) list.push(to);
      else relationNeighbors.set(from, [to]);
    };
    for (const rel of relationships) {
      if (rel.sourceEntity.id === rel.targetEntity.id) continue;
      edges.push({
        a: rel.sourceEntity.id,
        b: rel.targetEntity.id,
        kind: 'relationship',
        type: rel.relationshipType,
      });
      addRel(rel.sourceEntity.id, rel.targetEntity.id);
      addRel(rel.targetEntity.id, rel.sourceEntity.id);
    }

    const included = new Map<string, Entity>();
    const add = (id: string) => {
      const entity = entityById.get(id);
      if (entity && !included.has(id)) included.set(id, entity);
    };

    // Focus, plus its groups and the people sharing those groups.
    add(f.id);
    const focusGroups: GroupNode[] = [];
    if (f instanceof Person) {
      for (const group of membershipsOfPerson.get(f.id) ?? []) {
        focusGroups.push(group);
        add(group.id);
        for (const member of group.members) add(member.id);
      }
    } else {
      for (const member of f.members) add(member.id);
    }

    // Entities with a +/-1 relationship to the focus or to its groups
    // (for a group focus, also to its members).
    const relatedIds = new Set<string>();
    for (const id of relationNeighbors.get(f.id) ?? []) relatedIds.add(id);
    for (const group of focusGroups) {
      for (const id of relationNeighbors.get(group.id) ?? []) relatedIds.add(id);
    }
    if (f instanceof GroupNode) {
      for (const member of f.members) {
        for (const id of relationNeighbors.get(member.id) ?? []) relatedIds.add(id);
      }
    }

    for (const id of relatedIds) {
      const entity = entityById.get(id);
      if (!entity) continue;
      add(id);
      if (entity instanceof GroupNode) {
        for (const member of entity.members) add(member.id);
      }
    }

    const nodes = [...included.values()];
    const links = edges
      .filter(edge => included.has(edge.a) && included.has(edge.b))
      .map(edge => ({
        source: entityById.get(edge.a),
        target: entityById.get(edge.b),
        kind: edge.kind,
        type: edge.type,
      }));

    return { nodes, links };
  }

  function nodeRadius(node: Entity): number {
    return node instanceof Person ? 28 : 46;
  }

  function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function anchorFor(node: any, links: any[], fallback: { x: number; y: number }): { x: number; y: number } {
    let sx = 0;
    let sy = 0;
    let count = 0;
    for (const link of links) {
      const other = link.source === node ? link.target : link.target === node ? link.source : null;
      if (other && typeof other.x === 'number' && typeof other.y === 'number') {
        sx += other.x;
        sy += other.y;
        count++;
      }
    }
    return count > 0 ? { x: sx / count, y: sy / count } : fallback;
  }

  function findFreePosition(node: Entity, placed: any[], links: any[], anchor: { x: number; y: number }): { x: number; y: number } {
    const radii = [110, 150, 190, 235, 285, 340];
    let best = anchor;
    let bestScore = -Infinity;
    for (const radius of radii) {
      for (let angle = 0; angle < 360; angle += 12) {
        const rad = (angle * Math.PI) / 180;
        const x = anchor.x + Math.cos(rad) * radius;
        const y = anchor.y + Math.sin(rad) * radius;

        let nearestNode = Infinity;
        for (const other of placed) {
          const d = Math.hypot(x - other.x, y - other.y) - nodeRadius(other);
          if (d < nearestNode) nearestNode = d;
        }

        let nearestEdge = Infinity;
        for (const link of links) {
          const s = link.source;
          const t = link.target;
          if (typeof s.x !== 'number' || typeof t.x !== 'number') continue;
          const d = distanceToSegment(x, y, s.x, s.y, t.x, t.y) - nodeRadius(node) * 0.6;
          if (d < nearestEdge) nearestEdge = d;
        }

        const score = Math.min(nearestNode, nearestEdge * 1.2) - radius * 0.05;
        if (score > bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }
    }
    return best;
  }

  function drawEgo() {
    const center = focus;
    if (!graphEl || !center) return;

    simulation?.stop();
    d3.select(graphEl).selectAll('svg').remove();

    const width = graphEl.clientWidth || 800;
    const height = graphEl.clientHeight || 600;

    const { nodes, links } = buildEgo(center);

    // Reuse cached world coordinates so existing objects stay put.
    const focusPos = positionCache.get(center.id) ?? { x: 0, y: 0 };
    for (const node of nodes as any[]) {
      node.vx = 0;
      node.vy = 0;
      node.fx = null;
      node.fy = null;
    }
    (center as any).x = focusPos.x;
    (center as any).y = focusPos.y;
    (center as any).fx = focusPos.x;
    (center as any).fy = focusPos.y;

    const placed: any[] = [center as any];
    const unplaced: any[] = [];
    for (const node of nodes as any[]) {
      if (node.id === center.id) continue;
      const cached = positionCache.get(node.id);
      if (cached) {
        node.x = cached.x;
        node.y = cached.y;
        placed.push(node);
      } else {
        unplaced.push(node);
      }
    }

    // New nodes are dropped into the emptiest spot next to their neighbour so
    // their lines don't land on top of existing ones.
    for (const node of unplaced) {
      const anchor = anchorFor(node, links, focusPos);
      const pos = findFreePosition(node, placed, links, anchor);
      node.x = pos.x;
      node.y = pos.y;
      placed.push(node);
    }

    const svg = d3.select(graphEl)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g');
    svgG = g;

    const linkColor = '#999';
    const memberColor = '#bbb';

    g.append('defs').append('marker')
      .attr('id', 'ego-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 26)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', linkColor);

    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke-width', 1.5)
      .attr('stroke', (d: any) => d.kind === 'member' ? memberColor : linkColor)
      .attr('stroke-dasharray', (d: any) => d.kind === 'member' ? '4 2' : null)
      .attr('marker-end', (d: any) => d.kind === 'member' ? null : 'url(#ego-arrow)');

    const relationshipLinks = links.filter((l: any) => l.kind === 'relationship');
    g.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(relationshipLinks)
      .enter().append('text')
      .attr('dx', 8)
      .attr('dy', -6)
      .style('font-size', '10px')
      .style('fill', linkColor)
      .text((d: any) => d.type.name);

    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .style('cursor', 'pointer')
      .on('click', (_event: any, d: any) => {
        if (dragMoved) return;
        setFocus(d);
      })
      .call(d3.drag<SVGGElement, any>()
        .filter((d: any) => d.id !== center.id)
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any);

    const personNodes = node.filter((d: any) => d instanceof Person);

    personNodes.append('circle')
      .attr('r', 21)
      .attr('fill', '#fff')
      .attr('stroke', (d: any) => d.id === center.id ? '#0d6efd' : '#dee2e6')
      .attr('stroke-width', (d: any) => d.id === center.id ? 3 : 1);

    personNodes.append('image')
      .attr('href', (d: any) => d.thumbnailPhoto || './whobody.png')
      .attr('x', -20)
      .attr('y', -20)
      .attr('width', 40)
      .attr('height', 40)
      .style('clip-path', 'circle(50%)');

    personNodes.append('text')
      .attr('dx', 27)
      .attr('dy', 5)
      .style('font-size', '15px')
      .style('paint-order', 'stroke')
      .style('stroke', '#fff')
      .style('stroke-width', '3px')
      .style('stroke-linejoin', 'round')
      .text((d: any) => d.name);

    const groupNodes = node.filter((d: any) => d instanceof GroupNode);
    const groupText = groupNodes.append('text')
      .attr('dy', 5)
      .style('font-size', '10px')
      .style('text-anchor', 'middle')
      .text((d: any) => d.relationshipType.name);

    groupText.each(function (this: SVGTextElement) {
      const bbox = this.getBBox();
      const parent = this.parentNode as Element | null;
      if (!parent) return;
      const isFocus = (d3.select(this).datum() as any).id === center.id;
      d3.select(parent).insert('rect', 'text')
        .attr('x', bbox.x - 6)
        .attr('y', bbox.y - 4)
        .attr('width', bbox.width + 12)
        .attr('height', bbox.height + 8)
        .attr('rx', 6)
        .attr('fill', 'white')
        .attr('stroke', isFocus ? '#0d6efd' : '#dee2e6')
        .attr('stroke-width', isFocus ? 2 : 1);
    });

    // Keep the previous camera transform, then smoothly pan so the new focus is centered.
    const k = currentTransform.k;
    const target = d3.zoomIdentity
      .translate(width / 2 - k * focusPos.x, height / 2 - k * focusPos.y)
      .scale(k);
    svg.call(zoomBehavior);
    if (framed) {
      svg.call(zoomBehavior.transform, currentTransform);
      svg.transition().duration(500).ease(d3.easeCubicOut).call(zoomBehavior.transform as any, target);
    } else {
      currentTransform = target;
      svg.call(zoomBehavior.transform, target);
      framed = true;
    }

    simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links as any).id((d: any) => d.id)
        .distance((d: any) => d.kind === 'member' ? 100 : 180))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('collide', d3.forceCollide().radius((d: any) => (d instanceof Person ? 26 : 36)))
      .force('x', d3.forceX(focusPos.x).strength(0.05))
      .force('y', d3.forceY(focusPos.y).strength(0.05))
      .force('radial', d3.forceRadial(170, focusPos.x, focusPos.y).strength(0.05))
      .alpha(0.25)
      .alphaDecay(0.04)
      .velocityDecay(0.4);

    simulation.on('tick', ticked);
    (simulation.force('link') as any).links(links);

    ticked();
  }

  function ticked() {
    if (!svgG) return;
    svgG.selectAll<SVGLineElement, any>('.links line')
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y);

    svgG.selectAll<SVGTextElement, any>('.link-labels text')
      .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
      .attr('y', (d: any) => (d.source.y + d.target.y) / 2);

    svgG.selectAll<SVGGElement, any>('.nodes g')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`)
      .each((d: any) => {
        positionCache.set(d.id, { x: d.x, y: d.y });
      });
  }

  function dragstarted(event: d3.D3DragEvent<SVGGElement, any, any>, d: any) {
    dragMoved = false;
    if (!event.active) simulation?.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event: d3.D3DragEvent<SVGGElement, any, any>, d: any) {
    if (event.dx !== 0 || event.dy !== 0) dragMoved = true;
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event: d3.D3DragEvent<SVGGElement, any, any>, d: any) {
    if (!event.active) simulation?.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  function pickerItemLabel(entity: Entity): string {
    return entity instanceof GroupNode ? `${entity.name} (群组)` : entity.name;
  }
</script>

<Container fluid>
  <div class="explore-header">
    {#if history.length > 0}
      <Button color="light" size="sm" onclick={goBack} title="返回上一个焦点" aria-label="返回">
        <i class="bi bi-arrow-left"></i>
      </Button>
    {/if}
    <div class="focus-title">
      {#if focus}
        <span class="fw-bold">{focus.name}</span>
        {#if focus instanceof GroupNode}
          <span class="badge text-bg-secondary ms-1">群组</span>
        {/if}
      {:else}
        <span class="text-muted">关系探索</span>
      {/if}
    </div>
    <Button color="outline-secondary" size="sm" class="text-nowrap" title="查看全员关系图" onclick={() => navigate('/relationship-graph')}>
      <i class="bi bi-diagram-3"></i> 全员关系
    </Button>
    <Button color="secondary" size="sm" onclick={openPicker} title="选择关注对象">
      <i class="bi bi-search"></i>
    </Button>
  </div>

  <div class="graph-wrapper">
    <div bind:this={graphEl} class="graph"></div>
    {#if !focus}
      <div class="placeholder">
        <i class="bi bi-diagram-2" style="font-size: 3rem;"></i>
        <p class="mt-3 text-muted">选择一个人员或群组开始探索</p>
        <Button color="primary" onclick={openPicker}>选择关注对象</Button>
      </div>
    {/if}
  </div>

  <div class="legend">
    <span><span class="legend-line solid"></span> 直接关系</span>
    <span><span class="legend-line dashed"></span> 群组成员</span>
    <span class="text-muted">点击节点切换焦点</span>
  </div>

  <Modal isOpen={pickerOpen} toggle={() => pickerOpen = false}>
    <ModalHeader toggle={() => pickerOpen = false}>选择关注对象</ModalHeader>
    <ModalBody>
      <Input
        type="search"
        placeholder="搜索姓名…"
        value={pickerSearch}
        oninput={(e) => pickerSearch = (e.target as HTMLInputElement).value}
      />
      <div class="picker-list">
        {#each pickerOptions as option (option.id)}
          <button class="picker-item" onclick={() => setFocus(option)}>
            {#if option instanceof Person}
              <img
                src={option.thumbnailPhoto || './whobody.png'}
                alt={option.name}
                width="36"
                height="36"
                class="rounded-circle me-2"
                style="object-fit: cover;"
              />
            {:else}
              <i class="bi bi-people me-2"></i>
            {/if}
            <span>{pickerItemLabel(option)}</span>
          </button>
        {/each}
        {#if pickerOptions.length === 0}
          <div class="text-center text-muted py-3">未找到匹配对象</div>
        {/if}
      </div>
    </ModalBody>
  </Modal>
</Container>

<style>
  .explore-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    min-height: 32px;
  }

  .focus-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .graph-wrapper {
    position: relative;
  }

  .graph {
    border: 1px solid #ccc;
    border-radius: 4px;
    overflow: hidden;
    width: 100%;
    height: 80vh;
    min-height: 460px;
    background: #fff;
  }

  .placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #6c757d;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-top: 8px;
    font-size: 12px;
    color: #495057;
  }

  .legend-line {
    display: inline-block;
    width: 24px;
    height: 0;
    vertical-align: middle;
    border-top: 2px solid #999;
    margin-right: 4px;
  }

  .legend-line.dashed {
    border-top: 2px dashed #bbb;
  }

  .picker-list {
    margin-top: 12px;
    max-height: 50vh;
    overflow-y: auto;
  }

  .picker-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 8px 4px;
    border: none;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .picker-item:hover {
    background: rgba(13, 110, 253, 0.06);
  }
</style>
