"use client";

import {
  ChangeEvent,
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ModelViewer, {
  FitResult,
  ModelAnnotation,
  ModelMetrics,
} from "./components/ModelViewer";

type View = "review" | "library" | "pk" | "analytics";
type Category = "人物" | "场景" | "道具" | "其他";
type Key =
  | "silhouette"
  | "topology"
  | "flow"
  | "detail"
  | "efficiency"
  | "bake";
type Evaluation = {
  id: string;
  fileName: string;
  fileKey?: string | null;
  referenceKey?: string | null;
  category: Category;
  source: string;
  status: "draft" | "complete";
  passed: boolean;
  score: number;
  scores: Record<Key, number>;
  notes: Partial<Record<Key, string>>;
  metrics: ModelMetrics;
  issues: string[];
  annotations?: ModelAnnotation[];
  summary: string;
  createdAt: string;
  updatedAt?: string;
};
const criteria: { key: Key; name: string; help: string; weight: number }[] = [
  {
    key: "silhouette",
    name: "形体与轮廓",
    help: "比例、体块与特征是否准确",
    weight: 25,
  },
  {
    key: "topology",
    name: "拓扑正确性",
    help: "穿插、破面、非流形和开放边",
    weight: 20,
  },
  {
    key: "flow",
    name: "布线结构合理性",
    help: "面流是否服务形体和变形",
    weight: 15,
  },
  {
    key: "detail",
    name: "布线细节控制",
    help: "曲面、锐边与转折是否清晰",
    weight: 10,
  },
  {
    key: "efficiency",
    name: "密度与低模效率",
    help: "面数是否集中在有效区域",
    weight: 10,
  },
  {
    key: "bake",
    name: "高低模贴合与烘焙",
    help: "法线、接缝和笼子风险",
    weight: 20,
  },
];
const defaultScores: Record<Key, number> = {
  silhouette: 4,
  topology: 4,
  flow: 4,
  detail: 4,
  efficiency: 3,
  bake: 4,
};
const defaultMetrics: ModelMetrics = {
  vertices: 684,
  triangles: 1312,
  meshes: 5,
  size: "3.35 m",
  openEdges: 0,
  nonManifold: 0,
  degenerate: 0,
  thinFaces: 2,
  highValence: 4,
  uvCoverage: 100,
};
type SeedTuple = [
  string,
  string,
  Category,
  boolean,
  number,
  Record<Key, number>,
  Partial<ModelMetrics>,
  string,
  string,
  string,
];
const seedTuples: SeedTuple[] = [
  [
    "TK-024",
    "Scout_Character_Low_B.obj",
    "人物",
    true,
    73,
    { silhouette: 4, topology: 3, flow: 4, detail: 3, efficiency: 4, bake: 4 },
    {
      vertices: 8840,
      triangles: 17120,
      meshes: 6,
      size: "1.82 m",
      openEdges: 0,
    },
    "局部面数不均",
    "结构稳定，布线和轮廓表现较均衡；建议收紧肩部与手关节区域。",
    "2026-07-28T16:40:00Z",
  ],
  [
    "TK-019",
    "Runner_Character_Low_C.obj",
    "人物",
    false,
    52,
    { silhouette: 4, topology: 2, flow: 2, detail: 2, efficiency: 3, bake: 2 },
    {
      vertices: 7420,
      triangles: 14260,
      meshes: 5,
      size: "1.79 m",
      openEdges: 18,
    },
    "开放边|拓扑中断|烘焙风险",
    "轮廓尚可，但存在开放边和结构中断，当前不建议进入烘焙。",
    "2026-07-27T11:15:00Z",
  ],
  [
    "TK-018",
    "OldTown_Alley_Low.obj",
    "场景",
    true,
    77,
    { silhouette: 4, topology: 4, flow: 4, detail: 3, efficiency: 4, bake: 4 },
    {
      vertices: 12680,
      triangles: 24110,
      meshes: 18,
      size: "8.40 m",
      openEdges: 0,
    },
    "局部面数不均",
    "场景轮廓清晰，结构分区和密度控制稳定，可进入后续制作。",
    "2026-07-26T15:20:00Z",
  ],
  [
    "TK-016",
    "Industrial_Room_Low.obj",
    "场景",
    false,
    48,
    { silhouette: 3, topology: 3, flow: 2, detail: 2, efficiency: 3, bake: 2 },
    {
      vertices: 15640,
      triangles: 30420,
      meshes: 26,
      size: "11.20 m",
      openEdges: 8,
    },
    "长细面|部件穿插|烘焙不稳定",
    "主体空间可读，但长细面和穿插会给法线与烘焙带来风险。",
    "2026-07-25T10:05:00Z",
  ],
  [
    "TK-014",
    "Bone_Axe_Prop_Low.obj",
    "道具",
    true,
    85,
    { silhouette: 5, topology: 4, flow: 4, detail: 4, efficiency: 5, bake: 4 },
    {
      vertices: 3680,
      triangles: 7020,
      meshes: 3,
      size: "0.92 m",
      openEdges: 0,
    },
    "末端可再减面",
    "造型识别明确，拓扑和面数控制均衡，是完成度较高的低模资产。",
    "2026-07-24T17:35:00Z",
  ],
  [
    "TK-012",
    "Field_Radio_Prop_Low.obj",
    "道具",
    true,
    75,
    { silhouette: 4, topology: 4, flow: 4, detail: 3, efficiency: 4, bake: 4 },
    {
      vertices: 4980,
      triangles: 9460,
      meshes: 7,
      size: "0.48 m",
      openEdges: 0,
    },
    "圆角面数不均",
    "整体满足低模要求，建议优化旋钮和边缘圆角的密度分布。",
    "2026-07-23T09:40:00Z",
  ],
];
const data: Evaluation[] = seedTuples.map((r) => ({
  id: r[0],
  fileName: r[1],
  category: r[2],
  passed: r[3],
  score: r[4],
  scores: r[5],
  metrics: { ...defaultMetrics, ...r[6] },
  issues: r[7].split("|"),
  summary: r[8],
  createdAt: r[9],
  source: "人工评测",
  status: "complete",
  notes: {},
}));
const issueOptions = [
  "局部面数不均",
  "长细面",
  "开放边",
  "非流形边",
  "部件穿插",
  "轮廓变形",
  "烘焙接缝",
  "高低模不贴合",
];
const calc = (scores: Record<Key, number>) =>
  Math.round(
    criteria.reduce((sum, c) => sum + (scores[c.key] / 5) * c.weight, 0),
  );
const num = (n: number) => new Intl.NumberFormat("zh-CN").format(n || 0);
const date = (v: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(v));
const url = (r?: Evaluation | null) =>
  r?.fileKey ? `/api/files/${encodeURIComponent(r.fileKey)}` : null;
const highUrl = (r?: Evaluation | null) =>
  r?.referenceKey ? `/api/files/${encodeURIComponent(r.referenceKey)}` : null;
function download(content: BlobPart, name: string, type: string) {
  const u = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function reportHtml(r: Evaluation) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${r.fileName} 评测报告</title><style>body{font:15px Arial,"Microsoft YaHei";color:#172033;margin:48px;line-height:1.7}header{display:flex;justify-content:space-between;border-bottom:3px solid #625ff0}.score{font-size:46px;color:#625ff0}section{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:25px 0}section div,td,th{padding:12px;border:1px solid #e4e7ef}table{width:100%;border-collapse:collapse}.tag{display:inline-block;background:#eef0f6;padding:5px 9px;margin:3px;border-radius:20px}</style><header><div><small>TOPO AI · 低模质量评测</small><h1>${r.fileName}</h1><p>${r.id} · ${r.category} · ${date(r.createdAt)}</p></div><div><b class="score">${r.score}</b>/100<br>${r.passed ? "通过" : "不通过"}（人工判定）</div></header><section><div>顶点<br><b>${num(r.metrics.vertices)}</b></div><div>三角面<br><b>${num(r.metrics.triangles)}</b></div><div>Mesh<br><b>${r.metrics.meshes}</b></div><div>最大尺寸<br><b>${r.metrics.size}</b></div></section><h2>综合结论</h2><p>${r.summary}</p><h2>评分明细</h2><table>${criteria.map((c) => `<tr><td>${c.name}</td><td>${c.weight}%</td><td>${r.scores[c.key]}/5</td><td>${r.notes[c.key] || "—"}</td></tr>`).join("")}</table><h2>问题标签</h2>${r.issues.map((x) => `<span class="tag">${x}</span>`).join("")}<h2>模型标注</h2>${(r.annotations || []).map((a, i) => `<p>${i + 1}. [${a.severity === "serious" ? "严重" : "提醒"}] ${a.text}</p>`).join("") || "<p>无</p>"}<p>OBJ / 网格自动预检只提供“提醒”或“严重”风险标识，不参与通过判定；最终通过或不通过由评测人手动确认。</p></html>`;
}

function Button({
  variant = "",
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) {
  return <button className={`button ${variant}`} {...p} />;
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">T</span>
      <span>
        <strong>TOPO AI</strong>
        <small>模型质量评测</small>
      </span>
    </div>
  );
}
function Sidebar({ view, go }: { view: View; go: (v: View) => void }) {
  return (
    <aside className="sidebar">
      <Brand />
      <nav>
        {(
          [
            ["review", "◇", "模型评测"],
            ["library", "▦", "模型库"],
            ["pk", "⇄", "模型 PK"],
            ["analytics", "⌁", "数据分析"],
          ] as [View, string, string][]
        ).map((x) => (
          <button
            key={x[0]}
            className={view === x[0] ? "active" : ""}
            onClick={() => go(x[0])}
          >
            <span>{x[1]}</span>
            {x[2]}
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="avatar">QA</span>
        <span>
          <strong>拓扑评测</strong>
          <small>产品美术 · 质量审核</small>
        </span>
        <b>•••</b>
      </div>
    </aside>
  );
}
function Top({
  sub,
  title,
  children,
}: {
  sub: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="topbar">
      <div>
        <p>{sub}</p>
        <h1>{title}</h1>
      </div>
      <div className="top-actions">{children}</div>
    </header>
  );
}
function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className={`modal ${wide ? "wide" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button onClick={onClose}>×</button>
        </div>
        {children}
      </section>
    </div>
  );
}
function Report({ r, onClose }: { r: Evaluation; onClose: () => void }) {
  const html = reportHtml(r);
  return (
    <Modal title="评测报告" wide onClose={onClose}>
      <div className="report-preview">
        <div className="report-title">
          <div>
            <small>TOPO AI · 低模质量评测报告</small>
            <h2>{r.fileName}</h2>
            <p>
              {r.id} · {r.category} · {date(r.createdAt)}
            </p>
          </div>
          <div className="report-score">
            <b>{r.score}</b>
            <span>/100</span>
            <em className={r.passed ? "passed" : "failed"}>
              {r.passed ? "通过" : "不通过"}
            </em>
          </div>
        </div>
        <div className="report-metrics">
          <span>
            顶点<b>{num(r.metrics.vertices)}</b>
          </span>
          <span>
            三角面<b>{num(r.metrics.triangles)}</b>
          </span>
          <span>
            Mesh<b>{r.metrics.meshes}</b>
          </span>
          <span>
            最大尺寸<b>{r.metrics.size}</b>
          </span>
        </div>
        <h3>综合结论</h3>
        <p>{r.summary}</p>
        <h3>评分明细</h3>
        <div className="report-criteria">
          {criteria.map((c) => (
            <div key={c.key}>
              <span>
                {c.name}
                <small>{c.weight}%</small>
              </span>
              <b>{r.scores[c.key]}/5</b>
            </div>
          ))}
        </div>
        <h3>问题标签</h3>
        <div className="tags">
          {r.issues.map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
        <h3>模型表面标注</h3>
        <div className="report-annotations">
          {(r.annotations || []).length ? (
            (r.annotations || []).map((annotation, index) => (
              <p key={annotation.id}>
                <b>{index + 1}</b>
                <span>
                  {annotation.severity === "serious" ? "严重" : "提醒"}
                </span>
                {annotation.text}
              </p>
            ))
          ) : (
            <p>本次评测未添加模型表面标注。</p>
          )}
        </div>
      </div>
      <div className="modal-actions">
        <Button
          onClick={() =>
            download(html, `${r.fileName}-评测报告.html`, "text/html")
          }
        >
          下载 HTML
        </Button>
        <Button
          onClick={() =>
            download(
              JSON.stringify(r, null, 2),
              `${r.fileName}-评测数据.json`,
              "application/json",
            )
          }
        >
          导出 JSON
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            const w = open("", "_blank");
            if (w) {
              w.document.write(html);
              w.document.close();
              w.print();
            }
          }}
        >
          打印 / 保存 PDF
        </Button>
      </div>
    </Modal>
  );
}

function Review({
  saved,
  go,
  toast,
}: {
  saved: (r: Evaluation) => void;
  go: (v: View) => void;
  toast: (s: string) => void;
}) {
  const [evaluationId, setEvaluationId] = useState(
    () => `TK-${Date.now().toString().slice(-7)}`,
  );
  const [createdAt, setCreatedAt] = useState(() => new Date().toISOString());
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState<string | null>(null);
  const [high, setHigh] = useState<File | null>(null);
  const [highKey, setHighKey] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("人物");
  const [scores, setScores] = useState(defaultScores);
  const [notes, setNotes] = useState<Partial<Record<Key, string>>>({});
  const [metrics, setMetrics] = useState(defaultMetrics);
  const [issues, setIssues] = useState<string[]>(["局部面数不均"]);
  const [annotations, setAnnotations] = useState<ModelAnnotation[]>([]);
  const [summary, setSummary] = useState(
    "建议复核面部环线，并降低眼眶和耳根区域的局部面密度。",
  );
  const [previewMode, setPreviewMode] = useState<"shade" | "wire" | "fit">(
    "shade",
  );
  const [bakeCageDistance, setBakeCageDistance] = useState(12);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [manualVerdict, setManualVerdict] = useState<"pass" | "fail" | null>(
    null,
  );
  const [fitResult, setFitResult] = useState<FitResult | null>(null);
  const [camera, setCamera] = useState("perspective:0");
  const [report, setReport] = useState<Evaluation | null>(null);
  const [saving, setSaving] = useState(false);
  const score = calc(scores);
  const update = useCallback((m: ModelMetrics) => setMetrics(m), []);
  const updateFit = useCallback(
    (result: FitResult | null) => setFitResult(result),
    [],
  );
  const addAnnotation = useCallback(
    (position: [number, number, number]) => {
      setAnnotations((current) => [
        ...current,
        {
          id: `AN-${Date.now()}-${current.length}`,
          position,
          text: `请填写问题位置与修改建议`,
          severity: "reminder",
        },
      ]);
      toast("已在模型上添加标注点，请在下方填写问题内容");
    },
    [toast],
  );
  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [expanded]);
  const record = (status: "draft" | "complete"): Evaluation => ({
    id: evaluationId,
    fileName: file?.name || "Knight_Character_Low.obj",
    fileKey,
    referenceKey: highKey,
    category,
    source: "人工评测 + 自动预检",
    status,
    passed: status === "complete" ? manualVerdict === "pass" : false,
    score,
    scores,
    notes,
    metrics,
    issues,
    annotations,
    summary,
    createdAt,
  });
  const upload = async (f: File) => {
    const form = new FormData();
    form.append("file", f);
    const res = await fetch("/api/files", { method: "POST", body: form });
    if (!res.ok) throw 0;
    return (await res.json()).key as string;
  };
  const save = async (status: "draft" | "complete") => {
    if (status === "complete" && !manualVerdict) {
      toast("请先由评测人手动选择“通过”或“不通过”");
      return;
    }
    setSaving(true);
    let r = record(status);
    try {
      let nextFileKey = fileKey;
      let nextHighKey = highKey;
      if (file && !nextFileKey) {
        nextFileKey = await upload(file);
        setFileKey(nextFileKey);
      }
      if (high && !nextHighKey) {
        nextHighKey = await upload(high);
        setHighKey(nextHighKey);
      }
      r = {
        ...r,
        fileKey: nextFileKey,
        referenceKey: nextHighKey,
      };
      const res = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(r),
      });
      if (!res.ok) throw 0;
      r = (await res.json()).evaluation;
      saved(r);
      toast(status === "draft" ? "草稿已保存" : "评测已完成并加入模型库");
    } catch {
      saved(r);
      toast(
        status === "draft" ? "草稿已保存到当前会话" : "评测已加入当前模型库",
      );
    } finally {
      setSaving(false);
    }
    if (status === "complete") go("library");
  };
  const checks: [string, number | string, boolean, "reminder" | "serious"][] = [
    ["非流形边", metrics.nonManifold, !metrics.nonManifold, "serious"],
    ["开放边界", metrics.openEdges, !metrics.openEdges, "serious"],
    ["退化三角面", metrics.degenerate, !metrics.degenerate, "serious"],
    ["长细三角面", metrics.thinFaces, !metrics.thinFaces, "reminder"],
    [
      "高连接顶点",
      metrics.highValence,
      metrics.highValence < Math.max(8, metrics.vertices * 0.03),
      "reminder",
    ],
    ["UV 覆盖", `${metrics.uvCoverage}%`, metrics.uvCoverage > 90, "reminder"],
  ];
  const severeRisks = checks.filter(
    (item) => !item[2] && item[3] === "serious",
  );
  const reminderRisks = checks.filter(
    (item) => !item[2] && item[3] === "reminder",
  );
  const openReport = () => {
    if (!manualVerdict) {
      toast("生成正式报告前，请先人工选择通过或不通过");
      return;
    }
    setReport(record("complete"));
  };
  return (
    <>
      <Top sub="模型评测 / 新建评测" title="低模质量评测">
        <Button onClick={() => save("draft")} disabled={saving}>
          保存草稿
        </Button>
        <Button onClick={openReport}>生成报告</Button>
        <Button
          variant="primary"
          onClick={() => save("complete")}
          disabled={saving}
        >
          完成并入库
        </Button>
      </Top>
      <section className="file-strip panel">
        <div className="file-name">
          <strong>{file?.name || "Knight_Character_Low.obj"}</strong>
          <small>{file ? "已导入待评测模型" : "当前使用演示模型"}</small>
        </div>
        <label>
          模型分类
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            <option>人物</option>
            <option>场景</option>
            <option>道具</option>
            <option>其他</option>
          </select>
        </label>
        <label className="upload-button">
          <input
            type="file"
            accept=".obj,.glb,.gltf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                setFileKey(null);
                setHigh(null);
                setHighKey(null);
                setEvaluationId(`TK-${Date.now().toString().slice(-7)}`);
                setCreatedAt(new Date().toISOString());
                setScores({ ...defaultScores });
                setNotes({});
                setMetrics(defaultMetrics);
                setIssues([]);
                setAnnotations([]);
                setSummary("");
                setPreviewMode("shade");
                setBakeCageDistance(12);
                setAnnotationMode(false);
                setManualVerdict(null);
                setFitResult(null);
                setReport(null);
                toast(`已导入 ${f.name}，正在执行自动预检`);
              }
            }}
          />
          <span>● 导入低模</span>
        </label>
        <label className="upload-button">
          <input
            type="file"
            accept=".obj,.glb,.gltf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setHigh(f);
                setHighKey(null);
                setPreviewMode("fit");
                toast(`高模 ${f.name} 已载入，正在计算高低模贴合度`);
              }
            }}
          />
          <span>● 导入高模（选填）</span>
        </label>
        <div className="file-stats">
          <span>
            <b>{num(metrics.vertices)}</b>顶点
          </span>
          <span>
            <b>{metrics.meshes}</b>Mesh
          </span>
          <span>
            <b>{metrics.size}</b>最大尺寸
          </span>
        </div>
      </section>
      <div className="review-layout">
        <section
          className={`panel viewer-panel ${expanded ? "is-expanded" : ""}`}
        >
          <div className="section-head">
            <div>
              <h2>模型预览</h2>
              <p>
                拖拽旋转 · 滚轮缩放 ·
                {annotationMode ? " 单击模型表面添加标注" : " 可开启模型标注"}
              </p>
            </div>
            <div className="segmented">
              <button
                className={previewMode === "shade" ? "active" : ""}
                onClick={() => setPreviewMode("shade")}
              >
                着色模式
              </button>
              <button
                className={previewMode === "wire" ? "active" : ""}
                onClick={() => setPreviewMode("wire")}
              >
                拓扑线框
              </button>
              <button
                className={previewMode === "fit" ? "active" : ""}
                onClick={() => setPreviewMode("fit")}
              >
                高低模贴合
              </button>
              <button
                aria-label={expanded ? "退出全页模型预览" : "全页模型预览"}
                onClick={() => setExpanded((value) => !value)}
              >
                {expanded ? "退出全页" : "⛶ 全页"}
              </button>
            </div>
          </div>
          <ModelViewer
            file={file}
            highFile={high}
            wireframe={previewMode === "wire"}
            fitMode={previewMode === "fit"}
            fitDistancePercent={bakeCageDistance}
            onMetrics={update}
            onFitResult={updateFit}
            cameraCommand={camera}
            annotationMode={annotationMode}
            annotations={annotations}
            onAddAnnotation={addAnnotation}
          />
          <div className="viewer-controls">
            {[
              ["front", "正面"],
              ["side", "侧面"],
              ["top", "俯视"],
              ["perspective", "四分之三"],
            ].map((x) => (
              <button
                key={x[0]}
                onClick={() => setCamera(`${x[0]}:${Date.now()}`)}
              >
                {x[1]}
              </button>
            ))}
            <button
              className={`push-right ${annotationMode ? "active" : ""}`}
              onClick={() => setAnnotationMode((value) => !value)}
            >
              {annotationMode ? "完成标注" : "添加标注 ＋"}
            </button>
          </div>
          <div className="annotation-editor">
            <div className="annotation-title">
              <div>
                <h4>模型表面标注</h4>
                <small>修改这里的内容会同步到模型标记和评测报告</small>
              </div>
              <span>{annotations.length} 个标注点</span>
            </div>
            {annotations.length === 0 ? (
              <p className="annotation-empty">
                点击上方“添加标注”，再直接点击模型表面指出问题位置。
              </p>
            ) : (
              annotations.map((annotation, index) => (
                <div className="annotation-row" key={annotation.id}>
                  <b>{index + 1}</b>
                  <select
                    value={annotation.severity}
                    onChange={(event) =>
                      setAnnotations((current) =>
                        current.map((item) =>
                          item.id === annotation.id
                            ? {
                                ...item,
                                severity: event.target.value as
                                  | "reminder"
                                  | "serious",
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    <option value="reminder">提醒</option>
                    <option value="serious">严重</option>
                  </select>
                  <input
                    value={annotation.text}
                    onChange={(event) =>
                      setAnnotations((current) =>
                        current.map((item) =>
                          item.id === annotation.id
                            ? { ...item, text: event.target.value }
                            : item,
                        ),
                      )
                    }
                    placeholder="填写该位置的问题和修改建议"
                  />
                  <button
                    aria-label={`删除标注 ${index + 1}`}
                    onClick={() =>
                      setAnnotations((current) =>
                        current.filter((item) => item.id !== annotation.id),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
          {previewMode === "fit" && (
            <div className="fit-summary">
              <span className="fit-blue-dot" />
              蓝色：高模包裹低模，可投射烘焙
              <span className="fit-red-dot" />
              红色：低模露出、穿插或投射失败
              <label className="fit-distance-control">
                烘焙笼距离
                <input
                  type="range"
                  min="2"
                  max="25"
                  step="1"
                  value={bakeCageDistance}
                  onChange={(event) =>
                    setBakeCageDistance(Number(event.target.value))
                  }
                />
                <span>{bakeCageDistance}%</span>
              </label>
              <b>
                {high
                  ? fitResult
                    ? `可成功烘焙 ${fitResult.percent}% · 失败 ${fitResult.failedFaces} 面`
                    : "正在计算…"
                  : "请先导入高模（选填）"}
              </b>
            </div>
          )}
          <div className="auto-checks">
            <div className="section-head">
              <div>
                <h3>OBJ / 网格自动预检</h3>
                <p>自动检查用于定位风险，不代替最终人工判断</p>
              </div>
              <span
                className={`check-badge ${
                  severeRisks.length
                    ? "danger"
                    : reminderRisks.length
                      ? "reminder"
                      : ""
                }`}
              >
                {severeRisks.length
                  ? `严重 ${severeRisks.length}`
                  : reminderRisks.length
                    ? `提醒 ${reminderRisks.length}`
                    : "未发现风险"}
              </span>
            </div>
            <div className="check-grid">
              {checks.map((x) => (
                <div
                  key={x[0]}
                  className={
                    x[2] ? "okay" : x[3] === "serious" ? "serious" : "warning"
                  }
                >
                  <span>{x[2] ? "✓" : "!"}</span>
                  <p>
                    <b>{x[0]}</b>
                    <small>
                      {x[2]
                        ? "未发现明显问题"
                        : x[3] === "serious"
                          ? "严重 · 建议优先复核"
                          : "提醒 · 建议人工复核"}
                    </small>
                  </p>
                  <strong>{typeof x[1] === "number" ? num(x[1]) : x[1]}</strong>
                </div>
              ))}
            </div>
            <p className="check-note">
              自动预检只输出“提醒”或“严重”风险，不影响最终是否通过；通过与不通过必须由评测人手动选择。
            </p>
          </div>
          <div className="issue-section">
            <div className="section-head">
              <div>
                <h3>问题分类</h3>
                <p>记录具体问题，便于回溯和统计</p>
              </div>
              <b>{issues.length} 项</b>
            </div>
            <h4>通用拓扑问题</h4>
            <div className="issue-buttons">
              {issueOptions.map((x) => (
                <button
                  key={x}
                  className={issues.includes(x) ? "selected" : ""}
                  onClick={() =>
                    setIssues((cur) =>
                      cur.includes(x)
                        ? cur.filter((v) => v !== x)
                        : [...cur, x],
                    )
                  }
                >
                  {issues.includes(x) ? "✓ " : "+ "}
                  {x}
                </button>
              ))}
            </div>
            <h4>AI / 规则辅助建议</h4>
            <div className="advice-box">
              <span>✦</span>
              <p>
                {metrics.openEdges
                  ? `检测到 ${metrics.openEdges} 条开放边，建议在进入烘焙前封闭边界并检查法线方向。`
                  : metrics.thinFaces
                    ? `检测到 ${metrics.thinFaces} 个长细三角面，建议优先处理轮廓和曲率变化较弱区域。`
                    : "基础几何结构稳定。下一步建议对照高模检查轮廓、关键转折和烘焙接缝。"}
              </p>
            </div>
            <h4>总结性建议</h4>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
        </section>
        <aside className="panel scoring-panel">
          <div className="section-head">
            <div>
              <h2>质量评分</h2>
              <p>六项标准 · 具体问题均可追溯</p>
            </div>
            <span className="count-badge">6 / 6</span>
          </div>
          <div className="criteria-list">
            {criteria.map((c) => (
              <div className="criterion" key={c.key}>
                <div>
                  <span>
                    <b>{c.name}</b>
                    <small>{c.help}</small>
                  </span>
                  <strong>{c.weight}分</strong>
                </div>
                <div className="score-row">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <button
                      key={v}
                      className={scores[c.key] === v ? "active" : ""}
                      onClick={() => setScores((s) => ({ ...s, [c.key]: v }))}
                    >
                      {v}
                    </button>
                  ))}
                  <input
                    value={notes[c.key] || ""}
                    onChange={(e) =>
                      setNotes((n) => ({ ...n, [c.key]: e.target.value }))
                    }
                    placeholder="证据：记录具体位置或问题"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="total-score">
            <span>
              综合得分<small>按各项权重自动计算</small>
            </span>
            <b>
              {score}
              <small>/100</small>
            </b>
          </div>
          <div className="score-progress">
            <i style={{ width: `${score}%` }} />
          </div>
          <h3 className="verdict-title">评测结果</h3>
          <div className="verdict-buttons">
            <button
              className={manualVerdict === "pass" ? "selected pass" : ""}
              onClick={() => setManualVerdict("pass")}
            >
              ✓ 人工判定通过
            </button>
            <button
              className={manualVerdict === "fail" ? "selected fail" : ""}
              onClick={() => setManualVerdict("fail")}
            >
              × 人工判定不通过
            </button>
          </div>
          <p className="verdict-rule">
            总分、自动预检与贴合度只作为证据；最终结果完全由评测人决定。
          </p>
          <div className="score-actions">
            <Button onClick={openReport}>生成评测附件</Button>
            <Button variant="primary" onClick={() => save("complete")}>
              完成并存入模型库
            </Button>
          </div>
        </aside>
      </div>
      {report && <Report r={report} onClose={() => setReport(null)} />}
    </>
  );
}

function Library({
  records,
  setRecords,
  setPk,
  go,
  toast,
}: {
  records: Evaluation[];
  setRecords: Dispatch<SetStateAction<Evaluation[]>>;
  setPk: (s: "A" | "B", id: string) => void;
  go: (v: View) => void;
  toast: (s: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [cat, setCat] = useState<"全部" | Category>("全部"),
    [verdict, setVerdict] = useState<"全部" | "通过" | "不通过">("全部"),
    [sort, setSort] = useState("最新评测"),
    [detail, setDetail] = useState<Evaluation | null>(null),
    [report, setReport] = useState<Evaluation | null>(null),
    [hovered, setHovered] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null),
    complete = records.filter((r) => r.status === "complete");
  const list = useMemo(
    () =>
      complete
        .filter(
          (r) =>
            (!search ||
              `${r.fileName} ${r.id}`
                .toLowerCase()
                .includes(search.toLowerCase())) &&
            (cat === "全部" || r.category === cat) &&
            (verdict === "全部" || (verdict === "通过" ? r.passed : !r.passed)),
        )
        .sort((a, b) =>
          sort === "评分最高"
            ? b.score - a.score
            : sort === "评分最低"
              ? a.score - b.score
              : +new Date(b.createdAt) - +new Date(a.createdAt),
        ),
    [complete, search, cat, verdict, sort],
  );
  const pass = complete.length
      ? Math.round(
          (complete.filter((r) => r.passed).length / complete.length) * 100,
        )
      : 0,
    avg = complete.length
      ? Math.round(complete.reduce((s, r) => s + r.score, 0) / complete.length)
      : 0;
  const imported = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const raw = JSON.parse(await f.text()) as Evaluation | Evaluation[],
        next = (Array.isArray(raw) ? raw : [raw]).map((r) => ({
          ...r,
          id: r.id || `TK-${Date.now()}`,
          createdAt: r.createdAt || new Date().toISOString(),
        }));
      setRecords((cur) => [
        ...next,
        ...cur.filter((r) => !next.some((n) => n.id === r.id)),
      ]);
      next.forEach((r) =>
        fetch("/api/evaluations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(r),
        }),
      );
      toast(`已导入 ${next.length} 份评测报告`);
    } catch {
      toast("导入失败：请选择本站导出的 JSON 报告");
    }
    e.target.value = "";
  };
  return (
    <>
      <Top sub="模型库 / 历史评测档案" title="模型评测库">
        <input
          hidden
          ref={input}
          type="file"
          accept=".json"
          onChange={imported}
        />
        <Button onClick={() => input.current?.click()}>↥ 导入评测报告</Button>
      </Top>
      <section className="library-hero panel">
        <div>
          <small>统一管理模型、报告与问题记录</small>
          <h2>每一次评测，都会沉淀为可检索的模型档案</h2>
          <p>查看完整评测、问题证据与自动预检，也可以直接把记录送入模型 PK。</p>
        </div>
        <div className="hero-stats">
          <span>
            <small>评测记录</small>
            <b>{complete.length}</b>
          </span>
          <span>
            <small>通过率</small>
            <b>{pass}%</b>
          </span>
          <span>
            <small>平均分</small>
            <b>{avg}</b>
          </span>
          <span>
            <small>草稿</small>
            <b>{records.filter((r) => r.status === "draft").length}</b>
          </span>
        </div>
      </section>
      <section className="library-filters">
        <label className="search-box">
          ⌕
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索模型名、编号…"
          />
        </label>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value as "全部" | Category)}
        >
          <option>全部</option>
          <option>人物</option>
          <option>场景</option>
          <option>道具</option>
          <option>其他</option>
        </select>
        <div className="filter-tabs">
          {(["全部", "通过", "不通过"] as const).map((x) => (
            <button
              key={x}
              className={verdict === x ? "active" : ""}
              onClick={() => setVerdict(x)}
            >
              {x}
            </button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option>最新评测</option>
          <option>评分最高</option>
          <option>评分最低</option>
        </select>
      </section>
      <div className="model-grid">
        {list.map((r, i) => (
          <article
            className="model-card panel"
            key={r.id}
            onMouseEnter={() => setHovered(r.id)}
            onMouseLeave={() => setHovered(null)}
          >
            {hovered === r.id && (
              <div className="model-hover-preview" aria-hidden="true">
                <ModelViewer
                  url={url(r)}
                  color="#7774ef"
                  className="library-hover-canvas"
                />
                <span>鼠标悬浮即可实时预览模型</span>
              </div>
            )}
            <div className="model-card-head">
              <span className="record-index">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <small>
                  历史记录　<em>{r.category}</em>
                </small>
                <h3>{r.fileName}</h3>
                <p>
                  完成评测 {r.id} · {date(r.createdAt)}
                </p>
              </div>
              <span className={`status ${r.passed ? "passed" : "failed"}`}>
                {r.passed ? "通过" : "不通过"}
              </span>
            </div>
            <div className="card-score">
              <span>
                <small>综合得分</small>
                <b>
                  {r.score}
                  <i>/100</i>
                </b>
              </span>
              <div className="mini-bars">
                {criteria.map((c) => (
                  <i
                    key={c.key}
                    style={{ height: `${r.scores[c.key] * 14}%` }}
                  />
                ))}
              </div>
            </div>
            <p className="card-summary">{r.summary}</p>
            <div className="tags">
              {r.issues.slice(0, 3).map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
            <div className="card-meta">
              <span>⌁ {num(r.metrics.vertices)} 顶点</span>
              <span>△ {num(r.metrics.triangles)} 三角面</span>
              <span>＋ {r.issues.length} 项记录</span>
            </div>
            <div className="card-actions">
              <Button variant="ghost" onClick={() => setDetail(r)}>
                查看详情
              </Button>
              <Button variant="ghost" onClick={() => setReport(r)}>
                放大预览
              </Button>
              <span />
              <Button
                onClick={() => {
                  setPk("A", r.id);
                  go("pk");
                }}
              >
                设为 PK A
              </Button>
              <Button
                variant="success"
                onClick={() => {
                  setPk("B", r.id);
                  go("pk");
                }}
              >
                设为 PK B
              </Button>
            </div>
          </article>
        ))}
      </div>
      {detail && (
        <Modal title="模型评测详情" wide onClose={() => setDetail(null)}>
          <div className="detail-layout">
            <ModelViewer
              url={url(detail)}
              highUrl={highUrl(detail)}
              color="#7571ef"
              wireframe
              annotations={detail.annotations || []}
            />
            <div className="detail-info">
              <div className="detail-score">
                <b>{detail.score}</b>
                <span>/100</span>
                <em className={detail.passed ? "passed" : "failed"}>
                  {detail.passed ? "通过" : "不通过"}
                </em>
              </div>
              <h2>{detail.fileName}</h2>
              <p>{detail.summary}</p>
              {criteria.map((c) => (
                <div className="detail-row" key={c.key}>
                  <span>{c.name}</span>
                  <b>{detail.scores[c.key]}/5</b>
                </div>
              ))}
              <div className="modal-actions">
                <Button onClick={() => setReport(detail)}>生成报告</Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (confirm(`确定删除 ${detail.fileName} 吗？`)) {
                      setRecords((cur) =>
                        cur.filter((x) => x.id !== detail.id),
                      );
                      fetch(`/api/evaluations?id=${detail.id}`, {
                        method: "DELETE",
                      });
                      setDetail(null);
                      toast("评测档案已删除");
                    }
                  }}
                >
                  删除档案
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
      {report && <Report r={report} onClose={() => setReport(null)} />}
    </>
  );
}

function PK({
  records,
  a,
  b,
  setA,
  setB,
  toast,
}: {
  records: Evaluation[];
  a: string;
  b: string;
  setA: (v: string) => void;
  setB: (v: string) => void;
  toast: (s: string) => void;
}) {
  const list = records.filter((r) => r.status === "complete");
  const A = list.find((r) => r.id === a) || list[0];
  const B = list.find((r) => r.id === b) || list[1] || list[0];
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [metricsA, setMetricsA] = useState(A.metrics);
  const [metricsB, setMetricsB] = useState(B.metrics);
  const [winner, setWinner] = useState("平局");
  const [notes, setNotes] = useState("");
  const [camera, setCamera] = useState("perspective:0");
  const scoreA = fileA ? null : A.score;
  const scoreB = fileB ? null : B.score;
  const suggestion =
    scoreA === null || scoreB === null
      ? "待人工判断"
      : scoreA === scoreB
        ? "平局"
        : scoreA > scoreB
          ? "A"
          : "B";
  const chooseRecord = (slot: "A" | "B", id: string) => {
    const selected = list.find((record) => record.id === id);
    if (slot === "A") {
      setA(id);
      setFileA(null);
      if (selected) setMetricsA(selected.metrics);
    } else {
      setB(id);
      setFileB(null);
      if (selected) setMetricsB(selected.metrics);
    }
  };
  const save = async () => {
    try {
      const res = await fetch("/api/pk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          modelAId: fileA ? `upload:${fileA.name}` : A.id,
          modelBId: fileB ? `upload:${fileB.name}` : B.id,
          winner,
          notes,
        }),
      });
      if (!res.ok) throw 0;
      toast("PK 结果已保存");
    } catch {
      toast("PK 结果已保存到当前会话");
    }
  };
  return (
    <>
      <Top sub="模型 PK / 欢迎选择 A 与 B" title="模型双档对比">
        <Button
          onClick={() => {
            setA(B.id);
            setB(A.id);
            setFileA(fileB);
            setFileB(fileA);
            setMetricsA(metricsB);
            setMetricsB(metricsA);
          }}
        >
          ⇄ 交换 A / B
        </Button>
        <Button variant="primary" onClick={save}>
          保存 PK 结果
        </Button>
      </Top>
      <section className="pk-hero panel">
        <div>
          <small>模型质量 PK · 共 {list.length} 条记录</small>
          <h2>模型 A 与模型 B 公开选择，互不占用</h2>
          <p>比较评分、几何数据、问题证据与评测结论。</p>
        </div>
        <div className="winner-chip">
          <small>当前建议</small>
          <b>
            {suggestion === "待人工判断"
              ? suggestion
              : suggestion === "平局"
                ? "平局"
                : `模型 ${suggestion}`}
          </b>
          <span>
            {scoreA === null || scoreB === null
              ? "独立导入模型需人工评分"
              : `${Math.abs(scoreA - scoreB)} 分`}
          </span>
        </div>
      </section>
      <section className="panel pk-select-panel">
        <div>
          <label>
            模型 A · 紫色槽位
            <select
              value={A.id}
              onChange={(e) => chooseRecord("A", e.target.value)}
            >
              {list.map((r) => (
                <option key={r.id} value={r.id}>
                  [{r.category}] {r.fileName}
                </option>
              ))}
            </select>
          </label>
          <div className="pk-import-row">
            <small>
              {fileA
                ? `临时导入 · ${fileA.name}`
                : `${A.id} · ${date(A.createdAt)}`}
            </small>
            <label className="pk-upload">
              <input
                type="file"
                accept=".obj"
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  if (selected) {
                    setFileA(selected);
                    toast(`模型 A 已独立导入 ${selected.name}`);
                  }
                }}
              />
              独立导入 OBJ A
            </label>
          </div>
        </div>
        <span className="versus">VS</span>
        <div>
          <label>
            模型 B · 绿色槽位
            <select
              value={B.id}
              onChange={(e) => chooseRecord("B", e.target.value)}
            >
              {list.map((r) => (
                <option key={r.id} value={r.id}>
                  [{r.category}] {r.fileName}
                </option>
              ))}
            </select>
          </label>
          <div className="pk-import-row">
            <small>
              {fileB
                ? `临时导入 · ${fileB.name}`
                : `${B.id} · ${date(B.createdAt)}`}
            </small>
            <label className="pk-upload">
              <input
                type="file"
                accept=".obj"
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  if (selected) {
                    setFileB(selected);
                    toast(`模型 B 已独立导入 ${selected.name}`);
                  }
                }}
              />
              独立导入 OBJ B
            </label>
          </div>
        </div>
      </section>
      <section className="panel pk-viewer-panel">
        <div className="section-head">
          <div>
            <h2>同步模型视图</h2>
            <p>使用同一视角检查轮廓、面流与结构差异</p>
          </div>
          <div className="viewer-controls compact">
            {[
              ["front", "正面"],
              ["side", "侧面"],
              ["top", "俯视"],
              ["perspective", "四分之三"],
            ].map((x) => (
              <button
                key={x[0]}
                onClick={() => setCamera(`${x[0]}:${Date.now()}`)}
              >
                {x[1]}
              </button>
            ))}
          </div>
        </div>
        <div className="pk-viewers">
          {[
            {
              record: A,
              label: "A",
              color: "#7774ef",
              file: fileA,
              metrics: metricsA,
              onMetrics: setMetricsA,
            },
            {
              record: B,
              label: "B",
              color: "#11b8aa",
              file: fileB,
              metrics: metricsB,
              onMetrics: setMetricsB,
            },
          ].map((x) => (
            <div className={`pk-view ${x.label.toLowerCase()}`} key={x.label}>
              <div className="pk-model-head">
                <span>{x.label}</span>
                <p>
                  <b>{x.file?.name || x.record.fileName}</b>
                  <small>
                    {x.file ? "独立导入 OBJ · 未评测" : x.record.id}
                  </small>
                </p>
                <em
                  className={
                    x.file ? "temporary" : x.record.passed ? "passed" : "failed"
                  }
                >
                  {x.file ? "临时导入" : x.record.passed ? "通过" : "不通过"}
                </em>
              </div>
              <ModelViewer
                file={x.file}
                url={x.file ? null : url(x.record)}
                color={x.color}
                cameraCommand={camera}
                onMetrics={x.onMetrics}
              />
              <div className="pk-metrics">
                <span>
                  <b>{num(x.metrics.vertices)}</b>顶点
                </span>
                <span>
                  <b>{x.metrics.meshes}</b>Mesh
                </span>
                <span>
                  <b>{x.metrics.size}</b>最大尺寸
                </span>
              </div>
            </div>
          ))}
          <span className="viewer-vs">VS</span>
        </div>
      </section>
      <section className="panel comparison-panel">
        <div className="section-head">
          <div>
            <h2>维度评分对比</h2>
            <p>相同权重、相同判定标准，差异一目了然</p>
          </div>
          <div className="compare-total">
            模型 A <b>{scoreA ?? "—"}</b>
            <span>
              模型 B <b>{scoreB ?? "—"}</b>
            </span>
          </div>
        </div>
        <div className="compare-table">
          {criteria.map((c) => {
            const av = fileA ? null : A.scores[c.key];
            const bv = fileB ? null : B.scores[c.key];
            return (
              <div className="compare-row" key={c.key}>
                <span
                  className={
                    av !== null && bv !== null && av >= bv ? "best" : ""
                  }
                >
                  {av === null ? "—" : `${av}/5`}
                  <small>
                    {av === null
                      ? "独立导入模型待人工评分"
                      : A.notes[c.key] || "查看详情获取证据"}
                  </small>
                </span>
                <div>
                  <b>{c.name}</b>
                  <small>
                    {c.weight}% 权重 · {c.help}
                  </small>
                  <em>
                    {av === null || bv === null
                      ? "待评分"
                      : av === bv
                        ? "持平"
                        : av > bv
                          ? "A 领先"
                          : "B 领先"}
                  </em>
                </div>
                <span
                  className={
                    av !== null && bv !== null && bv >= av ? "best green" : ""
                  }
                >
                  {bv === null ? "—" : `${bv}/5`}
                  <small>
                    {bv === null
                      ? "独立导入模型待人工评分"
                      : B.notes[c.key] || "查看详情获取证据"}
                  </small>
                </span>
              </div>
            );
          })}
        </div>
      </section>
      <section className="panel decision-panel">
        <div className="decision-result">
          <small>对比建议</small>
          <b>
            {suggestion === "待人工判断"
              ? suggestion
              : suggestion === "平局"
                ? "暂定平局"
                : `模型 ${suggestion}`}
          </b>
          <span>
            {scoreA ?? "—"} : {scoreB ?? "—"}
          </span>
        </div>
        <div className="decision-controls">
          <label>
            人工最终结论
            <div className="verdict-buttons three">
              {["A", "平局", "B"].map((x) => (
                <button
                  key={x}
                  className={winner === x ? "selected" : ""}
                  onClick={() => setWinner(x)}
                >
                  模型 {x}
                </button>
              ))}
            </div>
          </label>
          <label>
            PK 结论与证据
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="记录选择原因、适用场景和需要复核的差异…"
            />
          </label>
        </div>
        <Button variant="primary" onClick={save}>
          确认并保存 PK 结果
        </Button>
      </section>
    </>
  );
}

function Analytics({ records }: { records: Evaluation[] }) {
  const list = records.filter((r) => r.status === "complete"),
    passed = list.filter((r) => r.passed).length,
    rate = list.length ? Math.round((passed / list.length) * 100) : 0,
    avg = list.length
      ? Math.round(list.reduce((s, r) => s + r.score, 0) / list.length)
      : 0;
  const issues = useMemo(() => {
    const m = new Map<string, number>();
    list.forEach((r) => r.issues.forEach((x) => m.set(x, (m.get(x) || 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [list]);
  const cats = (["人物", "场景", "道具", "其他"] as Category[]).map((c) => {
    const x = list.filter((r) => r.category === c);
    return {
      c,
      n: x.length,
      avg: x.length
        ? Math.round(x.reduce((s, r) => s + r.score, 0) / x.length)
        : 0,
      rate: x.length
        ? Math.round((x.filter((r) => r.passed).length / x.length) * 100)
        : 0,
    };
  });
  const dims = criteria.map((c) => ({
    ...c,
    avg: list.length
      ? list.reduce((s, r) => s + r.scores[c.key], 0) / list.length
      : 0,
  }));
  const csv = () => {
    const rows = [
      [
        "编号",
        "模型",
        "分类",
        "总分",
        "结果",
        ...criteria.map((c) => c.name),
        "问题",
      ],
      ...list.map((r) => [
        r.id,
        r.fileName,
        r.category,
        r.score,
        r.passed ? "通过" : "不通过",
        ...criteria.map((c) => r.scores[c.key]),
        r.issues.join("|"),
      ]),
    ];
    download(
      "\ufeff" +
        rows
          .map((r) =>
            r.map((x) => `"${String(x).replaceAll('"', '""')}"`).join(","),
          )
          .join("\n"),
      "TOPO-AI-评测数据分析.csv",
      "text/csv",
    );
  };
  return (
    <>
      <Top sub="数据分析 / 评测质量总览" title="评测数据分析">
        <Button onClick={csv}>导出分析数据</Button>
      </Top>
      <section className="analytics-hero panel">
        <div>
          <small>评测数据总览</small>
          <h2>从模型库记录中快速发现质量趋势</h2>
          <p>
            按品类、评分维度和高频问题回看评测结果，辅助确定下一轮修模重点。
          </p>
        </div>
        <div className="hero-stats">
          <span>
            <small>评测总量</small>
            <b>{list.length}</b>
          </span>
          <span>
            <small>整体通过率</small>
            <b>{rate}%</b>
          </span>
          <span>
            <small>平均得分</small>
            <b>{avg}</b>
          </span>
          <span>
            <small>累计问题记录</small>
            <b>{list.reduce((s, r) => s + r.issues.length, 0)}</b>
          </span>
        </div>
      </section>
      <section className="panel category-panel">
        <div className="section-head">
          <div>
            <h2>分类表现</h2>
            <p>数量、平均分和通过率按模型类型汇总</p>
          </div>
        </div>
        <div className="category-grid">
          {cats.map((x, i) => (
            <div key={x.c}>
              <span className={`category-icon c${i}`}>{x.c[0]}</span>
              <p>
                <b>{x.c}</b>
                <small>{x.n} 条评测</small>
              </p>
              <strong>均分 {x.avg || "—"}</strong>
              <div>
                <i style={{ width: `${x.rate}%` }} />
              </div>
              <small>通过率 {x.n ? `${x.rate}%` : "—"}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="panel issue-ranking">
        <div className="section-head">
          <div>
            <small>高频问题</small>
            <h2>问题频次与改进建议</h2>
            <p>优先处理出现频率最高的风险。</p>
          </div>
          <span>问题标签 Top 5</span>
        </div>
        <div className="issue-table">
          {issues.slice(0, 5).map(([x, n], i) => (
            <div key={x}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <p>
                <b>{x}</b>
                <small>
                  {n} 次出现 · 占{" "}
                  {list.length ? Math.round((n / list.length) * 100) : 0}%
                </small>
              </p>
              <p>
                <small>影响说明</small>
                {x.includes("开放") || x.includes("非流形")
                  ? "可能导致烘焙、法线和后续编辑失败"
                  : "会降低形体可读性或低模制作效率"}
              </p>
              <p>
                <small>改进建议</small>
                {x.includes("面数")
                  ? "重新分配密度，把面数集中在轮廓和变形区域。"
                  : "定位具体证据，修复后重新执行自动预检。"}
              </p>
              <em>{n >= 3 ? "重点复查" : "持续关注"}</em>
            </div>
          ))}
        </div>
      </section>
      <div className="analytics-grid">
        <section className="panel dimension-chart">
          <div className="section-head">
            <div>
              <h2>评分维度均值</h2>
              <p>按 5 分制查看六项标准表现</p>
            </div>
          </div>
          {dims.map((x) => (
            <div key={x.key}>
              <span>{x.name}</span>
              <i>
                <b style={{ width: `${(x.avg / 5) * 100}%` }} />
              </i>
              <strong>{x.avg.toFixed(1)}</strong>
            </div>
          ))}
        </section>
        <section className="panel issue-chart">
          <div className="section-head">
            <div>
              <h2>问题频次</h2>
              <p>最常见的五项风险</p>
            </div>
          </div>
          {issues.slice(0, 5).map(([x, n], i) => (
            <div key={x}>
              <span>
                {String(i + 1).padStart(2, "0")}　{x}
              </span>
              <i>
                <b
                  style={{
                    width: `${issues[0] ? (n / issues[0][1]) * 100 : 0}%`,
                  }}
                />
              </i>
              <strong>{n} 次</strong>
            </div>
          ))}
        </section>
        <section className="panel verdict-chart">
          <div className="section-head">
            <div>
              <h2>综合分布</h2>
              <p>评测结果数量</p>
            </div>
          </div>
          <div className="verdict-columns">
            <span>
              <i style={{ height: "12%" }} />
              <b>{records.filter((r) => r.status === "draft").length}</b>
              <small>草稿</small>
            </span>
            <span>
              <i
                className="green"
                style={{ height: `${Math.max(18, rate)}%` }}
              />
              <b>{passed}</b>
              <small>通过</small>
            </span>
            <span>
              <i
                className="red"
                style={{ height: `${Math.max(18, 100 - rate)}%` }}
              />
              <b>{list.length - passed}</b>
              <small>不通过</small>
            </span>
          </div>
        </section>
        <section className="panel recent-list">
          <div className="section-head">
            <div>
              <h2>最近评测</h2>
              <p>最新模型档案</p>
            </div>
          </div>
          {list.slice(0, 5).map((r) => (
            <div key={r.id}>
              <span>{r.category[0]}</span>
              <p>
                <b>{r.fileName}</b>
                <small>{date(r.createdAt)}</small>
              </p>
              <strong>{r.score}</strong>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("review"),
    [records, setRecords] = useState<Evaluation[]>(data),
    [a, setA] = useState(data[0].id),
    [b, setB] = useState(data[1].id),
    [toastText, setToast] = useState("");
  const toast = useCallback((s: string) => {
      setToast(s);
      setTimeout(() => setToast(""), 2600);
    }, []),
    go = useCallback((v: View) => {
      setView(v);
      location.hash = v;
      scrollTo({ top: 0, behavior: "smooth" });
    }, []);
  useEffect(() => {
    const hash = () => {
      const x = location.hash.slice(1) as View;
      if (["review", "library", "pk", "analytics"].includes(x)) setView(x);
    };
    hash();
    addEventListener("hashchange", hash);
    fetch("/api/evaluations")
      .then((r) => {
        if (!r.ok) throw 0;
        return r.json();
      })
      .then((x) => {
        if (x.evaluations?.length) {
          setRecords(x.evaluations);
          setA(x.evaluations[0].id);
          setB(x.evaluations[1]?.id || x.evaluations[0].id);
        }
      })
      .catch(() => {});
    return () => removeEventListener("hashchange", hash);
  }, []);
  const saved = (r: Evaluation) =>
    setRecords((cur) => [r, ...cur.filter((x) => x.id !== r.id)]);
  return (
    <div className="app-shell">
      <Sidebar view={view} go={go} />
      <main className="main-content">
        {view === "review" && <Review saved={saved} go={go} toast={toast} />}
        {view === "library" && (
          <Library
            records={records}
            setRecords={setRecords}
            setPk={(s, id) => (s === "A" ? setA(id) : setB(id))}
            go={go}
            toast={toast}
          />
        )}
        {view === "pk" && (
          <PK
            records={records}
            a={a}
            b={b}
            setA={setA}
            setB={setB}
            toast={toast}
          />
        )}
        {view === "analytics" && <Analytics records={records} />}
      </main>
      {toastText && <div className="toast">✓ {toastText}</div>}
    </div>
  );
}
