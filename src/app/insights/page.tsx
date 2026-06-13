import { redirect } from "next/navigation";

// Insights have moved into the Budget hub's Overview panel. Keep the route alive
// so old links / bookmarks land in the right place.
export default function InsightsPage() {
  redirect("/budget");
}
