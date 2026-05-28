import { SkillDefinition } from "../packages/core/src/types";
import { LLMClient } from "./llm-deps";
import { PARTY_DOC_TEMPLATES, DocTemplate } from "./party-templates";

// ============================================================
// Layer 2: 党建文档生成器（一个 Skill 覆盖全部文档类型）
// ============================================================

export var partyDocGeneratorDefinition: SkillDefinition = {
  name: "party-doc-generator",
  description:
    "党建文档智能生成器。支持生成：新闻稿/简报、活动方案、活动通知、会议记录、思想汇报/学习心得、" +
    "工作总结、思政周报、对照检查材料、整改清单、考察意见、述职报告。" +
    "当用户提到写党建相关文档时使用。收集必要信息后自动生成并创建企微文档。",
  parameters: {
    type: "object",
    properties: {
      docType: {
        type: "string",
        description: "文档类型：news / plan / notice / meeting-record / reflection / summary / weekly-digest / check-material / rectification-list / inspection-opinion / duty-report",
      },
      collectedInfo: {
        type: "object",
        description: "收集到的信息，字段因 docType 而异，必填字段参见各模板 collectFields",
      },
    },
    required: ["docType", "collectedInfo"],
  },
};

// ====== 类型 ======

export interface PartyDocInput {
  docType: string;
  collectedInfo: Record<string, string>;
}

export interface PartyDocOutput {
  success: boolean;
  docUrl: string;
  docId: string;
  preview: string;
  template: string;
}

export interface PartyDocDeps {
  callTool: (category: string, method: string, args: Record<string, unknown>) => Promise<unknown>;
  llm: LLMClient;
}

// ====== 执行函数 ======

export async function generatePartyDoc(
  input: PartyDocInput,
  deps: PartyDocDeps
): Promise<PartyDocOutput> {
  // 1. 查找模板
  const template: DocTemplate | undefined = PARTY_DOC_TEMPLATES[input.docType];
  if (!template) {
    const available = Object.keys(PARTY_DOC_TEMPLATES).join(" / ");
    throw new Error(
      "party-doc-generator: 未知文档类型 '" + input.docType + "'，可用类型：" + available
    );
  }

  // 2. 校验必填字段
  const missing: string[] = [];
  for (const field of template.collectFields) {
    if (field.required && !input.collectedInfo[field.key]) {
      missing.push(field.label + "(" + field.key + ")");
    }
  }
  if (missing.length > 0) {
    throw new Error(
      "party-doc-generator: 缺少必填信息：" + missing.join("、") +
      "。请追问用户补充后再调用。"
    );
  }

  // 3. 组装 LLM prompt
  const infoLines: string[] = [];
  for (const field of template.collectFields) {
    const val = input.collectedInfo[field.key];
    if (val) {
      infoLines.push(field.label + "：" + val);
    }
  }

  const userPrompt =
    "请根据以下信息，生成一份" + template.name + "。\n\n" +
    infoLines.join("\n") + "\n\n" +
    "要求：严格按照上述格式和语言风格生成，不编造未提供的信息。" +
    "对不确定的内容标注「待补充」。";

  // 4. 调用 LLM 生成
  const response = await deps.llm.chat({
    messages: [{ role: "user", content: userPrompt }],
    systemPrompt: template.systemPrompt,
    temperature: 0.3,
  });

  const content = response.content || "";
  if (!content) {
    throw new Error("party-doc-generator: LLM 返回空内容");
  }

  // 5. 提取标题（取第一行 # 开头或前30字）
  let docName = template.name + "_" + new Date().toISOString().slice(0, 10);
  const firstLine = content.split("\n")[0] || "";
  const titleMatch = firstLine.match(/^#+\s*(.+)/);
  if (titleMatch) {
    docName = titleMatch[1].replace(/[\\/:*?"<>|]/g, "_").substring(0, 80);
  } else {
    const shortTitle = firstLine.replace(/[#*]/g, "").trim().substring(0, 30);
    if (shortTitle) {
      docName = shortTitle.replace(/[\\/:*?"<>|]/g, "_");
    }
  }

  // 6. 创建文档
  const docResult = (await deps.callTool("doc", "create_doc", {
    doc_type: 3,
    doc_name: docName,
  })) as Record<string, unknown>;

  const docId = docResult.docid as string;
  const docUrl = docResult.url as string;

  // 7. 写入内容
  await deps.callTool("doc", "edit_doc_content", {
    content_type: 1,
    content: content,
    docid: docId,
  });

  // 8. 提取预览（取前 300 字）
  const preview = content.replace(/^#+\s*/gm, "").trim().substring(0, 300);

  return {
    success: true,
    docUrl: docUrl,
    docId: docId,
    preview: preview,
    template: template.name,
  };
}