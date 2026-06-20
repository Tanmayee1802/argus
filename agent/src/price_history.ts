export interface PricePoint {
  price:      number;
  confidence: number;
  timestamp:  number;
}

const MAX_WINDOW = 8;

export class PriceHistory {
  private suiPrices: PricePoint[] = [];
  private btcPrices: PricePoint[] = [];
  private suiBaselineVol = 0.80;

  push(sui: PricePoint, btc: PricePoint): void {
    this.suiPrices.push(sui);
    this.btcPrices.push(btc);
    if (this.suiPrices.length > MAX_WINDOW) this.suiPrices.shift();
    if (this.btcPrices.length > MAX_WINDOW) this.btcPrices.shift();
    if (this.suiPrices.length >= 4) {
      const currentVol = annualizedVol(this.suiPrices);
      this.suiBaselineVol = 0.97 * this.suiBaselineVol + 0.03 * currentVol;
    }
  }

  getSuiPrices():   PricePoint[] { return [...this.suiPrices]; }
  getBtcPrices():   PricePoint[] { return [...this.btcPrices]; }
  getBaselineVol(): number       { return this.suiBaselineVol; }
  hasEnoughData():  boolean      { return this.suiPrices.length >= 2; }
  isFull():         boolean      { return this.suiPrices.length >= MAX_WINDOW; }
}

export function logReturns(prices: PricePoint[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1].price > 0) {
      out.push(Math.log(prices[i].price / prices[i - 1].price));
    }
  }
  return out;
}

export function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

export function annualizedVol(prices: PricePoint[]): number {
  const rets = logReturns(prices);
  if (rets.length < 2) return 0;
  return stddev(rets) * Math.sqrt(96 * 365);
}

export function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const meanA = a.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const meanB = b.slice(0, n).reduce((s, v) => s + v, 0) / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num  += da * db;
    denA += da * da;
    denB += db * db;
  }
  if (denA === 0 || denB === 0) return 0;
  return num / Math.sqrt(denA * denB);
}