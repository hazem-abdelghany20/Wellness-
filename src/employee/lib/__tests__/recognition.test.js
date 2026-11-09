import { describe, it, expect } from 'vitest';
import { boardView, topTodayLine } from '../recognition.js';
import { makeBoard } from '../../test-fixtures/routine.js';

describe('boardView', () => {
  it('is null when the company has the board off', () => {
    expect(boardView(makeBoard('off'))).toBeNull();
    expect(boardView({ enabled: false, mode: 'off' })).toBeNull();
    expect(boardView(null)).toBeNull();
  });

  it('teams mode never carries names, even if the server sent some', () => {
    const v = boardView(makeBoard('teams'));
    expect(v.mode).toBe('teams');
    expect(v.teams.map((t) => t.name)).toEqual(['Finance', 'Sales']);
    expect(v.named).toBeNull();
    expect(v.inviteOptIn).toBe(false);
    expect(JSON.stringify(v)).not.toMatch(/Amira|Lina/);
  });

  it('named mode keeps opted-in people with effort > 0 and the "and N more" count', () => {
    const board = makeBoard('named');
    board.named.top.push({ user_id: 'u9', display_name: 'Zero Effort', items_done: 0, streak: 0 });
    const v = boardView(board);
    expect(v.named.top.map((p) => p.display_name)).toEqual(['Amira Hassan', 'Lina Adel']);
    expect(v.named.didEverythingCount).toBe(15);
    expect(v.named.longestStreak).toHaveLength(1);
    expect(v.inviteOptIn).toBe(true);
    expect(boardView(makeBoard('named', { me: { opted_in: true, items_done: 1, streak: 1 } })).inviteOptIn).toBe(false);
  });

  it('flags an empty board', () => {
    expect(boardView(makeBoard('teams', { teams: [] })).empty).toBe(true);
    expect(boardView(makeBoard('teams')).empty).toBe(false);
  });
});

describe('topTodayLine', () => {
  it('gives the top team and, in named mode, how many did everything', () => {
    expect(topTodayLine(boardView(makeBoard('teams')))).toEqual({ team: 'Finance', didEverything: 0 });
    expect(topTodayLine(boardView(makeBoard('named')))).toEqual({ team: 'Finance', didEverything: 15 });
  });
  it('is null with nothing to say', () => {
    expect(topTodayLine(null)).toBeNull();
    expect(topTodayLine(boardView(makeBoard('teams', { teams: [] })))).toBeNull();
  });
});
