<template>
  <v-container>
    <v-btn icon class="fab" @click="openRelationshipEditor" color="secondary">
      <v-icon>mdi-plus</v-icon>
    </v-btn>
    <RelationshipEditor ref="relationshipEditor" :people="people" :relationshipTypes="relationshipTypes"
      :relationships="relationships" @relationship-added="onRelationshipAdded" />
    <v-row>
      <v-col>
        <div ref="graph" class="graph"></div>
      </v-col>
      <v-col cols="auto">
        <v-list>
          <v-list-item density="compact" v-for="(relationship, index) in relationships" :key="index">
            <v-row>
              <v-col>
                <v-list-item-title>
                  {{ relationship.source.name }} - {{ relationship.target.name }} ({{ relationship.relationshipType.name }})
                </v-list-item-title>
              </v-col>
              <v-col cols="auto">
                <v-list-item-action>
                  <v-btn density="compact" variant="text" @click="deleteRelationship(index)">
                    <v-icon>mdi-delete</v-icon>
                  </v-btn>
                </v-list-item-action>
              </v-col>
            </v-row>
          </v-list-item>
        </v-list>
      </v-col>
    </v-row>
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
      people: [],
      relationshipTypes: [],
      relationships: [],
      svg: null,
      simulation: null,
    };
  },
  async created() {
    this.people = await Person.loadFromIndexedDB();
    this.relationshipTypes = await RelationshipType.loadFromIndexedDB();
    this.relationships = await Relationship.loadFromIndexedDBWith(this.people, this.relationshipTypes);
    this.drawGraph();
  },
  methods: {
    drawGraph() {
      if (!this.svg) {
        this.svg = d3.select(this.$refs.graph).append('svg')
          .attr('width', 800)
          .attr('height', 600);
      }

      this.simulation = d3.forceSimulation(this.people)
        .force('link', d3.forceLink(this.relationships).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(400, 300));

      const linkColor = '#999'; // Define the link color

      const link = this.svg.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(this.relationships)
        .enter().append('line')
        .attr('stroke-width', 1.5)
        .attr('stroke', linkColor) // Set the stroke color for visibility
        .attr('marker-end', 'url(#arrow)');

      const linkText = this.svg.append('g')
        .attr('class', 'link-labels')
        .selectAll('text')
        .data(this.relationships)
        .enter().append('text')
        .attr('dx', 10)
        .attr('dy', -5)
        .style('font-size', '10px')
        .style('fill', linkColor) // Set the text color to match the link color
        .text(d => d.relationshipType.name);

      const node = this.svg.append('g')
        .attr('class', 'nodes')
        .selectAll('g')
        .data(this.people)
        .enter().append('g')
        .call(d3.drag()
          .on('start', this.dragstarted)
          .on('drag', this.dragged)
          .on('end', this.dragended));

      node.append('image')
        .attr('xlink:href', d => d.thumbnailPhoto || '/whobody.png')
        .attr('x', -15)
        .attr('y', -15)
        .attr('width', 30)
        .attr('height', 30);

      node.append('text')
        .attr('dx', 20)
        .attr('dy', 5)
        .text(d => d.name);

      this.svg.append('defs').append('marker')
        .attr('id', 'arrow')
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 22) // Adjust refX to move the arrow outside the target node
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', linkColor); // Set the arrow color to match the link color

      this.simulation
        .nodes(this.people)
        .on('tick', this.ticked);

      this.simulation.force('link')
        .links(this.relationships);
    },
    ticked() {
      const link = this.svg.selectAll('.links line');
      const linkText = this.svg.selectAll('.link-labels text');
      const node = this.svg.selectAll('.nodes g');

      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      linkText
        .attr('x', d => (d.source.x + d.target.x) / 2)
        .attr('y', d => (d.source.y + d.target.y) / 2);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    },
    dragstarted(event, d) {
      if (!event.active) this.simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    },
    dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    },
    dragended(event, d) {
      if (!event.active) this.simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    },
    onRelationshipAdded(newRelationship) {
      this.relationships.push(newRelationship);
      this.updateGraph();
    },
    updateGraph() {
      // Clear the existing graph elements
      this.svg.selectAll('*').remove();
      // Redraw the graph with the updated data
      this.drawGraph();
    },
    async deleteRelationship(index) {
      const relationship = this.relationships[index];
      await Relationship.deleteFromIndexedDB(relationship.id);
      this.relationships.splice(index, 1);
      this.updateGraph();
    },
    openRelationshipEditor() {
      this.$refs.relationshipEditor.openDialog();
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
