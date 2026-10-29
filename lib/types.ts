export interface Review {
  id: string;
  source: "Google Maps" | "TripAdvisor";
  place: string;
  author: string;
  rating?: number;
  text: string;
  date: string;
  url: string;
}

export type SourceName = "google" | "tripadvisor";
