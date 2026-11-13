import { useMemo, useRef, useState } from 'react';
import { Icon } from '../components/icons';
import { ServiceMark } from '../components/Ticket';
import { BackBar } from '../components/TopBar';
import { Chips, MultiChips, Segmented, Stepper, Switch, Swatches } from '../components/ui';
import { getService, searchServices, serviceName, type Service } from '../data/catalog';
import { safeUrl } from '../lib/backup';
import { SWATCHES } from '../lib/categories';
import { addCycle, isValidISO, parts } from '../lib/dates';
import { CURRENCIES, currencySymbol, parseAmount } from '../lib/money';
import { blankSubscription, saveSubscription } from '../lib/store';
import type { CycleUnit, SubStatus, Subscription } from '../lib/types';
import { useApp } from '../state/app';
import { useDialogs } from '../state/dialogs';
import { back, replace } from '../state/router';

type Preset = 'w1' | 'm1' | 'm3' | 'm6' | 'y1' | 'custom';

const PRESETS: Record<Exclude<Preset, 'custom'>, { every: number; unit: CycleUnit }> = {
  w1: { every: 1, unit: 'week' },
  m1: { every: 1, unit: 'month' },
  m3: { every: 3, unit: 'month' },
  m6: { every: 6, unit: 'month' },
  y1: { every: 1, unit: 'year' },
};

function presetOf(every: number, unit: CycleUnit): Preset {
  const hit = (Object.keys(PRESETS) as Array<keyof typeof PRESETS>).find((k) => PRESETS[k].every === every && PRESETS[k].unit === unit);
  return hit ?? 'custom';
}

const REMIND_CHOICES = [0, 1, 2, 3, 5, 7, 14];

export function Edit({ id, serviceKey }: { id?: string; serviceKey?: string }) {
  const app = useApp();
  const { subs, settings, categories, today, t, tn, lang, categoryName, date } = app;
  const { toast } = useDialogs();
  const existing = id ? subs.find((s) => s.id === id) : undefined;

  const initial = useMemo<Subscription>(() => {
    if (existing) return existing;
    const blank = blankSubscription(settings, today);
    const svc = getService(serviceKey);
    return svc ? withService(blank, svc) : blank;
    // The form keeps its own copy; later changes to the list must not reset it.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [sub, setSub] = useState<Subscription>(initial);
  const [priceText, setPriceText] = useState(initial.price ? String(initial.price) : '');
  const [preset, setPreset] = useState<Preset>(presetOf(initial.cycle.every, initial.cycle.unit));
  const [suggest, setSuggest] = useState(false);
  const [more, setMore] = useState(!!existing && !!(existing.share > 1 || existing.paymentMethod || existing.url || existing.notes || existing.remindDays));
  const [tried, setTried] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  function withService(s: Subscription, svc: Service): Subscription {
    return { ...s, name: serviceName(svc, lang), service: svc.key, color: svc.color, categoryId: categories.some((c) => c.id === svc.cat) ? svc.cat : s.categoryId, url: svc.url ?? s.url };
  }

  const set = (patch: Partial<Subscription>) => setSub((s) => ({ ...s, ...patch }));
  const matches = useMemo(() => (suggest ? searchServices(sub.name, lang) : []), [sub.name, lang, suggest]);

  const price = parseAmount(priceText);
  const errors = {
    name: !sub.name.trim(),
    price: price === null,
    date: !isValidISO(sub.nextDate),
  };
  const valid = !errors.name && !errors.price && !errors.date;

  const setCycle = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') set({ cycle: PRESETS[p] });
  };

  const setStatus = (status: SubStatus) => {
    // A trial usually ends in a week or two, not a whole period from now.
    if (status === 'trial' && sub.status !== 'trial' && !existing) set({ status, nextDate: addCycle(today, { every: 7, unit: 'day' }) });
    else set({ status });
  };

  const save = async () => {
    setTried(true);
    if (!valid || price === null) return;
    const url = sub.url ? safeUrl(/^https?:\/\//i.test(sub.url) ? sub.url : `https://${sub.url}`) : undefined;
    const dateChanged = !existing || existing.nextDate !== sub.nextDate;
    const next: Subscription = {
      ...sub,
      name: sub.name.trim(),
      price,
      url,
      paymentMethod: sub.paymentMethod?.trim() || undefined,
      notes: sub.notes?.trim() || undefined,
      billingDay: dateChanged ? parts(sub.nextDate).d : sub.billingDay,
    };
    await saveSubscription(next, today);
    toast(t(existing ? 'common.saved' : 'edit.added'));
    if (existing) back(`/sub/${sub.id}`);
    else replace(`/sub/${sub.id}`);
  };

  const sym = currencySymbol(sub.currency, lang);
  const remind = sub.remindDays ?? null;

  return (
    <div className="screen screen--plain">
      <BackBar title={existing ? t('edit.editTitle') : t('edit.newTitle')} fallback={existing ? `/sub/${existing.id}` : '/'} />

      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="field" style={{ position: 'relative' }}>
          <span className="field__label">{t('edit.service')}</span>
          <div className="input-row" style={{ alignItems: 'center', gap: 12 }}>
            <ServiceMark name={sub.name || '?'} color={sub.color} service={sub.service} size={44} />
            <input
              ref={nameRef}
              className="input input--big"
              value={sub.name}
              autoFocus={!existing && !serviceKey}
              placeholder={t('edit.namePlaceholder')}
              autoComplete="off"
              maxLength={120}
              onFocus={() => setSuggest(true)}
              onBlur={() => window.setTimeout(() => setSuggest(false), 150)}
              onChange={(e) => {
                const name = e.target.value;
                // Typing a different name detaches the catalog logo.
                const keep = sub.service && getService(sub.service) && serviceName(getService(sub.service)!, lang) === name;
                set({ name, service: keep ? sub.service : undefined });
                setSuggest(true);
              }}
            />
          </div>
          {tried && errors.name && <span className="field__error">{t('edit.nameRequired')}</span>}
          {matches.length > 0 && (
            <div className="suggest" role="listbox">
              {matches.map((m) => (
                <button
                  type="button"
                  key={m.key}
                  className="suggest__item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSub((s) => withService(s, m));
                    setSuggest(false);
                  }}
                >
                  <ServiceMark name={serviceName(m, lang)} color={m.color} service={m.key} size={30} />
                  <span style={{ flex: 1, minWidth: 0 }}>{serviceName(m, lang)}</span>
                  <span className="mono">{categoryName(app.category(m.cat))}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid-price">
          <label className="field">
            <span className="field__label">
              {t('edit.price')}, {sym}
            </span>
            <input
              className="input input--big input--mono"
              inputMode="decimal"
              value={priceText}
              placeholder="0"
              onChange={(e) => setPriceText(e.target.value)}
            />
            {tried && errors.price && <span className="field__error">{t('edit.priceInvalid')}</span>}
          </label>
          <label className="field">
            <span className="field__label">{t('edit.currency')}</span>
            <select className="input input--mono" value={sub.currency} onChange={(e) => set({ currency: e.target.value })}>
              {[...new Set([settings.currency, ...CURRENCIES])].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="field">
          <span className="field__label">{t('edit.cycle')}</span>
          <Chips<Preset>
            label={t('edit.cycle')}
            value={preset}
            onChange={setCycle}
            options={[
              { value: 'w1', label: t('cycle.week') },
              { value: 'm1', label: t('cycle.month') },
              { value: 'm3', label: t('cycle.quarter') },
              { value: 'm6', label: t('cycle.halfYear') },
              { value: 'y1', label: t('cycle.year') },
              { value: 'custom', label: t('edit.custom') },
            ]}
          />
          {preset === 'custom' && (
            <div className="input-row" style={{ alignItems: 'center', gap: 12, marginTop: 6 }}>
              <span className="muted">{t('edit.every')}</span>
              <Stepper label={t('edit.every')} value={sub.cycle.every} min={1} max={365} onChange={(every) => set({ cycle: { ...sub.cycle, every } })} />
              <select className="input" style={{ flex: 1 }} value={sub.cycle.unit} onChange={(e) => set({ cycle: { ...sub.cycle, unit: e.target.value as CycleUnit } })}>
                {(['day', 'week', 'month', 'year'] as CycleUnit[]).map((u) => (
                  <option key={u} value={u}>
                    {tn(`unit_${u}` as 'unit_day', sub.cycle.every).replace(/^\d+\s?/, '')}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="field">
          <span className="field__label">{t('edit.status')}</span>
          <Segmented<SubStatus>
            label={t('edit.status')}
            value={sub.status}
            onChange={setStatus}
            options={[
              { value: 'active', label: t('status.active') },
              { value: 'trial', label: t('status.trial') },
              { value: 'paused', label: t('status.paused') },
              { value: 'cancelled', label: t('status.cancelled') },
            ]}
          />
        </div>

        <label className="field">
          <span className="field__label">
            {t(sub.status === 'trial' ? 'edit.trialEnds' : sub.status === 'cancelled' ? 'edit.accessUntil' : 'edit.nextDate')}
          </span>
          <input className="input" type="date" value={sub.nextDate} onChange={(e) => set({ nextDate: e.target.value })} />
          {tried && errors.date ? (
            <span className="field__error">{t('edit.dateInvalid')}</span>
          ) : (
            isValidISO(sub.nextDate) && <span className="field__hint">{app.dueLabel(sub.nextDate)} · {date(sub.nextDate, { year: true })}</span>
          )}
        </label>

        {sub.status !== 'cancelled' && (
          <div className="row" style={{ padding: 0, minHeight: 0 }}>
            <div className="row__text">
              <div className="row__label">{t('edit.autoRenew')}</div>
              <div className="row__hint">{t(sub.autoRenew ? 'edit.autoRenewOn' : 'edit.autoRenewOff')}</div>
            </div>
            <Switch label={t('edit.autoRenew')} checked={sub.autoRenew} onChange={(autoRenew) => set({ autoRenew })} />
          </div>
        )}

        <div className="field">
          <span className="field__label">{t('edit.category')}</span>
          <Chips
            label={t('edit.category')}
            value={sub.categoryId}
            onChange={(categoryId) => set({ categoryId })}
            options={categories.map((c) => ({ value: c.id, label: `${c.emoji} ${categoryName(c)}` }))}
          />
        </div>

        <div className="field">
          <span className="field__label">{t('edit.color')}</span>
          <Swatches label={t('edit.color')} value={sub.color} colors={[...new Set([...(getService(sub.service) ? [getService(sub.service)!.color] : []), ...SWATCHES])]} onChange={(color) => set({ color })} />
        </div>

        {!more ? (
          <button type="button" className="btn btn--ghost" onClick={() => setMore(true)}>
            <Icon name="plus" size={18} />
            {t('edit.more')}
          </button>
        ) : (
          <>
            <div className="row" style={{ padding: 0, minHeight: 0 }}>
              <div className="row__text">
                <div className="row__label">{t('edit.share')}</div>
                <div className="row__hint">
                  {sub.share > 1 && price ? t('edit.shareHint', { amount: app.money(price / sub.share, sub.currency, { show: true }) }) : t('edit.shareOff')}
                </div>
              </div>
              <Stepper label={t('edit.share')} value={sub.share} min={1} max={20} onChange={(share) => set({ share })} />
            </div>

            <label className="field">
              <span className="field__label">{t('edit.payment')}</span>
              <input className="input" value={sub.paymentMethod ?? ''} maxLength={80} placeholder={t('edit.paymentPlaceholder')} onChange={(e) => set({ paymentMethod: e.target.value })} />
            </label>

            <label className="field">
              <span className="field__label">{t('edit.url')}</span>
              <input className="input input--mono" type="url" inputMode="url" value={sub.url ?? ''} placeholder="https://" autoCapitalize="off" onChange={(e) => set({ url: e.target.value })} />
            </label>

            <div className="field">
              <span className="field__label">{t('edit.remind')}</span>
              <Chips<'global' | 'own'>
                label={t('edit.remind')}
                value={remind ? 'own' : 'global'}
                onChange={(v) => set({ remindDays: v === 'own' ? [...settings.remindDays] : null })}
                options={[
                  { value: 'global', label: t('edit.remindGlobal') },
                  { value: 'own', label: t('edit.remindOwn') },
                ]}
              />
              {remind && (
                <MultiChips<number>
                  label={t('edit.remind')}
                  values={remind}
                  onToggle={(d) => {
                    const nextDays = remind.includes(d) ? remind.filter((x) => x !== d) : [...remind, d].sort((a, b) => b - a);
                    set({ remindDays: nextDays.length ? nextDays : null });
                  }}
                  options={REMIND_CHOICES.map((d) => ({ value: d, label: d === 0 ? t('remind.sameDay') : tn('daysBefore', d) }))}
                />
              )}
            </div>

            <label className="field">
              <span className="field__label">{t('edit.notes')}</span>
              <textarea className="input" value={sub.notes ?? ''} maxLength={4000} placeholder={t('edit.notesPlaceholder')} onChange={(e) => set({ notes: e.target.value })} />
            </label>

            {!existing && (
              <div className="note">
                <Icon name="key" />
                <div className="note__body muted">{t('edit.credsLater')}</div>
              </div>
            )}
          </>
        )}

        <button type="submit" className="btn btn--accent btn--block" style={{ marginTop: 4 }}>
          <Icon name="check" size={18} />
          {existing ? t('common.save') : t('edit.add')}
        </button>
      </form>
    </div>
  );
}
