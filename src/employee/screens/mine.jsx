import React from 'react';
import {
  typeStyles, Icon, Card, SectionLabel, Button,
} from '../design-system.jsx';
import { useWallet } from '../hooks/use-wallet.js';
import { tierToken } from '../../shared/tokens.jsx';
import { getTierChoiceForReward } from '../../lib/supabase';

// v2 Mine tab — wallet hero. Sprint 0 shipped read-only display;
// Sprint 2 adds the choose-from-options + claim flow.

function ScreenMine({ theme, t, dir }) {
  const T = theme;
  const lang = dir === 'rtl' ? 'ar' : 'en';
  const { rewards, grouped, loading, error, claim } = useWallet();
  const [claiming, setClaiming] = React.useState(null);

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
                  onClick={r.status === 'ready' ? () => setClaiming(r) : undefined}
                />
              ))}
            </Card>
          </div>
        </>
      )}

      {claiming && (
        <ClaimSheet
          theme={T} t={t} lang={lang}
          reward={claiming}
          onCancel={() => setClaiming(null)}
          onClaim={async (chosenItemId) => {
            try {
              await claim(claiming.id, chosenItemId);
              setClaiming(null);
            } catch (_e) { /* surfaced via toast */ }
          }}/>
      )}
    </div>
  );
}

function RewardRow({ theme, t, lang, reward, divider, onClick }) {
  const T = theme;
  const tk = tierToken(reward.tier);
  const tierColor = tk.accent;
  const tierSoft = tk.accentSoft;
  const tierLabel = tk.label[lang === 'ar' ? 'ar' : 'en'];
  const itemName = reward.chosen_item
    ? (lang === 'ar' && reward.chosen_item.name_ar ? reward.chosen_item.name_ar : reward.chosen_item.name_en)
    : t('rewardChooseCTA');
  const itemMissing = !reward.chosen_item;
  const statusKey = reward.status === 'ready' ? 'rewardStatusReady'
    : reward.status === 'claimed' ? 'rewardStatusClaimed'
    : 'rewardStatusFulfilled';
  const interactive = !!onClick;
  const Tag = interactive ? 'button' : 'div';

  return (
    <Tag onClick={onClick} type={interactive ? 'button' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
        borderBottom: divider ? `1px solid ${T.border}` : 'none',
        background: 'transparent', border: 'none', width: '100%',
        textAlign: 'start', fontFamily: 'inherit',
        cursor: interactive ? 'pointer' : 'default',
      }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12,
        background: tierSoft, color: tierColor,
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
            background: tierSoft, color: tierColor,
            fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
          }}>{tierLabel}</span>
          <span style={{ fontSize: 11, color: T.textMuted }}>{t(statusKey)}</span>
        </div>
      </div>
      {interactive ? (
        <Icon name={lang === 'ar' ? 'chevL' : 'chev'} size={16} style={{ color: T.textMuted }}/>
      ) : (
        <StatusDot theme={T} status={reward.status}/>
      )}
    </Tag>
  );
}

function ClaimSheet({ theme, t, lang, reward, onCancel, onClaim }) {
  const T = theme;
  const tk = tierToken(reward.tier);
  const tierLabel = tk.label[lang === 'ar' ? 'ar' : 'en'];
  const [choice, setChoice] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [selected, setSelected] = React.useState(reward.chosen_item_id || '');

  React.useEffect(() => {
    let alive = true;
    if (!reward.competition_id) {
      // No competition tied to the reward → ad-hoc award. Confirm-only flow.
      setChoice({ allow_choice: false, fixed_item: reward.chosen_item || null, options: [] });
      return;
    }
    getTierChoiceForReward(reward.competition_id, reward.tier)
      .then((c) => { if (alive) setChoice(c || { allow_choice: false, fixed_item: null, options: [] }); })
      .catch((e) => { if (alive) { setErr(e); setChoice({ allow_choice: false, fixed_item: null, options: [] }); } });
    return () => { alive = false; };
  }, [reward]);

  const allowChoice = choice?.allow_choice;
  const canClaim = !busy && choice && (allowChoice ? !!selected : true);

  const handleClaim = async () => {
    if (!canClaim) return;
    setBusy(true); setErr(null);
    try {
      await onClaim(allowChoice ? selected : undefined);
    } catch (e) {
      setErr(e); setBusy(false);
    }
  };

  return (
    <div onClick={onCancel} style={{
      position: 'absolute', inset: 0, background: T.overlay,
      display: 'flex', alignItems: 'flex-end', zIndex: 60,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', background: T.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: '20px 22px 28px', border: `1px solid ${T.border}`,
        animation: 'sheetUp .25s ease both',
        maxHeight: '80%', overflow: 'auto',
      }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: T.border, margin: '0 auto 18px' }}/>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{
            padding: '3px 10px', borderRadius: 999,
            background: tk.accentSoft, color: tk.accent,
            fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
          }}>{tierLabel}</span>
          <span style={{ fontSize: 12, color: T.textMuted }}>
            {lang === 'ar' ? 'مكافأة جاهزة' : 'Reward ready'}
          </span>
        </div>

        <div style={{
          fontFamily: typeStyles(T).displayFont, fontSize: 22, color: T.text,
          letterSpacing: -0.3, marginBottom: 6,
        }}>
          {choice == null
            ? (lang === 'ar' ? 'جارٍ التحميل…' : 'Loading…')
            : allowChoice
              ? (lang === 'ar' ? 'اختر مكافأتك' : 'Choose your reward')
              : (lang === 'ar' ? 'تأكيد الاستلام' : 'Confirm claim')}
        </div>
        <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 18 }}>
          {allowChoice
            ? (lang === 'ar' ? 'اختر خياراً واحداً ثم اضغط استلام.' : 'Pick one option, then tap claim.')
            : (lang === 'ar' ? 'سيتولّى فريق الموارد البشرية التسليم.' : 'HR will deliver the reward to you.')}
        </div>

        {choice && allowChoice && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            {choice.options.map((opt) => {
              const active = selected === opt.id;
              const name = lang === 'ar' && opt.name_ar ? opt.name_ar : opt.name_en;
              const desc = lang === 'ar' && opt.description_ar ? opt.description_ar : opt.description_en;
              return (
                <button key={opt.id} onClick={() => setSelected(opt.id)} type="button"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: 14, borderRadius: 14, cursor: 'pointer', textAlign: 'start',
                    background: active ? tk.accentSoft : T.surfaceAlt,
                    border: `1.5px solid ${active ? tk.accent : 'transparent'}`,
                    color: T.text, fontFamily: 'inherit',
                  }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{name}</div>
                    {desc && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 4 }}>{desc}</div>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted }}>
                    {Math.round((opt.value_minor || 0) / 100)} {opt.currency}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {choice && !allowChoice && choice.fixed_item && (
          <div style={{
            padding: 14, borderRadius: 14, marginBottom: 18,
            background: tk.accentSoft, border: `1.5px solid ${tk.accent}`,
          }}>
            <div style={{ fontSize: 14, color: T.text, fontWeight: 600, lineHeight: 1.3 }}>
              {lang === 'ar' && choice.fixed_item.name_ar ? choice.fixed_item.name_ar : choice.fixed_item.name_en}
            </div>
            {(lang === 'ar' ? choice.fixed_item.description_ar : choice.fixed_item.description_en) && (
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 6, lineHeight: 1.4 }}>
                {lang === 'ar' ? choice.fixed_item.description_ar : choice.fixed_item.description_en}
              </div>
            )}
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8, fontWeight: 600 }}>
              {Math.round((choice.fixed_item.value_minor || 0) / 100)} {choice.fixed_item.currency}
            </div>
          </div>
        )}

        {err && (
          <div style={{
            padding: '10px 12px', borderRadius: 10, marginBottom: 14,
            background: 'rgba(226,127,106,0.12)', color: '#E27F6A',
            fontSize: 12, fontWeight: 500,
          }}>
            {lang === 'ar' ? 'تعذّر الاستلام. حاول مجدّداً.' : 'Could not claim. Try again.'}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <Button theme={T} variant="secondary" style={{ flex: 1 }} onClick={onCancel}>
            {lang === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button theme={T} variant="primary" style={{ flex: 2 }}
            disabled={!canClaim} onClick={handleClaim}>
            {busy
              ? (lang === 'ar' ? 'جارٍ…' : 'Claiming…')
              : (lang === 'ar' ? 'استلام' : 'Claim')}
          </Button>
        </div>
      </div>
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
