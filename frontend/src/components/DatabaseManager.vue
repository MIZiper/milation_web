<template>
    <v-container>
        <v-card>
            <v-card-title>数据库管理</v-card-title>
            <v-card-text>
                <p>这里可以下载和上传数据库。</p>
            </v-card-text>
            <v-card-actions>
                <v-row>
                    <v-col cols="auto">
                        <v-btn variant="outlined" @click="downloadDatabase">下载数据库</v-btn>
                    </v-col>
                    <v-col>
                        <v-file-input variant="outlined" density="compact" @change="uploadDatabase" label="上传数据库"
                            accept=".zip"></v-file-input>
                    </v-col>
                </v-row>
            </v-card-actions>
        </v-card>

        <v-card class="mt-4">
            <v-card-title>删除数据库</v-card-title>
            <v-card-text>
                <p>点击下面的按钮删除数据库。</p>
            </v-card-text>
            <v-card-actions>
                <v-btn variant="outlined" color="red" @click="deleteDatabase">删除数据库</v-btn>
            </v-card-actions>
        </v-card>
    </v-container>
</template>

<script>
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Person, RelationshipType, Relationship } from '../models/PersonRelationship';

export default {
    methods: {
        async downloadDatabase() {
            const zip = new JSZip();
            const dbRequest = indexedDB.open('MilationDB', 3);

            dbRequest.onsuccess = async () => {
                const db = dbRequest.result;
                const transaction = db.transaction(['people', 'relationshipTypes', 'relationships', 'originalPhotos'], 'readonly');
                const peopleStore = transaction.objectStore('people');
                const relationshipTypesStore = transaction.objectStore('relationshipTypes');
                const relationshipsStore = transaction.objectStore('relationships');
                const photosStore = transaction.objectStore('originalPhotos');

                const people = await new Promise((resolve) => {
                    const request = peopleStore.getAll();
                    request.onsuccess = () => resolve(request.result);
                });
                const relationshipTypes = await new Promise((resolve) => {
                    const request = relationshipTypesStore.getAll();
                    request.onsuccess = () => resolve(request.result);
                });
                const relationships = await new Promise((resolve) => {
                    const request = relationshipsStore.getAll();
                    request.onsuccess = () => resolve(request.result);
                });

                zip.file('people.json', JSON.stringify(people));
                zip.file('relationshipTypes.json', JSON.stringify(relationshipTypes));
                zip.file('relationships.json', JSON.stringify(relationships));

                await new Promise((resolve) => {
                    const request = photosStore.openCursor();

                    request.onerror = function (event) {
                        console.err("error fetching data");
                    };
                    request.onsuccess = function (event) {
                        let cursor = event.target.result;
                        if (cursor) {
                            let key = cursor.primaryKey;
                            let value = cursor.value;
                            zip.file(`photos/${key}.jpg`, value);
                            cursor.continue();
                        }
                        else {
                            resolve();
                        }
                    };
                });

                const content = await zip.generateAsync({ type: 'blob' });
                saveAs(content, 'milation-database.zip');
            };
        },
        async uploadDatabase(event) {
            const file = event.target.files[0];
            if (!file) return;

            const zip = new JSZip();
            const content = await zip.loadAsync(file);

            const people = JSON.parse(await content.file('people.json').async('string'));
            const relationshipTypes = JSON.parse(await content.file('relationshipTypes.json').async('string'));
            const relationships = JSON.parse(await content.file('relationships.json').async('string'));

            const dbRequest = indexedDB.open('MilationDB', 3);

            dbRequest.onsuccess = async () => {
                const db = dbRequest.result;
                const transaction = db.transaction(['people', 'relationshipTypes', 'relationships', 'originalPhotos'], 'readwrite');
                const peopleStore = transaction.objectStore('people');
                const relationshipTypesStore = transaction.objectStore('relationshipTypes');
                const relationshipsStore = transaction.objectStore('relationships');
                const photosStore = transaction.objectStore('originalPhotos');

                await new Promise((resolve) => {
                    const request = peopleStore.clear();
                    request.onsuccess = () => resolve();
                });
                await new Promise((resolve) => {
                    const request = relationshipTypesStore.clear();
                    request.onsuccess = () => resolve();
                });
                await new Promise((resolve) => {
                    const request = relationshipsStore.clear();
                    request.onsuccess = () => resolve();
                });
                await new Promise((resolve) => {
                    const request = photosStore.clear();
                    request.onsuccess = () => resolve();
                });

                for (const person of people) {
                    await new Promise((resolve) => {
                        const request = peopleStore.put(person);
                        request.onsuccess = () => resolve();
                    });
                }
                for (const type of relationshipTypes) {
                    await new Promise((resolve) => {
                        const request = relationshipTypesStore.put(type);
                        request.onsuccess = () => resolve();
                    });
                }
                for (const relationship of relationships) {
                    await new Promise((resolve) => {
                        const request = relationshipsStore.put(relationship);
                        request.onsuccess = () => resolve();
                    });
                }

                const photoFiles = content.folder('photos').file(/.*/);
                for (const photoFile of photoFiles) {
                    const blob = await photoFile.async('blob');
                    const id = photoFile.name.split('/').pop().split('.').shift();
                    await new Promise((resolve) => {
                        // the transaction is closed, no idea why, but start a new one everytime
                        const photoTransaction = db.transaction('originalPhotos', 'readwrite');
                        const photoStore = photoTransaction.objectStore('originalPhotos');
                        const request = photoStore.put(blob, id);
                        request.onsuccess = () => resolve();
                    });
                }
            };
        },
        async deleteDatabase() {
            const dbRequest = indexedDB.open('MilationDB', 3);

            dbRequest.onsuccess = async () => {
                const db = dbRequest.result;
                const transaction = db.transaction(['people', 'relationshipTypes', 'relationships', 'originalPhotos', 'groupNodes'], 'readwrite');
                const peopleStore = transaction.objectStore('people');
                const relationshipTypesStore = transaction.objectStore('relationshipTypes');
                const relationshipsStore = transaction.objectStore('relationships');
                const photosStore = transaction.objectStore('originalPhotos');
                const groupNodesStore = transaction.objectStore('groupNodes');

                await new Promise((resolve) => {
                    const request = peopleStore.clear();
                    request.onsuccess = () => resolve();
                });
                await new Promise((resolve) => {
                    const request = relationshipTypesStore.clear();
                    request.onsuccess = () => resolve();
                });
                await new Promise((resolve) => {
                    const request = relationshipsStore.clear();
                    request.onsuccess = () => resolve();
                });
                await new Promise((resolve) => {
                    const request = photosStore.clear();
                    request.onsuccess = () => resolve();
                });
                await new Promise((resolve) => {
                    const request = groupNodesStore.clear();
                    request.onsuccess = () => resolve();
                });

                alert('数据库已删除');
            };
        }
    }
};
</script>

<style scoped></style>
