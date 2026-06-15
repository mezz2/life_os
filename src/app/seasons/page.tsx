import { PageHeader } from "@/components/ui";
import { SeasonsClient, type SeasonDTO, type TemplateDTO } from "@/components/SeasonsClient";
import { db } from "@/lib/db";
import { todayKey, dateKey } from "@/lib/habits";
import { parseGoalIds, parseBlocks, templateMinutes, type BlockSpec } from "@/lib/seasons";

export const dynamic = "force-dynamic";

export default async function SeasonsPage() {
  const [seasons, templates, values, goals, blockCount] = await Promise.all([
    db.season.findMany({ orderBy: { start: "desc" }, include: { value: { select: { name: true } } } }),
    db.weekTemplate.findMany({ orderBy: { sortOrder: "asc" } }),
    db.value.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.goal.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.timeBlock.count(),
  ]);

  const goalName = new Map(goals.map((g) => [g.id, g.name]));

  const seasonDtos: SeasonDTO[] = seasons.map((s) => {
    const goalIds = parseGoalIds(s.goalIds);
    return {
      id: s.id,
      name: s.name,
      start: dateKey(s.start),
      end: dateKey(s.end),
      theme: s.theme,
      valueId: s.valueId,
      valueName: s.value?.name ?? null,
      goalIds,
      goalNames: goalIds.map((id) => goalName.get(id)).filter((n): n is string => Boolean(n)),
    };
  });

  const templateDtos: TemplateDTO[] = templates.map((t) => {
    const specs: BlockSpec[] = parseBlocks(t.blocks);
    return { id: t.id, name: t.name, blockCount: specs.length, weeklyMinutes: templateMinutes(specs) };
  });

  return (
    <div>
      <PageHeader
        title="Seasons"
        subtitle="6–12 week focus windows, plus reusable week templates you can apply to your blocks"
      />
      <SeasonsClient
        today={todayKey()}
        seasons={seasonDtos}
        templates={templateDtos}
        values={values}
        goals={goals}
        liveBlockCount={blockCount}
      />
    </div>
  );
}
