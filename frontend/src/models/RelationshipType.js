export default class RelationshipType {
  constructor(source, target = null) {
    this.source = source;
    this.target = target;
    this.name = target ? `${source}-${target}` : source;
  }
}
