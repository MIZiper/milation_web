<script lang="ts">
  import { Router } from 'sv-router';
  import { isActive, navigate, p, route } from './router';
  import { Styles } from '@sveltestrap/sveltestrap';

  let activeTab = $state(0);

  $effect(() => {
    const path = route.pathname;
    if (path === '/person-list' || path === '/') {
      activeTab = 0;
      document.title = '人员列表 - MILation';
    } else if (path === '/relationship-graph') {
      activeTab = 1;
      document.title = '关系图 - MILation';
    } else if (path === '/relationship-type') {
      activeTab = 2;
      document.title = '关系类型 - MILation';
    } else if (path === '/setting') {
      activeTab = 3;
      document.title = '设置 - MILation';
    }
  });
</script>

<Styles />

<div class="app-container">
  <Router />
</div>

<nav class="bottom-nav">
  <button class="bottom-nav-btn" class:active={activeTab === 0} onclick={() => navigate('/person-list')}>
    <i class="bi bi-person"></i>
    <span>人员列表</span>
  </button>
  <button class="bottom-nav-btn" class:active={activeTab === 1} onclick={() => navigate('/relationship-graph')}>
    <i class="bi bi-diagram-3"></i>
    <span>关系图</span>
  </button>
  <button class="bottom-nav-btn" class:active={activeTab === 2} onclick={() => navigate('/relationship-type')}>
    <i class="bi bi-arrow-left-right"></i>
    <span>关系类型</span>
  </button>
  <button class="bottom-nav-btn" class:active={activeTab === 3} onclick={() => navigate('/setting')}>
    <i class="bi bi-gear"></i>
    <span>设置</span>
  </button>
</nav>

<style>
  .app-container {
    padding-bottom: 70px;
  }

  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-around;
    background: #fff;
    border-top: 1px solid #dee2e6;
    height: 56px;
    z-index: 1000;
  }

  .bottom-nav-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    color: rgba(0, 0, 0, 0.6);
    cursor: pointer;
    padding: 4px 0;
    font-size: 12px;
    transition: color 0.2s, background-color 0.2s;
  }

  .bottom-nav-btn i {
    font-size: 20px;
    margin-bottom: 2px;
  }

  .bottom-nav-btn.active {
    color: #fff;
    background-color: #0d6efd;
  }
</style>
