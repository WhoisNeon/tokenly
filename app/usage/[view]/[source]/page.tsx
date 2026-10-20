import { redirect } from 'next/navigation';

import { UsageView } from '@/components/UsageView';
import { VIEWS, isSource } from '@/lib/types';
import type { View } from '@/lib/types';

/**
 * The URL is the state: /usage/<view>/<source>. Anything the CLI does not
 * know about goes back to the default report rather than rendering a broken page.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ view: string; source: string }>;
}) {
  const { view, source } = await params;

  if (!(VIEWS as readonly string[]).includes(view) || !isSource(source)) {
    redirect('/usage/daily/all');
  }

  return <UsageView view={view as View} source={source} />;
}
