export interface TipFeeBreakdown {
  feeCents: number;
  creatorNetCents: number;
}

/**
 * bps = basis points (1/100th of a percent). 500 bps == 5%.
 * Rounded half-up so fee + net always reconciles back to amountCents.
 */
export function computeTipFee(
  amountCents: number,
  feeBps: number,
): TipFeeBreakdown {
  const feeCents = Math.round((amountCents * feeBps) / 10000);
  return {
    feeCents,
    creatorNetCents: amountCents - feeCents,
  };
}
