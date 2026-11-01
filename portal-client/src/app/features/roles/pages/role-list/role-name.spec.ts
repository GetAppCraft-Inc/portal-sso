import { normalizeRoleName } from './role-list';

describe('normalizeRoleName', () => {
  it('adds the prefix and upper-cases what people naturally type', () => {
    expect(normalizeRoleName('support')).toBe('ROLE_SUPPORT');
    expect(normalizeRoleName('  Support Team ')).toBe('ROLE_SUPPORT_TEAM');
    expect(normalizeRoleName('on-call')).toBe('ROLE_ON_CALL');
  });

  it('leaves an already-correct name alone', () => {
    expect(normalizeRoleName('ROLE_SUPPORT')).toBe('ROLE_SUPPORT');
    expect(normalizeRoleName('role_finance')).toBe('ROLE_FINANCE');
  });
});
