import { NextResponse } from 'next/server';

import { CcusageError, fetchUsage } from '@/lib/ccusage';
import { VIEWS, isSource } from '@/lib/types';
import type { ApiError, View } from '@/lib/types';

// Usage is read from the local machine on every request; never cache it.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const viewParam = params.get('view') ?? 'daily';
  const sourceParam = params.get('source') ?? 'all';

  if (!(VIEWS as readonly string[]).includes(viewParam)) {
    const body: ApiError = {
      error: `Unknown view "${viewParam}".`,
      hint: `Use one of: ${VIEWS.join(', ')}.`,
    };
    return NextResponse.json(body, { status: 400 });
  }
  if (!isSource(sourceParam)) {
    const body: ApiError = {
      error: `Unknown source "${sourceParam}".`,
      hint: 'Use "all" or one of the ccusage agent subcommands.',
    };
    return NextResponse.json(body, { status: 400 });
  }

  try {
    return NextResponse.json(await fetchUsage(viewParam as View, sourceParam));
  } catch (err) {
    if (err instanceof CcusageError) {
      const body: ApiError = { error: err.message, hint: err.hint };
      return NextResponse.json(body, { status: err.status });
    }
    const body: ApiError = { error: 'Unexpected error while reading ccusage output.' };
    return NextResponse.json(body, { status: 500 });
  }
}