import { describe, it, expect, beforeEach } from 'vitest';
import { PermissionMiddleware, McpCaller } from '../src/permission-middleware';
import { PermissionConfig } from '../src/types';

function createMockMcpCaller(userData: Record<string, unknown>): McpCaller {
  return {
    callTool: async function(category: string, method: string, args: Record<string, unknown>): Promise<unknown> {
      if (category === 'contact' && method === 'get_userlist') {
        return { userlist: userData };
      }
      return {};
    },
  };
}

var sampleUsers = [
  { userid: 'zhangsan', tags: [{ tagname: '党员' }, { tagname: '支部委员' }], position: '支部书记' },
  { userid: 'lisi',     tags: [{ tagname: '党员' }], position: '工程师' },
  { userid: 'wangwu',   tags: [], position: '群众' },
];

var sampleConfig: PermissionConfig = {
  roles: {
    '标签:支部委员': { skills: ['*'] },
    '标签:党员': { skills: ['party-vote', 'doc.get_doc_content'] },
    '岗位:支部书记': { skills: ['*'] },
  },
  defaultRole: { skills: [] },
  denyMessage: '权限不足，请联系管理员。',
};

describe('PermissionMiddleware', function() {
  var middleware: PermissionMiddleware;

  beforeEach(function() {
    middleware = new PermissionMiddleware(sampleConfig, createMockMcpCaller(sampleUsers));
  });

  it('should allow all when no config', async function() {
    var mw = new PermissionMiddleware();
    var result = await mw.check('zhangsan', 'any-skill');
    expect(result.allowed).toBe(true);
  });

  it('should allow with wildcard role', async function() {
    var result = await middleware.check('zhangsan', 'doc.create_doc');
    expect(result.allowed).toBe(true);
  });

  it('should allow with specific skill', async function() {
    var result = await middleware.check('lisi', 'party-vote');
    expect(result.allowed).toBe(true);
  });

  it('should deny skill not in role', async function() {
    var result = await middleware.check('lisi', 'doc.create_doc');
    expect(result.allowed).toBe(false);
    expect(result.denyMessage).toBe('权限不足，请联系管理员。');
  });

  it('should deny with defaultRole = empty', async function() {
    var result = await middleware.check('wangwu', 'party-vote');
    expect(result.allowed).toBe(false);
  });

  it('should match by position', async function() {
    // zhangsan has position '支部书记' which maps to '*'
    var result = await middleware.check('zhangsan', 'todo.create_todo');
    expect(result.allowed).toBe(true);
  });

  it('should support category wildcard doc.*', async function() {
    var config: PermissionConfig = {
      roles: { '标签:党员': { skills: ['doc.*'] } },
      defaultRole: { skills: [] },
    };
    var mw = new PermissionMiddleware(config, createMockMcpCaller(sampleUsers));

    var r1 = await mw.check('lisi', 'doc.create_doc');
    expect(r1.allowed).toBe(true);

    var r2 = await mw.check('lisi', 'doc.edit_doc_content');
    expect(r2.allowed).toBe(true);

    var r3 = await mw.check('lisi', 'todo.create_todo');
    expect(r3.allowed).toBe(false);
  });

  it('should allow when multiple roles match (union)', async function() {
    // zhangsan matches 3 roles: 标签:支部委员(*), 标签:党员(party-vote, doc.get), 岗位:支部书记(*)
    // union = *
    var result = await middleware.check('zhangsan', 'any-weird-skill');
    expect(result.allowed).toBe(true);
  });
});