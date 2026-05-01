import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ScanFace, ShieldCheck, Check, ArrowRight } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { FaceMeshScanner } from "@/components/FaceMeshScanner";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Onboarding · Mog Arena" }] }),
  component: Onboarding,
});

function Onboarding() {
  const [step, setStep] = useState(0); // 0=auth gate, 1=cam, 2=scan, 3=age
  const [user, setUser] = useState<any>(null);
  const [age, setAge] = useState(false);
  const [psl, setPsl] = useState<any>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setUser(data.session.user);
        setStep(1);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) { setUser(session.user); setStep((s) => (s === 0 ? 1 : s)); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Cleanup camera
  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play();
      }
    } catch (e) {
      toast.error("Camera access denied");
    }
  };

  const signIn = async () => {
    await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/onboarding" });
  };

  const finish = async () => {
    if (!user || !psl || !age) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        psl_score: psl.psl,
        psl_metrics: psl,
        age_verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    stream?.getTracks().forEach((t) => t.stop());
    toast.success("Welcome to the Arena");
    navigate({ to: "/arena" });
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-10">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex-1">
              <div className={`h-1 rounded-full transition-all ${step >= n ? "bg-primary" : "bg-surface-2"}`} />
              <div className={`text-xs font-mono mt-2 ${step >= n ? "text-primary" : "text-muted-foreground"}`}>
                STEP {n.toString().padStart(2, "0")}
              </div>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 0 && (
            <Card key="auth" icon={ShieldCheck} title="Sign in to continue" desc="Sign in with Google to enter the arena.">
              <Button onClick={signIn} size="lg" className="bg-primary text-primary-foreground hover:shadow-[var(--shadow-glow)]">
                Continue with Google
              </Button>
            </Card>
          )}

          {step === 1 && (
            <Card key="cam" icon={Camera} title="Camera Check" desc="Make sure your face is well-lit and centered.">
              <div className="aspect-video bg-surface-2 rounded-lg overflow-hidden border border-border relative">
                <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" muted playsInline />
                {!stream && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Camera className="w-10 h-10 text-muted-foreground mb-3" />
                    <Button onClick={startCamera}>Enable Camera</Button>
                  </div>
                )}
              </div>
              {stream && (
                <Button onClick={() => setStep(2)} className="bg-primary text-primary-foreground hover:shadow-[var(--shadow-glow)]">
                  <Check className="w-4 h-4 mr-1" /> Camera looks good
                </Button>
              )}
            </Card>
          )}

          {step === 2 && (
            <Card key="scan" icon={ScanFace} title="Solo PSL Scan" desc="468-point face mesh. Hold still ~5 seconds. Entertainment metric only.">
              <div className="aspect-video bg-surface-2 rounded-lg overflow-hidden border border-border relative">
                <video ref={videoRef} className="w-full h-full object-cover scale-x-[-1]" muted playsInline />
                <div className="absolute inset-0 scale-x-[-1]">
                  <FaceMeshScannerOverlay videoRef={videoRef} onResult={setPsl} />
                </div>
              </div>
              <FaceMeshScanner videoRef={videoRef} active={true} onResult={setPsl} />
              <Button
                disabled={!psl}
                onClick={() => setStep(3)}
                className="bg-primary text-primary-foreground disabled:opacity-40"
              >
                Lock in score <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Card>
          )}

          {step === 3 && (
            <Card key="age" icon={ShieldCheck} title="Age confirmation" desc="This platform is 18+. By continuing you agree to our Terms.">
              <label className="flex items-start gap-3 p-4 surface-card cursor-pointer hover:border-primary/40 transition">
                <Checkbox checked={age} onCheckedChange={(v) => setAge(!!v)} className="mt-0.5" />
                <div>
                  <div className="font-medium">I confirm I am 18+ years old</div>
                  <div className="text-xs text-muted-foreground mt-1">I understand this is an entertainment platform with live video duels.</div>
                </div>
              </label>
              <Button disabled={!age} onClick={finish} size="lg" className="bg-primary text-primary-foreground disabled:opacity-40 hover:shadow-[var(--shadow-glow)]">
                Enter the Arena <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Card>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}

function Card({ icon: Icon, title, desc, children }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="surface-card p-8 space-y-6"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{desc}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </motion.div>
  );
}

// Just the canvas overlay (mirrors the scanner canvas absolutely)
function FaceMeshScannerOverlay(_props: any) { return null; }
