export interface CatalogService {
  id: string; name: string; description?: string | null; category?: string | null;
  price_kind?: string; duration_min: number; price: number;
}
export interface CatalogBarber {
  id: string; name: string; slug: string; avatar_url?: string | null; weekdays: number[];
  services: { service_id: string; price: number; duration_min: number }[];
}
export interface Catalog {
  business: {
    name: string; slug: string; timezone: string; currency: string;
    phone?: string | null; address?: string | null; cover_url?: string | null;
    max_advance_days: number; slot_step_min?: number;
    hours?: { weekday: number; is_open: boolean; start: string; end: string }[];
    special_days?: { on_date: string; closed: boolean; start: string | null; end: string | null; note: string | null }[];
  };
  services: CatalogService[];
  barbers: CatalogBarber[];
}
