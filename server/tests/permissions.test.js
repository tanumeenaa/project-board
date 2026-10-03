import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canManageBoard,
  canWriteBoard,
  getBoardRole,
  requireBoardPermission
} from '../src/middleware/permissions.js';

test('admin role has all permissions', () => {
  assert.equal(getBoardRole({ role: 'admin' }), 'admin');
  assert.equal(canManageBoard({ role: 'admin' }), true);
  assert.equal(canWriteBoard({ role: 'admin' }), true);
});

test('viewer cannot write to the board', () => {
  assert.equal(canWriteBoard({ role: 'viewer' }), false);
});

test('member can write board content', () => {
  assert.equal(canWriteBoard({ role: 'member' }), true);
});

test('permission middleware denies viewers and allows members to write', () => {
  const createResponse = () => ({
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  });

  const viewerResponse = createResponse();
  let viewerPassed = false;
  requireBoardPermission('member')(
    { board: { members: [{ user: 'viewer-1', role: 'viewer' }] }, user: { _id: 'viewer-1' } },
    viewerResponse,
    () => { viewerPassed = true; }
  );

  assert.equal(viewerPassed, false);
  assert.equal(viewerResponse.statusCode, 403);

  const memberResponse = createResponse();
  let memberPassed = false;
  requireBoardPermission('member')(
    { board: { members: [{ user: { _id: 'member-1' }, role: 'member' }] }, user: { _id: 'member-1' } },
    memberResponse,
    () => { memberPassed = true; }
  );

  assert.equal(memberPassed, true);
  assert.equal(memberResponse.statusCode, null);
});
