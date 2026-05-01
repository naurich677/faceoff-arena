import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 grid-bg">
      <div className="max-w-md text-center surface-card p-10">
        <div className="font-mono text-xs text-primary tracking-widest mb-2">ERROR · 404</div>
        <h1 className="text-7xl font-display font-black text-glow">K.O.</h1>
        <h2 className="mt-4 text-xl font-semibold">No opponent at this URL</h2>
        <p className="mt-2 text-sm text-muted-foreground">The page you're looking for got mogged out of existence.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:shadow-[var(--shadow-glow)] transition-all">
            Back to Arena
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "1v1 Mog Arena — Live looks duels, ranked." },
      { name: "description", content: "Out-mog the stranger. Live 1v1 face-off duels with audience voting and ELO ranking. 18+ entertainment platform." },
      { name: "author", content: "Mog Arena" },
      { property: "og:title", content: "1v1 Mog Arena — Live looks duels" },
      { property: "og:description", content: "Out-mog the stranger. Ranked face-off duels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
