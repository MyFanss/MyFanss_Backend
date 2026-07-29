import { buildResetPasswordEmail } from './reset-password.template';
import { buildNewSubscriberEmail } from './new-subscriber.template';

describe('email templates', () => {
  describe('buildResetPasswordEmail', () => {
    it('escapes user-controlled name and url in the html body', () => {
      const { html, text } = buildResetPasswordEmail({
        name: `<img src=x onerror=alert(1)>`,
        resetUrl: 'https://app.test/reset?token=abc"><script>alert(2)</script>',
      });

      expect(html).not.toContain('<img src=x onerror=alert(1)>');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
      expect(html).not.toContain('<script>alert(2)</script>');
      // Plain text is not HTML-rendered, so it stays unescaped/raw.
      expect(text).toContain('<img src=x onerror=alert(1)>');
    });

    it('includes the reset link and subject', () => {
      const { subject, text } = buildResetPasswordEmail({
        name: 'Jane',
        resetUrl: 'https://app.test/reset?token=xyz',
      });
      expect(subject).toBe('Reset your password');
      expect(text).toContain('https://app.test/reset?token=xyz');
    });
  });

  describe('buildNewSubscriberEmail', () => {
    it('escapes user-controlled names in the html body', () => {
      const { html } = buildNewSubscriberEmail({
        creatorName: 'Creator',
        subscriberName: `<script>alert('x')</script>`,
      });

      expect(html).not.toContain(`<script>alert('x')</script>`);
      expect(html).toContain('&lt;script&gt;');
    });

    it('mentions both creator and subscriber in the text body', () => {
      const { text } = buildNewSubscriberEmail({
        creatorName: 'Creator',
        subscriberName: 'Fan One',
      });
      expect(text).toContain('Creator');
      expect(text).toContain('Fan One');
    });
  });
});
