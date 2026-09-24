import JSZip from 'jszip';
import { Person, Relationship, RelationshipType, GroupNode } from './PersonRelationship';

export const SHARE_FORMAT = 'milation-share';
export const SHARE_VERSION = 1;

export interface ShareCounts {
  people: number;
  relationshipTypes: number;
  relationships: number;
  groupNodes: number;
  photos: number;
}

export interface ShareManifest {
  format: string;
  version: number;
  createdAt: string;
  counts: ShareCounts;
  note?: string;
}

export interface ShareResult {
  blob: Blob;
  filename: string;
  counts: ShareCounts;
}

export interface ShareSummary {
  people: { added: number; skipped: number };
  relationshipTypes: { added: number; skipped: number };
  relationships: { added: number; skipped: number };
  groupNodes: { added: number; skipped: number };
  photos: { added: number; skipped: number };
}

export async function exportShare(selectedIds: Set<string>, note = ''): Promise<ShareResult> {
  if (selectedIds.size === 0) {
    throw new Error('请至少选择一名人员');
  }

  const people = await Person.loadFromIndexedDB();
  const relationshipTypes = await RelationshipType.loadFromIndexedDB();
  const groups = await GroupNode.loadFromIndexedDBWith(people, relationshipTypes);
  const relationships = await Relationship.loadFromIndexedDBWith(people, groups, relationshipTypes);

  const selectedPeople = people.filter(person => selectedIds.has(person.id));

  // Candidate groups contain at least one selected member; members are trimmed to the selection.
  const candidates = groups
    .map(group => ({
      group,
      members: group.members.filter(member => selectedIds.has(member.id)),
    }))
    .filter(candidate => candidate.members.length > 0);

  const included = new Set<string>(selectedIds);
  for (const candidate of candidates) included.add(candidate.group.id);

  // Drop groups that became too small and have no relation to any retained entity.
  const keptIds = new Set(candidates.map(candidate => candidate.group.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const candidate of candidates) {
      const groupId = candidate.group.id;
      if (!keptIds.has(groupId) || candidate.members.length >= 2) continue;
      const hasRelation = relationships.some(rel => {
        const source = rel.sourceEntity.id;
        const target = rel.targetEntity.id;
        if (source !== groupId && target !== groupId) return false;
        const other = source === groupId ? target : source;
        return selectedIds.has(other) || keptIds.has(other);
      });
      if (!hasRelation) {
        keptIds.delete(groupId);
        included.delete(groupId);
        changed = true;
      }
    }
  }

  const keptGroups = candidates.filter(candidate => keptIds.has(candidate.group.id));
  const includedRelationships = relationships.filter(
    rel => included.has(rel.sourceEntity.id) && included.has(rel.targetEntity.id),
  );

  const referencedTypeIds = new Set<string>();
  for (const rel of includedRelationships) referencedTypeIds.add(rel.relationshipType.id);
  for (const candidate of keptGroups) referencedTypeIds.add(candidate.group.relationshipType.id);
  const includedTypes = relationshipTypes.filter(type => referencedTypeIds.has(type.id));

  const zip = new JSZip();
  zip.file('people.json', JSON.stringify(selectedPeople.map(person => person.save())));
  zip.file('relationshipTypes.json', JSON.stringify(includedTypes.map(type => type.save())));
  zip.file('relationships.json', JSON.stringify(includedRelationships.map(rel => rel.save())));
  zip.file('groupNodes.json', JSON.stringify(keptGroups.map(candidate => ({
    id: candidate.group.id,
    members: candidate.members.map(member => member.id),
    relationshipTypeId: candidate.group.relationshipType.id,
  }))));

  const photoKeys = new Set<string>();
  for (const person of selectedPeople) {
    if (person.photo) photoKeys.add(person.photo);
    for (const history of person.histories) {
      if (history.photo) photoKeys.add(history.photo);
    }
  }
  let photoCount = 0;
  for (const key of photoKeys) {
    const blob = await Person.loadOriginalPhoto(key);
    if (blob) {
      zip.file(`photos/${key}.jpg`, blob);
      photoCount++;
    }
  }

  const counts: ShareCounts = {
    people: selectedPeople.length,
    relationshipTypes: includedTypes.length,
    relationships: includedRelationships.length,
    groupNodes: keptGroups.length,
    photos: photoCount,
  };
  const manifest: ShareManifest = {
    format: SHARE_FORMAT,
    version: SHARE_VERSION,
    createdAt: new Date().toISOString(),
    counts,
    note: note || undefined,
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  const blob = await zip.generateAsync({ type: 'blob' });
  const date = new Date();
  const formattedDate = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return { blob, filename: `milation-share-${formattedDate}.zip`, counts };
}

export async function mergeShare(file: File): Promise<ShareSummary> {
  const zip = new JSZip();
  const content = await zip.loadAsync(file);

  const manifestFile = content.file('manifest.json');
  if (!manifestFile) {
    throw new Error('不是有效的分享文件（缺少 manifest.json）');
  }
  const manifest = JSON.parse(await manifestFile.async('string')) as ShareManifest;
  if (manifest.format !== SHARE_FORMAT) {
    throw new Error('不是有效的分享文件');
  }

  const readJson = async (name: string): Promise<any[]> => {
    const entry = content.file(name);
    if (!entry) return [];
    return JSON.parse(await entry.async('string'));
  };

  const peopleData = await readJson('people.json');
  const typesData = await readJson('relationshipTypes.json');
  const relationshipsData = await readJson('relationships.json');
  const groupsData = await readJson('groupNodes.json');

  const localPeople = await Person.loadFromIndexedDB();
  const localTypes = await RelationshipType.loadFromIndexedDB();
  const localGroups = await GroupNode.loadFromIndexedDBWith(localPeople, localTypes);
  const localRelationships = await Relationship.loadFromIndexedDBWith(localPeople, localGroups, localTypes);

  const personMap = new Map(localPeople.map(person => [person.id, person]));
  const typeMap = new Map(localTypes.map(type => [type.id, type]));
  const groupMap = new Map(localGroups.map(group => [group.id, group]));
  const relationshipIds = new Set(localRelationships.map(rel => rel.id));

  const summary: ShareSummary = {
    people: { added: 0, skipped: 0 },
    relationshipTypes: { added: 0, skipped: 0 },
    relationships: { added: 0, skipped: 0 },
    groupNodes: { added: 0, skipped: 0 },
    photos: { added: 0, skipped: 0 },
  };

  for (const raw of typesData) {
    if (typeMap.has(raw.id)) {
      summary.relationshipTypes.skipped++;
      continue;
    }
    const type = RelationshipType.load(raw);
    await type.saveToIndexedDB();
    typeMap.set(type.id, type);
    summary.relationshipTypes.added++;
  }

  for (const raw of peopleData) {
    if (personMap.has(raw.id)) {
      summary.people.skipped++;
      continue;
    }
    const person = Person.load(raw);
    await person.saveToIndexedDB();
    personMap.set(person.id, person);
    summary.people.added++;
  }

  for (const raw of groupsData) {
    if (groupMap.has(raw.id)) {
      summary.groupNodes.skipped++;
      continue;
    }
    const type = typeMap.get(raw.relationshipTypeId);
    const members = (raw.members || [])
      .map((id: string) => personMap.get(id))
      .filter(Boolean) as Person[];
    if (!type || members.length === 0) {
      summary.groupNodes.skipped++;
      continue;
    }
    const group = new GroupNode(raw.id, members, type);
    await group.saveToIndexedDB();
    groupMap.set(group.id, group);
    summary.groupNodes.added++;
  }

  for (const raw of relationshipsData) {
    if (relationshipIds.has(raw.id)) {
      summary.relationships.skipped++;
      continue;
    }
    const source = personMap.get(raw.sourceEntityId) || groupMap.get(raw.sourceEntityId);
    const target = personMap.get(raw.targetEntityId) || groupMap.get(raw.targetEntityId);
    const type = typeMap.get(raw.relationshipTypeId);
    if (!source || !target || !type) {
      summary.relationships.skipped++;
      continue;
    }
    const relationship = new Relationship(raw.id, source, target, type);
    await relationship.saveToIndexedDB();
    relationshipIds.add(relationship.id);
    summary.relationships.added++;
  }

  const photosFolder = content.folder('photos');
  if (photosFolder) {
    for (const photoFile of photosFolder.file(/.*/)) {
      const key = photoFile.name.split('/').pop()!.split('.').shift()!;
      const existing = await Person.loadOriginalPhoto(key);
      if (existing) {
        summary.photos.skipped++;
        continue;
      }
      const blob = await photoFile.async('blob');
      await Person.saveOriginalPhotoBlob(key, blob);
      summary.photos.added++;
    }
  }

  return summary;
}
