import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { HabitMedia } from '../habit-media.jsx';
import { THEMES } from '../../design-system.jsx';

const T = THEMES.brand;

describe('HabitMedia (employee Challenge tab)', () => {
  it('renders nothing without media', () => {
    const { container } = render(<HabitMedia theme={T} lang="en" payload={{ action_en: 'x' }}/>);
    expect(container).toBeEmptyDOMElement();
  });

  it('plays an uploaded video inline with controls and no autoplay', () => {
    const { container } = render(<HabitMedia theme={T} lang="en" title="Desk Stretch"
      payload={{ media_type: 'video', media_url: 'https://cdn/x.mp4' }}/>);
    expect(screen.getByText('Watch how')).toBeInTheDocument();
    const video = container.querySelector('video');
    expect(video).toHaveAttribute('src', 'https://cdn/x.mp4');
    expect(video).toHaveAttribute('controls');
    expect(video).toHaveAttribute('playsinline');
    expect(video).not.toHaveAttribute('autoplay');
  });

  it('shows an image', () => {
    render(<HabitMedia theme={T} lang="ar" title="تمدد" payload={{ media_type: 'image', media_url: 'https://cdn/x.png' }}/>);
    expect(screen.getByText('شوف إزاي')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn/x.png');
  });

  it('embeds YouTube through youtube-nocookie, lazy and without autoplay', () => {
    const { container } = render(<HabitMedia theme={T} lang="en" title="Breathing"
      payload={{ media_type: 'youtube', media_youtube_id: 'dQw4w9WgXcQ' }}/>);
    const frame = container.querySelector('iframe');
    expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1');
    expect(frame).toHaveAttribute('loading', 'lazy');
    expect(frame).toHaveAttribute('title', 'How to do it: Breathing');
    expect(frame).toHaveAttribute('allow', 'encrypted-media; picture-in-picture; fullscreen');
    expect(frame.getAttribute('src')).not.toMatch(/autoplay/);
  });

  it('ignores a bad YouTube id', () => {
    const { container } = render(<HabitMedia theme={T} lang="en" payload={{ media_type: 'youtube', media_youtube_id: '"><x' }}/>);
    expect(container).toBeEmptyDOMElement();
  });
});
