'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, LoaderCircle, Plus, Save, Trash2 } from 'lucide-react';

import type { ApiError, ModelPrice, PricingPayload } from '@/lib/types';

type State =
  | { status: 'loading' }
  | { status: 'ready'; data: PricingPayload; drafts: Draft[]; dirty: boolean }
  | { status: 'error'; error: ApiError };

/**
 * Prices are held as the strings the user typed, not as numbers: a controlled
 * `<input type="number">` cannot hold a half-typed "3." without snapping the
 * value back. Conversion happens once, on save.
 */
type Draft = {
  model: string;
  input: string;
  output: string;
  cacheRead: string;
  cacheCreation: string;
};

const FIELDS = ['input', 'output', 'cacheRead', 'cacheCreation'] as const;

const toDraft = (price: ModelPrice): Draft => ({
  model: price.model,
  input: String(price.input),
  output: String(price.output),
  cacheRead: String(price.cacheRead),
  cacheCreation: String(price.cacheCreation),
});

const toPrice = (draft: Draft): ModelPrice => ({
  model: draft.model.trim(),
  input: Number(draft.input) || 0,
  output: Number(draft.output) || 0,
  cacheRead: Number(draft.cacheRead) || 0,
  cacheCreation: Number(draft.cacheCreation) || 0,
});

const blankDraft = (model = ''): Draft => ({
  model,
  input: '',
  output: '',
  cacheRead: '',
  cacheCreation: '',
});

export function PricingEditor({
  unpriced = [],
  onSaved,
}: {
  unpriced?: string[];
  onSaved?: () => void;
}) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Saving a price re-runs ccusage, and the report it replaces has no data
  // for a moment. Hold the last list so the shortcuts do not blink out.
  const lastUnpriced = useRef(unpriced);
  useEffect(() => {
    if (unpriced.length > 0) lastUnpriced.current = unpriced;
  }, [unpriced]);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const res = await fetch('/api/pricing');
      const body = (await res.json()) as PricingPayload | ApiError;
      if (!res.ok || 'error' in body) {
        setState({
          status: 'error',
          error: 'error' in body ? body : { error: `Request failed (${res.status}).` },
        });
        return;
      }
      setState({
        status: 'ready',
        data: body,
        drafts: body.prices.map(toDraft),
        dirty: false,
      });
    } catch (err) {
      setState({ status: 'error', error: { error: (err as Error).message } });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const edit = (index: number, field: keyof Draft, value: string) => {
    setState((previous) => {
      if (previous.status !== 'ready') return previous;
      const drafts = previous.drafts.map((draft, i) =>
        i === index ? { ...draft, [field]: value } : draft,
      );
      return { ...previous, drafts, dirty: true };
    });
    setSaved(false);
  };

  const add = (model = '') => {
    setState((previous) => {
      if (previous.status !== 'ready') return previous;
      return { ...previous, drafts: [...previous.drafts, blankDraft(model)], dirty: true };
    });
    setSaved(false);
  };

  const remove = (index: number) => {
    setState((previous) => {
      if (previous.status !== 'ready') return previous;
      return {
        ...previous,
        drafts: previous.drafts.filter((_, i) => i !== index),
        dirty: true,
      };
    });
    setSaved(false);
  };

  const save = async () => {
    const current = state;
    if (current.status !== 'ready') return;

    const named = current.drafts.filter((draft) => draft.model.trim() !== '');
    if (named.length !== current.drafts.length) {
      setSaveError('Every row needs a model name.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prices: named.map(toPrice) }),
      });
      const body = (await res.json()) as PricingPayload | ApiError;
      if (!res.ok || 'error' in body) {
        setSaveError('error' in body ? body.error : `Save failed (${res.status}).`);
        return;
      }
      setState({
        status: 'ready',
        data: body,
        drafts: body.prices.map(toDraft),
        dirty: false,
      });
      setSaved(true);
      // Costs on the dashboard are computed by ccusage from this file, so the
      // report has to be re-read for the new prices to show.
      onSaved?.();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (state.status === 'loading') {
    return (
      <div className="panel reveal">
        <div className="panel__head">
          <h2 className="panel__title">Model prices</h2>
          <span className="label">
            <LoaderCircle className="spin" size={12} aria-hidden="true" /> reading ccusage config
          </span>
        </div>
        <div className="skeleton" />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="panel reveal">
        <div className="state state--error">
          <CircleAlert className="state__icon" size={22} aria-hidden="true" />
          <div className="state__title">Could not read the pricing config</div>
          <p className="state__body">{state.error.error}</p>
          {state.error.hint && <p className="state__hint">{state.error.hint}</p>}
        </div>
      </div>
    );
  }

  const { data, drafts, dirty } = state;
  const missing = lastUnpriced.current.filter(
    (model) => !drafts.some((draft) => draft.model === model),
  );

  return (
    <section className="panel reveal">
      <div className="panel__head">
        <h2 className="panel__title">Model prices</h2>
        <code className="pricing__path">{data.path}</code>
      </div>

      <div className="pricing">
        <p className="pricing__note">
          Dollars per million tokens. ccusage reads this file on every run, so saving here changes
          every cost on the dashboard.
        </p>

        {missing.length > 0 && (
          <p className="pricing__unpriced">
            <span className="pricing__unpriced-label">No price yet</span>
            {missing.map((model) => (
              <button
                key={model}
                type="button"
                className="chip chip--action"
                onClick={() => add(model)}
              >
                {model}
                <Plus size={11} aria-hidden="true" />
              </button>
            ))}
          </p>
        )}

        {data.agentOverrides.length > 0 && (
          <p className="state__hint state__hint--warn">
            {data.agentOverrides.join(', ')} set their own prices, and those win over the defaults
            below. Edit them in the config file to change them.
          </p>
        )}
      </div>

      <div className="table-scroll">
        <table className="pricing__table">
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col">Input</th>
              <th scope="col">Output</th>
              <th scope="col">Cache read</th>
              <th scope="col">Cache write</th>
              <th scope="col">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((draft, index) => (
              <tr key={index}>
                <td className="pricing__model">
                  <input
                    type="text"
                    value={draft.model}
                    placeholder="model-name"
                    aria-label="Model name"
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(event) => edit(index, 'model', event.target.value)}
                  />
                </td>
                {FIELDS.map((field) => (
                  <td key={field}>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="pricing__num"
                      value={draft[field]}
                      placeholder="0"
                      step="0.01"
                      aria-label={`${draft.model || 'model'} ${field} price`}
                      spellCheck={false}
                      autoComplete="off"
                      onChange={(event) => edit(index, field, event.target.value)}
                    />
                  </td>
                ))}
                <td className="pricing__remove">
                  <button
                    type="button"
                    className="btn btn--icon"
                    aria-label={`Remove ${draft.model || 'model'}`}
                    title="Remove"
                    onClick={() => remove(index)}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
            {drafts.length === 0 && (
              <tr>
                <td colSpan={6} className="pricing__empty">
                  No price overrides. ccusage is using its own table.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="row-head">
                {drafts.length} model{drafts.length === 1 ? '' : 's'}
              </th>
              {FIELDS.map((field) => (
                <td key={field} />
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="pricing__actions">
        <button type="button" className="btn" onClick={() => add()}>
          <Plus size={13} aria-hidden="true" />
          Add model
        </button>

        <div className="pricing__status" role="status" aria-live="polite">
          {saveError && (
            <span className="pricing__error">
              <CircleAlert size={13} aria-hidden="true" />
              {saveError}
            </span>
          )}
          {!saveError && saved && (
            <span className="pricing__ok">
              <CircleCheck size={13} aria-hidden="true" />
              Saved
            </span>
          )}
        </div>

        <button
          type="button"
          className="btn btn--primary"
          disabled={!dirty || saving}
          onClick={save}
        >
          {saving ? (
            <LoaderCircle className="spin" size={13} aria-hidden="true" />
          ) : (
            <Save size={13} aria-hidden="true" />
          )}
          Save prices
        </button>
      </div>
    </section>
  );
}
