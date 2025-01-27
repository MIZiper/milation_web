<template>
  <v-container>
    <v-btn @click="addRelationship">添加关系</v-btn>
    <div ref="graph" class="graph"></div>
  </v-container>
</template>

<script>
import * as d3 from 'd3';

export default {
  data() {
    return {
      relationships: JSON.parse(localStorage.getItem('relationships') || '[]'),
      people: JSON.parse(localStorage.getItem('people') || '[]')
    };
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
        .attr('stroke-width', 2);

      const node = svg.append('g')
        .attr('class', 'nodes')
        .selectAll('circle')
        .data(this.people)
        .enter().append('circle')
        .attr('r', 5)
        .attr('fill', 'blue')
        .call(d3.drag()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended));

      node.append('title')
        .text(d => d.name);

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

        node
          .attr('cx', d => d.x)
          .attr('cy', d => d.y);
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
    addRelationship() {
      // Logic to add a new relationship
    }
  }
};
</script>

<style>
.graph {
  border: 1px solid #ccc;
}
</style>
