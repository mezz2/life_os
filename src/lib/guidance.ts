// Central content store for all in-app coaching: term definitions (tooltips),
// per-page hint cards, richer empty-state coaching, the getting-started
// checklist, and the full /guide page. Copy lives here so it can be edited in
// one place. Philosophy leans on proven frameworks — identity-based habits and
// the Four Laws (Atomic Habits), core-values clarification, and leading vs.
// lagging indicators for goals.

export type Concept = {
  term: string;
  /** One or two sentences shown in a tooltip / popover. */
  short: string;
};

// Definitions for the jargon that shows up across the Direction + Habits pages.
// Key these by a stable slug and reference them from <InfoTip concept="…" />.
export const CONCEPTS: Record<string, Concept> = {
  value: {
    term: "Value",
    short:
      "A direction you want your life to point in — not a goal you finish. Health, Craft, Connection. Everything else (goals, habits, time, money) rolls up to your values so you can see what you're actually optimising for.",
  },
  "value-description": {
    term: "What it means to you",
    short:
      "Write the value in your own words so it's concrete, not a poster slogan. Good test: it should rule some things in and other things out.",
  },
  goal: {
    term: "Goal",
    short:
      "A specific, finishable outcome that moves a value forward. Make it measurable with a clear target and date so you always know if you're on track.",
  },
  "short-goal": {
    term: "Short-term goal",
    short:
      "Something you can finish within ~12 months. These are the concrete checkpoints on the way to your long-term goals.",
  },
  "long-goal": {
    term: "Long-term goal",
    short:
      "A 1–5 year outcome — the bigger picture a value is heading toward. Long-term goals give your short-term goals a reason to exist.",
  },
  "lagging-indicator": {
    term: "Lagging indicator",
    short:
      "The result you're after (e.g. $40k saved, 5km run). It only moves after the work is done — which is why you can't control it directly day to day.",
  },
  "leading-indicator": {
    term: "Leading indicator",
    short:
      "The repeatable action that drives the result (e.g. transfer $200/week, run 3×/week). Habits are leading indicators — you control them directly, and they make the goal almost inevitable.",
  },
  habit: {
    term: "Habit",
    short:
      "A small action you repeat on a cadence. The point isn't the single rep — it's casting a vote, again and again, for the kind of person you want to become.",
  },
  "identity-vote": {
    term: "Identity vote",
    short:
      "Each time you do a habit you cast one vote for an identity: 'I am a reader', 'I am someone who trains'. You don't need the majority — you just need to keep voting. Identity change is what makes habits stick.",
  },
  "build-break": {
    term: "Build vs. break",
    short:
      "Build = a habit you want to do more (make it obvious, attractive, easy, satisfying). Break = a habit you want to do less, tracked as days avoided (make it invisible, unattractive, hard, unsatisfying).",
  },
  cadence: {
    term: "Cadence",
    short:
      "How often the habit is due: every day, a number of times per week, or specific weekdays. Pick the smallest cadence you can actually keep — consistency beats intensity.",
  },
  cue: {
    term: "Cue (make it obvious)",
    short:
      "The trigger that starts the habit. The most reliable cue is an existing routine: 'After I pour my coffee, I…'. Obvious cues remove the need for willpower.",
  },
  craving: {
    term: "Craving (make it attractive)",
    short:
      "The reason you want to do it. Tie the habit to something you find appealing, or to the identity you're building, so you're pulled toward it rather than pushing yourself.",
  },
  response: {
    term: "Response (make it easy)",
    short:
      "The action itself. Reduce friction until starting is almost effortless — lay your clothes out, keep the book on the pillow. The easier the response, the more often it happens.",
  },
  reward: {
    term: "Reward (make it satisfying)",
    short:
      "What makes the rep feel good immediately, so your brain wants to repeat it. Ticking it off, a streak, or a small treat all count. What's rewarded gets repeated.",
  },
  "two-minute": {
    term: "Two-minute version",
    short:
      "Shrink any new habit until it takes two minutes — 'read one page', 'put on running shoes'. Master showing up first; you can scale the habit once the behaviour is automatic.",
  },
  "temptation-bundle": {
    term: "Reward bundle (temptation bundling)",
    short:
      "Pair a habit you should do with something you want to do — only listen to that playlist while you train. The thing you crave drags the habit along with it.",
  },
  routine: {
    term: "Routine (habit stack)",
    short:
      "A chain of habits done back-to-back, each one the cue for the next: 'After coffee → meditate → journal'. Stacking lets an established habit carry a new one.",
  },
  "anchor-cue": {
    term: "Anchor cue",
    short:
      "The existing habit a routine hangs off — the 'After I ___' that kicks the whole chain into motion. Choose something you already do without fail.",
  },
  alignment: {
    term: "Alignment",
    short:
      "How much your actual time, money and habit votes flow toward each value. Big gaps between what you say matters and where your hours and dollars go are the most useful thing this dashboard can show you.",
  },
  "checkin-identity": {
    term: "Daily check-in",
    short:
      "A 30-second read on how today went across your values. Over time it reveals patterns your habit ticks alone can't — energy, mood, and where attention actually went.",
  },
};

// ---------------------------------------------------------------------------
// Per-page hint cards. Shown as a dismissible card at the top of each page.
// `id` is the localStorage key suffix used to remember a dismissal.
// ---------------------------------------------------------------------------

export type PageHint = { id: string; title: string; points: string[] };

export const PAGE_HINTS: Record<string, PageHint> = {
  values: {
    id: "values",
    title: "How to write values that actually guide you",
    points: [
      "Name a direction, not a destination — 'Health', not 'lose 5kg'. You never finish a value; you keep pointing at it.",
      "Aim for 3–6. More than that and none of them really steer your decisions.",
      "Describe each in your own words so it rules some things in and others out.",
      "Everything else links up to a value — so start here, then add goals and habits beneath them.",
    ],
  },
  goals: {
    id: "goals",
    title: "How to set goals you can actually hit",
    points: [
      "Make it measurable: a number and a date, so you always know if you're on track.",
      "Tie every goal to a value — that's its reason to exist when motivation dips.",
      "The goal is the lagging indicator (the result). The habit beneath it is the leading indicator (the work that gets you there).",
      "Use short-term goals as the checkpoints on the way to your long-term ones.",
    ],
  },
  habits: {
    id: "habits",
    title: "How to build habits that stick",
    points: [
      "Every rep is a vote for an identity — write who this habit makes you ('I am a reader').",
      "Start with the two-minute version. Master showing up before you scale it.",
      "Make it obvious (cue), attractive (craving), easy (response), satisfying (reward).",
      "Link each habit to a value and a goal so a daily tick rolls up to the big picture.",
    ],
  },
  stacks: {
    id: "stacks",
    title: "How to build a routine that runs itself",
    points: [
      "Anchor the chain to something you already do without fail ('After I pour my coffee…').",
      "Each habit becomes the cue for the next — coffee → meditate → journal.",
      "Keep early routines short. Two or three small habits are easier to keep than a perfect ten-step morning.",
    ],
  },
  checkin: {
    id: "checkin",
    title: "Why a 30-second check-in matters",
    points: [
      "Habit ticks tell you what you did; a check-in tells you how it felt — energy, mood, attention.",
      "Do it at the same time each day so it becomes its own habit.",
      "Patterns only show up over weeks, so consistency matters more than detail.",
    ],
  },
  align: {
    id: "align",
    title: "Reading your alignment",
    points: [
      "This compares what you say matters (values) with where your time, money and votes actually go.",
      "A gap isn't failure — it's the most useful signal here. Decide whether to change the behaviour or the value.",
      "Tag calendar events and habits to values, and map spending categories, so this can fill in.",
    ],
  },
};

// ---------------------------------------------------------------------------
// Richer empty-state coaching — shown when a section has nothing in it yet.
// ---------------------------------------------------------------------------

export type Coach = { title: string; body: string; examples?: string[] };

export const COACH: Record<string, Coach> = {
  values: {
    title: "Start here — define what you're optimising for",
    body: "Values are the foundation everything else hangs off. Pick 3–6 directions for your life; your goals, habits, time and money will all roll up to them.",
    examples: ["Health & energy", "Craft & mastery", "Financial freedom", "Connection", "Adventure"],
  },
  goals: {
    title: "Turn a value into something measurable",
    body: "A goal is a finishable outcome with a number and a date. Tie it to a value, then add a habit beneath it that drives it forward day to day.",
    examples: ["Save $20k house deposit by Dec", "Run a sub-25min 5km", "Read 24 books this year"],
  },
  habits: {
    title: "Add the daily work that drives your goals",
    body: "A habit is the leading indicator — the small, repeatable action you control. Write the two-minute version and the identity each rep votes for.",
    examples: ["Read 10 pages → 'I am a reader'", "Transfer $200 → 'I am a saver'", "Train 20 min → 'I am an athlete'"],
  },
  stacks: {
    title: "Chain a few habits into a routine",
    body: "Stack new habits onto one you already do without fail. Each habit becomes the cue for the next, so the whole chain runs on autopilot.",
    examples: ["After coffee → meditate → journal", "After dinner → walk → read"],
  },
};

// ---------------------------------------------------------------------------
// Getting-started checklist. `key` maps to a boolean in the progress object
// computed on the dashboard. Order is the recommended setup sequence.
// ---------------------------------------------------------------------------

export type OnboardingStep = {
  key: "values" | "identity" | "goals" | "habits" | "routine" | "checkin";
  title: string;
  blurb: string;
  href: string;
  cta: string;
};

export const ONBOARDING: OnboardingStep[] = [
  {
    key: "values",
    title: "Define your values",
    blurb: "Pick 3–6 directions for your life. Everything else rolls up to these.",
    href: "/values",
    cta: "Add values",
  },
  {
    key: "goals",
    title: "Set goals beneath them",
    blurb: "Give each value a measurable, dated outcome to aim at.",
    href: "/goals",
    cta: "Add goals",
  },
  {
    key: "habits",
    title: "Add the daily habits",
    blurb: "The leading indicators — small reps that drive each goal and vote for an identity.",
    href: "/habits",
    cta: "Add habits",
  },
  {
    key: "identity",
    title: "Name the identity each habit votes for",
    blurb: "Edit a habit and add 'I am a ___'. Identity is what makes habits stick.",
    href: "/habits",
    cta: "Open habits",
  },
  {
    key: "routine",
    title: "Stack habits into a routine",
    blurb: "Chain a few habits to an anchor you already do, like your morning coffee.",
    href: "/stacks",
    cta: "Build a routine",
  },
  {
    key: "checkin",
    title: "Do your first check-in",
    blurb: "A 30-second daily read on how things are tracking across your values.",
    href: "/checkin",
    cta: "Check in",
  },
];

// ---------------------------------------------------------------------------
// The /guide page — the whole philosophy and the order to set things up.
// ---------------------------------------------------------------------------

export type GuideSection = { heading: string; paragraphs: string[]; bullets?: string[] };

export const GUIDE_INTRO =
  "LifeOS connects who you want to be to what you do today. It's one chain: values point you in a direction, goals turn a direction into a target, habits are the daily work that hits the target, and check-ins plus alignment tell you whether it's all working. Set it up top-down and review it bottom-up.";

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    heading: "1. Values — your direction",
    paragraphs: [
      "Start with values. A value is a direction you keep pointing at, not a box you tick — Health, Craft, Connection, Financial freedom. You never 'finish' a value; you live it.",
      "Pick 3–6 and write each in your own words so it's concrete enough to make decisions with. Everything else in LifeOS links up to a value, which is what lets you see whether your real life matches your stated priorities.",
    ],
    bullets: [
      "Good: 'Health — strong, energetic, and able to do hard physical things into old age.'",
      "Too vague: 'Be my best self.'",
      "That's a goal, not a value: 'Lose 5kg.'",
    ],
  },
  {
    heading: "2. Goals — your target",
    paragraphs: [
      "A goal turns a value into something measurable and finishable: a number and a date. Tie every goal to a value so it has a reason to exist when motivation runs low.",
      "The goal itself is a lagging indicator — the result, which only moves after the work is done. That's why you don't chase the goal directly; you build the habit underneath it.",
    ],
    bullets: [
      "Short-term (within a year) are the checkpoints; long-term (1–5 years) are the bigger picture.",
      "Good: 'Save a $20k deposit by December' beats 'save more money'.",
      "If you can't measure it, you can't tell whether you're on track.",
    ],
  },
  {
    heading: "3. Habits — your daily work",
    paragraphs: [
      "Habits are the leading indicators: the small, repeatable actions you actually control. Do the habit reliably and the goal becomes almost inevitable.",
      "The deeper point is identity. Every rep is a vote for the kind of person you're becoming — 'I am a reader', 'I am someone who trains'. You don't need every vote, you just need to keep voting. Write that identity statement when you create a habit.",
    ],
    bullets: [
      "Make it obvious (cue), attractive (craving), easy (response), satisfying (reward).",
      "Start with the two-minute version — master showing up before you scale.",
      "Link each habit to a value and a goal so a daily tick rolls up the whole chain.",
      "Break-habits work in reverse: track days avoided and make the bad habit invisible, unattractive, hard and unsatisfying.",
    ],
  },
  {
    heading: "4. Routines — habits that carry each other",
    paragraphs: [
      "A routine (or habit stack) chains habits back-to-back, each one the cue for the next: 'After coffee → meditate → journal'. Anchor the chain to something you already do without fail, and an established habit will carry the new ones.",
      "Keep early routines short — two or three small habits are far easier to keep than a perfect ten-step morning.",
    ],
  },
  {
    heading: "5. Check-in & alignment — the feedback loop",
    paragraphs: [
      "Ticking habits tells you what you did. The daily check-in tells you how it felt — energy, mood, where attention went — and patterns emerge over weeks.",
      "Alignment closes the loop: it compares what you say matters with where your time, money and votes actually flow. A gap isn't failure — it's the signal. Either change the behaviour or be honest and change the value.",
    ],
  },
  {
    heading: "The recommended order",
    paragraphs: [
      "Set it up top-down so each layer has something to attach to:",
    ],
    bullets: [
      "Values → 2. Goals → 3. Habits (+ the identity each votes for) → 4. Routines → 5. Daily check-in.",
      "Then review bottom-up: do your habits, check in daily, and read your alignment weekly to course-correct.",
    ],
  },
];
