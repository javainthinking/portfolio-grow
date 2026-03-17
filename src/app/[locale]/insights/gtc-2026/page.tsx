import Link from "next/link";

type Section = {
  id: string;
  title: string;
  points: string[];
};

const sections: Section[] = [
  {
    id: "mainline",
    title: "Keynote 主线：AI 数据中心从『存储/计算中心』变成『Token 工厂』",
    points: [
      "推理（inference）成为核心工作负载，tokens 被当作新的『产出/商品（commodity）』。",
      "企业衡量 AI Factory 的指标从 FLOPS 转向：单位功耗/单位成本下的 token 吞吐（用来解释代际跃迁与 ROI）。",
    ],
  },
  {
    id: "system",
    title: "硬件与系统：Vera Rubin（2026）主角 + 预告 Feynman（2028）",
    points: [
      "Vera Rubin 被描述为系统级野心很强的一代：围绕更高 token 吞吐、更好能效/成本做整体方案。",
      "提到 Grace Blackwell 早期交付/爬坡有波折，但 Rubin 的 sampling 进展不错；并提到首套系统已在 Azure 上运行（按 live blog 转述口径）。",
      "路线图继续上移到系统能力：GPU/CPU/网络/互连/光电共封装（CPO）等关键词连成一条叙事线。",
    ],
  },
  {
    id: "software",
    title: "软件与生态：CUDA-X + 行业库仍是护城河；『端到端但开放』",
    points: [
      "把自己定位为『算法公司』，强调 CUDA-X 与垂直行业 domain libraries 是落地关键。",
      "“vertically integrated but horizontally open”：全栈交付（芯片/网络/软件）同时与云与企业生态合作。",
    ],
  },
  {
    id: "agents",
    title: "模型/Agent：Nemotron 联盟 + Agentic/Physical AI 走向现实世界",
    points: [
      "围绕 Nemotron 扩大生态合作（live blog 提到 Black Forest Labs、Perplexity、Mistral、Cursor 等）。",
      "Physical AI（具身/机器人）成为重要段落：强调把 agents 带入物理世界。",
    ],
  },
  {
    id: "auto",
    title: "自动驾驶/出行：Robotaxi 生态扩张",
    points: [
      "新增 robotaxi 合作伙伴（live blog 提到 BYD、Hyundai、Nissan 等）。",
      "与 Uber 合作，把 robotaxi 接入 Uber 网络（先在部分城市）。",
    ],
  },
  {
    id: "gfx",
    title: "图形与消费侧：DLSS 5 作为『下一代图形计算』示范",
    points: [
      "Keynote 重心仍在 AI/数据中心，但用 DLSS 5 展示『可控 3D 图形/结构化数据』与生成式能力的融合趋势。",
    ],
  },
  {
    id: "vision",
    title: "愿景与概念：太空数据中心 + Omniverse/数字孪生的『AI 工厂蓝图』",
    points: [
      "提到一个 Space-1（太空数据中心）概念项目（偏早期/愿景）。",
      "Omniverse 被包装成供应链/工厂/数据中心协同设计与数字孪生的关键组件。",
    ],
  },
  {
    id: "impact",
    title: "行业信号（解读）：竞争维度从单卡性能转向系统交付 + token 产能 + 生态",
    points: [
      "NVIDIA 正把竞争维度从『GPU 参数』上移到『系统交付能力 + token 产能 + 软件生态』——卖的不只是 GPU，更像是『AI 工厂的生产力模型』。",
      "对企业买家：采购讨论会更像『算力/能耗/成本 → token 产能 → 业务产出』的 ROI 叙事，而不是纯参数对比。",
      "对创业/产品：做 agent/具身/行业 AI，接入其参考栈 + 行业库 + 生态伙伴网络，更容易进入大客户采购语言体系。",
    ],
  },
];

export default function Page() {
  return (
    <main style={{ padding: "28px 18px", maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0 }}>GTC 2026 Keynote（浓缩版）</h1>
          <p style={{ margin: "10px 0 0", color: "#555", lineHeight: 1.6 }}>
            按「Keynote 主线叙事 → 关键发布/信息点 → 我理解的影响」整理。适合快速对齐大方向。
          </p>
        </div>
        <Link href="/" style={{ color: "#2563eb", textDecoration: "none", whiteSpace: "nowrap" }}>
          ← Home
        </Link>
      </div>

      <section style={{ marginTop: 18, padding: 14, border: "1px solid #eee", borderRadius: 12, background: "#fafafa" }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>目录</div>
        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} style={{ color: "#111", textDecoration: "none" }}>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </section>

      <article style={{ marginTop: 18, lineHeight: 1.75 }}>
        {sections.map((s) => (
          <section key={s.id} id={s.id} style={{ marginTop: 22 }}>
            <h2 style={{ fontSize: 18, margin: 0 }}>{s.title}</h2>
            <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
              {s.points.map((p, idx) => (
                <li key={idx} style={{ margin: "6px 0" }}>
                  {p}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <hr style={{ margin: "26px 0", border: "none", borderTop: "1px solid #eee" }} />
        <p style={{ color: "#666", fontSize: 13 }}>
          注：内容基于公开 live blog 整理，细节口径可能与 NVIDIA 官方稿存在差异；建议用于“方向对齐”，不用于逐字引用。
        </p>
      </article>
    </main>
  );
}
