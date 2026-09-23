import { createRouter } from 'sv-router';
import PersonList from './routes/PersonList.svelte';
import RelationshipGraph from './routes/RelationshipGraph.svelte';
import RelationshipExplore from './routes/RelationshipExplore.svelte';
import RelationshipTypeEditor from './routes/RelationshipTypeEditor.svelte';
import DatabaseManager from './routes/DatabaseManager.svelte';

const routes = {
  '/': PersonList,
  '/person-list': PersonList,
  '/relationship-graph': RelationshipGraph,
  '/relationship-explore': RelationshipExplore,
  '/relationship-type': RelationshipTypeEditor,
  '/setting': DatabaseManager,
};

// Keep the client router in sync with Vite's `base` when deployed under a
// subfolder. `BASE_URL` is '/' locally, in which case no base is set.
const base = import.meta.env.BASE_URL;

export const { p, navigate, isActive, route } = createRouter(
  routes,
  base && base !== '/' ? { base } : {},
);
