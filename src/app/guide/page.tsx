import { PageHeader, Card } from "@/components/ui";
import { GUIDE_INTRO, GUIDE_SECTIONS, CONCEPTS } from "@/lib/guidance";

export const metadata = { title: "Guide · LifeOS" };

export default function GuidePage() {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="How LifeOS works"
        subtitle="The thinking behind values, goals, habits — and the order to set them up"
      />

      <Card className="mb-6">
        <p className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
          {GUIDE_INTRO}
        </p>
      </Card>

      <div className="space-y-4">
        {GUIDE_SECTIONS.map((s) => (
          <Card key={s.heading}>
            <h2 className="text-base font-semibold">{s.heading}</h2>
            <div className="mt-2 space-y-2">
              {s.paragraphs.map((p, i) => (
                <p key={i} className="text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
                  {p}
                </p>
              ))}
            </div>
            {s.bullets && (
              <ul className="mt-3 space-y-1.5 pl-5 text-sm" style={{ color: "var(--color-muted)" }}>
                {s.bullets.map((b, i) => (
                  <li key={i} className="list-disc">
                    {b}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      {/* Glossary — every term used across the Direction & Habits pages. */}
      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
        Glossary
      </h2>
      <Card>
        <dl className="divide-y" style={{ borderColor: "var(--color-border)" }}>
          {Object.entries(CONCEPTS).map(([key, c]) => (
            <div key={key} className="py-3 first:pt-0 last:pb-0">
              <dt className="text-sm font-medium">{c.term}</dt>
              <dd className="mt-1 text-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
                {c.short}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
