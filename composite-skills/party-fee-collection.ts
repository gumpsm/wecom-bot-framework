import { SkillDefinition } from "../packages/core/src/types";

// ============================================================
// party-fee-collection — 党费收缴全流程
// 状态存储在模块级内存中（与 party-vote.ts 模式一致）
// 进程重启后需重新 start 初始化
// ============================================================

export var partyFeeCollectionDefinition: SkillDefinition = {
  name: "party-fee-collection",
  description:
    "党费收缴管理。支持：发起收缴通知、标记党员已缴纳、查看进度、提醒未缴党员、生成汇总报告。" +
    "当用户提到党费、收党费、缴纳时使用。",
  parameters: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["start", "mark-paid", "status", "remind", "summary"] },
      members: { type: "string", description: "党员名单逗号分隔（start）" },
      chatId: { type: "string", description: "群chatId" },
      month: { type: "string" },
      deadline: { type: "string" },
      stateDocId: { type: "string", description: "状态文档docid" },
      userName: { type: "string", description: "缴纳人姓名" },
    },
    required: ["action"],
  },
};

// ====== 类型 ======

export interface FeeState {
  month: string;
  chatId: string;
  members: string[];
  paid: Record<string, string>;  // name → ISO时间
  status: "active" | "closed";
  deadline: string;
  stateDocId: string;
}

export interface FeeInput {
  action: "start" | "mark-paid" | "status" | "remind" | "summary";
  members?: string;
  chatId?: string;
  month?: string;
  deadline?: string;
  stateDocId?: string;
  userName?: string;
}

export interface FeeOutput {
  success: boolean;
  message: string;
  progress?: { paid: number; total: number; paidList: string[]; unpaidList: string[] };
  stateDocId?: string;
  summaryDocUrl?: string;
}

export interface FeeDeps {
  callTool: (category: string, method: string, args: Record<string, unknown>) => Promise<unknown>;
  sendMessage?: (chatId: string, chatType: number, body: Record<string, unknown>) => Promise<void>;
}

// ====== 模块级状态（进程重启后丢失，需重新 start） ======
const _activeCollections: Map<string, FeeState> = new Map();

// ====== 执行函数 ======

export async function runPartyFeeCollection(
  input: FeeInput,
  deps: FeeDeps
): Promise<FeeOutput> {
  switch (input.action) {

    case "start": {
      if (!input.members) throw new Error("party-fee: start 需要 members");
      const memberList = input.members.split(",").map((m) => m.trim()).filter(Boolean);
      if (memberList.length === 0) throw new Error("party-fee: members 不能为空");

      const month = input.month ||
        (new Date().getFullYear() + "-" + String(new Date().getMonth() + 1).padStart(2, "0"));
      const deadline = input.deadline ||
        (new Date().getFullYear() + "-" + String(new Date().getMonth() + 2).padStart(2, "0") + "-05");

      // 创建状态文档（仅用于记录，不用于读取）
      const docResult = (await deps.callTool("doc", "create_doc", {
        doc_type: 3,
        doc_name: "党费收缴状态_" + month,
      })) as Record<string, unknown>;

      const stateDocId = docResult.docid as string;

      // 写初始状态到文档
      const initJson = JSON.stringify({
        month, members: memberList, paid: {}, status: "active", deadline,
      }, null, 2);
      await deps.callTool("doc", "edit_doc_content", {
        content_type: 1,
        content: initJson,
        docid: stateDocId,
      });

      // 存入内存
      const state: FeeState = {
        month,
        chatId: input.chatId || "",
        members: memberList,
        paid: {},
        status: "active",
        deadline,
        stateDocId,
      };
      _activeCollections.set(stateDocId, state);

      // 发送群通知
      if (deps.sendMessage && input.chatId) {
        await deps.sendMessage(input.chatId, 2, {
          msgtype: "markdown",
          markdown: {
            content:
              "📢 党费收缴通知\n\n" +
              "各位党员同志：\n" +
              "请于" + deadline + "前缴纳" + month + "党费。\n" +
              "缴纳完成后请在群内 @党建助手 回复「已缴纳」。",
          },
        });
      }

      return {
        success: true,
        message: "党费收缴已启动（" + month + "），" + memberList.length + " 名党员待确认",
        stateDocId,
        progress: { paid: 0, total: memberList.length, paidList: [], unpaidList: [...memberList] },
      };
    }

    case "mark-paid": {
      if (!input.stateDocId) throw new Error("party-fee: mark-paid 需要 stateDocId");
      if (!input.userName) throw new Error("party-fee: mark-paid 需要 userName");

      const state = _activeCollections.get(input.stateDocId);
      if (!state) throw new Error("party-fee: 未找到活动收缴记录，请重新 start");
      if (state.status !== "active") throw new Error("party-fee: 收缴已结束");

      state.paid[input.userName] = new Date().toISOString();

      const paidList = Object.keys(state.paid);
      const unpaidList = state.members.filter((m) => !state.paid[m]);

      return {
        success: true,
        message: input.userName + " 已确认（" + paidList.length + "/" + state.members.length + "）",
        stateDocId: state.stateDocId,
        progress: { paid: paidList.length, total: state.members.length, paidList, unpaidList },
      };
    }

    case "status": {
      if (!input.stateDocId) throw new Error("party-fee: status 需要 stateDocId");
      const state = _activeCollections.get(input.stateDocId);
      if (!state) throw new Error("party-fee: 未找到活动收缴记录");

      const paidList = Object.keys(state.paid);
      const unpaidList = state.members.filter((m) => !state.paid[m]);

      return {
        success: true,
        message: "已确认 " + paidList.length + "/" + state.members.length,
        stateDocId: state.stateDocId,
        progress: { paid: paidList.length, total: state.members.length, paidList, unpaidList },
      };
    }

    case "remind": {
      if (!input.stateDocId) throw new Error("party-fee: remind 需要 stateDocId");
      const state = _activeCollections.get(input.stateDocId);
      if (!state) throw new Error("party-fee: 未找到活动收缴记录");
      if (state.status !== "active") return { success: true, message: "收缴已结束" };

      const unpaidList = state.members.filter((m) => !state.paid[m]);
      if (unpaidList.length === 0) return { success: true, message: "全部已确认" };

      if (deps.sendMessage && state.chatId) {
        await deps.sendMessage(state.chatId, 2, {
          msgtype: "markdown",
          markdown: {
            content:
              "🔔 党费缴纳提醒\n\n" +
              "以下" + unpaidList.length + "位同志尚未确认：\n" +
              unpaidList.join("、") + "\n\n" +
              "截止：" + state.deadline,
          },
        });
      }

      const paidList = Object.keys(state.paid);
      return {
        success: true,
        message: "已提醒 " + unpaidList.length + " 位",
        stateDocId: state.stateDocId,
        progress: { paid: paidList.length, total: state.members.length, paidList, unpaidList },
      };
    }

    case "summary": {
      if (!input.stateDocId) throw new Error("party-fee: summary 需要 stateDocId");
      const state = _activeCollections.get(input.stateDocId);
      if (!state) throw new Error("party-fee: 未找到活动收缴记录");

      state.status = "closed";
      const paidList = Object.keys(state.paid);
      const unpaidList = state.members.filter((m) => !state.paid[m]);

      let text = "# " + state.month + " 党费收缴汇总\n\n";
      text += "总人数: " + state.members.length + "\n";
      text += "已缴纳: " + paidList.length + "\n";
      text += "未缴纳: " + unpaidList.length + "\n\n";
      text += "## 已缴纳\n";
      for (const m of paidList) text += "- " + m + "（" + (state.paid[m] || "").slice(0, 10) + "）\n";
      if (unpaidList.length > 0) {
        text += "\n## 未缴纳\n";
        for (const m of unpaidList) text += "- " + m + "\n";
      }

      const docR = (await deps.callTool("doc", "create_doc", {
        doc_type: 3,
        doc_name: state.month + "党费收缴汇总",
      })) as Record<string, unknown>;

      await deps.callTool("doc", "edit_doc_content", {
        content_type: 1,
        content: text,
        docid: docR.docid as string,
      });

      return {
        success: true,
        message: "汇总完成：" + paidList.length + "/" + state.members.length,
        summaryDocUrl: docR.url as string,
        stateDocId: state.stateDocId,
        progress: { paid: paidList.length, total: state.members.length, paidList, unpaidList },
      };
    }

    default:
      throw new Error("party-fee: 未知操作");
  }
}