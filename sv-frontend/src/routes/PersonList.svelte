<script lang="ts">
  import { Person, RelationshipType, Relationship, GroupNode } from '../models/PersonRelationship';
  import { Container, Button, Input, FormGroup, Label, Modal, ModalHeader, ModalBody, ModalFooter, Pagination, PaginationItem, Offcanvas, OffcanvasHeader, OffcanvasBody, ListGroup, ListGroupItem } from '@sveltestrap/sveltestrap';
  import { onMount } from 'svelte';
  import RelationshipEditor from '../components/RelationshipEditor.svelte';
  import GroupEditor from '../components/GroupEditor.svelte';

  let people: Person[] = $state([]);
  let dialog = $state(false);
  let editIndex = $state(-1);
  let person: Person = $state(Person.create('', null));
  let defaultPhoto = './whobody.png';
  let photoDialog = $state(false);
  let originalPhoto = $state('');
  let historyDialog = $state(false);
  let personHistory: Person[] = $state([]);
  let historyIndex = $state(0);
  let currentHistory = $state<Person | null>(null);
  let newPhoto: File | null = $state(null);
  let photoPreview = $state<string | null>(null);
  let formValid = $state(true);
  let nameError = $state('');

  let showTools = $state(false);
  let search = $state('');
  let sortField = $state<'name' | 'timestamp'>('timestamp');
  let sortAsc = $state(false);
  let page = $state(1);
  const pageSize = 10;
  const collator = new Intl.Collator('zh-Hans-CN', { sensitivity: 'base' });

  let relationshipTypes: RelationshipType[] = $state([]);
  let groups: GroupNode[] = $state([]);
  let relationships: Relationship[] = $state([]);
  let relDataLoaded = $state(false);
  let contextPerson = $state<Person | null>(null);
  let relDrawerOpen = $state(false);
  let relEditorOpen = $state(false);
  let groupEditorOpen = $state(false);
  let groupToEdit = $state<GroupNode | null>(null);
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  let contextDirectRelationships = $derived(
    contextPerson
      ? relationships.filter(r => r.sourceEntity.id === contextPerson!.id || r.targetEntity.id === contextPerson!.id)
      : []
  );
  let contextGroups = $derived(
    contextPerson ? groups.filter(g => g.members.some(m => m.id === contextPerson!.id)) : []
  );

  let filtered = $derived(people.filter(p => matches(p, search)));
  let sorted = $derived([...filtered].sort(comparePeople));
  let totalPages = $derived(Math.max(1, Math.ceil(sorted.length / pageSize)));
  let paged = $derived(sorted.slice((page - 1) * pageSize, page * pageSize));

  let pageNumbers = $derived.by(() => {
    const total = totalPages;
    const current = page;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < total - 1) pages.push('...');
    pages.push(total);
    return pages;
  });

  $effect(() => {
    if (page > totalPages) page = totalPages;
  });

  onMount(async () => {
    people = await Person.loadFromIndexedDB();
  });

  function matches(p: Person, query: string): boolean {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [p.name, p.contact, p.birthYear, p.notes].some(
      value => (value || '').toLowerCase().includes(needle)
    );
  }

  function comparePeople(a: Person, b: Person): number {
    const cmp = sortField === 'name'
      ? collator.compare(a.name, b.name)
      : Date.parse(a.timestamp) - Date.parse(b.timestamp);
    return sortAsc ? cmp : -cmp;
  }

  function changeSearch(value: string) {
    search = value;
    page = 1;
  }

  function changeSortField(value: string) {
    sortField = value as 'name' | 'timestamp';
    page = 1;
  }

  function toggleSortDir() {
    sortAsc = !sortAsc;
    page = 1;
  }

  function goToPage(target: number) {
    if (target < 1 || target > totalPages || target === page) return;
    page = target;
  }

  async function loadRelationshipData() {
    relationshipTypes = await RelationshipType.loadFromIndexedDB();
    groups = await GroupNode.loadFromIndexedDBWith(people, relationshipTypes);
    relationships = await Relationship.loadFromIndexedDBWith(people, groups, relationshipTypes);
    relDataLoaded = true;
  }

  async function refreshRelationshipData() {
    if (!relDataLoaded) return;
    await loadRelationshipData();
  }

  async function openPersonMenu(p: Person) {
    contextPerson = p;
    relDrawerOpen = true;
    if (!relDataLoaded) {
      await loadRelationshipData();
    }
  }

  function closePersonMenu() {
    relDrawerOpen = false;
  }

  function openContextMenu(e: MouseEvent, p: Person) {
    e.preventDefault();
    openPersonMenu(p);
  }

  function onPersonKeydown(e: KeyboardEvent, p: Person) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPersonMenu(p);
    }
  }

  function startLongPress(e: PointerEvent, p: Person) {
    if ((e.target as HTMLElement).closest('button, a, input, select')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cancelLongPress();
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      openPersonMenu(p);
    }, 500);
  }

  function cancelLongPress() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function directionLabel(rel: Relationship, p: Person): string {
    return rel.sourceEntity.id === p.id
      ? `${p.name} → ${rel.targetEntity.name}`
      : `${rel.sourceEntity.name} → ${p.name}`;
  }

  async function deleteRelationship(rel: Relationship) {
    await Relationship.deleteFromIndexedDB(rel.id);
    await refreshRelationshipData();
  }

  async function deleteGroup(group: GroupNode) {
    await GroupNode.deleteCascade(group.id);
    await refreshRelationshipData();
  }

  function editGroup(group: GroupNode) {
    groupToEdit = group;
    groupEditorOpen = true;
  }

  function createGroup() {
    groupToEdit = null;
    groupEditorOpen = true;
  }

  async function onRelationshipAdded() {
    await refreshRelationshipData();
  }

  async function onGroupSaved() {
    await refreshRelationshipData();
  }

  function newPerson() {
    editIndex = -1;
    person = Person.create('', null);
    newPhoto = null;
    photoPreview = null;
    nameError = '';
    formValid = true;
    dialog = true;
  }

  function closeDialog() {
    dialog = false;
    newPhoto = null;
    photoPreview = null;
    nameError = '';
  }

  function editPerson(p: Person) {
    const idx = people.findIndex(x => x.id === p.id);
    if (idx === -1) return;
    editIndex = idx;
    person = new Person(
      p.id,
      p.name,
      p.thumbnailPhoto,
      p.birthYear,
      p.contact,
      p.notes,
      p.timestamp,
      [...p.histories],
      p.photo
    );
    newPhoto = null;
    photoPreview = person.thumbnailPhoto;
    nameError = '';
    formValid = true;
    dialog = true;
  }

  async function deletePerson(p: Person) {
    const idx = people.findIndex(x => x.id === p.id);
    if (idx === -1) return;
    if (contextPerson?.id === p.id) {
      relDrawerOpen = false;
      contextPerson = null;
    }
    people.splice(idx, 1);
    await Person.deleteCascade(p);
    if (p.photo) {
      await Person.deleteOriginalPhoto(p.photo);
    }
    for (const history of p.histories) {
      if (history.photo) {
        await Person.deleteOriginalPhoto(history.photo);
      }
    }
    await refreshRelationshipData();
  }

  async function showOriginalPhoto(p: Person) {
    if (!p.photo) return;
    const blob = await Person.loadOriginalPhoto(p.photo);
    if (blob) {
      originalPhoto = URL.createObjectURL(blob);
      photoDialog = true;
    }
  }

  async function changePhoto(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      newPhoto = file;
      const thumbnail = await Person.createThumbnail(file);
      person.thumbnailPhoto = thumbnail;
      photoPreview = thumbnail;
    }
  }

  function validateForm(): boolean {
    if (!person.name.trim()) {
      nameError = '姓名不能为空';
      formValid = false;
      return false;
    }
    nameError = '';
    formValid = true;
    return true;
  }

  async function savePerson() {
    if (!validateForm()) return;

    if (newPhoto && !person.photo) {
      person.photo = crypto.randomUUID();
    }
    const newPerson = new Person(
      person.id,
      person.name,
      person.thumbnailPhoto,
      person.birthYear,
      person.contact,
      person.notes,
      person.timestamp,
      person.histories,
      person.photo
    );
    if (editIndex === -1) {
      people.push(newPerson);
      page = 1;
    } else {
      people[editIndex] = newPerson;
    }
    await newPerson.saveToIndexedDB();
    if (newPhoto) {
      await newPerson.saveOriginalPhoto(newPhoto, person.photo!);
      newPhoto = null;
      photoPreview = null;
    }
    dialog = false;
  }

  async function saveAsNewVersion() {
    if (!validateForm()) return;

    const previousPerson = people[editIndex];
    previousPerson.histories = [];
    person.histories = [previousPerson, ...person.histories];
    if (newPhoto) {
      person.photo = crypto.randomUUID();
    } else {
      person.photo = null;
      person.thumbnailPhoto = null;
    }
    const newPerson = new Person(
      person.id,
      person.name,
      person.thumbnailPhoto,
      person.birthYear,
      person.contact,
      person.notes,
      new Date().toISOString(),
      person.histories,
      person.photo
    );
    people[editIndex] = newPerson;
    await newPerson.saveToIndexedDB();
    if (newPhoto) {
      await newPerson.saveOriginalPhoto(newPhoto, person.photo!);
      newPhoto = null;
      photoPreview = null;
    }
    dialog = false;
  }

  function viewHistory(p: Person) {
    personHistory = p.histories;
    historyIndex = 0;
    currentHistory = personHistory.length > 0 ? personHistory[0] : null;
    historyDialog = true;
  }

  function previousHistory() {
    if (historyIndex > 0) {
      historyIndex--;
      currentHistory = personHistory[historyIndex];
    }
  }

  function nextHistory() {
    if (historyIndex < personHistory.length - 1) {
      historyIndex++;
      currentHistory = personHistory[historyIndex];
    }
  }

  function formatNotes(notes: string): string {
    return notes ? notes.replace(/\n/g, '<br>') : '';
  }
</script>

<Container fluid>
  <Button color="primary" style="position: fixed; bottom: 72px; right: 16px; width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 1000; font-size: 24px; padding: 0;" onclick={newPerson}>
    <i class="bi bi-plus-lg"></i>
  </Button>

  <Button color={showTools ? 'primary' : 'secondary'} style="position: fixed; bottom: 140px; right: 16px; width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 1000; font-size: 24px; padding: 0;" aria-label="搜索与排序" title="搜索与排序" onclick={() => showTools = !showTools}>
    <i class="bi bi-search"></i>
  </Button>

  <Modal isOpen={dialog} toggle={closeDialog}>
    <ModalHeader toggle={closeDialog}>
      {editIndex === -1 ? '添加人员' : '编辑人员'}
    </ModalHeader>
    <ModalBody>
      {#if photoPreview && typeof photoPreview === 'string'}
        <img src={photoPreview} alt="预览" class="mb-3" style="max-width: 200px; max-height: 200px;" />
      {/if}
      <FormGroup>
        <Label for="personName">姓名</Label>
        <Input
          id="personName"
          type="text"
          value={person.name}
          oninput={(e) => {
            person.name = (e.target as HTMLInputElement).value;
            nameError = '';
            formValid = true;
          }}
          invalid={!!nameError}
        />
        {#if nameError}
          <div class="invalid-feedback d-block">{nameError}</div>
        {/if}
      </FormGroup>
      <FormGroup>
        <Label for="personPhoto">
          <i class="bi bi-camera"></i> 照片
        </Label>
        <Input id="personPhoto" type="file" accept="image/*" onchange={changePhoto} />
      </FormGroup>
      <FormGroup>
        <Label for="personContact">联系方式</Label>
        <Input id="personContact" type="text" bind:value={person.contact} />
      </FormGroup>
      <FormGroup>
        <Label for="personBirthYear">出生年份</Label>
        <Input id="personBirthYear" type="text" bind:value={person.birthYear} />
      </FormGroup>
      <FormGroup>
        <Label for="personNotes">备注</Label>
        <Input id="personNotes" type="textarea" bind:value={person.notes} />
      </FormGroup>
    </ModalBody>
    <ModalFooter>
      <Button color="secondary" onclick={closeDialog}>取消</Button>
      <Button color="primary" onclick={savePerson}>保存</Button>
      {#if editIndex !== -1}
        <Button color="primary" onclick={saveAsNewVersion}>保存为新版本</Button>
      {/if}
    </ModalFooter>
  </Modal>

  <Modal isOpen={photoDialog} toggle={() => photoDialog = false} size="lg">
    <ModalBody>
      <div class="d-flex justify-content-center">
        <img src={originalPhoto} alt="原图" style="max-width: 100%; max-height: 80vh;" />
      </div>
    </ModalBody>
  </Modal>

  <Modal isOpen={historyDialog} toggle={() => historyDialog = false}>
    <ModalHeader toggle={() => historyDialog = false}>
      历史版本
    </ModalHeader>
    <ModalBody>
      {#if currentHistory}
        <div class="d-flex align-items-center">
          <Button color="link" disabled={historyIndex === 0} onclick={previousHistory}>
            <i class="bi bi-chevron-left"></i>
          </Button>
          <div class="flex-grow-1 text-center">
            {#if currentHistory.thumbnailPhoto}
              <button class="img-btn" onclick={() => currentHistory && showOriginalPhoto(currentHistory)}>
                <img
                  src={currentHistory.thumbnailPhoto}
                  alt="历史照片"
                  class="mb-3"
                  style="max-width: 200px; max-height: 200px;"
                />
              </button>
            {/if}
            <div class="fw-bold">{currentHistory.name}</div>
            <div>添加日期：{new Date(currentHistory.timestamp).toLocaleDateString()}</div>
            <div>联系方式：{currentHistory.contact}</div>
            <div>
              备注：
              {@html formatNotes(currentHistory.notes)}
            </div>
          </div>
          <Button color="link" disabled={historyIndex === personHistory.length - 1} onclick={nextHistory}>
            <i class="bi bi-chevron-right"></i>
          </Button>
        </div>
      {/if}
    </ModalBody>
  </Modal>

  {#if showTools}
    <div class="tools-panel">
      <div class="tools-panel-content">
        <Input
          type="search"
          placeholder="搜索姓名、联系方式、备注…"
          value={search}
          oninput={(e) => changeSearch((e.target as HTMLInputElement).value)}
        />
        <div class="d-flex align-items-center gap-2 mt-2">
          <select
            class="form-select"
            value={sortField}
            onchange={(e) => changeSortField((e.target as HTMLSelectElement).value)}
          >
            <option value="timestamp">按添加时间</option>
            <option value="name">按姓名</option>
          </select>
          <Button
            color="secondary"
            title={sortAsc ? '升序' : '降序'}
            aria-label={sortAsc ? '升序' : '降序'}
            onclick={toggleSortDir}
          >
            <i class={sortAsc ? 'bi bi-sort-down-alt' : 'bi bi-sort-down'}></i>
          </Button>
        </div>
      </div>
    </div>
  {/if}

  <div class="list-group list-group-flush">
    {#each paged as p (p.id)}
      <div
        class="list-group-item hover-item"
        role="button"
        tabindex="0"
        aria-label={`${p.name} 的关系`}
        onkeydown={(e) => onPersonKeydown(e, p)}
        oncontextmenu={(e) => openContextMenu(e, p)}
        onpointerdown={(e) => startLongPress(e, p)}
        onpointerup={cancelLongPress}
        onpointercancel={cancelLongPress}
        onpointerleave={cancelLongPress}
      >
        <div class="d-flex">
          <button class="img-btn" onclick={() => showOriginalPhoto(p)}>
          <img
            src={p.thumbnailPhoto || defaultPhoto}
            alt={p.name}
            width="100"
            height="100"
            class="me-3 rounded"
            style="object-fit: cover; cursor: pointer;"
          />
        </button>
          <div class="flex-grow-1">
            <div class="fw-bold">
              <i class="bi bi-person"></i> {p.name}
            </div>
            <div class="d-flex flex-wrap gap-3 mt-1 small text-muted">
              {#if p.birthYear}
                <div><i class="bi bi-calendar"></i> {p.birthYear}</div>
              {/if}
              {#if p.contact}
                <div><i class="bi bi-link"></i> {p.contact}</div>
              {/if}
              {#if p.timestamp}
                <div><i class="bi bi-clock"></i> {new Date(p.timestamp).toLocaleDateString()}</div>
              {/if}
            </div>
            {@html formatNotes(p.notes)}
          </div>
          <div class="hover-actions">
            {#if p.histories.length > 0}
              <Button color="light" size="sm" onclick={() => viewHistory(p)}>
                <i class="bi bi-clock-history"></i>
              </Button>
            {/if}
            <Button color="light" size="sm" onclick={() => editPerson(p)}>
              <i class="bi bi-pencil"></i>
            </Button>
            <Button color="light" size="sm" onclick={() => deletePerson(p)}>
              <i class="bi bi-trash"></i>
            </Button>
          </div>
        </div>
      </div>
    {/each}
    {#if people.length === 0}
      <div class="list-group-item text-center text-muted py-5">
        <i class="bi bi-people" style="font-size: 3rem;"></i>
        <p class="mt-3">暂无人员，点击右下角 + 添加</p>
      </div>
    {:else if paged.length === 0}
      <div class="list-group-item text-center text-muted py-5">
        <i class="bi bi-search" style="font-size: 3rem;"></i>
        <p class="mt-3">未找到匹配人员</p>
      </div>
    {/if}
  </div>

  {#if totalPages > 1}
    <Pagination class="justify-content-center mt-3 mb-4">
      <PaginationItem disabled={page === 1}>
        <button class="page-link" onclick={() => goToPage(page - 1)}>上一页</button>
      </PaginationItem>
      {#each pageNumbers as n}
        {#if n === '...'}
          <PaginationItem disabled>
            <span class="page-link">…</span>
          </PaginationItem>
        {:else}
          <PaginationItem active={n === page}>
            <button class="page-link" onclick={() => goToPage(n)}>{n}</button>
          </PaginationItem>
        {/if}
      {/each}
      <PaginationItem disabled={page === totalPages}>
        <button class="page-link" onclick={() => goToPage(page + 1)}>下一页</button>
      </PaginationItem>
    </Pagination>
  {/if}

  <Offcanvas isOpen={relDrawerOpen} toggle={closePersonMenu} placement="bottom">
    <OffcanvasHeader toggle={closePersonMenu}>
      {contextPerson?.name ?? ''} 的关系
    </OffcanvasHeader>
    <OffcanvasBody>
      <h6 class="text-muted">直接关系</h6>
      <ListGroup flush>
        {#each contextDirectRelationships as rel (rel.id)}
          <ListGroupItem>
            <div class="d-flex justify-content-between align-items-center">
              <div class="me-2">
                <div>{directionLabel(rel, contextPerson!)}</div>
                <small class="text-muted">{rel.relationshipType.name}</small>
              </div>
              <Button color="light" size="sm" onclick={() => deleteRelationship(rel)}>
                <i class="bi bi-trash"></i>
              </Button>
            </div>
          </ListGroupItem>
        {/each}
        {#if contextDirectRelationships.length === 0}
          <ListGroupItem class="text-center text-muted">暂无直接关系</ListGroupItem>
        {/if}
      </ListGroup>

      <h6 class="text-muted mt-3">所在群组</h6>
      <ListGroup flush>
        {#each contextGroups as group (group.id)}
          <ListGroupItem>
            <div class="d-flex justify-content-between align-items-center">
              <div class="me-2">
                <div>{group.name}</div>
                <small class="text-muted text-truncate d-block">
                  {group.members.map(m => m.name).join(', ')}
                </small>
              </div>
              <div class="d-flex">
                <Button color="light" size="sm" onclick={() => editGroup(group)}>
                  <i class="bi bi-pencil"></i>
                </Button>
                <Button color="light" size="sm" onclick={() => deleteGroup(group)}>
                  <i class="bi bi-trash"></i>
                </Button>
              </div>
            </div>
          </ListGroupItem>
        {/each}
        {#if contextGroups.length === 0}
          <ListGroupItem class="text-center text-muted">不在任何群组</ListGroupItem>
        {/if}
      </ListGroup>

      <div class="d-flex gap-2 mt-3">
        <Button color="primary" onclick={() => relEditorOpen = true}>
          <i class="bi bi-plus-lg"></i> 以此人添加关系
        </Button>
        <Button color="secondary" onclick={createGroup}>
          <i class="bi bi-people"></i> 以此人创建群组
        </Button>
      </div>
    </OffcanvasBody>
  </Offcanvas>

  <RelationshipEditor
    bind:open={relEditorOpen}
    people={people}
    relationshipTypes={relationshipTypes}
    groups={groups}
    initialSourceId={contextPerson?.id ?? ''}
    onRelationshipAdded={onRelationshipAdded}
  />

  <GroupEditor
    bind:open={groupEditorOpen}
    people={people}
    group={groupToEdit}
    relationshipTypes={relationshipTypes}
    initialMemberIds={contextPerson ? [contextPerson.id] : []}
    onGroupUpdated={onGroupSaved}
  />
</Container>

<style>
  .img-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .tools-panel {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 56px;
    z-index: 999;
    background: #fff;
    border-top: 1px solid rgba(0, 0, 0, 0.12);
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.08);
    padding: 12px 16px;
  }

  .tools-panel-content {
    padding-right: 72px;
  }

  .hover-item {
    position: relative;
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    min-height: 100px;
  }

  .hover-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    opacity: 0;
    transition: opacity 0.3s;
    display: flex;
    gap: 4px;
  }

  .hover-item:hover .hover-actions {
    opacity: 1;
  }
</style>
