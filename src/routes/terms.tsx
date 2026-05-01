import { createFileRoute } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms · Mog Arena" }] }),
  component: () => (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <h1 className="text-4xl font-display font-black mb-6">Terms</h1>
        <p className="text-muted-foreground">Mog Arena is an entertainment platform for users 18+. PSL scores are subjective and do not represent any objective measure of attractiveness or worth. Be respectful in duels — harassment, nudity, or content involving minors is forbidden and results in a permanent ban.</p>
        <p className="text-muted-foreground mt-4">By using the platform you agree that duels are voluntary and may be ended at any time.</p>
      </div>
    </Layout>
  ),
});
