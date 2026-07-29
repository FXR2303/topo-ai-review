export async function GET(_request:Request,context:{params:Promise<{id:string}>}){
  try{
    const {id}=await context.params; const {env}=await import("cloudflare:workers"); const bucket=(env as unknown as {BUCKET?:R2Bucket}).BUCKET;
    if(!bucket) throw new Error("文件存储尚未绑定"); const object=await bucket.get(decodeURIComponent(id));
    if(!object) return new Response("File not found",{status:404});
    const headers=new Headers(); object.writeHttpMetadata(headers); headers.set("etag",object.httpEtag); headers.set("cache-control","private, max-age=3600");
    return new Response(object.body,{headers});
  }catch(error){return Response.json({error:error instanceof Error?error.message:"文件读取失败"},{status:500});}
}
