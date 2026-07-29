import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { evaluations } from "../../../db/schema";

type Input = {
  id?: string;
  fileName?: string;
  fileKey?: string | null;
  referenceKey?: string | null;
  category?: string;
  source?: string;
  status?: string;
  passed?: boolean;
  score?: number;
  scores?: Record<string, number>;
  notes?: Record<string, string>;
  metrics?: Record<string, number | string>;
  issues?: string[];
  annotations?: {
    id: string;
    position: [number, number, number];
    text: string;
    severity: "reminder" | "serious";
  }[];
  summary?: string;
  createdAt?: string;
};

const seeds: Input[] = [
  {
    id: "TK-024",
    fileName: "Scout_Character_Low_B.obj",
    category: "人物",
    passed: true,
    score: 73,
    scores: {
      silhouette: 4,
      topology: 3,
      flow: 4,
      detail: 3,
      efficiency: 4,
      bake: 4,
    },
    metrics: {
      vertices: 8840,
      triangles: 17120,
      meshes: 6,
      size: "1.82 m",
      openEdges: 0,
    },
    issues: ["局部面数不均"],
    summary: "结构稳定，布线和轮廓表现较均衡；建议收紧肩部与手关节区域。",
    createdAt: "2026-07-28T16:40:00.000Z",
  },
  {
    id: "TK-019",
    fileName: "Runner_Character_Low_C.obj",
    category: "人物",
    passed: false,
    score: 52,
    scores: {
      silhouette: 4,
      topology: 2,
      flow: 2,
      detail: 2,
      efficiency: 3,
      bake: 2,
    },
    metrics: {
      vertices: 7420,
      triangles: 14260,
      meshes: 5,
      size: "1.79 m",
      openEdges: 18,
    },
    issues: ["开放边", "拓扑中断", "烘焙风险"],
    summary: "轮廓尚可，但存在开放边和结构中断，当前不建议进入烘焙。",
    createdAt: "2026-07-27T11:15:00.000Z",
  },
  {
    id: "TK-018",
    fileName: "OldTown_Alley_Low.obj",
    category: "场景",
    passed: true,
    score: 77,
    scores: {
      silhouette: 4,
      topology: 4,
      flow: 4,
      detail: 3,
      efficiency: 4,
      bake: 4,
    },
    metrics: {
      vertices: 12680,
      triangles: 24110,
      meshes: 18,
      size: "8.40 m",
      openEdges: 0,
    },
    issues: ["局部面数不均"],
    summary: "场景轮廓清晰，结构分区和密度控制稳定，可进入后续制作。",
    createdAt: "2026-07-26T15:20:00.000Z",
  },
  {
    id: "TK-016",
    fileName: "Industrial_Room_Low.obj",
    category: "场景",
    passed: false,
    score: 48,
    scores: {
      silhouette: 3,
      topology: 3,
      flow: 2,
      detail: 2,
      efficiency: 3,
      bake: 2,
    },
    metrics: {
      vertices: 15640,
      triangles: 30420,
      meshes: 26,
      size: "11.20 m",
      openEdges: 8,
    },
    issues: ["长细面", "部件穿插", "烘焙不稳定"],
    summary: "主体空间可读，但长细面和穿插会给法线与烘焙带来风险。",
    createdAt: "2026-07-25T10:05:00.000Z",
  },
  {
    id: "TK-014",
    fileName: "Bone_Axe_Prop_Low.obj",
    category: "道具",
    passed: true,
    score: 85,
    scores: {
      silhouette: 5,
      topology: 4,
      flow: 4,
      detail: 4,
      efficiency: 5,
      bake: 4,
    },
    metrics: {
      vertices: 3680,
      triangles: 7020,
      meshes: 3,
      size: "0.92 m",
      openEdges: 0,
    },
    issues: ["末端可再减面"],
    summary: "造型识别明确，拓扑和面数控制均衡，是完成度较高的低模资产。",
    createdAt: "2026-07-24T17:35:00.000Z",
  },
  {
    id: "TK-012",
    fileName: "Field_Radio_Prop_Low.obj",
    category: "道具",
    passed: true,
    score: 75,
    scores: {
      silhouette: 4,
      topology: 4,
      flow: 4,
      detail: 3,
      efficiency: 4,
      bake: 4,
    },
    metrics: {
      vertices: 4980,
      triangles: 9460,
      meshes: 7,
      size: "0.48 m",
      openEdges: 0,
    },
    issues: ["圆角面数不均"],
    summary: "整体满足低模要求，建议优化旋钮和边缘圆角的密度分布。",
    createdAt: "2026-07-23T09:40:00.000Z",
  },
];

function parse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
function serialize(row: typeof evaluations.$inferSelect) {
  const storedNotes = parse<Record<string, unknown>>(row.notesJson, {});
  const annotations = Array.isArray(storedNotes.__annotations)
    ? storedNotes.__annotations
    : [];
  delete storedNotes.__annotations;
  return {
    id: row.id,
    fileName: row.fileName,
    fileKey: row.fileKey,
    referenceKey: row.referenceKey,
    category: row.category,
    source: row.source,
    status: row.status,
    passed: row.passed,
    score: row.score,
    scores: parse(row.scoresJson, {}),
    notes: storedNotes,
    metrics: parse(row.metricsJson, {}),
    issues: parse(row.issuesJson, []),
    annotations,
    summary: row.summary,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
function values(input: Input) {
  const now = new Date().toISOString();
  return {
    id: input.id || `TK-${Date.now().toString().slice(-7)}`,
    fileName: input.fileName?.trim() || "未命名模型.obj",
    fileKey: input.fileKey ?? null,
    referenceKey: input.referenceKey ?? null,
    category: input.category || "其他",
    source: input.source || "人工评测",
    status: input.status || "complete",
    passed: Boolean(input.passed),
    score: Math.max(0, Math.min(100, Math.round(input.score || 0))),
    scoresJson: JSON.stringify(input.scores || {}),
    notesJson: JSON.stringify({
      ...(input.notes || {}),
      __annotations: input.annotations || [],
    }),
    metricsJson: JSON.stringify(input.metrics || {}),
    issuesJson: JSON.stringify(input.issues || []),
    summary: input.summary || "",
    createdAt: input.createdAt || now,
    updatedAt: now,
  };
}

export async function GET() {
  try {
    const db = await getDb();
    if ((await db.select().from(evaluations).limit(1)).length === 0)
      await db.insert(evaluations).values(seeds.map(values));
    return Response.json({
      evaluations: (
        await db.select().from(evaluations).orderBy(desc(evaluations.createdAt))
      ).map(serialize),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "无法读取模型档案" },
      { status: 500 },
    );
  }
}
export async function POST(request: Request) {
  try {
    const input = (await request.json()) as Input;
    const db = await getDb();
    const row = values(input);
    await db
      .insert(evaluations)
      .values(row)
      .onConflictDoUpdate({
        target: evaluations.id,
        set: { ...row, createdAt: input.createdAt || row.createdAt },
      });
    const [saved] = await db
      .select()
      .from(evaluations)
      .where(eq(evaluations.id, row.id))
      .limit(1);
    return Response.json({ evaluation: serialize(saved) }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "保存失败" },
      { status: 500 },
    );
  }
}
export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "缺少记录 ID" }, { status: 400 });
  try {
    const db = await getDb();
    await db.delete(evaluations).where(eq(evaluations.id, id));
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "删除失败" },
      { status: 500 },
    );
  }
}
