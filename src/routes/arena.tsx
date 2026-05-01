import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, RotateCcw, Search, ThumbsUp } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/arena")({
  head: () => ({ meta: [{ title: "Arena · Mog Arena" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/onboarding" });
  },
  component: Arena,
});

type Phase = "idle" | "searching" | "countdown" | "duel" | "result";

const MOCK_OPPONENTS = [
  { username: "chad_2007", elo: 1180, avatar_url: null },
  { username: "jawline_god", elo: 1340, avatar_url: null },
  { username: "mewing_max", elo: 980, avatar_url: null },
  { username: "stranger", elo: 1050, avatar_url: null },
];

function Arena() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [timer, setTimer] = useState(10);
  const [opponent, setOpponent] = useState<typeof MOCK_OPPONENTS[number] | null>(null);
  const [votes, setVotes] = useState({ p1: 0, p2: 0 });
  const [profile, setProfile] = useState<any>(null);
  const [eloDelta, setEloDelta] = useState(0);
  const [won, setWon] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
        setStream(s);
        if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.play(); }
      } catch { toast.error("Camera required for the arena"); }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        setProfile(p);
      }
    })();
    return () => stream?.getTracks().forEach((t) => t.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // matchmaking → countdown
  useEffect(() => {
    if (phase !== "searching") return;
    const t = setTimeout(() => {
      setOpponent(MOCK_OPPONENTS[Math.floor(Math.random() * MOCK_OPPONENTS.length)]);
      setCountdown(3);
      setPhase("countdown");
    }, 2200);
    return () => clearTimeout(t);
  }, [phase]);

  // countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) { setTimer(10); setVotes({ p1: 0, p2: 0 }); setPhase("duel"); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // duel timer + simulated votes
  useEffect(() => {
    if (phase !== "duel") return;
    const tick = setInterval(() => {
      setTimer((t) => t - 1);
      setVotes((v) => ({
        p1: v.p1 + (Math.random() < 0.5 ? Math.floor(Math.random() * 3) : 0),
        p2: v.p2 + (Math.random() < 0.5 ? Math.floor(Math.random() * 3) : 0),
      }));
    }, 1000);
    return () => clearInterval(tick);
  }, [phase]);

  useEffect(() => {
    if (phase === "duel" && timer <= 0) {
      const userWon = votes.p1 >= votes.p2;
      const delta = userWon ? 15 : -12;
      setWon(userWon);
      setEloDelta(delta);
      setPhase("result");
      // persist
      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !profile) return;
        const newElo = profile.elo + delta;
        await supabase.from("profiles").update({
          elo: newElo,
          wins: profile.wins + (userWon ? 1 : 0),
          losses: profile.losses + (userWon ? 0 : 1),
          streak: userWon ? profile.streak + 1 : 0,
          max_streak: userWon ? Math.max(profile.max_streak, profile.streak + 1) : profile.max_streak,
        }).eq("id", user.id);
        await supabase.from("elo_history").insert({ user_id: user.id, elo_value: newElo });
        await supabase.from("matches").insert({
          player1_id: user.id, winner_id: userWon ? user.id : null,
          votes_p1: votes.p1, votes_p2: votes.p2, elo_delta: delta, status: "completed",
        });
        setProfile({ ...profile, elo: newElo, wins: profile.wins + (userWon ? 1 : 0), losses: profile.losses + (userWon ? 0 : 1), streak: userWon ? profile.streak + 1 : 0 });
      })();
    }
  }, [phase, timer, votes, profile]);

  const findMatch = () => setPhase("searching");
  const reset = () => { setPhase("idle"); setOpponent(null); setVotes({ p1: 0, p2: 0 }); };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Top stats */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <div className="font-mono text-xs text-primary tracking-widest">ARENA</div>
            <h1 className="text-3xl font-display font-black">{profile?.username ?? "..."}</h1>
          </div>
          <div className="flex gap-3">
            <StatPill label="ELO" value={profile?.elo ?? "—"} />
            <StatPill label="W/L" value={profile ? `${profile.wins}/${profile.losses}` : "—"} />
            <StatPill label="STREAK" value={profile?.streak ?? 0} accent />
          </div>
        </div>

        {/* Cameras */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
          {/* You */}
          <CameraSlot label={profile?.username ?? "You"} elo={profile?.elo} active={phase === "duel"} mirror>
            <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" muted playsInline />
          </CameraSlot>

          {/* VS */}
          <div className="flex flex-row md:flex-col items-center justify-center gap-4 px-4">
            <div className="font-display font-black text-4xl md:text-6xl text-primary text-glow">VS</div>
            <AnimatePresence mode="wait">
              {phase === "duel" && (
                <motion.div
                  key="timer"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className="font-mono text-5xl md:text-6xl font-bold tabular-nums"
                  style={{ color: timer <= 3 ? "var(--error)" : "var(--text)" }}
                >
                  {timer.toString().padStart(2, "0")}
                </motion.div>
              )}
              {phase === "countdown" && (
                <motion.div
                  key={countdown}
                  initial={{ scale: 2, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className="font-mono text-7xl font-bold text-primary text-glow"
                >
                  {countdown > 0 ? countdown : "GO"}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Opponent */}
          <CameraSlot label={opponent?.username ?? "Opponent"} elo={opponent?.elo} active={phase === "duel"}>
            {opponent ? (
              <div className="w-full h-full bg-gradient-to-br from-surface-2 to-surface flex items-center justify-center">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-primary/20 border border-primary/40 mx-auto flex items-center justify-center font-display text-2xl font-black">
                    {opponent.username[0].toUpperCase()}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground mt-3">simulated opponent</div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full bg-surface-2 flex items-center justify-center text-muted-foreground text-sm">
                Waiting for opponent...
              </div>
            )}
          </CameraSlot>
        </div>

        {/* Controls */}
        <div className="mt-6">
          {phase === "idle" && (
            <div className="text-center">
              <Button size="lg" onClick={findMatch} className="bg-primary text-primary-foreground hover:shadow-[var(--shadow-glow-lg)] px-10 py-6 text-base">
                <Swords className="w-5 h-5 mr-2" /> Find Match
              </Button>
            </div>
          )}
          {phase === "searching" && (
            <div className="text-center">
              <Button size="lg" disabled className="bg-primary/40 text-primary-foreground px-10 py-6 text-base animate-pulse-glow">
                <Search className="w-5 h-5 mr-2 animate-spin" /> Searching for opponent...
              </Button>
            </div>
          )}
          {phase === "duel" && (
            <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto">
              <VoteBtn label={`Vote ${profile?.username ?? "You"}`} count={votes.p1} side="left" onClick={() => setVotes((v) => ({ ...v, p1: v.p1 + 1 }))} />
              <VoteBtn label={`Vote ${opponent?.username ?? "Opp"}`} count={votes.p2} side="right" onClick={() => setVotes((v) => ({ ...v, p2: v.p2 + 1 }))} />
            </div>
          )}
          {phase === "result" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4"
            >
              <div className={`font-display text-4xl md:text-6xl font-black ${won ? "text-primary text-glow" : "text-destructive"}`}>
                {won ? "VICTORY" : "DEFEAT"}
              </div>
              <div className="font-mono text-2xl">
                <span className={won ? "text-primary" : "text-destructive"}>{eloDelta > 0 ? "+" : ""}{eloDelta}</span>
                <span className="text-muted-foreground"> ELO</span>
              </div>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => { reset(); findMatch(); }} className="bg-primary text-primary-foreground">
                  <RotateCcw className="w-4 h-4 mr-1" /> Find new opponent
                </Button>
                <Button variant="outline" asChild><Link to="/profile">View profile</Link></Button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </Layout>
  );
}

function StatPill({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <div className="surface-card px-4 py-2">
      <div className="text-[10px] text-muted-foreground tracking-widest font-mono">{label}</div>
      <div className={`font-mono font-bold text-lg ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function CameraSlot({ children, label, elo, active, mirror: _m }: any) {
  return (
    <div className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all ${active ? "border-primary shadow-[var(--shadow-glow-lg)]" : "border-border"}`}>
      {children}
      <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 backdrop-blur text-xs font-mono">
        {label} {elo && <span className="text-primary ml-1">{elo}</span>}
      </div>
      {active && <div className="absolute top-2 right-2 px-2 py-1 rounded bg-destructive/80 text-xs font-mono font-bold animate-pulse">● LIVE</div>}
    </div>
  );
}

function VoteBtn({ label, count, side, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`group surface-card p-4 hover:border-primary/60 hover:shadow-[var(--shadow-glow)] transition-all text-${side === "left" ? "left" : "right"}`}
    >
      <div className="flex items-center justify-between">
        <ThumbsUp className={`w-4 h-4 ${side === "right" ? "order-2" : ""} text-primary`} />
        <div className={side === "right" ? "text-right" : ""}>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="font-mono text-2xl font-bold">{count}</div>
        </div>
      </div>
    </button>
  );
}
