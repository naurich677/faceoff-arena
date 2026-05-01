import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, Swords } from "lucide-react";

export function Header() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/onboarding" });
  };
  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[oklch(0.12_0.015_270/0.7)] border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/40 flex items-center justify-center group-hover:border-glow transition-all">
            <Swords className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display font-black text-lg tracking-tight">
            1v1 <span className="text-primary">MOG</span> ARENA
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <Link to="/arena" className="hover:text-foreground transition" activeProps={{ className: "text-foreground" }}>Arena</Link>
          <Link to="/leaderboard" className="hover:text-foreground transition" activeProps={{ className: "text-foreground" }}>Leaderboard</Link>
          {userId && <Link to="/profile" className="hover:text-foreground transition" activeProps={{ className: "text-foreground" }}>Profile</Link>}
          <a href="https://discord.gg" target="_blank" rel="noreferrer" className="hover:text-foreground transition">Discord</a>
        </nav>

        <div className="flex items-center gap-2">
          {userId ? (
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-1" /> Sign out
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={signIn} className="bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[var(--shadow-glow)] transition-all">
              <LogIn className="w-4 h-4 mr-1" /> Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
