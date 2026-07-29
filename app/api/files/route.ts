const extensions = new Set([
  "obj",
  "glb",
  "gltf",
  "png",
  "jpg",
  "jpeg",
  "webp",
]);
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return Response.json({ error: "请选择要上传的文件" }, { status: 400 });
    const extension = (file.name.split(".").pop() || "bin").toLowerCase();
    if (!extensions.has(extension))
      return Response.json(
        { error: "仅支持 OBJ、GLB、GLTF、PNG、JPG 和 WEBP" },
        { status: 400 },
      );
    if (file.size > 80 * 1024 * 1024)
      return Response.json({ error: "单个文件不能超过 80MB" }, { status: 413 });
    const { env } = await import("cloudflare:workers");
    const bucket = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
    if (!bucket) throw new Error("文件存储尚未绑定");
    const key = `${crypto.randomUUID()}.${extension}`;
    await bucket.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
      customMetadata: { originalName: file.name },
    });
    return Response.json({
      key,
      name: file.name,
      size: file.size,
      url: `/api/files/${encodeURIComponent(key)}`,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "文件上传失败" },
      { status: 500 },
    );
  }
}
