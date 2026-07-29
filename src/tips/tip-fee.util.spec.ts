import { computeTipFee } from './tip-fee.util';

describe('computeTipFee', () => {
  it('computes a 5% fee (500 bps) on a round amount', () => {
    expect(computeTipFee(1000, 500)).toEqual({
      feeCents: 50,
      creatorNetCents: 950,
    });
  });

  it('rounds half-up on fractional cents', () => {
    // 333 * 500 / 10000 = 16.65 -> rounds to 17
    expect(computeTipFee(333, 500)).toEqual({
      feeCents: 17,
      creatorNetCents: 316,
    });
  });

  it('charges zero fee at 0 bps', () => {
    expect(computeTipFee(1000, 0)).toEqual({
      feeCents: 0,
      creatorNetCents: 1000,
    });
  });

  it('takes the full amount at 10000 bps (100%)', () => {
    expect(computeTipFee(1000, 10000)).toEqual({
      feeCents: 1000,
      creatorNetCents: 0,
    });
  });

  it('fee + net always reconciles to the original amount', () => {
    const { feeCents, creatorNetCents } = computeTipFee(777, 337);
    expect(feeCents + creatorNetCents).toBe(777);
  });
});
