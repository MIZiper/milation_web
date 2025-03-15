import { v4 as uuidv4 } from 'uuid';

class IndexedDBHelper {
  static dbName = 'MilationDB';
  static dbVersion = 3;

  static openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(IndexedDBHelper.dbName, IndexedDBHelper.dbVersion);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains('people')) {
          db.createObjectStore('people', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('relationshipTypes')) {
          db.createObjectStore('relationshipTypes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('relationships')) {
          db.createObjectStore('relationships', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('originalPhotos')) {
          db.createObjectStore('originalPhotos');
        }
        if (!db.objectStoreNames.contains('groupNodes')) {
          db.createObjectStore('groupNodes', { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static async saveData(storeName: string, data: any): Promise<void> {
    const db = await IndexedDBHelper.openDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    store.put(data);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  static async loadData(storeName: string): Promise<any[]> {
    const db = await IndexedDBHelper.openDB();
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  static async deleteData(storeName: string, key: string): Promise<void> {
    const db = await IndexedDBHelper.openDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    store.delete(key);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  static async saveBlobData(storeName: string, key: string, blob: Blob): Promise<void> {
    const db = await IndexedDBHelper.openDB();
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    store.put(blob, key);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  static async loadBlobData(storeName: string, key: string): Promise<Blob | null> {
    const db = await IndexedDBHelper.openDB();
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  static async loadDataWithPagination(storeName: string, offset: number, limit: number): Promise<{ results: any[], totalCount: number }> {
    const db = await IndexedDBHelper.openDB();
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.openCursor();
      const results: any[] = [];
      let count = 0;
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          if (count >= offset && results.length < limit) {
            results.push(cursor.value);
          }
          count++;
          cursor.continue();
        } else {
          resolve({ results, totalCount: count });
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

interface Entity {
  id: string;
  name: string;
}

export class Person implements Entity {
  id: string;
  name: string;
  photo: string | null;
  thumbnailPhoto: string | null;
  birthYear: string;
  contact: string;
  notes: string;
  timestamp: string;
  histories: Person[];

  constructor(id: string, name: string, thumbnailPhoto: string | null = null, birthYear: string = '', contact: string = '', notes: string = '', timestamp: string = new Date().toISOString(), histories: Person[] = [], photo: string | null = null) {
    this.id = id;
    this.name = name;
    this.photo = photo;
    this.thumbnailPhoto = thumbnailPhoto;
    this.birthYear = birthYear;
    this.contact = contact;
    this.notes = notes;
    this.timestamp = timestamp;
    this.histories = histories;
  }

  static create(name: string, thumbnailPhoto: string | null = null, birthYear: string = '', contact: string = '', notes: string = ''): Person {
    return new Person(uuidv4(), name, thumbnailPhoto, birthYear, contact, notes);
  }

  static load(data: any): Person {
    if (data.histories) {
      data.histories = data.histories.map((history: any) => Person.load(history));
    } else {
      data.histories = [];
    }
    return new Person(data.id, data.name, data.thumbnailPhoto, data.birthYear, data.contact, data.notes, data.timestamp, data.histories, data.photo);
  }

  save(): any {
    return {
      id: this.id,
      name: this.name,
      photo: this.photo,
      thumbnailPhoto: this.thumbnailPhoto,
      birthYear: this.birthYear,
      contact: this.contact,
      notes: this.notes,
      timestamp: this.timestamp,
      histories: this.histories.map(history => history.save()),
    };
  }

  static loadFromLocalStorage(): Person[] {
    const data = JSON.parse(localStorage.getItem('people') || '[]');
    return data.map((item: any) => Person.load(item));
  }

  static saveToLocalStorage(people: Person[]): void {
    localStorage.setItem('people', JSON.stringify(people.map(person => person.save())));
  }

  static async loadFromIndexedDB(): Promise<Person[]> {
    const data = await IndexedDBHelper.loadData('people');
    return data.map((item: any) => Person.load(item));
  }

  static async saveToIndexedDB(people: Person[]): Promise<void> {
    for (const person of people) {
      await IndexedDBHelper.saveData('people', person.save());
    }
  }

  static async getById(id: string): Promise<Person | null> {
    const db = await IndexedDBHelper.openDB();
    const transaction = db.transaction('people', 'readonly');
    const store = transaction.objectStore('people');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ? Person.load(request.result) : null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveToIndexedDB(): Promise<void> {
    const data = this.save();
    await IndexedDBHelper.saveData('people', data);
  }

  static async deleteFromIndexedDB(id: string): Promise<void> {
    await IndexedDBHelper.deleteData('people', id);
    await IndexedDBHelper.deleteData('originalPhotos', id);
  }

  async saveOriginalPhoto(photo: Blob, key: string): Promise<void> {
    await IndexedDBHelper.saveBlobData('originalPhotos', key, photo);
  }

  static async loadOriginalPhoto(id: string): Promise<Blob | null> {
    return await IndexedDBHelper.loadBlobData('originalPhotos', id);
  }

  static async createThumbnail(photo: Blob): Promise<string> {
    return new Promise((resolve) => {
      const img = document.createElement('img');
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const maxSize = 200; // Set the maximum size for the thumbnail
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxSize) {
              height *= maxSize / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width *= maxSize / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg'));
        };
      };
      reader.readAsDataURL(photo);
    });
  }

  static async loadFromIndexedDBWithPagination(offset: number, limit: number): Promise<{ people: Person[], totalCount: number }> {
    const { results, totalCount } = await IndexedDBHelper.loadDataWithPagination('people', offset, limit);
    return { people: results.map((item: any) => Person.load(item)), totalCount };
  }
}

export class RelationshipType {
  id: string;
  source: string;
  target: string | null;
  name: string;

  constructor(id: string, source: string, target: string | null = null) {
    this.id = id;
    this.source = source;
    this.target = target;
    this.name = target ? `${source} - ${target}` : source;
  }

  static create(source: string, target: string | null = null): RelationshipType {
    return new RelationshipType(uuidv4(), source, target);
  }

  static load(data: any): RelationshipType {
    return new RelationshipType(data.id, data.source, data.target);
  }

  save(): any {
    return {
      id: this.id,
      source: this.source,
      target: this.target,
    };
  }

  static loadFromLocalStorage(): RelationshipType[] {
    const data = JSON.parse(localStorage.getItem('relationshipTypes') || '[]');
    return data.map((item: any) => RelationshipType.load(item));
  }

  static saveToLocalStorage(relationshipTypes: RelationshipType[]): void {
    localStorage.setItem('relationshipTypes', JSON.stringify(relationshipTypes.map(type => type.save())));
  }

  static async loadFromIndexedDB(): Promise<RelationshipType[]> {
    const data = await IndexedDBHelper.loadData('relationshipTypes');
    return data.map((item: any) => RelationshipType.load(item));
  }

  static async saveToIndexedDB(relationshipTypes: RelationshipType[]): Promise<void> {
    for (const type of relationshipTypes) {
      await IndexedDBHelper.saveData('relationshipTypes', type.save());
    }
  }

  static async getById(id: string): Promise<RelationshipType | null> {
    const db = await IndexedDBHelper.openDB();
    const transaction = db.transaction('relationshipTypes', 'readonly');
    const store = transaction.objectStore('relationshipTypes');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ? RelationshipType.load(request.result) : null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveToIndexedDB(): Promise<void> {
    await IndexedDBHelper.saveData('relationshipTypes', this.save());
  }

  static async deleteFromIndexedDB(id: string): Promise<void> {
    await IndexedDBHelper.deleteData('relationshipTypes', id);
  }
}

export class GroupNode implements Entity {
  id: string;
  name: string;
  members: Person[];
  relationshipType: RelationshipType;

  constructor(id: string, members: Person[], relationshipType: RelationshipType) {
    this.id = id;
    this.members = members;
    this.relationshipType = relationshipType;
    const memberNames = members.slice(0, 2).map(member => member.name).join(', ');
    this.name = `${relationshipType.name} [${memberNames}, ...]`;
  }

  static create(members: Person[], relationshipType: RelationshipType): GroupNode {
    return new GroupNode(uuidv4(), members, relationshipType);
  }

  save(): any {
    return {
      id: this.id,
      members: this.members.map(member => member.id),
      relationshipTypeId: this.relationshipType.id
    };
  }

  static async load(data: any): Promise<GroupNode> {
    const members = await Promise.all(data.members.map((id: string) => Person.getById(id)));
    const relationshipType = await RelationshipType.getById(data.relationshipTypeId);

    if (!relationshipType) {
      throw new Error('Invalid group node data');
    }

    return new GroupNode(data.id, members.filter(member => member !== null) as Person[], relationshipType);
  }

  static async loadFrom(data: any, people: Person[], relationshipTypes: RelationshipType[]): Promise<GroupNode> {
    const members = data.members.map((id: string) => people.find(person => person.id === id));
    const relationshipType = relationshipTypes.find(type => type.id === data.relationshipTypeId);

    if (!relationshipType) {
      throw new Error('Invalid group node data');
    }

    return new GroupNode(data.id, members.filter(member => member !== undefined) as Person[], relationshipType);
  }

  async saveToIndexedDB(): Promise<void> {
    await IndexedDBHelper.saveData('groupNodes', this.save());
  }

  static async loadFromIndexedDB(): Promise<GroupNode[]> {
    const data = await IndexedDBHelper.loadData('groupNodes');
    return Promise.all(data.map((item: any) => GroupNode.load(item)));
  }

  static async loadFromIndexedDBWith(people: Person[], relationshipTypes: RelationshipType[]): Promise<GroupNode[]> {
    const data = await IndexedDBHelper.loadData('groupNodes');
    return Promise.all(data.map((item: any) => GroupNode.loadFrom(item, people, relationshipTypes)));
  }

  static async deleteFromIndexedDB(id: string): Promise<void> {
    await IndexedDBHelper.deleteData('groupNodes', id);
  }

  static async getById(id: string): Promise<GroupNode | null> {
    const db = await IndexedDBHelper.openDB();
    const transaction = db.transaction('groupNodes', 'readonly');
    const store = transaction.objectStore('groupNodes');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result ? GroupNode.load(request.result) : null);
      request.onerror = () => reject(request.error);
    });
  }
}

export class Relationship {
  id: string;
  sourceEntity: Entity;
  targetEntity: Entity;
  relationshipType: RelationshipType;
  source: string; // Add source property for D3 compatibility
  target: string; // Add target property for D3 compatibility

  constructor(id: string, sourceEntity: Entity, targetEntity: Entity, relationshipType: RelationshipType) {
    this.id = id;
    this.sourceEntity = sourceEntity;
    this.targetEntity = targetEntity;
    this.relationshipType = relationshipType;
    this.source = sourceEntity.id; // Initialize source
    this.target = targetEntity.id; // Initialize target
  }

  static create(sourceEntity: Entity, targetEntity: Entity, relationshipType: RelationshipType): Relationship | GroupNode {
    if (!relationshipType.target && targetEntity instanceof Person && sourceEntity instanceof Person) {
      return GroupNode.create([sourceEntity, targetEntity], relationshipType);
    } else {
      return new Relationship(uuidv4(), sourceEntity, targetEntity, relationshipType);
    }
  }

  static async load(data: any): Promise<Relationship> {
    const sourceEntity = await Person.getById(data.sourceEntityId) || await GroupNode.getById(data.sourceEntityId);
    const targetEntity = await Person.getById(data.targetEntityId) || await GroupNode.getById(data.targetEntityId);
    const relationshipType = await RelationshipType.getById(data.relationshipTypeId);

    if (!sourceEntity || !targetEntity || !relationshipType) {
      throw new Error('Invalid relationship data');
    }

    return new Relationship(data.id, sourceEntity, targetEntity, relationshipType);
  }

  static async loadFrom(data: any, people: Person[], groups: GroupNode[], relationshipTypes: RelationshipType[]): Promise<Relationship> {
    const sourceEntity = people.find(person => person.id === data.sourceEntityId) || groups.find(group => group.id === data.sourceEntityId);
    const targetEntity = people.find(person => person.id === data.targetEntityId) || groups.find(group => group.id === data.targetEntityId);
    const relationshipType = relationshipTypes.find(type => type.id === data.relationshipTypeId);

    if (!sourceEntity || !targetEntity || !relationshipType) {
      throw new Error('Invalid relationship data');
    }

    return new Relationship(data.id, sourceEntity, targetEntity, relationshipType);
  }

  save(): any {
    return {
      id: this.id,
      sourceEntityId: this.sourceEntity.id,
      targetEntityId: this.targetEntity.id,
      relationshipTypeId: this.relationshipType.id
    };
  }

  static loadFromLocalStorage(): Relationship[] {
    const data = JSON.parse(localStorage.getItem('relationships') || '[]');
    return data.map((item: any) => Relationship.load(item));
  }

  static saveToLocalStorage(relationships: Relationship[]): void {
    localStorage.setItem('relationships', JSON.stringify(relationships.map(rel => rel.save())));
  }

  static async loadFromIndexedDB(): Promise<Relationship[]> {
    const data = await IndexedDBHelper.loadData('relationships');
    return Promise.all(data.map((item: any) => Relationship.load(item)));
  }

  static async loadFromIndexedDBWith(people: Person[], groups: GroupNode[], relationshipTypes: RelationshipType[]): Promise<Relationship[]> {
    const data = await IndexedDBHelper.loadData('relationships');
    return Promise.all(data.map((item: any) => Relationship.loadFrom(item, people, groups, relationshipTypes)));
  }

  static async saveToIndexedDB(relationships: Relationship[]): Promise<void> {
    for (const rel of relationships) {
      await IndexedDBHelper.saveData('relationships', rel.save());
    }
  }

  async saveToIndexedDB(): Promise<void> {
    await IndexedDBHelper.saveData('relationships', this.save());
  }

  static async deleteFromIndexedDB(id: string): Promise<void> {
    await IndexedDBHelper.deleteData('relationships', id);
  }
}
