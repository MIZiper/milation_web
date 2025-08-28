<template>
  <v-container>
    <v-btn icon class="fab" @click="openRelationshipEditor" color="secondary">
      <v-icon>mdi-plus</v-icon>
    </v-btn>
    <v-btn icon class="fab-drawer" @click="drawer = !drawer" color="primary">
      <v-icon>mdi-menu</v-icon>
    </v-btn>
    <RelationshipEditor ref="relationshipEditor" :people="people" :relationshipTypes="relationshipTypes"
      :relationships="relationships" :groups="groups" @relationship-added="onRelationshipAdded" />
    <GroupEditor ref="groupEditor" :people="people" @group-updated="onGroupUpdated" />

    <div ref="graph" class="graph"></div>
    
    <v-navigation-drawer
      v-model="drawer"
      app
      :width="350"
      temporary
    >
      <v-list>
        <v-list-subheader>独立关系</v-list-subheader>
        <v-list-item density="compact" v-for="(relationship, index) in relationships" :key="index">
          <v-row>
            <v-col cols="8">
              <v-list-item-title class="ellipsis">
                {{ relationship.source.name }} - {{ relationship.target.name }} ({{ relationship.relationshipType.name }})
              </v-list-item-title>
            </v-col>
            <v-spacer></v-spacer>
            <v-col>
              <v-list-item-action>
                <v-btn density="compact" variant="text" @click="deleteRelationship(index)">
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </v-list-item-action>
            </v-col>
          </v-row>
        </v-list-item>
        <v-list-subheader>群组关系</v-list-subheader>
        <v-list-item density="compact" v-for="(group, index) in groups" :key="index">
          <v-row>
            <v-col cols="6">
              <v-list-item-title class="ellipsis">
                {{ group.name }} ({{ group.members.length }} 人)
              </v-list-item-title>
              <v-list-item-subtitle class="ellipsis">
                {{ group.members.map(member => member.name).join(', ') }}
              </v-list-item-subtitle>
            </v-col>
            <v-spacer></v-spacer>
            <v-col>
              <v-list-item-action>
                <v-btn density="compact" variant="text" @click="editGroup(index)">
                  <v-icon>mdi-pencil</v-icon>
                </v-btn>
                <v-btn density="compact" variant="text" @click="deleteGroup(index)">
                  <v-icon>mdi-delete</v-icon>
                </v-btn>
              </v-list-item-action>
            </v-col>
          </v-row>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
  </v-container>
</template>

<script>
import * as d3 from 'd3';
import RelationshipEditor from './RelationshipEditor.vue';
import GroupEditor from './GroupEditor.vue';
import { RelationshipType, Person, Relationship, GroupNode } from '../models/PersonRelationship';

export default {
  components: {
    RelationshipEditor,
    GroupEditor
  },
  data() {
    return {
      people: [],
      relationshipTypes: [],
      relationships: [],
      groups: [],
      svg: null,
      simulation: null,
      drawer: false,
    };
  },
  async created() {
    this.people = await Person.loadFromIndexedDB();
    this.relationshipTypes = await RelationshipType.loadFromIndexedDB();
    this.groups = await GroupNode.loadFromIndexedDBWith(this.people, this.relationshipTypes);
    this.relationships = await Relationship.loadFromIndexedDBWith(this.people, this.groups, this.relationshipTypes);
    this.drawGraph();
  },
  methods: {
    drawGraph() {
      if (!this.svg) {
        this.svg = d3.select(this.$refs.graph).append('svg')
          .attr('width', '100%')
          .attr('height', '720')
          .call(d3.zoom().on('zoom', (event) => {
            this.svg.attr('transform', event.transform);
          }))
          .append('g'); // Append a group element to apply zoom and pan transformations
      }

      const allEntities = [...this.people, ...this.groups];
      const allLinks = [
        ...this.relationships,
        ...this.groups.flatMap(group => group.members.map(member => ({ source: group, target: member, dashed: true })))
      ];

      this.simulation = d3.forceSimulation(allEntities)
        .force('link', d3.forceLink(allLinks).id(d => d.id)
          .distance(d => d.dashed ? 75 : 175)) // Set different distances for group-member and relationship links
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(this.$refs.graph.clientWidth / 2, this.$refs.graph.clientHeight / 2));

      const linkColor = '#999'; // Define the link color

      const link = this.svg.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(allLinks)
        .enter().append('line')
        .attr('stroke-width', 1.5)
        .attr('stroke', linkColor) // Set the stroke color for visibility
        .attr('stroke-dasharray', d => d.dashed ? '4 2' : 'none') // Make dashed lines for group-member links
        .attr('marker-end', d => d.dashed ? null : 'url(#arrow)'); // No arrow for dashed lines

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
        .data(allEntities)
        .enter().append('g')
        .call(d3.drag()
          .on('start', this.dragstarted)
          .on('drag', this.dragged)
          .on('end', this.dragended));

      node.filter(d => !(d instanceof GroupNode))
        .append('image')
        .attr('xlink:href', d => d.thumbnailPhoto || './whobody.png')
        .attr('x', -15)
        .attr('y', -15)
        .attr('width', 30)
        .attr('height', 30);

      const groupNodeText = node.filter(d => d instanceof GroupNode)
        .append('text')
        .attr('dx', 0)
        .attr('dy', 5)
        .style('font-size', '10px') // Smaller text for GroupNode
        .style('text-anchor', 'middle') // Center text for GroupNode
        .text(d => d.relationshipType.name);

      groupNodeText.each(function() {
        const bbox = this.getBBox();
        d3.select(this.parentNode).insert('rect', 'text')
          .attr('x', bbox.x - 2)
          .attr('y', bbox.y - 2)
          .attr('width', bbox.width + 4)
          .attr('height', bbox.height + 4)
          .attr('fill', 'white');
      });

      node.append('text')
        .attr('dx', d => d instanceof GroupNode ? 0 : 20)
        .attr('dy', d => d instanceof GroupNode ? 5 : 5)
        .style('font-size', d => d instanceof GroupNode ? '10px' : '15px') // Smaller text for GroupNode
        .style('text-anchor', d => d instanceof GroupNode ? 'middle' : 'start') // Center text for GroupNode
        .text(d => d instanceof GroupNode ? d.relationshipType.name : d.name);

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
        .nodes(allEntities)
        .on('tick', this.ticked);

      this.simulation.force('link')
        .links(allLinks);
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
      if (newRelationship instanceof GroupNode) {
        this.groups.push(newRelationship);
      } else {
        this.relationships.push(newRelationship);
      }
      this.updateGraph();
    },
    onGroupUpdated(updatedGroup) {
      const index = this.groups.findIndex(group => group.id === updatedGroup.id);
      if (index !== -1) {
        this.groups.splice(index, 1, updatedGroup);
      }
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
    async deleteGroup(index) {
      const group = this.groups[index];
      await GroupNode.deleteFromIndexedDB(group.id);
      this.groups.splice(index, 1);
      this.updateGraph();
    },
    editGroup(index) {
      const group = this.groups[index];
      this.$refs.groupEditor.openDialog(group);
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
  overflow: hidden; /* Ensure the graph container does not overflow */
  position: relative; /* Ensure the graph container is positioned correctly */
}

.fab {
  position: fixed;
  bottom: 72px;
  right: 16px;
  width: 56px;
  height: 56px;
  z-index: 1000;
}

.fab-drawer {
  position: fixed;
  bottom: 140px;
  right: 16px;
  width: 56px;
  height: 56px;
  z-index: 1000;
}

.ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
