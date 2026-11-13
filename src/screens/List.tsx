import { useMemo, useState } from 'react';
import { Icon } from '../components/icons';
import { TicketList } from '../components/Ticket';
import { TopBar } from '../components/TopBar';
import { Chips, IconButton, Segmented } from '../components/ui';
import { sortSubs } from '../lib/stats';
import type { SortKey, SubStatus } from '../lib/types';
import { useApp } from '../state/app';
import { go } from '../state/router';

type Filter = 'all' | SubStatus;

export function List() {
  const { subs, settings, update, t, tn, category, categoryName } = useApp();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Filter>('all');
  const [cat, setCat] = useState('all');

  const usedCategories = useMemo(() => {
    const ids = [...new Set(subs.map((s) => category(s.categoryId).id))];
    return ids.map(category).sort((a, b) => a.order - b.order);
  }, [subs, category]);

  const usedStatuses = useMemo(() => (['active', 'trial', 'paused', 'cancelled'] as SubStatus[]).filter((st) => subs.some((s) => s.status === st)), [subs]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = subs.filter(
      (s) =>
        (status === 'all' || s.status === status) &&
        (cat === 'all' || category(s.categoryId).id === cat) &&
        (!q || s.name.toLowerCase().includes(q) || s.notes?.toLowerCase().includes(q) || s.paymentMethod?.toLowerCase().includes(q)),
    );
    return sortSubs(filtered, settings.sort, settings);
  }, [subs, query, status, cat, settings, category]);

  return (
    <div className="screen">
      <TopBar kicker={tn('subscriptions', subs.length)} title={t('nav.list')} actions={<span className="only-desktop"><IconButton icon="plus" label={t('common.add')} onClick={() => go('/new')} /></span>} />

      {subs.length === 0 ? (
        <div className="empty">
          <h2 className="empty__title">{t('list.emptyTitle')}</h2>
          <p className="empty__text">{t('home.emptyText')}</p>
          <button className="btn btn--accent" onClick={() => go('/new')}>
            <Icon name="plus" size={18} />
            {t('home.addFirst')}
          </button>
        </div>
      ) : (
        <>
          <label className="search">
            <Icon name="search" size={20} className="row__icon" />
            <input type="search" value={query} placeholder={t('list.search')} onChange={(e) => setQuery(e.target.value)} enterKeyHint="search" />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label={t('common.clear')}>
                <Icon name="close" size={18} />
              </button>
            )}
          </label>

          {usedStatuses.length > 1 && (
            <Chips
              scroll
              label={t('list.status')}
              value={status}
              onChange={setStatus}
              options={[{ value: 'all' as Filter, label: t('list.all') }, ...usedStatuses.map((st) => ({ value: st as Filter, label: t(`status.${st}`) }))]}
            />
          )}

          {usedCategories.length > 1 && (
            <Chips
              scroll
              label={t('edit.category')}
              value={cat}
              onChange={setCat}
              options={[{ value: 'all', label: t('list.allCategories') }, ...usedCategories.map((c) => ({ value: c.id, label: categoryName(c), color: c.color }))]}
            />
          )}

          <Segmented<SortKey>
            label={t('list.sort')}
            value={settings.sort}
            onChange={(sort) => update({ sort })}
            options={[
              { value: 'date', label: t('list.byDate') },
              { value: 'price', label: t('list.byPrice') },
              { value: 'name', label: t('list.byName') },
            ]}
          />

          {shown.length ? (
            <TicketList subs={shown} onOpen={(s) => go(`/sub/${s.id}`)} />
          ) : (
            <div className="note">
              <Icon name="search" />
              <div className="note__body">{t('list.nothing')}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
