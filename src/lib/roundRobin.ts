/**
 * Standard "circle method" round-robin scheduler. For an even number of
 * teams (n), produces n-1 rounds of n/2 matches where every team plays
 * every other team exactly once.
 */
export function generateRoundRobin(teamIds: string[]): [string, string][][] {
  const n = teamIds.length;
  if (n % 2 !== 0) throw new Error("generateRoundRobin requires an even number of teams");

  const fixed = teamIds[0];
  let rotating = teamIds.slice(1);
  const rounds: [string, string][][] = [];

  for (let r = 0; r < n - 1; r++) {
    const table = [fixed, ...rotating];
    const round: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = table[i];
      const b = table[n - 1 - i];
      round.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(round);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, rotating.length - 1)];
  }

  return rounds;
}
