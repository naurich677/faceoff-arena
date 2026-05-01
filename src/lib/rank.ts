export type Rank = { name: string; color: string; min: number };

export const RANKS: Rank[] = [
  { name: "Unranked", color: "oklch(0.55 0.02 270)", min: 0 },
  { name: "Bronze", color: "oklch(0.6 0.12 50)", min: 900 },
  { name: "Silver", color: "oklch(0.78 0.02 270)", min: 1050 },
  { name: "Gold", color: "oklch(0.86 0.16 90)", min: 1200 },
  { name: "Platinum", color: "oklch(0.85 0.08 200)", min: 1400 },
  { name: "Diamond", color: "oklch(0.82 0.18 220)", min: 1600 },
  { name: "GOD", color: "oklch(0.7 0.28 330)", min: 1900 },
];

export function rankFromElo(elo: number): Rank {
  return [...RANKS].reverse().find((r) => elo >= r.min) ?? RANKS[0];
}
