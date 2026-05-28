// 技能目录命令 — PM 配置权限时参考
// 用法: npx tsx scripts/list-skills.ts [bot-name]
//   bot-name 可选，指定后只列出该 Bot 配置的 skills

import * as fs from "fs";
import * as path from "path";

var botName = process.argv[2];
var configuredSkills: string[] = [];

if (botName) {
  var configPath = path.resolve(__dirname, "..", "bots", botName, "config.json");
  if (fs.existsSync(configPath)) {
    var cfg = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    configuredSkills = cfg.skills || [];
    console.log("  Bot: " + botName + " | 已配置 " + configuredSkills.length + " 个技能\n");
  } else {
    console.log("  Bot " + botName + " 的 config.json 不存在，显示全部技能。\n");
  }
}

// 技能定义（与 bot-manager.ts 中同步）
interface SkillItem { name: string; category: string; description: string; }

var allSkills: SkillItem[] = [];

// 组合 Skill
var compSkills: Array<[string, string]> = [
  ["create-weekly-report", "项目周报：汇总进展/计划/风险，生成文档"],
  ["organize-meeting",     "组织会议：创建会议 + 同步日程 + 待办提醒"],
  ["meeting-minutes",      "会议纪要：提取待办 + 分类 + 创建文档"],
  ["party-vote",           "党建投票：多项选择卡片 + 结果记录"],
  ["info-gathering",       "信息汇集分析"],
];
for (var cs of compSkills) {
  allSkills.push({ name: cs[0], category: "组合 Skill", description: cs[1] });
}

// 原子 Skill（从 MCP 动态获取的描述，这里是静态快照）
var atomSkills: Array<[string, string, string]> = [
  ["contact", "get_userlist",                "获取通讯录用户列表"],
  ["todo",    "get_todo_list",               "查询待办列表"],
  ["todo",    "create_todo",                 "创建待办（内容 + 提醒时间）"],
  ["todo",    "get_todo_detail",             "查询待办详情"],
  ["todo",    "update_todo",                 "更新待办内容"],
  ["todo",    "delete_todo",                 "删除待办"],
  ["msg",     "get_msg_chat_list",           "查询会话列表"],
  ["msg",     "send_message",                "发送消息"],
  ["msg",     "get_message",                 "获取历史消息"],
  ["schedule","get_schedule_list_by_range",  "查询日程列表（时间范围）"],
  ["schedule","create_schedule",             "创建日程"],
  ["schedule","get_schedule_detail",         "查询日程详情"],
  ["schedule","update_schedule",             "更新日程"],
  ["schedule","cancel_schedule",             "取消日程"],
  ["schedule","check_availability",          "查询参会人闲忙状态"],
  ["meeting", "list_user_meetings",          "查询用户会议列表"],
  ["meeting", "create_meeting",              "创建会议"],
  ["meeting", "get_meeting_info",            "查询会议详情"],
  ["meeting", "set_invite_meeting_members",  "添加/修改参会人"],
  ["meeting", "cancel_meeting",              "取消会议"],
  ["doc",     "create_doc",                  "新建文档（doc_type:3=文档,10=智能表格）"],
  ["doc",     "get_doc_content",             "读取文档内容"],
  ["doc",     "edit_doc_content",            "编辑文档内容（Markdown）"],
  ["doc",     "smartsheet_get_sheet",        "查询智能表格子表"],
  ["doc",     "smartsheet_add_sheet",        "添加智能表格子表"],
  ["doc",     "smartsheet_get_fields",       "查询智能表格字段/列"],
  ["doc",     "smartsheet_add_fields",       "添加智能表格字段/列"],
  ["doc",     "smartsheet_update_fields",    "更新智能表格字段"],
  ["doc",     "smartsheet_get_records",      "查询智能表格记录/行"],
  ["doc",     "smartsheet_add_records",      "添加智能表格记录/行"],
  ["doc",     "smartsheet_update_records",   "更新智能表格记录"],
  ["doc",     "smartsheet_delete_records",   "删除智能表格记录"],
];
for (var as of atomSkills) {
  allSkills.push({ name: as[0] + "." + as[1], category: as[0], description: as[2] });
}

// 过滤
var filtered = allSkills;
if (configuredSkills.length > 0) {
  filtered = allSkills.filter(function(s) { return configuredSkills.indexOf(s.name) >= 0; });
}

// 输出
var currentCat = "";
for (var s of filtered) {
  if (s.category !== currentCat) {
    if (currentCat) console.log("");
    console.log("\x1b[1m\x1b[36m  " + s.category + "\x1b[0m");
    currentCat = s.category;
  }
  var namePad = s.name.padEnd(42);
  console.log("    " + namePad + s.description);
}

console.log("\n  共 " + filtered.length + " 个技能");
console.log("  使用方式: config.json 中 permissions.roles 引用技能名");
console.log("  通配符: * = 全部,  doc.* = doc品类全部\n");