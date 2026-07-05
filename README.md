# 测对儿 CEDUI · Web

基于多 Agent 协作的关系契合度分析产品 —— Web 版(已正式上线,部署于 Vercel)。

把"性格标签 + 关系状态"翻译成**可逐项验证的契合分** + **多 Agent LLM 生成的关系侧写**:

```
输入双方型号/标签
   → 牵红线小游戏
   → 猜 TA 心里话(4 选 1 猜主题 → 揭晓猜中/没猜中 → 逐字揭开)
   → 契合报告(确定性算分明细 + AI 侧写 + 实时问 TA)
```

## 结构

```
index.html        前端单页(确定性算分 + 16 型号 + 136 CP + 全部交互)
typedex.html      16 型号图鉴
xray.html         多 Agent 协作过程可视化
eval.html         LLM 输出评估方案展示
api/              Vercel Serverless Functions
  diary.js          心里话生成(Diary ×3 → Diagnosis)
  scan.js           心动浓度扫描(Q + Heart → Verdict)
  ask.js            TA 回话(Q → T → P)
  judge.js          LLM 裁判(eval 用)
lib/              多 Agent 编排 + LLM 客户端 + agents/
```

## 本地运行

纯前端可直接打开 `index.html`(AI 接口会回退到示例数据)。完整后端见 `DEPLOY.md`。

## 部署(Vercel)

```
vercel --prod
# 环境变量:LLM_API_KEY / LLM_BASE_URL / LLM_MODEL
```

详见 [`DEPLOY.md`](./DEPLOY.md)。密钥仅存于 Vercel 环境变量,不进代码。

> 报告为娱乐性质,不构成任何感情决策依据。
