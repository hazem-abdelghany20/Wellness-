import { describe, it, expect } from 'vitest';
import {
  parseYouTubeUrl, youtubeEmbedUrl, isYouTubeId, mediaFromPayload, habitCategory, HABIT_CATEGORIES,
} from '../habit-meta.js';

const ID = 'dQw4w9WgXcQ';

describe('parseYouTubeUrl', () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}`,
    `http://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `youtube.com/watch?v=${ID}`,
    `youtu.be/${ID}`,
    `  https://youtu.be/${ID}  `,
  ])('accepts %s', (url) => {
    expect(parseYouTubeUrl(url)).toEqual({ ok: true, id: ID });
  });

  it('accepts Shorts links', () => {
    expect(parseYouTubeUrl(`https://www.youtube.com/shorts/${ID}`)).toEqual({ ok: true, id: ID });
    expect(parseYouTubeUrl(`https://youtube.com/shorts/${ID}?feature=share`)).toEqual({ ok: true, id: ID });
  });

  it('ignores extra params and fragments', () => {
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=${ID}&t=42s&list=PL123`)).toEqual({ ok: true, id: ID });
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?feature=share&v=${ID}`)).toEqual({ ok: true, id: ID });
    expect(parseYouTubeUrl(`https://youtu.be/${ID}?si=AbCdEf123&t=10`)).toEqual({ ok: true, id: ID });
    expect(parseYouTubeUrl(`https://www.youtube.com/embed/${ID}?start=30#x`)).toEqual({ ok: true, id: ID });
  });

  it.each([
    `https://vimeo.com/123456789`,
    `https://youtube.com.evil.com/watch?v=${ID}`,
    `https://notyoutube.com/watch?v=${ID}`,
    `https://evil.com/youtube.com/watch?v=${ID}`,
    `https://youtu.be.evil.com/${ID}`,
    `https://drive.google.com/file/d/${ID}/view`,
  ])('rejects other hosts: %s', (url) => {
    expect(parseYouTubeUrl(url)).toEqual({ ok: false, reason: 'host' });
  });

  it.each([
    'https://www.youtube.com/watch',
    'https://www.youtube.com/watch?list=PL123',
    'https://youtu.be/',
    'https://www.youtube.com/shorts/',
    'https://www.youtube.com/embed/',
    'https://www.youtube.com/@wellness',
    'https://www.youtube.com/channel/UC1234567890',
    `https://www.youtube.com/playlist?list=PL123`,
  ])('rejects links with no video id: %s', (url) => {
    expect(parseYouTubeUrl(url)).toEqual({ ok: false, reason: 'missing_id' });
  });

  it('rejects malformed ids', () => {
    expect(parseYouTubeUrl('https://youtu.be/short')).toEqual({ ok: false, reason: 'bad_id' });
    expect(parseYouTubeUrl(`https://youtu.be/${ID}x`)).toEqual({ ok: false, reason: 'bad_id' });
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=abc<script>1')).toEqual({ ok: false, reason: 'bad_id' });
  });

  it('rejects empty and non-web input', () => {
    expect(parseYouTubeUrl('')).toEqual({ ok: false, reason: 'empty' });
    expect(parseYouTubeUrl(null)).toEqual({ ok: false, reason: 'empty' });
    expect(parseYouTubeUrl('javascript:alert(1)').ok).toBe(false);
    expect(parseYouTubeUrl(`ftp://youtube.com/watch?v=${ID}`)).toEqual({ ok: false, reason: 'invalid' });
    expect(parseYouTubeUrl('not a url at all').ok).toBe(false);
  });
});

describe('youtubeEmbedUrl / isYouTubeId', () => {
  it('builds the privacy-enhanced embed url', () => {
    expect(youtubeEmbedUrl(ID)).toBe(`https://www.youtube-nocookie.com/embed/${ID}?rel=0&playsinline=1`);
  });
  it('refuses anything that is not an id', () => {
    expect(isYouTubeId('"><script>')).toBe(false);
    expect(youtubeEmbedUrl('../../evil')).toBeNull();
  });
});

describe('mediaFromPayload', () => {
  it('reads uploaded video and image media', () => {
    expect(mediaFromPayload({ media_type: 'video', media_url: 'https://cdn/x.mp4', media_path: 'challenges/x.mp4', media_mime: 'video/mp4' }))
      .toEqual({ type: 'video', url: 'https://cdn/x.mp4', path: 'challenges/x.mp4', mime: 'video/mp4' });
    expect(mediaFromPayload({ media_url: 'https://cdn/x.jpg' }).type).toBe('image');
  });
  it('reads a YouTube id', () => {
    expect(mediaFromPayload({ media_type: 'youtube', media_youtube_id: ID })).toEqual({ type: 'youtube', youtube_id: ID });
  });
  it('returns null without usable media', () => {
    expect(mediaFromPayload({})).toBeNull();
    expect(mediaFromPayload(null)).toBeNull();
    expect(mediaFromPayload({ media_type: 'youtube', media_youtube_id: 'nope' })).toBeNull();
    expect(mediaFromPayload({ media_type: 'video', media_url: 'javascript:alert(1)' })).toBeNull();
  });
});

describe('habitCategory', () => {
  it('knows the five categories with EN and AR labels', () => {
    expect(HABIT_CATEGORIES.map((c) => c.id)).toEqual(['movement', 'sleep', 'mood', 'hydration', 'stress']);
    for (const c of HABIT_CATEGORIES) { expect(c.en).toBeTruthy(); expect(c.ar).toBeTruthy(); }
    expect(habitCategory('sleep').en).toBe('Sleep');
    expect(habitCategory('nope')).toBeNull();
  });
});
