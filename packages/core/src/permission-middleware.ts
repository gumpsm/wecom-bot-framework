import { PermissionConfig, RoleEntry, SheetRoleSource } from './types';

interface CachedUserInfo {
  userId: string;
  departments: string[];   // 部门名称列表（可能为空，待集成测试确认）
  position: string;        // 岗位
  tags: string[];          // 标签列表
  fetchedAt: number;       // 缓存时间戳
}

export interface PermissionCheckResult {
  allowed: boolean;
  denyMessage?: string;
}

// 通用 MCP 调用接口（避免循环依赖 WeComMcpClient）
export interface McpCaller {
  callTool(category: string, method: string, args: Record<string, unknown>): Promise<unknown>;
}

export class PermissionMiddleware {
  private config: PermissionConfig | null;
  private mcpCaller: McpCaller | null;
  private userCache: Map<string, CachedUserInfo> = new Map();
  private cacheTtlMs = 10 * 60 * 1000; // 10 分钟
  private userListFetched = false;
  private sheetRoleCache = new Map();
  private sheetCacheTtlMs = 2 * 60 * 1000;
  private sheetIdMap = new Map();

  constructor(config?: PermissionConfig, mcpCaller?: McpCaller) {
    this.config = config || null;
    this.mcpCaller = mcpCaller || null;
  }

  setConfig(config: PermissionConfig): void {
    this.config = config;
    this.userCache.clear();
    this.userListFetched = false;
    this.sheetRoleCache.clear();
    this.sheetIdMap.clear();
  }

  setMcpCaller(mcpCaller: McpCaller): void {
    this.mcpCaller = mcpCaller;
  }

  // 检查 userId 是否有权限调用 skillName
  async check(userId: string, skillName: string): Promise<PermissionCheckResult> {
    // 未配置权限 → 所有人可调用所有技能
    if (!this.config || Object.keys(this.config.roles).length === 0) {
      return { allowed: true };
    }

    // 获取用户信息
    var userInfo = await this.getUserInfo(userId);
    if (!userInfo) {
      // 查不到用户 → 走 defaultRole
      return this.checkDefaultRole(skillName);
    }

    // 匹配角色
    var roleNames = await this.matchRolesAsync(userInfo);
    if (roleNames.length === 0) {
      return this.checkDefaultRole(skillName);
    }

    // 取所有角色的 skills 并集，检查是否包含目标 skill
    var allowedSkills = this.mergeSkills(roleNames);
    if (this.skillMatches(skillName, allowedSkills)) {
      return { allowed: true };
    }

    return {
      allowed: false,
      denyMessage: this.config.denyMessage || '抱歉，您没有权限执行此操作。',
    };
  }

  // 用户信息 → 匹配角色名列表
  private async matchRolesAsync(userInfo: CachedUserInfo): Promise<string[]> {
    var roles: string[] = [];
    var roleKeys = Object.keys(this.config!.roles);

    for (var key of roleKeys) {
      var parts = key.split(':');
      if (parts.length !== 2) continue;
      var type = parts[0];
      var value = parts[1];

      if (type === '用户' && userInfo.userId === value) {
        roles.push(key);
      } else if (type === '标签' && userInfo.tags.indexOf(value) >= 0) {
        roles.push(key);
      } else if (type === '岗位' && userInfo.position === value) {
        roles.push(key);
      } else if (type === '部门' && userInfo.departments.indexOf(value) >= 0) {
        roles.push(key);
      }
    }

        // check sheet roles
    var sheetRoles = await this.matchSheetRoles(userInfo);
    var rk = Object.keys(this.config.roles);
    for (var si = 0; si < sheetRoles.length; si++) {
      if (rk.indexOf(sheetRoles[si]) >= 0 && roles.indexOf(sheetRoles[si]) < 0) roles.push(sheetRoles[si]);
    }
    return roles;
  }// 合并多个角色的 skills（并集）
  private mergeSkills(roleNames: string[]): string[] {
    var allSkills: string[] = [];
    for (var roleName of roleNames) {
      var entry = this.config!.roles[roleName];
      if (entry && entry.skills) {
        for (var s of entry.skills) {
          if (allSkills.indexOf(s) < 0) allSkills.push(s);
        }
      }
    }
    return allSkills;
  }

  // 技能名匹配（支持通配符）
  private skillMatches(skillName: string, allowedSkills: string[]): boolean {
    for (var allowed of allowedSkills) {
      // 精确匹配
      if (allowed === skillName) return true;
      // 全通配
      if (allowed === '*') return true;
      // 品类通配: "doc.*" 匹配 "doc.create_doc"
      if (allowed.endsWith('.*') || allowed.endsWith('_*')) {
        var prefix = allowed.slice(0, -2);
        if (skillName.indexOf(prefix + '.') === 0 || skillName.indexOf(prefix + '_') === 0) return true;
      }
    }
    return false;
  }

  // defaultRole 兜底
  private checkDefaultRole(skillName: string): PermissionCheckResult {
    if (!this.config || !this.config.defaultRole) {
      return {
        allowed: false,
        denyMessage: this.config?.denyMessage || '抱歉，您没有权限执行此操作。',
      };
    }
    var skills = this.config.defaultRole.skills;
    if (skills.indexOf('*') >= 0) return { allowed: true };
    if (this.skillMatches(skillName, skills)) return { allowed: true };

    return {
      allowed: false,
      denyMessage: this.config?.denyMessage || '抱歉，您没有权限执行此操作。',
    };
  }

  // 获取用户信息（带缓存）
  private async getUserInfo(userId: string): Promise<CachedUserInfo | null> {
    // 先查缓存
    var cached = this.userCache.get(userId);
    if (cached && (Date.now() - cached.fetchedAt) < this.cacheTtlMs) {
      return cached;
    }

    if (!this.mcpCaller) return null;

    try {
      // 首次加载全量用户列表
      if (!this.userListFetched) {
        await this.fetchAllUsers();
      }

      return this.userCache.get(userId) || null;
    } catch (e) {
      console.warn('[PermissionMiddleware] 获取用户信息失败: ' + (e as Error).message);
      return null;
    }
  }

  // 从 contact API 全量加载用户
  private async fetchAllUsers(): Promise<void> {
    if (!this.mcpCaller) return;

    var result = await this.mcpCaller.callTool('contact', 'get_userlist', {}) as Record<string, unknown>;
    var userList = result.userlist || result.user_list || result.data || [];
    if (!Array.isArray(userList)) {
      console.warn('[PermissionMiddleware] contact.get_userlist 返回格式异常: ' + JSON.stringify(result).substring(0, 200));
      return;
    }

    var now = Date.now();
    for (var user of userList) {
      if (!user || typeof user !== 'object') continue;
      var u = user as Record<string, unknown>;
      var uid = String(u.userid || u.user_id || '');
      if (!uid) continue;

      // 尝试多种可能的字段名提取标签/岗位/部门
      var tags: string[] = [];
      var rawTags = u.tags || u.tag_list || u.label_list;
      if (Array.isArray(rawTags)) {
        tags = rawTags.map(function(t: unknown) {
          if (typeof t === 'string') return t;
          if (typeof t === 'object' && t !== null) {
            var to = t as Record<string, unknown>;
            return String(to.tagname || to.tag_name || to.name || to.label || '');
          }
          return '';
        }).filter(function(s: string) { return s.length > 0; });
      }

      var position = String(u.position || u.title || u.job || '');

      // 部门：尝试多种格式
      var departments: string[] = [];
      var rawDept = u.department || u.dept || u.departments;
      if (Array.isArray(rawDept)) {
        departments = rawDept.map(function(d: unknown) { return String(d); });
      } else if (rawDept !== undefined && rawDept !== null) {
        departments = [String(rawDept)];
      }

      this.userCache.set(uid, {
        userId: uid,
        departments: departments,
        position: position,
        tags: tags,
        fetchedAt: now,
      });
    }

    this.userListFetched = true;
    console.log('[PermissionMiddleware] 已加载 ' + this.userCache.size + ' 个用户');
  }

  // 清除缓存
  private async matchSheetRoles(userInfo: CachedUserInfo): Promise<string[]> {
    var roles: string[] = [];
    var sheets = this.config?.roleSource?.sheets;
    if (!sheets || sheets.length === 0) return roles;
    if (!this.mcpCaller) return roles;
    for (var si = 0; si < sheets.length; si++) {
      var sheet = sheets[si];
      try {
        var records = await this.fetchSheetRecords(sheet);
        for (var ri = 0; ri < records.length; ri++) {
          if (records[ri].name === userInfo.userId && records[ri].role) {
            if (roles.indexOf(records[ri].role) < 0) roles.push(records[ri].role);
          }
        }
      } catch (e) {
        console.warn("[PermissionMiddleware] sheet error: " + (e as Error).message);
      }
    }
    return roles;
  }

  private async fetchSheetRecords(sheet: SheetRoleSource): Promise<Array<{ name: string; dept: string; role: string }>> {
    var cacheKey = sheet.docid + "|" + sheet.sheetName;
    var cached = this.sheetRoleCache.get(cacheKey);
    var tsKey = cacheKey + "_ts";
    var ts = this.sheetIdMap.get(tsKey);
    if (cached && ts && (Date.now() - Number(ts)) < this.sheetCacheTtlMs) return cached;
    var sheetId = this.sheetIdMap.get(cacheKey);
    if (!sheetId) {
      var sres = await this.mcpCaller!.callTool("doc", "smartsheet_get_sheet", { docid: sheet.docid }) as Record<string, unknown>;
      var sl = (sres.sheet_list || []) as Array<Record<string, unknown>>;
      for (var i = 0; i < sl.length; i++) {
        if (String(sl[i].title || sl[i].sheet_title || "") === sheet.sheetName) { sheetId = String(sl[i].sheet_id || ""); break; }
      }
      if (!sheetId) throw new Error("sheet not found: " + sheet.sheetName);
      this.sheetIdMap.set(cacheKey, sheetId);
    }
    var rres = await this.mcpCaller!.callTool("doc", "smartsheet_get_records", { docid: sheet.docid, sheet_id: sheetId }) as Record<string, unknown>;
    var records = (rres.records || []) as Array<Record<string, unknown>>;
    var rows: Array<{ name: string; dept: string; role: string }> = [];
    for (var ri = 0; ri < records.length; ri++) {
      var vals = (records[ri].values || {}) as Record<string, unknown>;
      rows.push({ name: extractCell(vals[sheet.nameColumn]), dept: "", role: extractCell(vals[sheet.roleColumn]) });
    }
    this.sheetRoleCache.set(cacheKey, rows);
    this.sheetIdMap.set(tsKey, String(Date.now()));
    return rows;
  }
  clearCache(): void {
    this.userCache.clear();
    this.userListFetched = false;
  }
}
function extractCell(cell: unknown): string {
  if (!cell) return "";
  if (typeof cell === "string") return cell;
  if (Array.isArray(cell)) {
    for (var i = 0; i < cell.length; i++) {
      var item = cell[i];
      if (typeof item === "object" && item !== null) {
        var obj = item as Record<string, unknown>;
        if (obj.text && typeof obj.text === "string") return obj.text;
      }
    }
  }
  if (typeof cell === "object" && cell !== null) {
    var obj2 = cell as Record<string, unknown>;
    if (obj2.text && typeof obj2.text === "string") return obj2.text;
  }
  return String(cell);
}
