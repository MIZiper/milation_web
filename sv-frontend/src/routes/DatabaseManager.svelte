<script lang="ts">
  import { Container, Card, CardTitle, CardText, CardBody, CardFooter, Button, Row, Col, Input, Modal, ModalHeader, ModalBody, ModalFooter } from '@sveltestrap/sveltestrap';
  import JSZip from 'jszip';
  import { saveAs } from 'file-saver';
  import { mergeShare, type ShareSummary } from '../models/ShareTransfer';
  import ShareSelectGraph from '../components/ShareSelectGraph.svelte';

  let shareOpen = $state(false);
  let mergeBusy = $state(false);
  let mergeError = $state('');
  let mergeSummary = $state<ShareSummary | null>(null);
  let summaryOpen = $state(false);

  async function handleMerge(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    mergeBusy = true;
    mergeError = '';
    try {
      mergeSummary = await mergeShare(file);
      summaryOpen = true;
    } catch (err) {
      mergeError = err instanceof Error ? err.message : '合并失败';
    } finally {
      mergeBusy = false;
      input.value = '';
    }
  }

  async function downloadDatabase() {
    const zip = new JSZip();
    const dbRequest = indexedDB.open('MilationDB', 3);

    dbRequest.onsuccess = async () => {
      const db = dbRequest.result;
      const transaction = db.transaction(['people', 'relationshipTypes', 'relationships', 'originalPhotos', 'groupNodes'], 'readonly');
      const peopleStore = transaction.objectStore('people');
      const relationshipTypesStore = transaction.objectStore('relationshipTypes');
      const relationshipsStore = transaction.objectStore('relationships');
      const photosStore = transaction.objectStore('originalPhotos');
      const groupNodesStore = transaction.objectStore('groupNodes');

      const people = await new Promise<any[]>((resolve) => {
        const request = peopleStore.getAll();
        request.onsuccess = () => resolve(request.result);
      });
      const relationshipTypes = await new Promise<any[]>((resolve) => {
        const request = relationshipTypesStore.getAll();
        request.onsuccess = () => resolve(request.result);
      });
      const relationships = await new Promise<any[]>((resolve) => {
        const request = relationshipsStore.getAll();
        request.onsuccess = () => resolve(request.result);
      });
      const groupNodes = await new Promise<any[]>((resolve) => {
        const request = groupNodesStore.getAll();
        request.onsuccess = () => resolve(request.result);
      });

      zip.file('people.json', JSON.stringify(people));
      zip.file('relationshipTypes.json', JSON.stringify(relationshipTypes));
      zip.file('relationships.json', JSON.stringify(relationships));
      zip.file('groupNodes.json', JSON.stringify(groupNodes));

      await new Promise<void>((resolve) => {
        const request = photosStore.openCursor();
        request.onsuccess = (event: any) => {
          const cursor = event.target.result;
          if (cursor) {
            const key = cursor.primaryKey;
            const value = cursor.value;
            zip.file(`photos/${key}.jpg`, value);
            cursor.continue();
          } else {
            resolve();
          }
        };
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const date = new Date();
      const formattedDate = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
      saveAs(content, `milation-database-${formattedDate}.zip`);
    };
  }

  async function uploadDatabase(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const zip = new JSZip();
    const content = await zip.loadAsync(file);

    const people = JSON.parse(await content.file('people.json')!.async('string'));
    const relationshipTypes = JSON.parse(await content.file('relationshipTypes.json')!.async('string'));
    const relationships = JSON.parse(await content.file('relationships.json')!.async('string'));
    const groupNodes = JSON.parse(await content.file('groupNodes.json')!.async('string'));

    const dbRequest = indexedDB.open('MilationDB', 3);

    dbRequest.onsuccess = async () => {
      const db = dbRequest.result;
      const transaction = db.transaction(['people', 'relationshipTypes', 'relationships', 'originalPhotos', 'groupNodes'], 'readwrite');
      const peopleStore = transaction.objectStore('people');
      const relationshipTypesStore = transaction.objectStore('relationshipTypes');
      const relationshipsStore = transaction.objectStore('relationships');
      const photosStore = transaction.objectStore('originalPhotos');
      const groupNodesStore = transaction.objectStore('groupNodes');

      await new Promise<void>((resolve) => {
        const request = peopleStore.clear();
        request.onsuccess = () => resolve();
      });
      await new Promise<void>((resolve) => {
        const request = relationshipTypesStore.clear();
        request.onsuccess = () => resolve();
      });
      await new Promise<void>((resolve) => {
        const request = relationshipsStore.clear();
        request.onsuccess = () => resolve();
      });
      await new Promise<void>((resolve) => {
        const request = photosStore.clear();
        request.onsuccess = () => resolve();
      });
      await new Promise<void>((resolve) => {
        const request = groupNodesStore.clear();
        request.onsuccess = () => resolve();
      });

      for (const person of people) {
        await new Promise<void>((resolve) => {
          const request = peopleStore.put(person);
          request.onsuccess = () => resolve();
        });
      }
      for (const type of relationshipTypes) {
        await new Promise<void>((resolve) => {
          const request = relationshipTypesStore.put(type);
          request.onsuccess = () => resolve();
        });
      }
      for (const relationship of relationships) {
        await new Promise<void>((resolve) => {
          const request = relationshipsStore.put(relationship);
          request.onsuccess = () => resolve();
        });
      }
      for (const groupNode of groupNodes) {
        await new Promise<void>((resolve) => {
          const request = groupNodesStore.put(groupNode);
          request.onsuccess = () => resolve();
        });
      }

      const photoFiles = content.folder('photos')!.file(/.*/);
      for (const photoFile of photoFiles) {
        const blob = await photoFile.async('blob');
        const id = photoFile.name.split('/').pop()!.split('.').shift()!;
        await new Promise<void>((resolve) => {
          const photoTransaction = db.transaction('originalPhotos', 'readwrite');
          const photoStore = photoTransaction.objectStore('originalPhotos');
          const request = photoStore.put(blob, id);
          request.onsuccess = () => resolve();
        });
      }

      alert('数据库已导入');
      input.value = '';
    };
  }

  async function deleteDatabase() {
    const dbRequest = indexedDB.open('MilationDB', 3);

    dbRequest.onsuccess = async () => {
      const db = dbRequest.result;
      const transaction = db.transaction(['people', 'relationshipTypes', 'relationships', 'originalPhotos', 'groupNodes'], 'readwrite');
      const peopleStore = transaction.objectStore('people');
      const relationshipTypesStore = transaction.objectStore('relationshipTypes');
      const relationshipsStore = transaction.objectStore('relationships');
      const photosStore = transaction.objectStore('originalPhotos');
      const groupNodesStore = transaction.objectStore('groupNodes');

      await new Promise<void>((resolve) => {
        const request = peopleStore.clear();
        request.onsuccess = () => resolve();
      });
      await new Promise<void>((resolve) => {
        const request = relationshipTypesStore.clear();
        request.onsuccess = () => resolve();
      });
      await new Promise<void>((resolve) => {
        const request = relationshipsStore.clear();
        request.onsuccess = () => resolve();
      });
      await new Promise<void>((resolve) => {
        const request = photosStore.clear();
        request.onsuccess = () => resolve();
      });
      await new Promise<void>((resolve) => {
        const request = groupNodesStore.clear();
        request.onsuccess = () => resolve();
      });

      alert('数据库已删除');
    };
  }
</script>

<Container>
  <Card class="mb-4">
    <CardBody>
      <CardTitle>数据库管理</CardTitle>
      <CardText>这里可以下载和上传数据库。</CardText>
    </CardBody>
    <CardFooter>
      <Row class="align-items-center">
        <Col xs="auto">
          <Button color="secondary" onclick={downloadDatabase}>
            <i class="bi bi-download"></i> 下载数据库
          </Button>
        </Col>
        <Col>
          <Input
            type="file"
            accept=".zip"
            onchange={uploadDatabase}
            bsSize="sm"
          />
        </Col>
      </Row>
    </CardFooter>
  </Card>

  <Card class="mb-4">
    <CardBody>
      <CardTitle>分享与合并</CardTitle>
      <CardText>
        <p>选择人员导出分享文件（仅包含选中人员之间的内部关系），或合并他人分享的文件。</p>
        <p class="mb-0 text-muted small">合并只新增本地缺失的内容，不会覆盖或删除已有数据。</p>
      </CardText>
    </CardBody>
    <CardFooter>
      <Row class="align-items-center g-2">
        <Col xs="12" sm="auto">
          <Button color="secondary" onclick={() => shareOpen = true}>
            <i class="bi bi-share"></i> 导出分享
          </Button>
        </Col>
        <Col xs="12" sm>
          <Input
            type="file"
            accept=".zip"
            onchange={handleMerge}
            disabled={mergeBusy}
            bsSize="sm"
          />
        </Col>
      </Row>
      {#if mergeBusy}
        <p class="text-muted mt-2 mb-0">正在合并…</p>
      {/if}
      {#if mergeError}
        <p class="text-danger mt-2 mb-0">{mergeError}</p>
      {/if}
    </CardFooter>
  </Card>

  <Card class="mb-4">
    <CardBody>
      <CardTitle>注意事项</CardTitle>
      <CardText>
        <p>MILation网页版所有数据存储于浏览器IndexedDB中，需要自己管理。</p>
        <p>如果有清除浏览器垃圾习惯，请谨慎操作，提前测试、备份。</p>
      </CardText>
    </CardBody>
    <CardFooter>
      <Button color="secondary" href="https://github.com/MIZiper/milation_web.git" target="_blank">
        <i class="bi bi-github"></i> 查看源代码
      </Button>
    </CardFooter>
  </Card>

  <Card>
    <CardBody>
      <CardTitle>删除数据库</CardTitle>
      <CardText>点击下面的按钮删除数据库。（注意没有弹框确认步骤）</CardText>
    </CardBody>
    <CardFooter>
      <Button color="danger" onclick={deleteDatabase}>
        <i class="bi bi-trash"></i> 删除数据库
      </Button>
    </CardFooter>
  </Card>

  <ShareSelectGraph bind:open={shareOpen} />

  <Modal isOpen={summaryOpen} toggle={() => summaryOpen = false}>
    <ModalHeader toggle={() => summaryOpen = false}>合并完成</ModalHeader>
    <ModalBody>
      {#if mergeSummary}
        <ul class="mb-0">
          <li>人员：新增 {mergeSummary.people.added}，跳过 {mergeSummary.people.skipped}</li>
          <li>关系类型：新增 {mergeSummary.relationshipTypes.added}，跳过 {mergeSummary.relationshipTypes.skipped}</li>
          <li>群组：新增 {mergeSummary.groupNodes.added}，跳过 {mergeSummary.groupNodes.skipped}</li>
          <li>关系：新增 {mergeSummary.relationships.added}，跳过 {mergeSummary.relationships.skipped}</li>
          <li>照片：新增 {mergeSummary.photos.added}，跳过 {mergeSummary.photos.skipped}</li>
        </ul>
      {/if}
    </ModalBody>
    <ModalFooter>
      <Button color="primary" onclick={() => summaryOpen = false}>好</Button>
    </ModalFooter>
  </Modal>
</Container>
