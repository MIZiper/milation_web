<script lang="ts">
  import { untrack } from 'svelte';
  import * as d3 from 'd3';
  import { Person, RelationshipType, Relationship, GroupNode } from '../models/PersonRelationship';
  import { exportShare } from '../models/ShareTransfer';
  import { saveAs } from 'file-saver';
  import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Input } from '@sveltestrap/sveltestrap';

  type Entity = Person | GroupNode;

  let { open = $bindable() }: { open: boolean } = $props();

  let people: Person[] = $state([]);
  let relationshipTypes: RelationshipType[] = $state([]);
  let groups: GroupNode[] = $state([]);
  let relationships: Relationship[] = $state([]);

  let activated: Set<string> = $state(new Set());
  let loading = $state(false);
  let exporting = $state(false);
  let error = $state('');
  let search = $state('');

  let graphEl: HTMLDivElement;
  let svgEl: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  let svgG: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  let simulation: d3.Simulation<any, any> | null = null;
  let dragMoved = false;

  const positionCache = new Map<string, { x: number; y: number }>();
  let currentTransform: d3.ZoomTransform = d3.zoomIdentity;
  let framed = false;
  let pendingCenterId: string | null = null;
  const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.3, 3])
    .on('zoom', (event) => {
      currentTransform = event.transform;
      if (svgG) svgG.attr('transform', event.transform.toString());
    });

  const collator = new Intl.Collator('zh-Hans-CN', { sensitivity: 'base' });

  let selectedCount = $derived(people.filter(person => activated.has(person.id)).length);

  let searchMatches = $derived(
    search.trim()
      ? people
          .filter(person => person.name.toLowerCase().includes(search.trim().toLowerCase()))
          .sort((a, b) => collator.compare(a.name, b.name))
          .slice(0, 12)
      : []
  );

  $effect(() => {
    if (open) {
      untrack(() => reset());
      void loadData();
    }
  });

  async function loadData() {
    loading = true;
    error = '';
    try {
      people = await Person.loadFromIndexedDB();
      relationshipTypes = await RelationshipType.loadFromIndexedDB();
      groups = await GroupNode.loadFromIndexedDBWith(people, relationshipTypes);
      relationships = await Relationship.loadFromIndexedDBWith(people, groups, relationshipTypes);
    } finally {
      loading = false;
    }
  }

  function reset() {
    activated = new Set();
    search = '';
    error = '';
    simulation?.stop();
    d3.select(graphEl).selectAll('svg').remove();
    svgEl = null;
    svgG = null;
  }

  function entityById(): Map<string, Entity> {
    const map = new Map<string, Entity>();
    for (const person of people) map.set(person.id, person);
    for (const group of groups) map.set(group.id, group);
    return map;
  }

  function buildSelection() {
    const map = entityById();
    const nodeIds = new Set<string>();
    const links: any[] = [];

    for (const id of activated) {
      const entity = map.get(id);
      if (entity) nodeIds.add(id);
    }

    for (const rel of relationships) {
      const source = rel.sourceEntity;
      const target = rel.targetEntity;
      if (activated.has(source.id) || activated.has(target.id)) {
        nodeIds.add(source.id);
        nodeIds.add(target.id);
        links.push({ source, target, kind: 'relationship', type: rel.relationshipType });
      }
    }

    for (const group of groups) {
      for (const member of group.members) {
        if (group.id === member.id) continue;
        if (activated.has(group.id) || activated.has(member.id)) {
          nodeIds.add(group.id);
          nodeIds.add(member.id);
          links.push({ source: group, target: member, kind: 'member' });
        }
      }
    }

    const nodes = [...nodeIds].map(id => map.get(id)).filter(Boolean) as Entity[];
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

  function anchorFor(node: any, links: any[]): { x: number; y: number } {
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
    return count > 0 ? { x: sx / count, y: sy / count } : { x: 0, y: 0 };
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

  function drawGraph() {
    if (!graphEl) return;

    simulation?.stop();
    d3.select(graphEl).selectAll('svg').remove();

    const width = graphEl.clientWidth || 800;
    const height = graphEl.clientHeight || 600;

    if (activated.size === 0) {
      svgEl = null;
      svgG = null;
      return;
    }

    const { nodes, links } = buildSelection();

    const linkColor = '#999';
    const memberColor = '#bbb';
    const highlight = '#0d6efd';

    const svg = d3.select(graphEl)
      .append('svg')
      .attr('width', width)
      .attr('height', height);
    svgEl = svg;

    const g = svg.append('g');
    svgG = g;

    const placed: any[] = [];
    for (const node of nodes as any[]) {
      const cached = positionCache.get(node.id);
      if (cached) {
        node.x = cached.x;
        node.y = cached.y;
      }
      node.vx = 0;
      node.vy = 0;
      node.fx = null;
      node.fy = null;
    }
    // Place nodes that have never been shown before.
    for (const node of nodes as any[]) {
      if (typeof node.x === 'number' && typeof node.y === 'number') {
        placed.push(node);
        continue;
      }
      const anchor = anchorFor(node, links);
      const pos = findFreePosition(node, placed, links, anchor);
      node.x = pos.x;
      node.y = pos.y;
      placed.push(node);
    }

    g.append('defs').append('marker')
      .attr('id', 'share-arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 26)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', linkColor);

    const bothActive = (d: any) => activated.has(d.source.id) && activated.has(d.target.id);

    g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke-width', (d: any) => bothActive(d) ? 2.5 : 1.5)
      .attr('stroke', (d: any) => bothActive(d) ? highlight : (d.kind === 'member' ? memberColor : linkColor))
      .attr('stroke-dasharray', (d: any) => d.kind === 'member' ? '4 2' : null)
      .attr('marker-end', (d: any) => d.kind === 'member' ? null : 'url(#share-arrow)');

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

    // Wide, transparent lines make edges easy to click; placed under the nodes
    // so they never block node clicks.
    g.append('g')
      .attr('class', 'link-hits')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke-width', 16)
      .attr('stroke', 'transparent')
      .style('pointer-events', 'stroke')
      .style('cursor', 'pointer')
      .on('click', (_event: any, d: any) => {
        activateLinkEndpoints(d);
      });

    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .style('cursor', 'pointer')
      .on('click', (_event: any, d: any) => {
        if (dragMoved) return;
        toggle(d.id);
      })
      .call(d3.drag<SVGGElement, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any);

    const personNodes = node.filter((d: any) => d instanceof Person);
    personNodes.append('circle')
      .attr('r', 21)
      .attr('fill', '#fff')
      .attr('stroke', (d: any) => activated.has(d.id) ? highlight : '#dee2e6')
      .attr('stroke-width', (d: any) => activated.has(d.id) ? 3 : 1);
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
      const isActive = activated.has((d3.select(this).datum() as any).id);
      d3.select(parent).insert('rect', 'text')
        .attr('x', bbox.x - 6)
        .attr('y', bbox.y - 4)
        .attr('width', bbox.width + 12)
        .attr('height', bbox.height + 8)
        .attr('rx', 6)
        .attr('fill', 'white')
        .attr('stroke', isActive ? highlight : '#dee2e6')
        .attr('stroke-width', isActive ? 2 : 1);
    });

    if (!framed) {
      const target = d3.zoomIdentity.translate(width / 2, height / 2).scale(1);
      currentTransform = target;
      svg.call(zoomBehavior);
      svg.call(zoomBehavior.transform, target);
      framed = true;
    } else {
      svg.call(zoomBehavior);
      svg.call(zoomBehavior.transform, currentTransform);
    }

    if (pendingCenterId) {
      const target = nodes.find((n: any) => n.id === pendingCenterId) as any;
      pendingCenterId = null;
      if (target) centerCameraOn(target, !framed ? false : true);
    }

    simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links as any).id((d: any) => d.id)
        .distance((d: any) => d.kind === 'member' ? 100 : 180))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('collide', d3.forceCollide().radius((d: any) => nodeRadius(d)))
      .force('x', d3.forceX(0).strength(0.03))
      .force('y', d3.forceY(0).strength(0.03))
      .alpha(0.3)
      .alphaDecay(0.04)
      .velocityDecay(0.4);

    simulation.on('tick', ticked);
    (simulation.force('link') as any).links(links);

    ticked();
  }

  function centerCameraOn(node: any, animate: boolean) {
    if (!svgEl || typeof node.x !== 'number') return;
    const width = graphEl.clientWidth || 800;
    const height = graphEl.clientHeight || 600;
    const k = currentTransform.k;
    const target = d3.zoomIdentity
      .translate(width / 2 - k * node.x, height / 2 - k * node.y)
      .scale(k);
    if (animate) {
      svgEl.transition().duration(450).ease(d3.easeCubicOut).call(zoomBehavior.transform as any, target);
    } else {
      currentTransform = target;
      svgEl.call(zoomBehavior.transform, target);
    }
  }

  function ticked() {
    if (!svgG) return;
    svgG.selectAll<SVGLineElement, any>('.links line')
      .attr('x1', (d: any) => d.source.x)
      .attr('y1', (d: any) => d.source.y)
      .attr('x2', (d: any) => d.target.x)
      .attr('y2', (d: any) => d.target.y);

    svgG.selectAll<SVGLineElement, any>('.link-hits line')
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

  function addPerson(person: Person) {
    search = '';
    if (activated.has(person.id)) {
      pendingCenterId = person.id;
      drawGraph();
      return;
    }
    pendingCenterId = person.id;
    activated = new Set([...activated, person.id]);
    drawGraph();
  }

  function toggle(id: string) {
    const next = new Set(activated);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    activated = next;
    drawGraph();
  }

  function activateLinkEndpoints(link: any) {
    const next = new Set(activated);
    let changed = false;
    for (const endpoint of [link.source, link.target]) {
      if (endpoint && !next.has(endpoint.id)) {
        next.add(endpoint.id);
        changed = true;
      }
    }
    if (changed) {
      activated = next;
      drawGraph();
    }
  }

  function clearSelection() {
    activated = new Set();
    drawGraph();
  }

  function close() {
    open = false;
  }

  async function doExport() {
    const ids = new Set(people.filter(person => activated.has(person.id)).map(person => person.id));
    if (ids.size === 0) return;
    exporting = true;
    error = '';
    try {
      const { blob, filename } = await exportShare(ids);
      saveAs(blob, filename);
      open = false;
    } catch (e) {
      error = e instanceof Error ? e.message : '导出失败';
    } finally {
      exporting = false;
    }
  }
</script>

<Modal isOpen={open} toggle={close} fullscreen>
  <ModalHeader toggle={close}>选择分享人员</ModalHeader>
  <ModalBody>
    <div class="share-select">
      <div class="toolbar">
        <div class="search-wrap">
          <Input
            type="search"
            placeholder="搜索并添加人员…"
            value={search}
            oninput={(e) => search = (e.target as HTMLInputElement).value}
            bsSize="sm"
          />
          {#if searchMatches.length > 0}
            <div class="search-results">
              {#each searchMatches as person (person.id)}
                <button class="search-item" onclick={() => addPerson(person)}>
                  <img
                    src={person.thumbnailPhoto || './whobody.png'}
                    alt={person.name}
                    width="28"
                    height="28"
                    class="rounded-circle me-2"
                    style="object-fit: cover;"
                  />
                  <span>{person.name}</span>
                  {#if activated.has(person.id)}
                    <i class="bi bi-check-lg ms-2 text-primary"></i>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
        <span class="ms-2 text-nowrap small">已选 {selectedCount} 人</span>
        <Button color="light" size="sm" onclick={clearSelection} disabled={activated.size === 0} title="清空选择">
          <i class="bi bi-x-lg"></i>
        </Button>
      </div>

      <div class="graph-wrapper">
        <div bind:this={graphEl} class="graph"></div>
        {#if activated.size === 0}
          <div class="placeholder">
            {#if loading}
              <p class="text-muted">加载中…</p>
            {:else}
              <i class="bi bi-diagram-2" style="font-size: 3rem;"></i>
              <p class="mt-3 text-muted">搜索并选择一个人开始，点击节点或连线逐步展开</p>
            {/if}
          </div>
        {/if}
      </div>

      <div class="legend">
        <span><span class="legend-dot selected"></span> 选中人员</span>
        <span><span class="legend-line solid"></span> 直接关系</span>
        <span><span class="legend-line dashed"></span> 群组成员</span>
        <span class="text-muted">点击节点或连线展开，再点取消</span>
      </div>

      {#if error}
        <div class="alert alert-danger py-2 mt-2 mb-0">{error}</div>
      {/if}
    </div>
  </ModalBody>
  <ModalFooter>
    <Button color="secondary" onclick={close} disabled={exporting}>取消</Button>
    <Button color="primary" onclick={doExport} disabled={exporting || selectedCount === 0}>
      <i class="bi bi-download"></i> 导出选中的 {selectedCount} 人
    </Button>
  </ModalFooter>
</Modal>

<style>
  .share-select {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .toolbar {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
  }

  .search-wrap {
    position: relative;
    flex: 1;
    min-width: 0;
  }

  .search-results {
    position: absolute;
    z-index: 1100;
    left: 0;
    right: 0;
    top: 100%;
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 4px;
    margin-top: 2px;
    max-height: 40vh;
    overflow-y: auto;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  }

  .search-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 6px 10px;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .search-item:hover {
    background: rgba(13, 110, 253, 0.06);
  }

  .graph-wrapper {
    position: relative;
  }

  .graph {
    border: 1px solid #ccc;
    border-radius: 4px;
    overflow: hidden;
    width: 100%;
    height: 58vh;
    min-height: 360px;
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
    pointer-events: none;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-top: 8px;
    font-size: 12px;
    color: #495057;
  }

  .legend-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    vertical-align: middle;
    margin-right: 4px;
    border: 2px solid #0d6efd;
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
</style>
