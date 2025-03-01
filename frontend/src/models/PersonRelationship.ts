import { v4 as uuidv4 } from 'uuid';

class IndexedDBHelper {
  static dbName = 'MilationDB';
  static dbVersion = 2;

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
}

export class Person {
  id: string;
  name: string;
  photo: string | null;
  thumbnailPhoto: string | null;
  birthYear: string;
  contact: string;
  notes: string;

  constructor(id: string, name: string, thumbnailPhoto: string | null = null, birthYear: string = '', contact: string = '', notes: string = '') {
    this.id = id;
    this.name = name;
    this.photo = null;
    this.thumbnailPhoto = thumbnailPhoto;
    this.birthYear = birthYear;
    this.contact = contact;
    this.notes = notes;
  }

  static create(name: string, thumbnailPhoto: string | null = null, birthYear: string = '', contact: string = '', notes: string = ''): Person {
    return new Person(uuidv4(), name, thumbnailPhoto, birthYear, contact, notes);
  }

  static load(data: any): Person {
    return new Person(data.id, data.name, data.thumbnailPhoto, data.birthYear, data.contact, data.notes);
  }

  save(): any {
    return {
      id: this.id,
      name: this.name,
      photo: this.photo,
      thumbnailPhoto: this.thumbnailPhoto,
      birthYear: this.birthYear,
      contact: this.contact,
      notes: this.notes
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

  async saveOriginalPhoto(photo: Blob): Promise<void> {
    await IndexedDBHelper.saveBlobData('originalPhotos', this.id, photo);
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

export class Relationship {
  id: string;
  person1: Person;
  person2: Person;
  relationshipType: RelationshipType;
  source: string; // Add source property for D3 compatibility
  target: string; // Add target property for D3 compatibility

  constructor(id: string, person1: Person, person2: Person, relationshipType: RelationshipType) {
    this.id = id;
    this.person1 = person1;
    this.person2 = person2;
    this.relationshipType = relationshipType;
    this.source = person1.id; // Initialize source
    this.target = person2.id; // Initialize target
  }

  static create(person1: Person, person2: Person, relationshipType: RelationshipType): Relationship {
    return new Relationship(uuidv4(), person1, person2, relationshipType);
  }

  static async load(data: any): Promise<Relationship> {
    const person1 = await Person.getById(data.person1Id);
    const person2 = await Person.getById(data.person2Id);
    const relationshipType = await RelationshipType.getById(data.relationshipTypeId);

    if (!person1 || !person2 || !relationshipType) {
      throw new Error('Invalid relationship data');
    }

    return new Relationship(data.id, person1, person2, relationshipType);
  }

  save(): any {
    return {
      id: this.id,
      person1Id: this.person1.id,
      person2Id: this.person2.id,
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
