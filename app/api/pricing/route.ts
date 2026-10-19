import { NextResponse } from 'next/server';

import { readPricing, writePricing } from '@/lib/pricing';
import type { ApiError, ModelPrice } from '@/lib/types';

// Prices are read from and written to the local machine on every request;
// never cache it.
export const dynamic = 'force-dynamic';

const isPrice = (value: unknown): value is ModelPrice => {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.model === 'string' &&
    p.model.trim() !== '' &&
    typeof p.input === 'number' &&
    typeof p.output === 'number' &&
    typeof p.cacheRead === 'number' &&
    typeof p.cacheCreation === 'number'
  );
};

export async function GET() {
  try {
    return NextResponse.json(await readPricing());
  } catch (err) {
    const body: ApiError = { error: (err as Error).message };
    return NextResponse.json(body, { status: 500 });
  }
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    const body: ApiError = { error: 'Request body was not valid JSON.' };
    return NextResponse.json(body, { status: 400 });
  }

  const prices = (payload as { prices?: unknown })?.prices;
  if (!Array.isArray(prices) || !prices.every(isPrice)) {
    const body: ApiError = {
      error: 'Expected { prices: [{ model, input, output, cacheRead, cacheCreation }] }.',
      hint: 'Prices are dollars per million tokens and must be non-negative numbers.',
    };
    return NextResponse.json(body, { status: 400 });
  }

  const negative = prices.find(
    (price) => price.input < 0 || price.output < 0 || price.cacheRead < 0 || price.cacheCreation < 0,
  );
  if (negative) {
    const body: ApiError = { error: `Prices cannot be negative (${negative.model}).` };
    return NextResponse.json(body, { status: 400 });
  }

  try {
    return NextResponse.json(await writePricing(prices));
  } catch (err) {
    const body: ApiError = { error: (err as Error).message };
    return NextResponse.json(body, { status: 500 });
  }
}
