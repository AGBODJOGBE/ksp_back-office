import { act, renderHook } from '@testing-library/react';
import { identityTexts } from '@/features/identity/texts';
import { secondsLeft, useCountdown } from './countdown';

describe('compte à rebours', () => {
  afterEach(() => vi.useRealTimers());

  it('compte les secondes restantes, arrondies au-dessus, jamais négatives', () => {
    expect(secondsLeft(10_000, 0)).toBe(10);
    expect(secondsLeft(10_000, 9_001)).toBe(1);
    expect(secondsLeft(10_000, 12_000)).toBe(0);
  });

  it('décompte jusqu’à zéro puis s’arrête', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCountdown());

    act(() => result.current.start(3));
    expect(result.current.remaining).toBe(3);
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current.remaining).toBe(2);
    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current.remaining).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('s’annule avec un délai nul', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCountdown());
    act(() => result.current.start(30));
    act(() => result.current.start(0));
    expect(result.current.remaining).toBe(0);
  });

  it('formate le délai en français', () => {
    const { delay } = identityTexts.login;
    expect(delay(45)).toBe('45 s');
    expect(delay(60)).toBe('1 min');
    expect(delay(125)).toBe('2 min 05 s');
  });
});
