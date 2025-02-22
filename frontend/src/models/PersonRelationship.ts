export class Person {
  name: string;
  photo: string | null;
  birthYear: string;
  contact: string;
  notes: string;

  constructor(name: string, photo: string | null = null, birthYear: string = '', contact: string = '', notes: string = '') {
    this.name = name;
    this.photo = photo;
    this.birthYear = birthYear;
    this.contact = contact;
    this.notes = notes;
  }

  static load(data: any): Person {
    return new Person(data.name, data.photo, data.birthYear, data.contact, data.notes);
  }

  save(): any {
    return {
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
}

export class RelationshipType {
  source: string;
  target: string | null;
  name: string;

  constructor(source: string, target: string | null = null) {
    this.source = source;
    this.target = target;
    this.name = target ? `${source} - ${target}` : source;
  }

  static load(data: any): RelationshipType {
    return new RelationshipType(data.source, data.target);
  }

  save(): any {
    return {
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
}

export class Relationship {
  person1: Person;
  person2: Person;
  relationshipType: RelationshipType;

  constructor(person1: Person, person2: Person, relationshipType: RelationshipType) {
    this.person1 = person1;
    this.person2 = person2;
    this.relationshipType = relationshipType;
  }

  static load(data: any): Relationship {
    const person1 = Person.load(data.person1);
    const person2 = Person.load(data.person2);
    const relationshipType = RelationshipType.load(data.relationshipType);
    return new Relationship(person1, person2, relationshipType);
  }

  save(): any {
    return {
      person1: this.person1.save(),
      person2: this.person2.save(),
      relationshipType: this.relationshipType.save()
    };
  }

  static loadFromLocalStorage(): Relationship[] {
    const data = JSON.parse(localStorage.getItem('relationships') || '[]');
    return data.map((item: any) => Relationship.load(item));
  }

  static saveToLocalStorage(relationships: Relationship[]): void {
    localStorage.setItem('relationships', JSON.stringify(relationships.map(rel => rel.save())));
  }
}
