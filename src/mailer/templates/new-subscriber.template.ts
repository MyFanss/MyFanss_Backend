import { escapeHtml } from '../mailer.util';
import { EmailContent } from './email-content.type';

export interface NewSubscriberTemplateParams {
  creatorName: string;
  subscriberName: string;
}

export function buildNewSubscriberEmail(
  params: NewSubscriberTemplateParams,
): EmailContent {
  const safeCreatorName = escapeHtml(params.creatorName);
  const safeSubscriberName = escapeHtml(params.subscriberName);
  const subject = 'You have a new subscriber';

  const html = `<!doctype html>
<html>
  <body style="font-family: sans-serif; line-height: 1.5;">
    <p>Hi ${safeCreatorName},</p>
    <p><strong>${safeSubscriberName}</strong> just subscribed to your page.</p>
    <p>Keep posting to keep your subscribers engaged!</p>
  </body>
</html>`;

  const text = `Hi ${params.creatorName},

${params.subscriberName} just subscribed to your page.

Keep posting to keep your subscribers engaged!`;

  return { subject, html, text };
}
