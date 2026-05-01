import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t border-border mt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="font-display font-black text-base">
            1v1 <span className="text-primary">MOG</span> ARENA
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-mono">v0.1 · entertainment only · 18+</p>
        </div>
        <nav className="flex gap-6 text-sm text-muted-foreground">
          <a href="https://discord.gg" target="_blank" rel="noreferrer" className="hover:text-foreground transition">Discord</a>
          <Link to="/privacy" className="hover:text-foreground transition">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground transition">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}
