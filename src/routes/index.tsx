import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Camera, ScanFace, Swords, Trophy, Users, Zap, ArrowRight } from "lucide-react";
import { Layout } from "@/components/Layout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "1v1 Mog Arena — Out-mog the stranger" },
      { name: "description", content: "Live 1v1 looks duels. 10-second face-offs, audience votes, ELO ranking. Climb from Bronze to GOD." },
      { property: "og:title", content: "1v1 Mog Arena" },
      { property: "og:description", content: "Live 1v1 looks duels. Out-mog the stranger." },
    ],
  }),
  component: Index,
});

function Index() {
  const [stats, setStats] = useState({ players: 0, matches: 0 });

  useEffect(() => {
    (async () => {
      const { count: pl } = await supabase.from("profiles").select("*", { count: "exact", head: true });
      const today = new Date(); today.setHours(0,0,0,0);
      const { count: m } = await supabase.from("matches").select("*", { count: "exact", head: true }).gte("created_at", today.toISOString());
      setStats({ players: pl ?? 0, matches: m ?? 0 });
    })();
  }, []);

  return (
    <Layout>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-bg opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-24 sm:pt-28 sm:pb-32 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/5 text-xs font-mono text-primary mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              LIVE · {stats.players} mogggers online
            </div>
            <h1 className="text-5xl sm:text-7xl md:text-8xl font-display font-black tracking-tighter leading-[0.9]">
              Out-mog
              <br />
              <span className="text-primary text-glow">the stranger.</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto">
              10 seconds. Two faces. One winner.
              Live 1v1 looks duels with audience voting and ranked ELO.
            </p>
            <div className="mt-10 flex items-center justify-center gap-3">
              <Link
                to="/onboarding"
                className="group inline-flex items-center gap-2 px-7 py-4 rounded-md bg-primary text-primary-foreground font-bold text-base hover:shadow-[var(--shadow-glow-lg)] transition-all"
              >
                Enter Arena
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/leaderboard"
                className="inline-flex items-center gap-2 px-7 py-4 rounded-md border border-border bg-surface hover:border-primary/50 transition-all font-medium"
              >
                <Trophy className="w-4 h-4" />
                Leaderboard
              </Link>
            </div>
          </motion.div>

          {/* live stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden surface-card"
          >
            <Stat label="Players" value={stats.players.toString()} />
            <Stat label="Matches today" value={stats.matches.toString()} />
            <Stat label="Avg duel" value="10s" />
            <Stat label="Top rank" value="GOD" gold />
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-14">
          <div className="font-mono text-xs text-primary tracking-widest mb-2">HOW IT WORKS</div>
          <h2 className="text-3xl sm:text-5xl font-display font-black">Three steps to the throne</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon: Camera, title: "Camera Check", desc: "We make sure your lighting and angle are arena-ready.", n: "01" },
            { icon: ScanFace, title: "PSL Scan", desc: "468-point face mesh maps your symmetry, jaw, and ratios.", n: "02" },
            { icon: Swords, title: "Compete & Climb", desc: "Match into 10-second duels. Audience votes. ELO moves.", n: "03" },
          ].map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="surface-card p-7 hover:border-primary/40 hover:shadow-[var(--shadow-glow)] transition-all group"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center group-hover:bg-primary/20 transition">
                  <s.icon className="w-5 h-5 text-primary" />
                </div>
                <div className="font-mono text-xs text-muted-foreground">{s.n}</div>
              </div>
              <h3 className="text-xl font-bold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* RANKS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="surface-card p-8 sm:p-12 relative overflow-hidden">
          <div className="absolute inset-0 grid-bg opacity-20" />
          <div className="relative">
            <div className="font-mono text-xs text-primary tracking-widest mb-2">RANK LADDER</div>
            <h2 className="text-3xl sm:text-4xl font-display font-black mb-8">Bronze → GOD</h2>
            <div className="flex flex-wrap gap-2">
              {[
                ["Unranked", "oklch(0.55 0.02 270)"],
                ["Bronze", "oklch(0.6 0.12 50)"],
                ["Silver", "oklch(0.78 0.02 270)"],
                ["Gold", "oklch(0.86 0.16 90)"],
                ["Platinum", "oklch(0.85 0.08 200)"],
                ["Diamond", "oklch(0.82 0.18 220)"],
                ["GOD", "oklch(0.7 0.28 330)"],
              ].map(([name, color]) => (
                <div key={name} className="px-4 py-2 rounded-md font-mono text-sm font-bold border" style={{ borderColor: color, color }}>
                  {name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="text-center surface-card p-12 sm:p-16 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
          <Zap className="w-10 h-10 text-primary mx-auto mb-4 relative" />
          <h2 className="text-3xl sm:text-5xl font-display font-black mb-4 relative">Step into the arena.</h2>
          <p className="text-muted-foreground mb-8 relative">No signup essays. Google sign-in, scan, duel.</p>
          <Link to="/onboarding" className="relative inline-flex items-center gap-2 px-7 py-4 rounded-md bg-primary text-primary-foreground font-bold hover:shadow-[var(--shadow-glow-lg)] transition-all">
            Enter Arena <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </section>
    </Layout>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="bg-surface p-6 text-center">
      <div className={`font-mono text-3xl sm:text-4xl font-bold ${gold ? "text-gold" : "text-foreground"}`}>{value}</div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function Users(_props: any) { return null; }
