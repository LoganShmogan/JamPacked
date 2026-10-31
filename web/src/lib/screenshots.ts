// Screenshots of the app in public/screenshots/, rendered from demo data by app/screenshots/
// (`flutter test screenshots`). Each is a 390×844 phone screen at 2×.
export type Shot = { src: string; alt: string; caption: string };

export const shots = {
  home: {
    src: "/screenshots/home.png",
    alt: "JamPacked home screen: today's deliveries, temperature checks, open corrective actions, expiring and held stock",
    caption: "Today at a glance",
  },
  receive: {
    src: "/screenshots/receive.png",
    alt: "Checking a delivered item: product, batch code, storage, probe temperature within limits, date marks and condition",
    caption: "Check each delivery at the door",
  },
  stock: {
    src: "/screenshots/stock.png",
    alt: "Stock on hand, first expiring first, with use-by dates, locations and a lot on hold",
    caption: "Stock, first expiring first",
  },
  production: {
    src: "/screenshots/production.png",
    alt: "Making a batch of cheese scones from its recipe, with ingredient batches picked from stock and a shortfall flagged",
    caption: "Make a batch from a recipe",
  },
  trace: {
    src: "/screenshots/trace.png",
    alt: "Tracing a flour batch: the delivery it came on, the scones made from it, and who they went to",
    caption: "Trace and recall in seconds",
  },
  insights: {
    src: "/screenshots/insights.png",
    alt: "Insights: the business's numbers for the last 30 days and how long everyday tasks take",
    caption: "See how your business is doing",
  },
  help: {
    src: "/screenshots/help.png",
    alt: "Help and support in the app: step-by-step guides for every task",
    caption: "Help, right in the app",
  },
} satisfies Record<string, Shot>;

export type ShotName = keyof typeof shots;
