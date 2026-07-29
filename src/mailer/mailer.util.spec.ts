import { escapeHtml, maskEmail, redactSensitive } from './mailer.util';

describe('mailer.util', () => {
  describe('maskEmail', () => {
    it('keeps the domain and masks most of the local part', () => {
      expect(maskEmail('jeremiah@example.com')).toBe('je******@example.com');
    });

    it('returns a redacted placeholder for malformed input', () => {
      expect(maskEmail('not-an-email')).toBe('[REDACTED]');
    });
  });

  describe('redactSensitive', () => {
    it('redacts long hex-looking tokens', () => {
      const token = 'a'.repeat(64);
      const input = `Reset link: https://app/reset?token=${token}`;
      expect(redactSensitive(input)).toBe(
        'Reset link: https://app/reset?token=[REDACTED]',
      );
    });

    it('leaves short/non-hex strings untouched', () => {
      expect(redactSensitive('hello world 123')).toBe('hello world 123');
    });
  });

  describe('escapeHtml', () => {
    it('escapes HTML special characters', () => {
      expect(escapeHtml(`<script>alert('x')</script> & "quoted"`)).toBe(
        '&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; &quot;quoted&quot;',
      );
    });
  });
});
