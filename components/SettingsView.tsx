'use client';

import { useCallback, useEffect, useState } from 'react';

import { AppShell } from '@/components/AppShell';
import { PricingEditor } from '@/components/PricingEditor';

/**
 * The Settings page. It has no command line to show, so it renders without
 * a footer.
 */
export function SettingsView() {
  const [unpriced, setUnpriced] = useState<string[]>([]);

  // ccusage knows which models it has no price for; only its own report says so.
  const loadUnpriced = useCallback(async () => {
    try {
      const res = await fetch('/api/usage?view=daily&source=all');
      const body = (await res.json()) as { totals?: { unpricedModels?: string[] } };
      if (res.ok) setUnpriced(body.totals?.unpricedModels ?? []);
    } catch {
      /* the editor works fine without the shortcuts */
    }
  }, []);

  useEffect(() => {
    loadUnpriced();
  }, [loadUnpriced]);

  return (
    <AppShell>
      <PricingEditor unpriced={unpriced} onSaved={loadUnpriced} />
    </AppShell>
  );
}
