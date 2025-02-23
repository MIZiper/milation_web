import { v4 as uuidv4 } from 'uuid';

class IndexedDBHelper {
  static dbName = 'MilationDB';
  static dbVersion = 1;

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
}

export class Person {
  id: string;
  name: string;
  photo: string | null;
  birthYear: string;
  contact: string;
  notes: string;

  constructor(id: string, name: string, photo: string | null = null, birthYear: string = '', contact: string = '', notes: string = '') {
    this.id = id;
    this.name = name;
    this.photo = photo;
    this.birthYear = birthYear;
    this.contact = contact;
    this.notes = notes;
  }

  static create(name: string, photo: string | null = null, birthYear: string = '', contact: string = '', notes: string = ''): Person {
    return new Person(uuidv4(), name, photo, birthYear, contact, notes);
  }

  static load(data: any): Person {
    return new Person(data.id, data.name, data.photo, data.birthYear, data.contact, data.notes);
  }

  save(): any {
    return {
      id: this.id,
      name: this.name,
      photo: this.photo,
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
    const people = await Person.loadFromIndexedDB();
    return people.find(person => person.id === id) || null;
  }

  async saveToIndexedDB(): Promise<void> {
    const data = this.save();
    await IndexedDBHelper.saveData('people', data);
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
    const types = await RelationshipType.loadFromIndexedDB();
    return types.find(type => type.id === id) || null;
  }

  async saveToIndexedDB(): Promise<void> {
    await IndexedDBHelper.saveData('relationshipTypes', this.save());
  }
}

export class Relationship {
  id: string;
  person1: Person;
  person2: Person;
  relationshipType: RelationshipType;

  constructor(id: string, person1: Person, person2: Person, relationshipType: RelationshipType) {
    this.id = id;
    this.person1 = person1;
    this.person2 = person2;
    this.relationshipType = relationshipType;
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
}
