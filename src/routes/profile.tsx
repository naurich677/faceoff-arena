import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { rankFromElo } from "@/lib/rank";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile · Mog Arena" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/onboarding" });
  },
  component: Profile,
});

function Profile() {
  const [profile, setProfile] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: p }, { data: m }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("matches").select("*").or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`).order("created_at", { ascending: false }).limit(20),
      ]);
      setProfile(p); setMatches(m ?? []);
    })();
  }, []);

  if (!profile) return <Layout><div className="p-12 text-center text-muted-foreground">Loading...</div></Layout>;

  const rank = rankFromElo(profile.elo);
  const winRate = profile.wins + profile.losses > 0 ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100) : 0;
  const m = profile.psl_metrics as any;

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="surface-card p-8 flex flex-col sm:flex-row gap-6 items-start">
          <div className="w-24 h-24 rounded-xl bg-primary/20 border-2 border-primary/40 flex items-center justify-center font-display text-4xl font-black">
            {profile.username[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-display font-black">{profile.username}</h1>
            <div className="mt-2 flex items-center gap-2">
              <span className="px-3 py-1 rounded-md font-mono text-sm font-bold border" style={{ borderColor: rank.color, color: rank.color }}>{rank.name}</span>
              <span className="font-mono text-sm text-muted-foreground">PSL {profile.psl_score ?? "—"}/8</span>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-xs text-muted-foreground tracking-widest">ELO</div>
            <div className="font-mono text-5xl font-bold text-primary text-glow">{profile.elo}</div>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label="Matches" value={profile.wins + profile.losses} />
          <Stat label="Wins" value={profile.wins} />
          <Stat label="Losses" value={profile.losses} />
          <Stat label="Win rate" value={`${winRate}%`} accent />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
          <Stat label="Current streak" value={profile.streak} accent />
          <Stat label="Max streak" value={profile.max_streak} />
        </div>

        {/* PSL breakdown */}
        {m && (
          <div className="surface-card p-6">
            <div className="font-mono text-xs text-primary tracking-widest mb-4">PSL BREAKDOWN</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Bar label="Symmetry" v={m.symmetry} />
              <Bar label="Jawline" v={m.jawline} />
              <Bar label="Canthal" v={m.canthal} />
              <Bar label="IPD" v={m.ipd} />
            </div>
          </div>
        )}

        {/* Recent matches */}
        <div className="surface-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border font-mono text-xs text-primary tracking-widest">RECENT MATCHES</div>
          {matches.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">No matches yet — head to the arena.</div>}
          {matches.map((mt) => {
            const won = mt.winner_id === profile.id;
            return (
              <div key={mt.id} className="flex items-center justify-between px-6 py-3 border-b border-border last:border-0 text-sm">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${won ? "bg-primary" : "bg-destructive"}`} />
                  <span className="font-mono">{won ? "WIN" : "LOSS"}</span>
                </div>
                <div className="font-mono text-xs text-muted-foreground">
                  {new Date(mt.created_at).toLocaleString()}
                </div>
                <div className={`font-mono font-bold ${won ? "text-primary" : "text-destructive"}`}>
                  {mt.elo_delta > 0 ? "+" : ""}{mt.elo_delta} ELO
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}

function Stat({ label, value, accent }: any) {
  return (
    <div className="surface-card p-5">
      <div className="text-[10px] text-muted-foreground tracking-widest font-mono">{label}</div>
      <div className={`font-mono text-2xl font-bold mt-1 ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function Bar({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-mono mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span>{v}</span>
      </div>
      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-primary/70 to-primary" style={{ width: `${v}%`, boxShadow: "0 0 12px var(--accent-glow)" }} />
      </div>
    </div>
  );
}
