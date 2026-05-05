import React from 'react';
import {
  typeStyles, Icon, Card, SectionLabel,
} from '../design-system.jsx';
import { useWallet } from '../hooks/use-wallet.js';
import { tierFor } from '../lib/tiers.js';

// v2 Sprint 0 — Mine tab "wallet hero": read-only list of awarded rewards.
// Edit / claim / choose flows arrive in Sprint 2.

const TIER_COLORS = { bronze: '#C08458', silver: '#A0AEC0', gold: '#D4A65A' };
const TIER_LABEL = {
  bronze: { en: 'Bronze', ar: 'برونزي' },
  silver: { en: 'Silver', ar: 'فضي' },
  gold:   { en: 'Gold',   ar: 'ذهبي' },
};

function ScreenMine({ theme, t, dir }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const { rewards, grouped, loading, error } = useWallet();

  if (loading) return <MineLoading theme={T} dir={dir}/>;

  const summaryStats = [
    { key: 'ready',     label: t('rewardStatusReady'),     count: grouped.ready.length },
    { key: 'claimed',   label: t('rewardStatusClaimed'),   count: grouped.claimed.length },
    { key: 'fulfilled', label: t('rewardStatusFulfilled'), count: grouped.fulfilled.length },
  ];

  return (
    <div style={{
      height: '100%', background: T.bg, overflow: 'auto',
      paddingTop: 54, paddingBottom: 100, boxSizing: 'border-box',
    }}>
      <div style={{ padding: '18px 22px 6px' }}>
        <div style={{
          fontFamily: typeStyles(T).displayFont, fontSize: 28, lineHeight: 1.1,
          color: T.text, letterSpacing: -0.4,
        }}>{t('walletTitle')}</div>
        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>
          {t('walletSub')}
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ padding: '14px 16px 4px' }}>
        <Card theme={T} pad={14} radius={20}>
          <div style={{ display: 'flex' }}>
            {summaryStats.map((s, i) => (
              <div key={s.key} style={{
                flex: 1,
                borderLeft: i > 0 ? `1px solid ${T.border}` : 'none',
                paddingLeft: i > 0 ? 12 : 0, paddingRight: i < summaryStats.length - 1 ? 12 : 0,
              }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: T.text, lineHeight: 1 }}>{s.count}</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4, letterSpacing: 0.2 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {error ? (
        <ErrorState theme={T} lang={lang}/>
      ) : rewards.length === 0 ? (
        <EmptyState theme={T} t={t} dir={dir}/>
      ) : (
        <>
          <SectionLabel theme={T}>{t('walletTitle')}</SectionLabel>
          <div style={{ padding: '0 16px' }}>
            <Card theme={T} pad={0} radius={22}>
              {rewards.map((r, i) => (
                <RewardRow
                  key={r.id}
                  theme={T} t={t} lang={lang}
                  reward={r}
                  divider={i < rewards.length - 1}
                />
              ))}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function RewardRow({ theme, t, lang, reward, divider }) {
  const T = theme;
  const tierColor = TIER_COLORS[reward.tier] || T.accent;
  const tierLabel = (TIER_LABEL[reward.tier] || { en: reward.tier, ar: reward.tier })[lang === 'ar' ? 'ar' : 'en'];
  const itemName = reward.chosen_item
    ? (lang === 'ar' && reward.chosen_item.name_ar ? reward.chosen_item.name_ar : reward.chosen_item.name_en)
    : t('rewardChooseCTA');
  const itemMissing = !reward.chosen_item;
  const statusKey = reward.status === 'ready' ? 'rewardStatusReady'
    : reward.status === 'claimed' ? 'rewardStatusClaimed'
    : 'rewardStatusFulfilled';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
      borderBottom: divider ? `1px solid ${T.border}` : 'none',
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12,
        background: tierColor + '22', color: tierColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon name="star" size={20}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, color: itemMissing ? T.textMuted : T.text,
          fontStyle: itemMissing ? 'italic' : 'normal',
          fontWeight: 500, lineHeight: 1.3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{itemName}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <span style={{
            padding: '2px 8px', borderRadius: 999,
            background: tierColor + '22', color: tierColor,
            fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
          }}>{tierLabel}</span>
          <span style={{ fontSize: 11, color: T.textMuted }}>{t(statusKey)}</span>
        </div>
      </div>
      <StatusDot theme={T} status={reward.status}/>
    </div>
  );
}

function StatusDot({ theme, status }) {
  const T = theme;
  const color = status === 'ready' ? T.accent
    : status === 'claimed' ? '#D4A65A'
    : T.textMuted;
  return (
    <div style={{
      width: 10, height: 10, borderRadius: 999, background: color, flexShrink: 0,
    }}/>
  );
}

function EmptyState({ theme, t, dir }) {
  const T = theme;
  return (
    <div style={{ padding: '36px 22px 0' }}>
      <Card theme={T} pad={24} radius={22}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: T.accentSoft, color: T.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="trophy" size={28}/>
        </div>
        <div style={{
          fontFamily: typeStyles(T).displayFont, fontSize: 19, color: T.text,
          letterSpacing: -0.2,
        }}>{t('walletEmptyTitle')}</div>
        <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.4, maxWidth: 280 }}>
          {t('walletEmptySub')}
        </div>
      </Card>
    </div>
  );
}

function ErrorState({ theme, lang }) {
  const T = theme;
  const text = lang === 'ar' ? 'تعذّر تحميل المكافآت.' : 'Could not load rewards.';
  return (
    <div style={{ padding: '24px 22px', color: T.textMuted, fontSize: 13, textAlign: 'center' }}>
      {text}
    </div>
  );
}

function MineLoading({ theme, dir }) {
  const T = theme;
  const text = dir === 'rtl' ? 'جارٍ التحميل…' : 'Loading…';
  return (
    <div style={{
      height: '100%', background: T.bg, paddingTop: 54, paddingBottom: 100,
      boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ color: T.textMuted, fontSize: 14, letterSpacing: 0.5 }}>{text}</div>
    </div>
  );
}

export { ScreenMine };
