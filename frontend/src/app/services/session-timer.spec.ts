import { MatDialog } from '@angular/material/dialog';
import { TestBed } from '@angular/core/testing';
import { NEVER } from 'rxjs';
import { Router } from '@angular/router';
import { Auth } from './auth';
import { SessionTimer } from './session-timer';

describe('SessionTimer', () => {
  const dialogRef = {
    afterClosed: () => NEVER,
    close: vi.fn(),
  };
  const dialog = {
    open: vi.fn(() => dialogRef),
    openDialogs: [],
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-19T12:00:00.000Z'));
    dialog.open.mockClear();
    TestBed.configureTestingModule({
      providers: [
        SessionTimer,
        { provide: MatDialog, useValue: dialog },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: Auth, useValue: { refresh: vi.fn() } },
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(SessionTimer).stopTimer();
    TestBed.resetTestingModule();
    sessionStorage.clear();
    vi.useRealTimers();
  });

  it('shows the warning five minutes before server expiry, regardless of user activity', () => {
    const timer = TestBed.inject(SessionTimer);
    timer.startTimer(Date.now() + 15 * 60 * 1000);

    vi.advanceTimersByTime(9 * 60 * 1000);
    document.dispatchEvent(new Event('click'));
    vi.advanceTimersByTime(60 * 1000);

    expect(dialog.open).toHaveBeenCalledOnce();
  });
});
