import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LoginModal, { isValidPasscode } from './LoginModal';

describe('inventory passcode', () => {
  it('accepts 3105', () => {
    expect(isValidPasscode('3105')).toBe(true);
    expect(isValidPasscode(' 3105 ')).toBe(true);
  });

  it('rejects anything else', () => {
    for (const v of ['', '310', '31050', '1234', 'care@ramya', null, undefined]) {
      expect(isValidPasscode(v)).toBe(false);
    }
  });

  it('renders a single passcode field when open', () => {
    const html = renderToStaticMarkup(<LoginModal open onClose={() => {}} onAuthenticated={() => {}} />);
    expect(html).toContain('Enter Passcode');
    expect(html).toContain('aria-label="Passcode"');
    expect(html).not.toContain('Username');
  });

  it('renders nothing when closed', () => {
    expect(renderToStaticMarkup(<LoginModal open={false} />)).toBe('');
  });
});
