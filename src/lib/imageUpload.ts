import { sb } from "@/lib/supabase";

/** Achica la foto (JPEG) antes de subirla: las del celular pesan varios MB. */
export async function shrinkImage(file: File, max = 1280): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo leer la foto."))), "image/jpeg", 0.85));
}

/** Sube una foto al bucket público `avatars` dentro de la carpeta del negocio y devuelve su URL pública. */
export async function uploadBusinessImage(businessId: string, file: File, prefix: string, max = 1280): Promise<string> {
  const blob = await shrinkImage(file, max);
  const path = `${businessId}/${prefix}-${Date.now()}.jpg`;
  const { error } = await sb().storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error("No se pudo subir la foto. Revisa que exista el bucket avatars en Supabase (migración 0022).");
  return sb().storage.from("avatars").getPublicUrl(path).data.publicUrl;
}
