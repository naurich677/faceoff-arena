import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type LobbyPresence = {
  user_id: string;
  username: string;
  elo: number;
  psl_score: number | null;
  joined_at: number;
};

export type MatchInvite = {
  match_id: string;
  initiator_id: string;
  opponent_id: string;
  initiator: LobbyPresence;
  opponent: LobbyPresence;
};

const LOBBY_CHANNEL = "mog-lobby-v1";

/**
 * Join the lobby and try to pair with another waiting player.
 * Returns a cleanup function. Calls onMatched once a match is established.
 */
export function joinLobby(
  me: LobbyPresence,
  onMatched: (invite: MatchInvite, role: "initiator" | "opponent") => void,
  onError: (msg: string) => void,
) {
  let matched = false;
  let channel: RealtimeChannel | null = null;

  const cleanup = () => {
    if (channel) {
      try {
        channel.untrack();
      } catch {}
      supabase.removeChannel(channel);
      channel = null;
    }
  };

  channel = supabase.channel(LOBBY_CHANNEL, {
    config: { presence: { key: me.user_id } },
  });

  // Listen for invites broadcast at us
  channel.on("broadcast", { event: "invite" }, (payload) => {
    if (matched) return;
    const invite = payload.payload as MatchInvite;
    if (invite.opponent_id !== me.user_id) return;
    matched = true;
    onMatched(invite, "opponent");
    cleanup();
  });

  const tryPair = async () => {
    if (matched || !channel) return;
    const state = channel.presenceState() as Record<string, LobbyPresence[]>;
    const players: LobbyPresence[] = Object.values(state)
      .map((arr) => arr[0])
      .filter(Boolean)
      .filter((p) => p.user_id !== me.user_id);
    if (players.length === 0) return;

    // Deterministic: only the player with the smaller user_id initiates,
    // to avoid both sides creating duplicate matches.
    const opponent = players.sort((a, b) => a.joined_at - b.joined_at)[0];
    if (me.user_id > opponent.user_id) return; // opponent will initiate

    matched = true;

    // Create match row
    const { data: match, error } = await supabase
      .from("matches")
      .insert({
        player1_id: me.user_id,
        player2_id: opponent.user_id,
        status: "pending",
        duration: 60,
      })
      .select()
      .single();

    if (error || !match) {
      matched = false;
      onError(error?.message ?? "Failed to create match");
      return;
    }

    const invite: MatchInvite = {
      match_id: match.id,
      initiator_id: me.user_id,
      opponent_id: opponent.user_id,
      initiator: me,
      opponent,
    };

    await channel.send({ type: "broadcast", event: "invite", payload: invite });
    onMatched(invite, "initiator");
    cleanup();
  };

  channel.on("presence", { event: "sync" }, tryPair);
  channel.on("presence", { event: "join" }, tryPair);

  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel!.track(me);
      // try immediately in case someone is already there
      setTimeout(tryPair, 200);
    }
  });

  return cleanup;
}
