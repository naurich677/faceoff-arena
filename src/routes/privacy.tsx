import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy · Mog Arena" }] }),
  component: () => (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 prose prose-invert">
        <h1 className="text-4xl font-display font-black mb-6">Privacy</h1>
        <p className="text-muted-foreground">We process your video locally in your browser for face mesh analysis. PSL scores and account data (username, ELO, match history) are stored on our servers. Live duel video is peer-to-peer and not recorded by us. Sign-in is via Google OAuth.</p>
        <p className="text-muted-foreground mt-4">You can request deletion of your account at any time via Discord.</p>
      </div>
    </Layout>
  ),
});
