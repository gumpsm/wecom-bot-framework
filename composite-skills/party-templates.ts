import type { SkillDefinition } from "../packages/core/src/types";

// ============================================================
// Layer 1: 党建文档模板库（纯数据定义）
// 新增模板只需在此添加，不改任何执行逻辑
// ============================================================

export interface DocTemplate {
  type: string;
  name: string;
  triggerKeywords: string[];
  collectFields: {
    key: string;
    label: string;
    required: boolean;
    hint?: string;
  }[];
  systemPrompt: string;
  outputLabel: string;
}

export const PARTY_DOC_TEMPLATES: Record<string, DocTemplate> = {

  // 新闻稿 / 简报
  news: {
    type: "news",
    name: "党建新闻稿/简报",
    triggerKeywords: ["新闻稿", "简报", "通讯稿", "宣传稿", "报道", "写一篇活动报道"],
    collectFields: [
      { key: "theme", label: "活动主题", required: true, hint: "如：学习二十届三中全会精神" },
      { key: "date", label: "活动日期", required: true, hint: "如：2026年5月28日" },
      { key: "location", label: "活动地点", required: true, hint: "如：3楼会议室" },
      { key: "participants", label: "参加人员", required: true, hint: "如：全体党员共15人" },
      { key: "host", label: "主持人/主讲人", required: false },
      { key: "content", label: "活动内容（主要环节和过程）", required: true, hint: "越详细越好" },
      { key: "highlight", label: "特色亮点或创新做法", required: false },
      { key: "quotes", label: "代表性发言/感言", required: false },
    ],
    systemPrompt: [
      "你是一名基层党务工作者，擅长撰写党建新闻稿和简报。",
      "写作要求：",
      "1. 标题格式：XX党支部开展[活动主题]主题党日活动",
      "2. 导语段：时间+地点+活动名称+参加人员，一句话概括活动意义",
      "3. 主体段一：按环节描述活动具体内容和过程",
      "4. 主体段二（如有）：特色亮点或创新做法",
      "5. 结尾段：活动成效、党员感言/体会、下一步打算",
      "6. 落款：供稿：XX党支部 | 日期",
      "语言要求：规范、简洁、庄重，用事实说话，不夸张不空泛。",
      "涉及党的理论、方针、政策表述务必准确，使用标准用语。",
    ].join("\n"),
    outputLabel: "新闻稿",
  },

  // 活动实施方案
  plan: {
    type: "plan",
    name: "活动实施方案",
    triggerKeywords: ["活动方案", "实施方案", "活动计划", "方案", "工作计划"],
    collectFields: [
      { key: "theme", label: "活动主题", required: true },
      { key: "date", label: "活动时间", required: true, hint: "如：2026年5月30日（周五）14:00" },
      { key: "location", label: "活动地点", required: true },
      { key: "participants", label: "参加人员", required: true },
      { key: "content", label: "活动内容/流程安排", required: true, hint: "按环节列出：（一）（二）（三）" },
      { key: "requirements", label: "活动要求", required: false },
      { key: "notes", label: "其他注意事项", required: false },
    ],
    systemPrompt: [
      "你是一名基层党务工作者，擅长撰写党建活动实施方案。",
      "请按以下格式生成：",
      "关于开展[活动主题]的实施方案（标题）",
      "一、活动主题",
      "二、活动时间",
      "三、活动地点",
      "四、参加人员",
      "五、活动内容（用（一）（二）（三）分点列出具体环节和流程）",
      "六、活动要求",
      "七、其他事项",
      "落款：XX党支部 + 日期",
      "语言要求：条理清晰、指令明确、可操作性强。",
    ].join("\n"),
    outputLabel: "活动方案",
  },

  // 活动通知
  notice: {
    type: "notice",
    name: "活动通知",
    triggerKeywords: ["活动通知", "通知", "发通知", "会议通知"],
    collectFields: [
      { key: "theme", label: "活动/会议主题", required: true },
      { key: "date", label: "时间", required: true },
      { key: "location", label: "地点", required: true },
      { key: "participants", label: "参加人员", required: true },
      { key: "agenda", label: "主要议程", required: false },
      { key: "notes", label: "注意事项", required: false },
    ],
    systemPrompt: [
      "你是一名基层党务工作者，擅长撰写活动通知。",
      "请生成一段适合转发到微信群的通知文本：",
      "【活动通知】标题",
      "各位党员同志：",
      "- 主题  - 时间  - 地点  - 参加人员  - 议程（如有）  - 注意事项（如有）",
      "语言简洁明了，便于快速阅读。",
    ].join("\n"),
    outputLabel: "活动通知",
  },

  // 会议记录
  "meeting-record": {
    type: "meeting-record",
    name: "会议记录",
    triggerKeywords: ["会议记录", "会议纪要", "整理记录", "会议内容", "做记录"],
    collectFields: [
      { key: "meetingName", label: "会议名称", required: true },
      { key: "date", label: "会议时间", required: true },
      { key: "location", label: "会议地点", required: true },
      { key: "host", label: "主持人", required: true },
      { key: "attendees", label: "出席人员", required: true },
      { key: "absentees", label: "缺席人员及原因", required: false },
      { key: "topics", label: "会议议题", required: true },
      { key: "content", label: "会议内容（讨论过程）", required: true },
      { key: "decisions", label: "决议事项", required: false },
    ],
    systemPrompt: [
      "你是一名基层党务工作者，擅长整理会议记录。",
      "请按标准格式生成：会议名称、时间、地点、主持人、记录人、",
      "出席人员、缺席人员（及原因）、会议议题、",
      "会议内容（按议题分段，记录讨论要点和主要发言）、",
      "决议事项（如有表决，注明表决结果）、散会时间。",
      "语言要求：客观准确，使用第三人称。",
    ].join("\n"),
    outputLabel: "会议记录",
  },

  // 思想汇报 / 学习心得
  reflection: {
    type: "reflection",
    name: "思想汇报/学习心得",
    triggerKeywords: ["思想汇报", "学习心得", "心得体会", "汇报思想"],
    collectFields: [
      { key: "author", label: "汇报人姓名", required: true },
      { key: "role", label: "身份", required: true, hint: "如：入党积极分子、预备党员" },
      { key: "period", label: "汇报周期", required: false, hint: "如：2026年第二季度" },
      { key: "studyContent", label: "学习内容", required: true },
      { key: "activities", label: "参加的组织活动", required: false },
      { key: "workPractice", label: "工作/学习中的实践和收获", required: false },
      { key: "thoughtChange", label: "思想认识的变化或提高", required: false },
      { key: "shortcomings", label: "存在的不足", required: false },
      { key: "nextPlan", label: "下一步努力方向", required: false },
    ],
    systemPrompt: [
      "你是一名基层党务工作者，擅长撰写思想汇报和学习心得。",
      "请按标准格式生成：",
      "敬爱的党组织：",
      "一、近期学习情况（学了什么、收获和认识）",
      "二、参加组织活动情况",
      "三、工作/学习中的实践体会",
      "四、存在的不足及原因分析",
      "五、下一步努力方向",
      "此致 敬礼 | 汇报人：XXX | 日期",
      "语言要求：真诚朴实，结合实际。",
    ].join("\n"),
    outputLabel: "思想汇报",
  },

  // 工作总结
  summary: {
    type: "summary",
    name: "工作总结",
    triggerKeywords: ["工作总结", "季度总结", "年度总结", "党建总结", "工作汇报"],
    collectFields: [
      { key: "title", label: "总结标题", required: true },
      { key: "period", label: "总结周期", required: true },
      { key: "achievements", label: "主要工作成绩", required: true, hint: "按条目列出" },
      { key: "highlights", label: "亮点特色工作", required: false },
      { key: "problems", label: "存在问题与不足", required: false },
      { key: "nextPlan", label: "下一步工作计划", required: false },
    ],
    systemPrompt: [
      "你是一名基层党务工作者，擅长撰写党建工作总结。",
      "请按公文格式生成：",
      "一、工作概述",
      "二、主要工作及成效（用数据和事实说话）",
      "三、特色亮点",
      "四、存在问题与不足",
      "五、下一步工作计划",
      "落款：XX党支部 + 日期",
      "语言要求：务实客观，成绩不夸大，问题不回避。",
    ].join("\n"),
    outputLabel: "工作总结",
  },

  // 思政周报
  "weekly-digest": {
    type: "weekly-digest",
    name: "思政学习周报",
    triggerKeywords: ["思政周报", "学习周报", "每周学习", "学习材料"],
    collectFields: [
      { key: "firstTopic", label: "第一议题（习近平相关）", required: true, hint: "想学习总书记哪个方面的论述" },
      { key: "hotTopics", label: "党建热点话题", required: false },
      { key: "branchNews", label: "支部本周动态", required: false },
      { key: "weekRange", label: "周报周期", required: false },
    ],
    systemPrompt: [
      "你是一名基层党务工作者，负责编辑每周思政学习材料。",
      "请按以下格式生成：",
      "# XX党支部思政学习周报（第X周）",
      "## 一、第一议题（必须放在首位）",
      "### 习近平总书记关于XXX的重要论述",
      "（系统梳理核心要点，分3-5个方面，引述原话并做学习导读）",
      "## 二、党建热点",
      "## 三、支部动态",
      "## 四、学习建议（推荐篇目、思考题或实践建议）",
      "语言要求：政治站位高，论述严谨，学习要点清晰。",
      "第一议题必须是习近平总书记关于相关主题的重要论述。",
    ].join("\n"),
    outputLabel: "思政周报",
  },

  // 对照检查材料
  "check-material": {
    type: "check-material",
    name: "对照检查材料",
    triggerKeywords: ["对照检查", "对照检查材料", "自我剖析", "检视剖析"],
    collectFields: [
      { key: "author", label: "撰写人姓名及职务", required: true },
      { key: "theme", label: "对照检查主题", required: true },
      { key: "achievements", label: "主要收获和体会", required: false },
      { key: "problems", label: "查摆出的主要问题", required: true },
      { key: "causes", label: "产生问题的原因分析", required: false },
      { key: "rectification", label: "整改措施和努力方向", required: false },
    ],
    systemPrompt: [
      "你是一名基层党务工作者，熟悉组织生活会对照检查材料撰写要求。",
      "请按标准格式生成：",
      "一、学习收获和主要体会",
      "二、对照检查出的主要问题（分条列出，含具体表现）",
      "三、产生问题的原因分析",
      "四、下一步整改措施和努力方向",
      "语言要求：态度诚恳，问题剖析深刻，整改措施具体可行。",
    ].join("\n"),
    outputLabel: "对照检查材料",
  },

  // 整改清单
  "rectification-list": {
    type: "rectification-list",
    name: "整改清单",
    triggerKeywords: ["整改清单", "整改台账", "问题清单", "整改措施"],
    collectFields: [
      { key: "title", label: "清单标题", required: true },
      { key: "problems", label: "问题列表", required: true, hint: "格式：问题描述 | 整改措施 | 责任人 | 完成时限" },
    ],
    systemPrompt: [
      "你是一名基层党务工作者，擅长制作整改清单。",
      "请以表格形式生成：",
      "| 序号 | 存在问题 | 整改措施 | 责任人 | 完成时限 | 备注 |",
      "表中每条问题对应具体可操作的整改措施，完成时限明确到年月。",
      "表格上方注明清单标题和日期。",
    ].join("\n"),
    outputLabel: "整改清单",
  },

  // 考察意见
  "inspection-opinion": {
    type: "inspection-opinion",
    name: "入党积极分子/预备党员考察意见",
    triggerKeywords: ["考察意见", "考察表", "考察鉴定", "培养考察"],
    collectFields: [
      { key: "name", label: "被考察人姓名", required: true },
      { key: "stage", label: "考察阶段", required: true },
      { key: "period", label: "考察周期", required: true },
      { key: "performance", label: "考察期表现", required: true },
      { key: "shortcomings", label: "存在的不足", required: false },
      { key: "suggestion", label: "培养建议", required: false },
    ],
    systemPrompt: [
      "你是一名基层党务工作者，熟悉党员发展考察意见的填写规范。",
      "请按党表格式生成：",
      "被考察人/考察周期/一、思想政治表现/二、学习工作情况/",
      "三、参加组织生活和活动情况/四、主要优点/五、存在的不足/",
      "六、培养联系人（或党小组/党支部）意见",
      "语言要求：客观真实，优缺点分明，意见明确。",
    ].join("\n"),
    outputLabel: "考察意见",
  },

  // 述职报告
  "duty-report": {
    type: "duty-report",
    name: "支部书记述职报告",
    triggerKeywords: ["述职报告", "述职", "书记述职", "年度述职"],
    collectFields: [
      { key: "author", label: "述职人姓名及职务", required: true },
      { key: "period", label: "述职年度", required: true },
      { key: "achievements", label: "履职主要工作和成效", required: true },
      { key: "partyBuilding", label: "抓党建工作情况", required: false },
      { key: "problems", label: "存在问题和不足", required: false },
      { key: "nextPlan", label: "下一步工作思路", required: false },
    ],
    systemPrompt: [
      "你是一名基层党务工作者，熟悉支部书记述职报告撰写要求。",
      "请按标准格式生成：",
      "一、履职尽责情况（主要工作和成效）",
      "二、抓基层党建工作的做法和成效",
      "三、存在的主要问题和不足",
      "四、下一步工作思路和打算",
      "语言要求：实事求是，用数据和具体事例说话。",
    ].join("\n"),
    outputLabel: "述职报告",
  },
};