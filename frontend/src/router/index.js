import { createRouter, createWebHistory } from 'vue-router';
import PersonList from '../components/PersonList.vue';
import RelationshipGraph from '../components/RelationshipGraph.vue';

const routes = [
  { path: '/', redirect: '/person-list' },
  { path: '/person-list', component: PersonList },
  { path: '/relationship-graph', component: RelationshipGraph }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

export default router;
