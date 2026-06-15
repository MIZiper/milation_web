import { createRouter } from 'sv-router';
import PersonList from './routes/PersonList.svelte';
import RelationshipGraph from './routes/RelationshipGraph.svelte';
import RelationshipTypeEditor from './routes/RelationshipTypeEditor.svelte';
import DatabaseManager from './routes/DatabaseManager.svelte';

export const { p, navigate, isActive, route } = createRouter({
  '/': PersonList,
  '/person-list': PersonList,
  '/relationship-graph': RelationshipGraph,
  '/relationship-type': RelationshipTypeEditor,
  '/setting': DatabaseManager,
});
