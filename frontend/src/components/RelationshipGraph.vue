<template>
  <v-container>
    <v-btn icon class="fab" @click="openRelationshipEditor" color="secondary">
      <v-icon>mdi-plus</v-icon>
    </v-btn>
    <div ref="graph" class="graph"></div>
    <RelationshipEditor
      ref="relationshipEditor"
      :people="people"
      :relationships="relationships"
      @save-relationship="addRelationship"
    />
  </v-container>
</template>

<script>
import * as d3 from 'd3';
import RelationshipEditor from './RelationshipEditor.vue';
import { RelationshipType, Person, Relationship } from '../models/PersonRelationship';

export default {
  components: {
    RelationshipEditor
  },
  data() {
    return {
      relationships: [],
      people: []
    };
  },
  async created() {
    this.people = await Person.loadFromIndexedDB();
    this.relationships = await Relationship.loadFromIndexedDB();
  },
  mounted() {
    this.drawGraph();
  },
  methods: {
    drawGraph() {
      const svg = d3.select(this.$refs.graph).append('svg')
        .attr('width', 800)
        .attr('height', 600);

      const simulation = d3.forceSimulation(this.people)
        .force('link', d3.forceLink(this.relationships).id(d => d.name))
        .force('charge', d3.forceManyBody())
        .force('center', d3.forceCenter(400, 300));

      const link = svg.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(this.relationships)
        .enter().append('line')
        .attr('stroke-width', 2)
        .attr('marker-end', d => d.directed ? 'url(#arrow)' : '');

      const node = svg.append('g')
        .attr('class', 'nodes')
        .selectAll('g')
        .data(this.people)
        .enter().append('g')
        .call(d3.drag()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended));

      node.append('image')
        .attr('xlink:href', d => d.photo || 'path/to/default/photo.png')
        .attr('x', -15)
        .attr('y', -15)
        .attr('width', 30)
        .attr('height', 30);

      node.append('text')
        .attr('dx', 20)
        .attr('dy', 5)
        .text(d => d.name);

      svg.append('defs').append('marker')
        .attr('id', 'arrow')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 15)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#000');

      simulation
        .nodes(this.people)
        .on('tick', ticked);

      simulation.force('link')
        .links(this.relationships);

      function ticked() {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);

        node.attr('transform', d => `translate(${d.x},${d.y})`);
      }

      function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }

      function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
      }

      function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
    },
    openRelationshipEditor() {
      this.$refs.relationshipEditor.openDialog();
    },
    async addRelationship(relationship) {
      this.relationships.push(relationship);
      await relationship.saveToIndexedDB();
      this.drawGraph();
    }
  }
};
</script>

<style scoped>
.graph {
  border: 1px solid #ccc;
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
