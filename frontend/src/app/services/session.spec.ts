import { TestBed } from '@angular/core/testing';
import { Session } from './session';
import { CurrentUser } from './current-user';

describe('Session', () => {
  let session: Session;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    session = TestBed.inject(Session);
  });

  it('stores and reads the current user', () => {
    const user: CurrentUser = { _id: 'user-id', perfil: 'usuario' };

    session.setCurrentUser(user);

    expect(session.getCurrentUser()).toEqual(user);
  });

  it('clears malformed session data', () => {
    sessionStorage.setItem('currentUser', '{invalid');

    expect(session.getCurrentUser()).toBeNull();
    expect(sessionStorage.getItem('currentUser')).toBeNull();
  });
});
