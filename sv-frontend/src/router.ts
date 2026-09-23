import { createRouter } from 'sv-router';
import PersonList from './routes/PersonList.svelte';
import RelationshipGraph from './routes/RelationshipGraph.svelte';
import RelationshipExplore from './routes/RelationshipExplore.svelte';
import RelationshipTypeEditor from './routes/RelationshipTypeEditor.svelte';
import DatabaseManager from './routes/DatabaseManager.svelte';

export const { p, navigate, isActive, route } = createRouter({
  '/': PersonList,
  '/person-list': PersonList,
  '/relationship-graph': RelationshipGraph,
  '/relationship-explore': RelationshipExplore,
  '/relationship-type': RelationshipTypeEditor,
  '/setting': DatabaseManager,
});
