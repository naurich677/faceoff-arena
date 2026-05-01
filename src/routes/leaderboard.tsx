import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Crown } from "lucide-react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { rankFromElo } from "@/lib/rank";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard · Mog Arena" }] }),
  component: Leaderboard,
});

function Leaderboard() {
  const [rows, setRows] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("*").order("elo", { ascending: false }).limit(100);
      setRows(data ?? []);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        setMe(p);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="font-mono text-xs text-primary tracking-widest">RANKINGS</div>
            <h1 className="text-4xl sm:text-5xl font-display font-black">Top 100 Moggers</h1>
          </div>
          <Trophy className="w-10 h-10 text-gold" />
        </div>

        <div className="surface-card overflow-hidden">
          <div className="grid grid-cols-[60px_1fr_100px_80px_80px] gap-4 px-4 py-3 border-b border-border text-xs font-mono uppercase text-muted-foreground tracking-widest">
            <div>#</div>
            <div>Player</div>
            <div className="text-right">ELO</div>
            <div className="text-right">W/L</div>
            <div className="text-right">Rank</div>
          </div>

          {loading && Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="grid grid-cols-[60px_1fr_100px_80px_80px] gap-4 px-4 py-4 border-b border-border animate-pulse">
              <div className="h-4 bg-surface-2 rounded" />
              <div className="h-4 bg-surface-2 rounded" />
              <div className="h-4 bg-surface-2 rounded" />
              <div className="h-4 bg-surface-2 rounded" />
              <div className="h-4 bg-surface-2 rounded" />
            </div>
          ))}

          {rows.map((p, i) => {
            const rank = rankFromElo(p.elo);
            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.6) }}
                className="grid grid-cols-[60px_1fr_100px_80px_80px] gap-4 px-4 py-4 border-b border-border hover:bg-surface-2 transition group"
              >
                <div className="font-mono font-bold flex items-center gap-1">
                  {i === 0 && <Crown className="w-4 h-4 text-gold" />}
                  <span className={i < 3 ? "text-gold" : "text-muted-foreground"}>{(i + 1).toString().padStart(2, "0")}</span>
                </div>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center font-display font-bold text-sm shrink-0">
                    {p.username[0].toUpperCase()}
                  </div>
                  <div className="font-medium truncate">{p.username}</div>
                </div>
                <div className="text-right font-mono font-bold">{p.elo}</div>
                <div className="text-right font-mono text-sm text-muted-foreground">{p.wins}/{p.losses}</div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded font-mono text-xs font-bold border" style={{ borderColor: rank.color, color: rank.color }}>
                    {rank.name}
                  </span>
                </div>
              </motion.div>
            );
          })}

          {!loading && rows.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">No players yet. Be the first.</div>
          )}
        </div>

        {me && (
          <div className="sticky bottom-4 mt-6 surface-card p-4 border-primary/40 shadow-[var(--shadow-glow)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="font-mono text-xs text-primary">YOU</div>
                <div className="font-bold">{me.username}</div>
              </div>
              <div className="flex gap-6 text-sm">
                <div><span className="text-muted-foreground font-mono">ELO </span><span className="font-mono font-bold">{me.elo}</span></div>
                <div><span className="text-muted-foreground font-mono">W/L </span><span className="font-mono font-bold">{me.wins}/{me.losses}</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
