import { NextResponse } from "next/server";
import { requireRequestUser } from "@/lib/supabase/route-auth";
import { READ_ONLY_MODE } from "@/lib/maintenance";
import { detectSupportedImage, MAX_IMAGE_BYTES } from "@/lib/uploads/image-validation";

export async function POST(request) {
  if (READ_ONLY_MODE) {
    return NextResponse.json({ error: "Modo somente leitura" }, { status: 503 });
  }

  const authorization = await requireRequestUser(request);
  if (authorization.error) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Envie uma imagem de até 2 MB." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectSupportedImage(bytes);
  if (!detected) {
    return NextResponse.json({ error: "O arquivo não é PNG, JPEG ou WebP válido." }, { status: 415 });
  }

  const path = `${authorization.user.id}/${crypto.randomUUID()}.${detected.extension}`;
  const { error: uploadError } = await authorization.userClient.storage
    .from("shields")
    .upload(path, bytes, { contentType: detected.mime, upsert: false, cacheControl: "3600" });
  if (uploadError) return NextResponse.json({ error: "Falha ao armazenar o escudo." }, { status: 400 });

  const { data: { publicUrl } } = authorization.userClient.storage.from("shields").getPublicUrl(path);
  const { error: updateError } = await authorization.userClient.rpc("update_team_identity", {
    p_badge_url: publicUrl,
    p_uniform_url: null,
  });
  if (updateError) {
    await authorization.userClient.storage.from("shields").remove([path]);
    return NextResponse.json({ error: "Falha ao vincular o escudo ao clube." }, { status: 400 });
  }

  return NextResponse.json({ url: publicUrl });
}
