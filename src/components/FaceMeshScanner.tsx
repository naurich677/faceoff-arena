import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Metrics = {
  symmetry: number;
  jawline: number;
  canthal: number;
  ipd: number;
  psl: number;
};

// Compute fake-but-deterministic metrics from face landmarks.
// This is ENTERTAINMENT — not a medical or scientific assessment.
function computeMetrics(lm: { x: number; y: number; z: number }[]): Metrics {
  // Key indices from MediaPipe Face Mesh (468 points)
  const L_EYE_OUT = 33, R_EYE_OUT = 263, L_EYE_IN = 133, R_EYE_IN = 362;
  const NOSE = 1, CHIN = 152, JAW_L = 172, JAW_R = 397;
  const FH_L = 54, FH_R = 284;

  const dist = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y);

  // Symmetry: compare left/right offsets from nose
  const lJaw = dist(lm[JAW_L], lm[NOSE]);
  const rJaw = dist(lm[JAW_R], lm[NOSE]);
  const lFh = dist(lm[FH_L], lm[NOSE]);
  const rFh = dist(lm[FH_R], lm[NOSE]);
  const sym = 1 - (Math.abs(lJaw - rJaw) / Math.max(lJaw, rJaw) + Math.abs(lFh - rFh) / Math.max(lFh, rFh)) / 2;

  // Jawline: width vs height
  const jawW = dist(lm[JAW_L], lm[JAW_R]);
  const faceH = dist(lm[NOSE], lm[CHIN]);
  const jawRatio = jawW / faceH; // ~1.5-2.0 typical
  const jawline = Math.max(0, Math.min(1, (jawRatio - 1.2) / 1.0));

  // Canthal tilt: vertical offset between inner & outer eye corners
  const ltilt = (lm[L_EYE_IN].y - lm[L_EYE_OUT].y);
  const rtilt = (lm[R_EYE_IN].y - lm[R_EYE_OUT].y);
  const canthal = Math.max(0, Math.min(1, (ltilt + rtilt) * 50 + 0.5));

  // IPD ratio: inter-pupillary vs face width
  const ipd = dist(lm[L_EYE_OUT], lm[R_EYE_OUT]) / jawW;
  const ipdScore = 1 - Math.min(1, Math.abs(ipd - 1.05) * 4);

  const psl = (sym * 2.5 + jawline * 2 + canthal * 1.5 + ipdScore * 2);
  return {
    symmetry: Math.round(sym * 100),
    jawline: Math.round(jawline * 100),
    canthal: Math.round(canthal * 100),
    ipd: Math.round(ipdScore * 100),
    psl: Math.max(0, Math.min(8, +psl.toFixed(1))),
  };
}

export function FaceMeshScanner({
  videoRef,
  active,
  onResult,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  active: boolean;
  onResult: (m: Metrics) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [scanning, setScanning] = useState(false);
  const samplesRef = useRef<Metrics[]>([]);

  useEffect(() => {
    if (!active || !videoRef.current) return;
    let faceMesh: any;
    let raf = 0;
    let cancelled = false;
    setScanning(true);
    samplesRef.current = [];

    (async () => {
      const mod = await import("@mediapipe/face_mesh");
      const FaceMesh: any = (mod as any).FaceMesh;
      faceMesh = new FaceMesh({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
      });
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: false,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });

      faceMesh.onResults((results: any) => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.multiFaceLandmarks?.length) {
          const lm = results.multiFaceLandmarks[0];
          // draw points
          ctx.fillStyle = "oklch(0.82 0.18 220 / 0.7)";
          for (const p of lm) {
            ctx.beginPath();
            ctx.arc(p.x * canvas.width, p.y * canvas.height, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
          const m = computeMetrics(lm);
          samplesRef.current.push(m);
          if (samplesRef.current.length > 30) samplesRef.current.shift();
          // average
          const avg = samplesRef.current.reduce(
            (acc, x) => ({
              symmetry: acc.symmetry + x.symmetry,
              jawline: acc.jawline + x.jawline,
              canthal: acc.canthal + x.canthal,
              ipd: acc.ipd + x.ipd,
              psl: acc.psl + x.psl,
            }),
            { symmetry: 0, jawline: 0, canthal: 0, ipd: 0, psl: 0 }
          );
          const n = samplesRef.current.length;
          const out = {
            symmetry: Math.round(avg.symmetry / n),
            jawline: Math.round(avg.jawline / n),
            canthal: Math.round(avg.canthal / n),
            ipd: Math.round(avg.ipd / n),
            psl: +(avg.psl / n).toFixed(1),
          };
          setMetrics(out);
          if (samplesRef.current.length >= 25) {
            onResult(out);
          }
        }
      });

      const tick = async () => {
        if (cancelled) return;
        if (videoRef.current && videoRef.current.readyState >= 2) {
          await faceMesh.send({ image: videoRef.current });
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      faceMesh?.close?.();
      setScanning(false);
    };
  }, [active, videoRef, onResult]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      </div>
      <AnimatePresence>
        {metrics && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-end justify-between">
              <div>
                <div className="font-mono text-xs text-muted-foreground tracking-widest">PSL SCORE</div>
                <div className="font-mono text-5xl font-bold text-primary text-glow">{metrics.psl.toFixed(1)}<span className="text-muted-foreground text-2xl">/8</span></div>
              </div>
              <div className="text-xs text-muted-foreground font-mono">{scanning ? "LIVE · sampling" : "idle"}</div>
            </div>
            <Bar label="Facial Symmetry" v={metrics.symmetry} />
            <Bar label="Jawline Score" v={metrics.jawline} />
            <Bar label="Canthal Tilt" v={metrics.canthal} />
            <Bar label="IPD Ratio" v={metrics.ipd} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Bar({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs font-mono mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground">{v}</span>
      </div>
      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${v}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full bg-gradient-to-r from-primary/70 to-primary"
          style={{ boxShadow: "0 0 12px var(--accent-glow)" }}
        />
      </div>
    </div>
  );
}
