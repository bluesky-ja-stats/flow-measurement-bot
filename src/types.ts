export type JetstreamEvent = JetstreamEventKindCommit | JetstreamEventKindIdentity | JetstreamEventKindAccount

export interface JetstreamEventKindCommit {
  did: string
  time_us: number
  kind: 'commit'
  commit: JetstreamEventKindCommitOperationCreate | JetstreamEventKindCommitOperationUpdate | JetstreamEventKindCommitOperationDelete
}

export interface JetstreamEventKindCommitOperationCreate {
  rev: string
  operation: 'create'
  collection: string
  rkey: string
  record: JetstreamRecord
  cid: string
}

export interface JetstreamRecord {
  $type: string
  [k: string]: any
}

export interface JetstreamEventKindCommitOperationUpdate {
  rev: string
  operation: 'update'
  collection: string
  rkey: string
  record: JetstreamRecord
  cid: string
}

export interface JetstreamEventKindCommitOperationDelete {
  rev: string
  operation: 'delete'
  collection: string
  rkey: string
}

export interface JetstreamEventKindIdentity {
  did: string
  time_us: number
  kind: 'identity'
  identity: {
    did: string
    handle: string
    seq: number
    time: string
  }
}

export interface JetstreamEventKindAccount {
  did: string
  time_us: number
  kind: 'account'
  account: {
    active: boolean
    did: string
    seq: number
    status?: string
    time: string
  }
}

export interface Cursors {
  all: number[]
  posts: {
    all: number[]
    ja: number[]
  }
  likes: {
    all: string[]
    ja: string[]
  }
}

export interface imageData {
  title: string
  buffer: Buffer
  aspectRatio: {
    width: number
    height: number
  }
}
