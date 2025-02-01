export default class Person {
  constructor(name, photo = null, contact = '', description = '') {
    this.name = name;
    this.photo = photo;
    this.contact = contact;
    this.description = description;
  }
}
