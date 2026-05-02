import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

export type DuelChannelHandlers = {
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionState?: (state: RTCPeerConnectionState) => void;
  onScore?: (score: number) => void;
};

export type DuelChannel = {
  pc: RTCPeerConnection;
  channel: RealtimeChannel;
  sendScore: (score: number) => void;
  close: () => void;
};

/**
 * Establish a P2P video connection over a Supabase Realtime broadcast channel.
 * The "initiator" creates the offer once subscribed and the peer joins.
 */
export async function startDuelConnection(opts: {
  matchId: string;
  selfId: string;
  peerId: string;
  role: "initiator" | "opponent";
  localStream: MediaStream;
  handlers: DuelChannelHandlers;
}): Promise<DuelChannel> {
  const { matchId, selfId, peerId, role, localStream, handlers } = opts;

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  for (const track of localStream.getTracks()) {
    pc.addTrack(track, localStream);
  }

  const remoteStream = new MediaStream();
  pc.ontrack = (e) => {
    e.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t));
    handlers.onRemoteStream(remoteStream);
  };

  pc.onconnectionstatechange = () => {
    handlers.onConnectionState?.(pc.connectionState);
  };

  const channel = supabase.channel(`match:${matchId}`, {
    config: { broadcast: { self: false, ack: false } },
  });

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      channel.send({
        type: "broadcast",
        event: "ice",
        payload: { from: selfId, to: peerId, candidate: e.candidate.toJSON() },
      });
    }
  };

  const pendingIce: RTCIceCandidateInit[] = [];
  let remoteSet = false;

  channel.on("broadcast", { event: "offer" }, async (msg) => {
    const { from, sdp } = msg.payload as { from: string; sdp: RTCSessionDescriptionInit };
    if (from !== peerId) return;
    await pc.setRemoteDescription(sdp);
    remoteSet = true;
    while (pendingIce.length) {
      try { await pc.addIceCandidate(pendingIce.shift()!); } catch {}
    }
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    channel.send({
      type: "broadcast",
      event: "answer",
      payload: { from: selfId, to: peerId, sdp: answer },
    });
  });

  channel.on("broadcast", { event: "answer" }, async (msg) => {
    const { from, sdp } = msg.payload as { from: string; sdp: RTCSessionDescriptionInit };
    if (from !== peerId) return;
    await pc.setRemoteDescription(sdp);
    remoteSet = true;
    while (pendingIce.length) {
      try { await pc.addIceCandidate(pendingIce.shift()!); } catch {}
    }
  });

  channel.on("broadcast", { event: "ice" }, async (msg) => {
    const { from, candidate } = msg.payload as { from: string; candidate: RTCIceCandidateInit };
    if (from !== peerId) return;
    if (!remoteSet) {
      pendingIce.push(candidate);
      return;
    }
    try { await pc.addIceCandidate(candidate); } catch {}
  });

  channel.on("broadcast", { event: "score" }, (msg) => {
    const { from, score } = msg.payload as { from: string; score: number };
    if (from !== peerId) return;
    handlers.onScore?.(score);
  });

  channel.on("broadcast", { event: "ready" }, async (msg) => {
    if (role !== "initiator") return;
    const { from } = msg.payload as { from: string };
    if (from !== peerId) return;
    // peer is ready, send offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    channel.send({
      type: "broadcast",
      event: "offer",
      payload: { from: selfId, to: peerId, sdp: offer },
    });
  });

  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
    });
  });

  // Opponent signals readiness so initiator sends offer
  if (role === "opponent") {
    await channel.send({
      type: "broadcast",
      event: "ready",
      payload: { from: selfId, to: peerId },
    });
  }

  return {
    pc,
    channel,
    sendScore: (score) => {
      channel.send({
        type: "broadcast",
        event: "score",
        payload: { from: selfId, score },
      });
    },
    close: () => {
      try { pc.close(); } catch {}
      supabase.removeChannel(channel);
    },
  };
}
