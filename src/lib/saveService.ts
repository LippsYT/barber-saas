import { sb, errEs } from "./supabase";
import { toCents } from "./money";
import { draftsToDbRows } from "./serviceCommission";
import type { ServiceDraft } from "@/components/app/ServiceEditor";

/** Crea o edita un servicio y deja comisión por barbero en commission_rules (miembro + ítem). */
export async function saveServiceBundle(businessId: string, editing: string | null, draft: ServiceDraft): Promise<{ id: string } | { error: string }> {
  const payload = {
    name: draft.name.trim(),
    duration_min: Number(draft.duration),
    price: toCents(draft.price),
    description: draft.description.trim() || null,
  };
  let id = editing;
  if (id) {
    const { error } = await sb().from("services").update(payload).eq("id", id);
    if (error) return { error: errEs(error) };
  } else {
    const { data, error } = await sb().from("services").insert({ business_id: businessId, ...payload }).select("id").single();
    if (error || !data) return { error: errEs(error) };
    id = data.id as string;
  }
  const { error: delMs } = await sb().from("member_services").delete().eq("service_id", id);
  if (delMs) return { error: errEs(delMs) };
  const chosen = draft.drafts.filter((d) => d.selected);
  if (chosen.length) {
    const { error } = await sb().from("member_services").insert(chosen.map((d) => ({ member_id: d.memberId, service_id: id, business_id: businessId })));
    if (error) return { error: errEs(error) };
  }
  const { error: delRules } = await sb().from("commission_rules").delete().eq("business_id", businessId).eq("item_type", "service").eq("item_id", id);
  if (delRules) return { error: errEs(delRules) };
  const rows = draftsToDbRows(businessId, id!, draft.drafts);
  if (rows.length) {
    const { error } = await sb().from("commission_rules").insert(rows);
    if (error) return { error: errEs(error) };
  }
  return { id: id! };
}
