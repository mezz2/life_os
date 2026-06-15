import { PageHeader } from "@/components/ui";
import { ReviewClient, type ReviewDTO } from "@/components/ReviewClient";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const reviews = await db.weeklyReview.findMany({ orderBy: { weekStart: "desc" }, take: 12 });
  const dto: ReviewDTO[] = reviews.map((r) => ({
    weekStart: r.weekStart.toISOString().slice(0, 10),
    title: r.title,
    lines: r.body.split("\n").filter(Boolean),
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div>
      <PageHeader
        title="Weekly review"
        subtitle="The feedback loop — what your week actually added up to across habits, time and goals"
      />
      <ReviewClient reviews={dto} />
    </div>
  );
}
