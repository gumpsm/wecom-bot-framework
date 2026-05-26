import { SkillDefinition } from "../packages/core/src/types";

export var partyVoteDefinition: SkillDefinition = {
  name: "party-vote",
  description: "发起投票/推荐选举。发送投票卡片到群聊/私聊，收集投票结果并写入文档。当用户提到投票、推荐、选举、评选、优秀党员时使用。",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "投票标题，如 2026年Q2优秀党员推荐" },
      description: { type: "string", description: "投票说明/描述" },
      candidates: { type: "string", description: "候选人列表，逗号分隔的名称，如 张三,李四,王五" },
      questions: { type: "string", description: "额外问题，JSON格式，可选。如 [{\"key\":\"reason\",\"title\":\"推荐理由\",\"options\":[\"工作业绩\",\"团队协作\"]}]" },
    },
    required: ["title", "candidates"],
  },
};

// Composite Skill: 党建投票/选举
// 发送多项选择卡片 → 注册交互回调 → 收集投票 → 记录到文档
import { LLMClient } from "./llm-deps";

export interface VoteOption {
  id: string;              // 选项ID，如 "candidate_zhang"
  text: string;            // 显示文字，如 "张三"
}

export interface VoteQuestion {
  key: string;             // question_key，如 "recommendation"
  title: string;           // 问题标题，如 "推荐优秀党员"
  options: VoteOption[];   // 可选项
}

export interface PartyVoteInput {
  title: string;           // 投票标题，如 "2026年Q2优秀党员推荐"
  description: string;     // 投票说明
  questions: VoteQuestion[];
  resultDocName?: string;  // 结果文档名（不传则自动生成）
}

export interface PartyVoteOutput {
  success: boolean;
  taskId: string;
  cardBody: Record<string, unknown>;
  resultDocId?: string;
  resultDocUrl?: string;
}

export interface PartyVoteDeps {
  callTool: (category: string, method: string, args: Record<string, unknown>) => Promise<unknown>;
  sendMessage?: (chatId: string, chatType: number, body: Record<string, unknown>) => Promise<void>;
  registerEventHandler?: (taskId: string, handler: (event: Record<string, unknown>) => Promise<void>) => void;
  chatId?: string;
  chatType?: number;
}

// 投票结果收集器（模块级状态）
var _voteResults: Map<string, Array<{ user: string; selections: Record<string, string[]>; timestamp: string }>> = new Map();

export function getVoteResults(taskId: string) {
  return _voteResults.get(taskId) || [];
}

export async function sendPartyVote(
  input: PartyVoteInput,
  deps: PartyVoteDeps
): Promise<PartyVoteOutput> {
  // 1. 参数校验
  if (!input.title) throw new Error("partyVote: title is required");
  if (!input.questions || input.questions.length === 0) throw new Error("partyVote: at least one question is required");

  // 2. 构建投票卡片 body（multiple_interaction 类型）
  var taskId = "vote_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 6);

  var selectList: Array<Record<string, unknown>> = [];
  for (var q of input.questions) {
    var optionList: Array<Record<string, unknown>> = [];
    for (var opt of q.options) {
      optionList.push({ id: opt.id, text: opt.text });
    }
    selectList.push({
      question_key: q.key,
      title: q.title,
      option_list: optionList,
    });
  }

  var cardBody: Record<string, unknown> = {
    msgtype: "template_card",
    template_card: {
      card_type: "multiple_interaction",
      main_title: { title: input.title, desc: input.description },
      select_list: selectList,
      submit_button: { text: "提交投票", key: "submit_vote" },
      task_id: taskId,
    },
  };

  // 3. 注册事件处理器
  _voteResults.set(taskId, []);

  if (deps.registerEventHandler) {
    deps.registerEventHandler(taskId, async function(event: Record<string, unknown>) {
      var cardEvt = (event as any)?.body?.event?.template_card_event;
      if (!cardEvt) return;

      var userId = (event as any)?.body?.from?.userid || "unknown";
      var selections: Record<string, string[]> = {};

      if (cardEvt.selected_items?.selected_item) {
        for (var item of cardEvt.selected_items.selected_item) {
          selections[item.question_key] = item.option_ids?.option_id || [];
        }
      }

      var currentResults = _voteResults.get(taskId) || [];
      currentResults.push({
        user: userId,
        selections: selections,
        timestamp: new Date().toISOString(),
      });
      _voteResults.set(taskId, currentResults);

      console.log("[partyVote] Vote recorded: user=" + userId + " taskId=" + taskId);
    });
  }

  // 4. 发送投票卡片
  if (deps.sendMessage && deps.chatId) {
    await deps.sendMessage(deps.chatId, deps.chatType || 1, cardBody);
  }

  return {
    success: true,
    taskId: taskId,
    cardBody: cardBody,
  };
}

// 汇总投票结果并写入文档
export async function finalizePartyVote(
  taskId: string,
  deps: {
    callTool: (category: string, method: string, args: Record<string, unknown>) => Promise<unknown>;
    llm?: LLMClient;
    resultDocName?: string;
  }
): Promise<{ docUrl: string; docId: string; summary: string }> {
  var results = _voteResults.get(taskId) || [];

  // 统计每个选项的票数
  var stats: Record<string, Record<string, number>> = {};
  var voters: string[] = [];

  for (var r of results) {
    voters.push(r.user);
    for (var key of Object.keys(r.selections)) {
      if (!stats[key]) stats[key] = {};
      for (var optId of r.selections[key]) {
        stats[key][optId] = (stats[key][optId] || 0) + 1;
      }
    }
  }

  // 生成汇总文本
  var summary = "# 投票结果汇总\n\n**总投票人数**: " + results.length + "\n\n";
  for (var key of Object.keys(stats)) {
    summary += "## 问题: " + key + "\n";
    for (var optId of Object.keys(stats[key])) {
      summary += "- " + optId + ": " + stats[key][optId] + " 票\n";
    }
    summary += "\n";
  }

  summary += "## 投票详情\n";
  for (var r of results) {
    summary += "- **" + r.user + "** (" + r.timestamp + "): " +
      JSON.stringify(r.selections) + "\n";
  }

  // 创建结果文档
  var docName = deps.resultDocName || ("投票结果_" + taskId);
  var docResult = await deps.callTool("doc", "create_doc", {
    doc_type: 3,
    doc_name: docName,
  }) as Record<string, unknown>;

  var docId = docResult.docid as string;
  var docUrl = docResult.url as string;

  await deps.callTool("doc", "edit_doc_content", {
    content_type: 1,
    content: summary,
    docid: docId,
  });

  // 清理内存中的投票数据
  _voteResults.delete(taskId);

  return { docUrl: docUrl, docId: docId, summary: summary };
}

