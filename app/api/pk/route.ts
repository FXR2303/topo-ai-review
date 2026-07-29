import { getDb } from "../../../db";
import { pkComparisons } from "../../../db/schema";

export async function POST(request:Request) {
  try {
    const payload=await request.json() as {modelAId?:string;modelBId?:string;winner?:string;notes?:string};
    if(!payload.modelAId||!payload.modelBId||!payload.winner) return Response.json({error:"请选择 A、B 模型和结论"},{status:400});
    const id=`PK-${Date.now()}`; const db=await getDb();
    await db.insert(pkComparisons).values({id,modelAId:payload.modelAId,modelBId:payload.modelBId,winner:payload.winner,notes:payload.notes||"",createdAt:new Date().toISOString()});
    return Response.json({comparison:{id,...payload}},{status:201});
  } catch(error){return Response.json({error:error instanceof Error?error.message:"PK 结果保存失败"},{status:500});}
}
