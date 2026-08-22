import { NextResponse } from "next/server";
import { READ_ONLY_MODE } from "@/lib/maintenance";
import { detectSupportedImage, MAX_IMAGE_BYTES } from "@/lib/uploads/image-validation";
import { requireAdminUser } from "@/lib/supabase/route-auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request) {
  if (READ_ONLY_MODE) return NextResponse.json({ error: "Modo somente leitura" }, { status: 503 });
  const authorization = await requireAdminUser();
  if (authorization.error) {
    return NextResponse.json({ error: authorization.error }, { status: authorization.status });
  }
  const form = await request.formData();
  const kind = form.get("kind");
  const file = form.get("file");
  const bucket = kind === "shield" ? "shields" : kind === "trophy" ? "trophies" : null;
  if (!bucket) return NextResponse.json({ error: "Tipo de imagem inválido." }, { status: 400 });
  const hasFile = file instanceof File && file.size > 0;
  if (kind === "shield" && !hasFile) {
    return NextResponse.json({ error: "Envie uma imagem de até 2 MB." }, { status: 400 });
  }

  let path = null;
  let publicUrl = null;
  if (hasFile) {
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Envie uma imagem de até 2 MB." }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectSupportedImage(bytes);
    if (!detected) return NextResponse.json({ error: "Use PNG, JPEG ou WebP válido." }, { status: 415 });
    path = `admin/${crypto.randomUUID()}.${detected.extension}`;
    const upload = await authorization.serviceClient.storage.from(bucket)
      .upload(path, bytes, { contentType: detected.mime, upsert: false, cacheControl: "3600" });
    if (upload.error) return NextResponse.json({ error: "Falha ao armazenar a imagem." }, { status: 400 });
    ({ data: { publicUrl } } = authorization.serviceClient.storage.from(bucket).getPublicUrl(path));
  }

  let mutation;
  if (kind === "shield") {
    const teamId = form.get("teamId");
    if (typeof teamId !== "string" || !UUID.test(teamId)) mutation = { error: new Error("Clube inválido.") };
    else mutation = await authorization.serviceClient.from("teams").update({ badge_url: publicUrl })
      .eq("id", teamId).select("id").single();
  } else {
    const name = String(form.get("name") || "").trim();
    const description = String(form.get("description") || "").trim();
    const competition = String(form.get("competition") || "").trim();
    if (!name || name.length > 160 || description.length > 1000 || competition.length > 160) {
      mutation = { error: new Error("Dados do troféu inválidos.") };
    } else {
      mutation = await authorization.serviceClient.from("trophies").insert({
        name, description, competition, image_url: publicUrl,
      }).select("id").single();
    }
  }
  if (mutation.error) {
    if (path) await authorization.serviceClient.storage.from(bucket).remove([path]);
    return NextResponse.json({ error: "Não foi possível vincular a imagem." }, { status: 400 });
  }
  return NextResponse.json({ data: { ...mutation.data, url: publicUrl } },
    { headers: { "Cache-Control": "no-store" } });
}
