import { CREATOR_EMAIL } from './storage';
import { SuggestionTicket } from '../types';

export interface SuggestionPayload {
  id?: string;
  ticketId?: string;
  name?: string;
  email?: string;
  category: string;
  message: string;
  createdAt?: string;
  status?: string;
  creatorNotes?: string;
}

// Generate web Gmail compose URL as direct instant dispatch
export function getGmailComposeUrl(to: string, subject: string, bodyText: string): string {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: to,
    su: subject,
    body: bodyText,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

// Generate standard mailto URL
export function getMailtoUrl(to: string, subject: string, bodyText: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
}

// Generate email text content for a suggestion
export function formatSuggestionEmailBody(suggestion: SuggestionPayload): { subject: string; body: string } {
  const ticketRef = suggestion.ticketId ? `[${suggestion.ticketId}] ` : '';
  const senderName = suggestion.name?.trim() || 'Anonymous User';
  const senderEmail = suggestion.email?.trim() || 'Not specified';
  const timestamp = suggestion.createdAt ? new Date(suggestion.createdAt).toLocaleString() : new Date().toLocaleString();

  const subject = `[Change Request] ${ticketRef}[${suggestion.category}] from ${senderName}`;

  const body = [
    `==================================================`,
    `SESSION TIME TRACKER - CHANGE REQUEST TICKET`,
    `==================================================`,
    `Ticket ID   : ${suggestion.ticketId || 'Pending Assignment'}`,
    `Date & Time : ${timestamp}`,
    `Category    : ${suggestion.category}`,
    `Status      : ${suggestion.status || 'New'}`,
    `Submitted By: ${senderName}`,
    `Reply Email : ${senderEmail}`,
    `Destination : ${CREATOR_EMAIL}`,
    `==================================================`,
    ``,
    `CHANGE REQUEST / FEEDBACK DETAILS:`,
    `--------------------------------------------------`,
    suggestion.message.trim(),
    `--------------------------------------------------`,
    ``,
    suggestion.creatorNotes ? `CREATOR NOTES:\n${suggestion.creatorNotes}\n\n` : '',
    `TRIAGE & RESOLUTION CHECKLIST:`,
    `[ ] 1. Review requested workflow or fix`,
    `[ ] 2. Scope impact on punch records / session timers`,
    `[ ] 3. Implement & test in local build`,
    `[ ] 4. Reply to submitter (${senderEmail}) if email provided`,
    `[ ] 5. Mark as resolved in Creator Inbox`,
    ``,
    `Logged in: Session Time Tracker Creator Queue`,
    `Auto-routed to: ${CREATOR_EMAIL}`,
  ].filter(Boolean).join('\n');

  return { subject, body };
}

// Format a single ticket as clean Markdown for issue trackers/changelogs
export function formatTicketAsMarkdown(ticket: SuggestionTicket | SuggestionPayload): string {
  const ticketId = ticket.ticketId || 'CR-NEW';
  const dateStr = ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : new Date().toLocaleDateString();
  return [
    `### [${ticketId}] ${ticket.category}: ${ticket.name || 'User'} (${dateStr})`,
    `- **Submitter**: ${ticket.name || 'Anonymous'} ${ticket.email ? `<${ticket.email}>` : ''}`,
    `- **Status**: \`${ticket.status || 'new'}\``,
    `- **Date**: ${ticket.createdAt || new Date().toISOString()}`,
    `- **Request**:`,
    `  > ${ticket.message.replace(/\n/g, '\n  > ')}`,
    ticket.creatorNotes ? `- **Creator Notes**: ${ticket.creatorNotes}` : '',
  ].filter(Boolean).join('\n');
}

// Direct helper to send/compose email to creator
export function openSuggestionInEmail(suggestion: SuggestionPayload, preferGmailWeb = true): void {
  const { subject, body } = formatSuggestionEmailBody(suggestion);
  if (preferGmailWeb) {
    window.open(getGmailComposeUrl(CREATOR_EMAIL, subject, body), '_blank');
  } else {
    window.location.href = getMailtoUrl(CREATOR_EMAIL, subject, body);
  }
}

