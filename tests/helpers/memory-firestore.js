import { randomUUID } from 'node:crypto';

function clone(value) {
  if (value === undefined) return undefined;
  return structuredClone(value);
}

class Snapshot {
  constructor(ref, value) {
    this.ref = ref;
    this.id = ref.id;
    this.exists = value !== undefined;
    this._value = clone(value);
  }
  data() { return clone(this._value); }
}

class DocumentReference {
  constructor(store, collectionName, id) {
    this.store = store;
    this.collectionName = collectionName;
    this.id = id;
    this.path = `${collectionName}/${id}`;
  }
  async get() { return new Snapshot(this, this.store._get(this.path)); }
  async create(data) {
    if (this.store._get(this.path) !== undefined) throw Object.assign(new Error('Already exists'), { code: 6 });
    this.store._set(this.path, data);
  }
  async set(data, options = {}) {
    this.store._set(this.path, options.merge ? { ...(this.store._get(this.path) || {}), ...clone(data) } : data);
  }
  async update(data) {
    const current = this.store._get(this.path);
    if (current === undefined) throw new Error(`Missing document ${this.path}`);
    this.store._set(this.path, { ...current, ...clone(data) });
  }
  async delete() { this.store._delete(this.path); }
}

class Query {
  constructor(store, collectionName, filters = [], max = Infinity) {
    this.store = store;
    this.collectionName = collectionName;
    this.filters = filters;
    this.max = max;
  }
  where(field, op, value) { return new Query(this.store, this.collectionName, [...this.filters, [field, op, value]], this.max); }
  limit(max) { return new Query(this.store, this.collectionName, this.filters, max); }
  async get() {
    const prefix = `${this.collectionName}/`;
    const docs = [...this.store.data.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .filter(([, value]) => this.filters.every(([field, op, expected]) => {
        if (op === '==') return value[field] === expected;
        if (op === 'in') return expected.includes(value[field]);
        return false;
      }))
      .slice(0, this.max)
      .map(([path, value]) => new Snapshot(new DocumentReference(this.store, this.collectionName, path.slice(prefix.length)), value));
    return { docs, size: docs.length, empty: docs.length === 0 };
  }
}

class CollectionReference extends Query {
  doc(id = randomUUID()) { return new DocumentReference(this.store, this.collectionName, id); }
  async add(data) { const ref = this.doc(); await ref.create(data); return ref; }
}

class WriteBatch {
  constructor(store) { this.store = store; this.writes = []; }
  set(ref, data, options) { this.writes.push(['set', ref, clone(data), options]); return this; }
  create(ref, data) { this.writes.push(['create', ref, clone(data)]); return this; }
  update(ref, data) { this.writes.push(['update', ref, clone(data)]); return this; }
  delete(ref) { this.writes.push(['delete', ref]); return this; }
  async commit() {
    for (const [kind, ref] of this.writes) {
      if (kind === 'create' && this.store._get(ref.path) !== undefined) throw new Error(`Already exists: ${ref.path}`);
      if (kind === 'update' && this.store._get(ref.path) === undefined) throw new Error(`Missing document: ${ref.path}`);
    }
    for (const [kind, ref, data, options] of this.writes) {
      if (kind === 'set') this.store._set(ref.path, options?.merge ? { ...(this.store._get(ref.path) || {}), ...data } : data);
      if (kind === 'create') this.store._set(ref.path, data);
      if (kind === 'update') this.store._set(ref.path, { ...this.store._get(ref.path), ...data });
      if (kind === 'delete') this.store._delete(ref.path);
    }
    return this.writes.length;
  }
}

class Transaction {
  constructor(store) { this.store = store; this.writes = []; }
  async get(ref) {
    if (ref instanceof Query) return ref.get();
    return new Snapshot(ref, this.store._get(ref.path));
  }
  create(ref, data) { this.writes.push(['create', ref, clone(data)]); return this; }
  set(ref, data, options) { this.writes.push(['set', ref, clone(data), options]); return this; }
  update(ref, data) { this.writes.push(['update', ref, clone(data)]); return this; }
  delete(ref) { this.writes.push(['delete', ref]); return this; }
  commit() {
    // Validate all writes before applying any, approximating Firestore atomic commit.
    for (const [kind, ref] of this.writes) {
      if (kind === 'create' && this.store._get(ref.path) !== undefined) throw Object.assign(new Error('Already exists'), { code: 6 });
      if (kind === 'update' && this.store._get(ref.path) === undefined) throw new Error(`Missing document ${ref.path}`);
    }
    for (const [kind, ref, data, options] of this.writes) {
      if (kind === 'create') this.store._set(ref.path, data);
      if (kind === 'set') this.store._set(ref.path, options?.merge ? { ...(this.store._get(ref.path) || {}), ...data } : data);
      if (kind === 'update') this.store._set(ref.path, { ...this.store._get(ref.path), ...data });
      if (kind === 'delete') this.store._delete(ref.path);
    }
  }
}

export class MemoryFirestore {
  constructor() { this.data = new Map(); this._queue = Promise.resolve(); }
  _get(path) { return this.data.has(path) ? clone(this.data.get(path)) : undefined; }
  _set(path, value) { this.data.set(path, clone(value)); }
  _delete(path) { this.data.delete(path); }
  collection(name) { return new CollectionReference(this, name); }
  batch() { return new WriteBatch(this); }
  async runTransaction(callback) {
    let release;
    const previous = this._queue;
    this._queue = new Promise(resolve => { release = resolve; });
    await previous;
    try {
      const tx = new Transaction(this);
      const result = await callback(tx);
      tx.commit();
      return result;
    } finally { release(); }
  }
}
