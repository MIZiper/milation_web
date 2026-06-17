<script lang="ts">
  import { Person } from '../models/PersonRelationship';
  import { Container, Button, Input, FormGroup, Label, Modal, ModalHeader, ModalBody, ModalFooter } from '@sveltestrap/sveltestrap';
  import { onMount } from 'svelte';

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

  onMount(async () => {
    people = await Person.loadFromIndexedDB();
  });

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

  function editPerson(idx: number) {
    editIndex = idx;
    person = new Person(
      people[idx].id,
      people[idx].name,
      people[idx].thumbnailPhoto,
      people[idx].birthYear,
      people[idx].contact,
      people[idx].notes,
      people[idx].timestamp,
      [...people[idx].histories],
      people[idx].photo
    );
    newPhoto = null;
    photoPreview = person.thumbnailPhoto;
    nameError = '';
    formValid = true;
    dialog = true;
  }

  async function deletePerson(idx: number) {
    const p = people.splice(idx, 1)[0];
    await Person.deleteFromIndexedDB(p.id);
    if (p.photo) {
      await Person.deleteOriginalPhoto(p.photo);
    }
    for (const history of p.histories) {
      if (history.photo) {
        await Person.deleteOriginalPhoto(history.photo);
      }
    }
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

  function viewHistory(idx: number) {
    const p = people[idx];
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

  <div class="list-group list-group-flush">
    {#each people as p, idx (p.id)}
      <div class="list-group-item hover-item">
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
              <Button color="light" size="sm" onclick={() => viewHistory(idx)}>
                <i class="bi bi-clock-history"></i>
              </Button>
            {/if}
            <Button color="light" size="sm" onclick={() => editPerson(idx)}>
              <i class="bi bi-pencil"></i>
            </Button>
            <Button color="light" size="sm" onclick={() => deletePerson(idx)}>
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
    {/if}
  </div>
</Container>

<style>
  .img-btn {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
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
