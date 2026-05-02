import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, RotateCcw, Search, X } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { joinLobby, type MatchInvite, type LobbyPresence } from "@/lib/matchmaking";
import { startDuelConnection, type DuelChannel } from "@/lib/webrtc";
import { toast } from "sonner";

export const Route = createFileRoute("/arena")({
  head: () => ({ meta: [{ title: "Arena · Mog Arena" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/onboarding" });
  },
  component: Arena,
});

type Phase = "idle" | "searching" | "connecting" | "countdown" | "duel" | "result";

const DUEL_SECONDS = 60;

function Arena() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [timer, setTimer] = useState(DUEL_SECONDS);
  const [profile, setProfile] = useState<any>(null);
  const [invite, setInvite] = useState<MatchInvite | null>(null);
  const [role, setRole] = useState<"initiator" | "opponent" | null>(null);
  const [scores, setScores] = useState({ p1: 0, p2: 0 });
  const [eloDelta, setEloDelta] = useState(0);
  const [won, setWon] = useState(false);
  const [connState, setConnState] = useState<RTCPeerConnectionState>("new");

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const lobbyCleanupRef = useRef<(() => void) | null>(null);
  const duelRef = useRef<DuelChannel | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── boot: camera + profile ─────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });
        if (!mounted) { s.getTracks().forEach((t) => t.stop()); return; }
        setStream(s);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = s;
          await localVideoRef.current.play().catch(() => {});
        }
      } catch {
        toast.error("Camera required for the arena");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (mounted) setProfile(p);
    })();
    return () => {
      mounted = false;
      stream?.getTracks().forEach((t) => t.stop());
      lobbyCleanupRef.current?.();
      duelRef.current?.close();
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── matched → set up WebRTC ────────────────────────────────────────────
  const setupConnection = useCallback(async (inv: MatchInvite, r: "initiator" | "opponent") => {
    if (!stream || !profile) return;
    setPhase("connecting");
    const peer = r === "initiator" ? inv.opponent : inv.initiator;
    const duel = await startDuelConnection({
      matchId: inv.match_id,
      selfId: profile.id,
      peerId: peer.user_id,
      role: r,
      localStream: stream,
      handlers: {
        onRemoteStream: (rs) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = rs;
            remoteVideoRef.current.play().catch(() => {});
          }
        },
        onConnectionState: (s) => {
          setConnState(s);
          if (s === "connected") {
            setPhase((curr) => (curr === "connecting" ? "countdown" : curr));
            setCountdown(3);
          }
          if (s === "failed" || s === "disconnected") {
            toast.error("Connection lost");
          }
        },
      },
    });
    duelRef.current = duel;

    // safety: if state never reaches "connected" within 8s, start anyway
    setTimeout(() => {
      setPhase((curr) => (curr === "connecting" ? "countdown" : curr));
    }, 8000);
  }, [stream, profile]);

  // ── join lobby ─────────────────────────────────────────────────────────
  const findMatch = useCallback(() => {
    if (!profile || !stream) {
      toast.error("Camera not ready");
      return;
    }
    setPhase("searching");
    const me: LobbyPresence = {
      user_id: profile.id,
      username: profile.username,
      elo: profile.elo,
      psl_score: profile.psl_score,
      joined_at: Date.now(),
    };
    lobbyCleanupRef.current = joinLobby(
      me,
      (inv, r) => {
        setInvite(inv);
        setRole(r);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        setupConnection(inv, r);
      },
      (msg) => {
        toast.error(msg);
        setPhase("idle");
      },
    );

    // 20s timeout → cancel
    searchTimeoutRef.current = setTimeout(() => {
      lobbyCleanupRef.current?.();
      lobbyCleanupRef.current = null;
      toast("No opponents online — try again in a moment");
      setPhase("idle");
    }, 20000);
  }, [profile, stream, setupConnection]);

  const cancelSearch = useCallback(() => {
    lobbyCleanupRef.current?.();
    lobbyCleanupRef.current = null;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setPhase("idle");
  }, []);

  // ── countdown ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      // freeze final scores using PSL + per-match randomization
      const myBase = profile?.psl_score ?? 5;
      const oppBase = (role === "initiator" ? invite?.opponent.psl_score : invite?.initiator.psl_score) ?? 5;
      const myFinal = clamp((myBase + (Math.random() * 0.6 - 0.3)) * (0.85 + Math.random() * 0.3), 0, 8);
      const oppFinal = clamp((oppBase + (Math.random() * 0.6 - 0.3)) * (0.85 + Math.random() * 0.3), 0, 8);
      setFinalScores({ me: myFinal, opp: oppFinal });
      setTimer(DUEL_SECONDS);
      setScores({ p1: 0, p2: 0 });
      setPhase("duel");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 800);
    return () => clearTimeout(t);
  }, [phase, countdown, profile, invite, role]);

  const [finalScores, setFinalScores] = useState({ me: 0, opp: 0 });

  // ── duel: animate score bars to final values, tick timer ──────────────
  useEffect(() => {
    if (phase !== "duel") return;
    const start = Date.now();
    const tick = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const remaining = Math.max(0, DUEL_SECONDS - elapsed);
      setTimer(Math.ceil(remaining));
      const progress = Math.min(1, elapsed / DUEL_SECONDS);
      // ease-out + jitter for "live scanning" feel
      const eased = 1 - Math.pow(1 - progress, 2);
      setScores({
        p1: finalScores.me * eased + (1 - progress) * (Math.random() * 0.3 - 0.15),
        p2: finalScores.opp * eased + (1 - progress) * (Math.random() * 0.3 - 0.15),
      });
      if (remaining <= 0) {
        clearInterval(tick);
        finishDuel(finalScores.me, finalScores.opp);
      }
    }, 200);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, finalScores]);

  const finishDuel = useCallback(async (myScore: number, oppScore: number) => {
    const userWon = myScore >= oppScore;
    const delta = userWon ? 15 : -12;
    setWon(userWon);
    setEloDelta(delta);
    setPhase("result");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !profile || !invite) return;

    const newElo = profile.elo + delta;
    await supabase.from("profiles").update({
      elo: newElo,
      wins: profile.wins + (userWon ? 1 : 0),
      losses: profile.losses + (userWon ? 0 : 1),
      streak: userWon ? profile.streak + 1 : 0,
      max_streak: userWon ? Math.max(profile.max_streak, profile.streak + 1) : profile.max_streak,
    }).eq("id", user.id);
    await supabase.from("elo_history").insert({ user_id: user.id, elo_value: newElo, match_id: invite.match_id });

    // only the initiator updates the match row to avoid double-write conflicts
    if (role === "initiator") {
      const initWon = userWon;
      await supabase.from("matches").update({
        winner_id: initWon ? invite.initiator_id : invite.opponent_id,
        votes_p1: Math.round(myScore * 100),
        votes_p2: Math.round(oppScore * 100),
        elo_delta: delta,
        status: "completed",
      }).eq("id", invite.match_id);
    }

    setProfile({
      ...profile,
      elo: newElo,
      wins: profile.wins + (userWon ? 1 : 0),
      losses: profile.losses + (userWon ? 0 : 1),
      streak: userWon ? profile.streak + 1 : 0,
    });

    duelRef.current?.close();
    duelRef.current = null;
  }, [profile, invite, role]);

  const reset = () => {
    duelRef.current?.close();
    duelRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setInvite(null);
    setRole(null);
    setScores({ p1: 0, p2: 0 });
    setFinalScores({ me: 0, opp: 0 });
    setConnState("new");
    setPhase("idle");
  };

  const opponentName =
    role === "initiator" ? invite?.opponent.username : invite?.initiator.username;
  const opponentElo =
    role === "initiator" ? invite?.opponent.elo : invite?.initiator.elo;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Top stats */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <div className="font-mono text-xs text-primary tracking-widest">ARENA · LIVE</div>
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
          <CameraSlot
            label={profile?.username ?? "You"}
            elo={profile?.elo}
            active={phase === "duel"}
            score={phase === "duel" ? scores.p1 : null}
          >
            <video ref={localVideoRef} className="w-full h-full object-cover scale-x-[-1]" muted playsInline />
          </CameraSlot>

          {/* Center */}
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
                  style={{ color: timer <= 5 ? "var(--error, #ff4d4d)" : undefined }}
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
              {phase === "connecting" && (
                <motion.div key="conn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-mono text-xs text-muted-foreground text-center">
                  connecting<br />
                  <span className="text-primary">{connState}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <CameraSlot
            label={opponentName ?? "Opponent"}
            elo={opponentElo}
            active={phase === "duel"}
            score={phase === "duel" ? scores.p2 : null}
          >
            {invite ? (
              <video ref={remoteVideoRef} className="w-full h-full object-cover" autoPlay playsInline />
            ) : (
              <div className="w-full h-full bg-surface-2 flex items-center justify-center text-muted-foreground text-sm">
                {phase === "searching" ? "Searching for opponent..." : "Waiting for match"}
              </div>
            )}
          </CameraSlot>
        </div>

        {/* Controls */}
        <div className="mt-6">
          {phase === "idle" && (
            <div className="text-center">
              <Button
                size="lg"
                onClick={findMatch}
                disabled={!stream || !profile}
                className="bg-primary text-primary-foreground hover:shadow-[var(--shadow-glow-lg)] px-10 py-6 text-base"
              >
                <Swords className="w-5 h-5 mr-2" /> Find Live Match
              </Button>
              <p className="font-mono text-xs text-muted-foreground mt-3">
                60-second auto-scan duel · live P2P video
              </p>
            </div>
          )}

          {phase === "searching" && (
            <div className="text-center space-y-3">
              <Button size="lg" disabled className="bg-primary/40 text-primary-foreground px-10 py-6 text-base animate-pulse">
                <Search className="w-5 h-5 mr-2 animate-spin" /> Searching for opponent...
              </Button>
              <div>
                <button onClick={cancelSearch} className="font-mono text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                  <X className="w-3 h-3" /> cancel
                </button>
              </div>
            </div>
          )}

          {phase === "connecting" && (
            <div className="text-center font-mono text-sm text-muted-foreground">
              Establishing P2P connection...
            </div>
          )}

          {phase === "result" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
              <div className={`font-display text-4xl md:text-6xl font-black ${won ? "text-primary text-glow" : "text-destructive"}`}>
                {won ? "VICTORY" : "DEFEAT"}
              </div>
              <div className="font-mono text-2xl">
                <span className={won ? "text-primary" : "text-destructive"}>{eloDelta > 0 ? "+" : ""}{eloDelta}</span>
                <span className="text-muted-foreground"> ELO</span>
              </div>
              <div className="font-mono text-sm text-muted-foreground">
                Final: {finalScores.me.toFixed(2)} vs {finalScores.opp.toFixed(2)} PSL
              </div>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => { reset(); setTimeout(findMatch, 100); }} className="bg-primary text-primary-foreground">
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function StatPill({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <div className="surface-card px-4 py-2">
      <div className="text-[10px] text-muted-foreground tracking-widest font-mono">{label}</div>
      <div className={`font-mono font-bold text-lg ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function CameraSlot({ children, label, elo, active, score }: any) {
  return (
    <div className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all ${active ? "border-primary shadow-[var(--shadow-glow-lg)]" : "border-border"}`}>
      {children}
      <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 backdrop-blur text-xs font-mono">
        {label} {elo && <span className="text-primary ml-1">{elo}</span>}
      </div>
      {active && (
        <div className="absolute top-2 right-2 px-2 py-1 rounded bg-destructive/80 text-xs font-mono font-bold animate-pulse">● LIVE</div>
      )}
      {score !== null && score !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-between text-xs font-mono mb-1">
            <span className="text-muted-foreground">PSL SCAN</span>
            <span className="text-primary font-bold tabular-nums">{Math.max(0, score).toFixed(2)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${Math.max(0, Math.min(100, (score / 8) * 100))}%`, boxShadow: "0 0 8px var(--primary)" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
