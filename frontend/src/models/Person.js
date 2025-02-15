export default class Person {
  constructor(name, photo = null, birthYear = '', contact = '', notes = '') {
    this.name = name;
    this.photo = photo;
    this.birthYear = birthYear;
    this.contact = contact;
    this.notes = notes;
  }
}
