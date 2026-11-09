import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { THEMES } from '../../design-system.jsx';
import { TabBar } from '../tab-bar.jsx';

const T = THEMES.brand;
const names = () => screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'));

describe('TabBar', () => {
  it('four tabs, exactly as before, without a routine', () => {
    render(<TabBar theme={T} dir="ltr" active="challenges" onTab={() => {}}/>);
    expect(names()).toEqual(['Challenge', 'Library', 'Score', 'Me']);
  });
  it('Today first when a routine is assigned', () => {
    const onTab = vi.fn();
    render(<TabBar theme={T} dir="ltr" active="today" onTab={onTab} hasToday/>);
    expect(names()).toEqual(['Today', 'Challenge', 'Library', 'Score', 'Me']);
    expect(screen.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: 'Challenge' }));
    expect(onTab).toHaveBeenCalledWith('challenges');
  });
  it('Arabic labels', () => {
    render(<TabBar theme={T} dir="rtl" active="today" onTab={() => {}} hasToday/>);
    expect(names()).toEqual(['النهارده', 'التحدي', 'المكتبة', 'نقاطي', 'أنا']);
  });
});
