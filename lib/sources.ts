import { googleBrowserReviews } from "./google-browser";
import { fetchJson } from "./http";
import type { Review, SourceName } from "./types";

const env = (k: string) => process.env[k]?.trim() ?? "";

/** Google Places API (New): chỉ trả tối đa 5 review "liên quan nhất". */
async function googlePlaces(): Promise<Review[]> {
  const data = await fetchJson<any>(
    `https://places.googleapis.com/v1/places/${env("GOOGLE_PLACE_ID")}?languageCode=vi`,
    {
      headers: {
        "X-Goog-Api-Key": env("GOOGLE_API_KEY"),
        "X-Goog-FieldMask": "displayName,googleMapsUri,reviews",
      },
    },
  );
  const place = data.displayName?.text ?? "Google Maps";
  return (data.reviews ?? []).map((r: any): Review => ({
    id: r.name,
    source: "Google Maps",
    place,
    author: r.authorAttribution?.displayName ?? "Ẩn danh",
    rating: r.rating,
    text: (r.originalText ?? r.text)?.text ?? "",
    date: r.relativePublishTimeDescription ?? "",
    url: r.googleMapsUri ?? data.googleMapsUri ?? "",
  }));
}

/** SerpApi google_maps_reviews, sắp xếp mới nhất trước. */
async function googleSerpApi(): Promise<Review[]> {
  const qs = new URLSearchParams({
    engine: "google_maps_reviews",
    data_id: env("GOOGLE_DATA_ID"),
    sort_by: "newestFirst",
    hl: "vi",
    api_key: env("SERPAPI_KEY"),
  });
  const data = await fetchJson<any>(`https://serpapi.com/search.json?${qs}`);
  if (data.error) throw new Error(`SerpApi: ${data.error}`);
  const place = data.place_info?.title ?? "Google Maps";
  return (data.reviews ?? []).map((r: any): Review => ({
    id: r.review_id,
    source: "Google Maps",
    place,
    author: r.user?.name ?? "Ẩn danh",
    rating: r.rating,
    text: r.snippet ?? r.extracted_snippet?.original ?? "",
    date: r.iso_date ?? r.date ?? "",
    url: r.link ?? "",
  }));
}

/** TripAdvisor Content API: tối đa 3 review (gói Discover) hoặc 5 (Growth) mỗi ngôn ngữ. */
async function tripadvisor(): Promise<Review[]> {
  const langs = (env("TRIPADVISOR_LANGUAGES") || "en").split(",").map((s) => s.trim()).filter(Boolean);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (env("TRIPADVISOR_REFERER")) headers.Referer = env("TRIPADVISOR_REFERER");
  const out: Review[] = [];
  for (const language of langs) {
    const qs = new URLSearchParams({ key: env("TRIPADVISOR_API_KEY"), language });
    const data = await fetchJson<any>(
      `https://api.content.tripadvisor.com/api/v1/location/${env("TRIPADVISOR_LOCATION_ID")}/reviews?${qs}`,
      { headers },
    );
    for (const r of data.data ?? []) {
      out.push({
        id: String(r.id),
        source: "TripAdvisor",
        place: env("TRIPADVISOR_NAME") || "TripAdvisor",
        author: r.user?.username ?? "Ẩn danh",
        rating: r.rating,
        text: r.title ? `${r.title}\n${r.text ?? ""}`.trim() : (r.text ?? ""),
        date: r.published_date ?? "",
        url: r.url ?? "",
      });
    }
  }
  return out;
}

export function enabledSources(): { name: SourceName; fetch: () => Promise<Review[]> }[] {
  const list: { name: SourceName; fetch: () => Promise<Review[]> }[] = [];
  if (env("GOOGLE_SOURCE") === "browser" && (env("GOOGLE_PLACE_ID") || env("GOOGLE_MAPS_URL")))
    list.push({ name: "google", fetch: googleBrowserReviews });
  else if (env("SERPAPI_KEY") && env("GOOGLE_DATA_ID")) list.push({ name: "google", fetch: googleSerpApi });
  else if (env("GOOGLE_API_KEY") && env("GOOGLE_PLACE_ID")) list.push({ name: "google", fetch: googlePlaces });
  if (env("TRIPADVISOR_API_KEY") && env("TRIPADVISOR_LOCATION_ID")) list.push({ name: "tripadvisor", fetch: tripadvisor });
  return list;
}
