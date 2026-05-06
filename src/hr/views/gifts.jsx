import React, { useState } from 'react';
import { DENSITY, tierToken } from '../../shared/tokens.jsx';
import { HRButton, HRIcon, Panel, Badge } from '../../shared/components.jsx';
import { HRPageHeader } from './_header.jsx';
import { useGiftsOverview } from '../hooks/use-gifts.js';
import { markRewardFulfilled } from '../../lib/supabase-hr';

// HR Gifts overview — v2 Sprint 1.
// 4 stat cards · 3 quick actions · activity feed.
// Catalog management ships in HRGiftCatalogPage; tier-config in Sprint 2.

function HRGiftsOverview({ theme, S, lang, density, onSection }) {
  const T = theme;
  const s = (en, ar) => lang === 'ar' ? ar : en;
  const { rewards, stats, loading, error, refetch } = useGiftsOverview();
  const gap = DENSITY[density].gap;

  if (loading) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
        {s('Loading…', 'جارٍ التحميل…')}
      </div>
    );
  }

  return (
    <>
      <HRPageHeader theme={T}
        eyebrow={s('Recognition · Rewards', 'التقدير · المكافآت')}
        title={s('Gifts', 'الهدايا')}
        sub={s('Allocate budget, configure tier rewards, and track redemptions.',
              'وزّع الميزانية، أعدّ مكافآت المراحل، وتابع الاستردادات.')}
        right={
          <HRButton theme={T} variant="primary" icon="plus" onClick={() => onSection?.('catalog')}>
            {s('Manage catalog', 'إدارة الكتالوج')}
          </HRButton>
        }
      />

      {error && <ErrorStrip theme={T} lang={lang}/>}

      {/* 4 stat cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap, marginBottom: gap,
      }}>
        <StatCard theme={T} S={S}
          label={s('Total budget', 'إجمالي الميزانية')}
          value={formatMinor(stats.totalBudget, stats.currency, lang)}
          sub={s(`${stats.activePools} active pool${stats.activePools === 1 ? '' : 's'}`,
                 `${stats.activePools} حوض نشط`)}
          icon="coin"/>
        <StatCard theme={T} S={S}
          label={s('Remaining', 'المتبقي')}
          value={formatMinor(stats.remaining, stats.currency, lang)}
          sub={budgetUsageLabel(stats, lang)}
          icon="coin" tone="positive"/>
        <StatCard theme={T} S={S}
          label={s('Rewards awarded', 'مكافآت ممنوحة')}
          value={String(stats.awarded)}
          sub={s(`${stats.readyToClaim} ready · ${stats.fulfilled} fulfilled`,
                 `${stats.readyToClaim} جاهزة · ${stats.fulfilled} تم تسليمها`)}
          icon="gifts"/>
        <StatCard theme={T} S={S}
          label={s('Pending fulfillment', 'بانتظار التنفيذ')}
          value={String(stats.pendingFulfillment)}
          sub={s('claimed, awaiting HR delivery', 'تم استلامها · بانتظار التسليم')}
          icon="bell" tone={stats.pendingFulfillment > 0 ? 'warn' : 'neutral'}/>
      </div>

      {/* 3 quick actions */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap, marginBottom: gap,
      }}>
        <QuickAction theme={T}
          icon="coin"
          title={s('New gift pool', 'حوض هدايا جديد')}
          sub={s('Allocate budget to a competition or open pool.',
                 'خصّص ميزانية لتحدٍّ أو حوض مفتوح.')}
          onClick={() => onSection?.('pools')}/>
        <QuickAction theme={T}
          icon="gifts"
          title={s('Edit gift catalog', 'تحرير الكتالوج')}
          sub={s('Manage WH Services, Amazon vouchers, and custom items.',
                 'أدِر خدمات WH وقسائم أمازون والعناصر المخصّصة.')}
          onClick={() => onSection?.('catalog')}/>
        <QuickAction theme={T}
          icon="challenges"
          title={s('Configure tier rewards', 'إعداد مكافآت المراحل')}
          sub={s('Bronze · Silver · Gold per competition.',
                 'برونزي · فضي · ذهبي لكل تحدٍّ.')}
          onClick={() => onSection?.('tiers')}/>
      </div>

      {/* Activity feed */}
      <Panel theme={T} density={density}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>
            {s('Recent activity', 'النشاط الأخير')}
          </div>
          <Badge theme={T} tone="neutral">{rewards.length}</Badge>
        </div>
        {rewards.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
            {s('No rewards have been awarded yet. Rewards appear here as employees finish competitions.',
               'لم تُمنح مكافآت بعد. ستظهر هنا عند إنهاء الموظفين للتحديات.')}
          </div>
        ) : (
          <div>
            {rewards.slice(0, 12).map((r, i) => (
              <ActivityRow key={r.id} theme={T} lang={lang} reward={r}
                divider={i < Math.min(rewards.length, 12) - 1}
                onFulfilled={refetch}/>
            ))}
            {rewards.length > 12 && (
              <div style={{ padding: '12px 0 0', textAlign: 'center', fontSize: 12, color: T.textMuted }}>
                {s(`+${rewards.length - 12} more`, `+${rewards.length - 12} أخرى`)}
              </div>
            )}
          </div>
        )}
      </Panel>
    </>
  );
}

function StatCard({ theme, S, label, value, sub, icon, tone = 'neutral' }) {
  const T = theme;
  const accent = tone === 'positive' ? T.positive : tone === 'warn' ? T.caution : T.accent;
  const accentSoft = tone === 'positive' ? 'rgba(46,125,94,0.10)'
    : tone === 'warn' ? 'rgba(180,134,31,0.14)'
    : T.accentSoft;
  return (
    <Panel theme={T} density="comfortable" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: accentSoft, color: accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><HRIcon name={icon} size={18}/></div>
        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
          {label}
        </div>
      </div>
      <div style={{ fontSize: 26, color: T.text, fontWeight: 600, lineHeight: 1, letterSpacing: -0.5 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8 }}>{sub}</div>
      )}
    </Panel>
  );
}

function QuickAction({ theme, icon, title, sub, onClick }) {
  const T = theme;
  return (
    <button onClick={onClick} style={{
      textAlign: 'start', cursor: onClick ? 'pointer' : 'default',
      background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14,
      padding: 18, color: T.text, fontFamily: 'inherit',
      transition: 'border-color .15s, transform .15s',
    }}
    onMouseEnter={(e) => { if (onClick) e.currentTarget.style.borderColor = T.borderStrong; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: T.accentSoft, color: T.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 12,
      }}><HRIcon name={icon} size={20}/></div>
      <div style={{ fontSize: 14, color: T.text, fontWeight: 600, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.4 }}>{sub}</div>
    </button>
  );
}

function ActivityRow({ theme, lang, reward, divider, onFulfilled }) {
  const T = theme;
  const tk = tierToken(reward.tier);
  const tierLabel = tk.label[lang === 'ar' ? 'ar' : 'en'];
  const profile = reward.profile;
  const initials = profile?.initials || '·';
  const name = profile?.display_name || (lang === 'ar' ? 'موظف' : 'Employee');
  const itemName = reward.chosen_item?.name_en || (lang === 'ar' ? 'لم يتم الاختيار' : 'Not yet chosen');
  const statusLabel = reward.status === 'ready' ? (lang === 'ar' ? 'جاهزة' : 'Ready')
    : reward.status === 'claimed' ? (lang === 'ar' ? 'قيد التنفيذ' : 'Pending')
    : (lang === 'ar' ? 'تم التسليم' : 'Delivered');
  const when = formatRelative(reward.awarded_at, lang);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const isClaimed = reward.status === 'claimed';

  const handleFulfill = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      await markRewardFulfilled(reward.id, 'manual', { source: 'overview_quick_action' });
      onFulfilled?.();
    } catch (e) {
      setErr(e?.message || 'failed');
      setBusy(false);
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
      borderBottom: divider ? `1px solid ${T.divider}` : 'none',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 999, flexShrink: 0,
        background: T.accentSoft, color: T.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700,
      }}>{initials}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: T.text, fontWeight: 500, lineHeight: 1.3 }}>
          {name} · {itemName}
        </div>
        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
          {when}{err ? ` · ${err}` : ''}
        </div>
      </div>
      <span style={{
        padding: '2px 8px', borderRadius: 999,
        background: tk.accentSoft, color: tk.accent,
        fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
      }}>{tierLabel}</span>
      {isClaimed ? (
        <HRButton theme={T} variant="primary" disabled={busy} onClick={handleFulfill}>
          {busy
            ? (lang === 'ar' ? '…' : '…')
            : (lang === 'ar' ? 'تأكيد التسليم' : 'Mark fulfilled')}
        </HRButton>
      ) : (
        <span style={{ fontSize: 11, color: T.textMuted, minWidth: 70, textAlign: 'end' }}>
          {statusLabel}
        </span>
      )}
    </div>
  );
}

function ErrorStrip({ theme, lang }) {
  const T = theme;
  const text = lang === 'ar'
    ? 'تعذّر تحميل بعض البيانات. تحقق من إعدادات السحابة.'
    : 'Some data could not load. Check cloud configuration.';
  return (
    <div style={{
      padding: '12px 16px', marginBottom: 16, borderRadius: 10,
      background: 'rgba(162,67,43,0.10)', color: T.danger,
      fontSize: 12, fontWeight: 500,
    }}>{text}</div>
  );
}

function formatMinor(minor, currency = 'EGP', lang = 'en') {
  const n = Math.round((minor || 0) / 100);
  const formatted = n.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US');
  return `${formatted} ${currency}`;
}

function budgetUsageLabel(stats, lang) {
  if (!stats.totalBudget) return lang === 'ar' ? 'لم تُخصَّص ميزانية بعد' : 'No budget allocated yet';
  const pct = Math.round((stats.totalSpent / stats.totalBudget) * 100);
  return lang === 'ar' ? `${pct}٪ مستخدم` : `${pct}% used`;
}

function formatRelative(iso, lang = 'en') {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.max(0, Math.floor((now - then) / 1000));
  if (sec < 60) return lang === 'ar' ? 'الآن' : 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return lang === 'ar' ? `منذ ${min} د` : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return lang === 'ar' ? `منذ ${hr} س` : `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return lang === 'ar' ? `منذ ${day} ي` : `${day}d ago`;
  return new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US');
}

export { HRGiftsOverview };
