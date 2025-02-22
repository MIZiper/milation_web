<template>
  <v-app>
    <v-main>
      <router-view />
    </v-main>
    <v-bottom-navigation v-model="activeTab" grow>
      <v-btn @click="goToPersonList" :class="{ active: activeTab === 0 }">
        <v-icon>mdi-account</v-icon>
        <span>人员列表</span>
      </v-btn>
      <v-btn @click="goToRelationshipGraph" :class="{ active: activeTab === 1 }">
        <v-icon>mdi-graph</v-icon>
        <span>关系图</span>
      </v-btn>
      <v-btn @click="goToRelationshipTypeEditor" :class="{ active: activeTab === 2 }">
        <v-icon>mdi-vector-line</v-icon>
        <span>关系类型</span>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>

<script setup lang="ts">
import PersonList from './components/PersonList.vue';
import RelationshipEditor from './components/RelationshipEditor.vue';
import RelationshipGraph from './components/RelationshipGraph.vue';
import RelationshipTypeEditor from './components/RelationshipTypeEditor.vue';
import { useRouter, useRoute } from 'vue-router';
import { ref, watch } from 'vue';

const activeTab = ref(0);
const router = useRouter();
const route = useRoute();

function goToPersonList() {
  activeTab.value = 0;
  router.push('/person-list');
}

function goToRelationshipGraph() {
  activeTab.value = 1;
  router.push('/relationship-graph');
}

function goToRelationshipTypeEditor() {
  activeTab.value = 2;
  router.push('/relationship-type');
}

watch(route, (newRoute) => {
  if (newRoute.path === '/person-list') {
    document.title = '人员列表 - MILation';
    activeTab.value = 0;
  } else if (newRoute.path === '/relationship-graph') {
    document.title = '关系图 - MILation';
    activeTab.value = 1;
  } else if (newRoute.path === '/relationship-type') {
    document.title = '关系类型 - MILation';
    activeTab.value = 2;
  }
}, { immediate: true });
</script>

<style scoped>
.v-bottom-navigation .v-btn.active {
  background-color: #1976d2;
  color: white;
}
</style>
