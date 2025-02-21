export class Person {
  constructor(name, photo = null, birthYear = '', contact = '', notes = '') {
    this.name = name;
    this.photo = photo;
    this.birthYear = birthYear;
    this.contact = contact;
    this.notes = notes;
  }
}

export class RelationshipType {
  constructor(source, target = null) {
    this.source = source;
    this.target = target;
    this.name = target ? `${source} - ${target}` : source;
  }
}
