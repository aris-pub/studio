import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'events';

import { isWriteFrame, isReadOnlySocket, installWriteFrameFilter } from './server.js';

// Minimal raw y-protocols frames. The first byte is the message type
// (0 = sync, 1 = awareness); for a sync message the second byte is the sync
// step (0 = SyncStep1, 1 = SyncStep2, 2 = Update). These values are < 128 so
// each is a single-byte varUint.
const SYNC_STEP1 = new Uint8Array([0, 0]);
const SYNC_STEP2 = new Uint8Array([0, 1]);
const SYNC_UPDATE = new Uint8Array([0, 2]);
const AWARENESS = new Uint8Array([1, 0]);
const AUTH = new Uint8Array([2]);

describe('isWriteFrame', () => {
  it('treats SyncStep1 and non-sync control frames as reads', () => {
    expect(isWriteFrame(SYNC_STEP1)).toBe(false);
    expect(isWriteFrame(AUTH)).toBe(false);
  });

  it('treats SyncStep2, Update and Awareness as writes', () => {
    expect(isWriteFrame(SYNC_STEP2)).toBe(true);
    expect(isWriteFrame(SYNC_UPDATE)).toBe(true);
    expect(isWriteFrame(AWARENESS)).toBe(true);
  });

  it('accepts a Node Buffer as well as a Uint8Array', () => {
    expect(isWriteFrame(Buffer.from([0, 2]))).toBe(true); // update
    expect(isWriteFrame(Buffer.from([0, 0]))).toBe(false); // step1
  });

  it('drops anything it cannot decode (fail closed for read-only)', () => {
    expect(isWriteFrame(new Uint8Array([]))).toBe(true);
    expect(isWriteFrame('not a buffer')).toBe(true);
    expect(isWriteFrame(null)).toBe(true);
  });
});

describe('isReadOnlySocket', () => {
  it('is false for write roles and true for everything else', () => {
    expect(isReadOnlySocket({ _authRole: 'OWNER' })).toBe(false);
    expect(isReadOnlySocket({ _authRole: 'EDITOR' })).toBe(false);
    expect(isReadOnlySocket({ _authRole: 'backend' })).toBe(false);
    expect(isReadOnlySocket({ _authRole: 'COMMENTER' })).toBe(true);
    expect(isReadOnlySocket({ _authRole: undefined })).toBe(true);
  });
});

describe('installWriteFrameFilter', () => {
  it('delivers read frames but drops write frames from the wrapped listener', () => {
    const ws = new EventEmitter();
    installWriteFrameFilter(ws);

    const received = [];
    ws.on('message', (data) => received.push(data));

    ws.emit('message', SYNC_STEP1); // read -> delivered
    ws.emit('message', SYNC_UPDATE); // write -> dropped
    ws.emit('message', AWARENESS); // write -> dropped
    ws.emit('message', AUTH); // read -> delivered

    expect(received).toEqual([SYNC_STEP1, AUTH]);
  });

  it('leaves non-message listeners untouched', () => {
    const ws = new EventEmitter();
    installWriteFrameFilter(ws);

    const onClose = vi.fn();
    ws.on('close', onClose);
    ws.emit('close');

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
