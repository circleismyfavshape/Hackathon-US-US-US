import type { Alert, Sos } from '../../shared/api.ts';
import type { Toast } from '../ui.tsx';

function alertTone(alert: Alert): Toast['tone'] {
  if (alert.sourceType === 'official') {
    return 'info';
  }
  switch (alert.kind) {
    case 'shelter':
      return 'good';
    case 'flood':
      return 'danger';
    default:
      return 'info';
  }
}

export function alertToast(alert: Alert, onClick: () => void): Toast {
  const sourceLabel = alert.sourceType === 'official' ? 'Official' : 'Simulated';
  const body = alert.text.length > 110 ? `${alert.text.slice(0, 108).trimEnd()}…` : alert.text;
  return {
    id: alert.id,
    tone: alertTone(alert),
    title: alert.title,
    body,
    meta: `${sourceLabel} · ${alert.source}`,
    onClick,
  };
}

export function requestStatusToast(request: Sos): Toast {
  const identity = { id: `${request.id}:${request.status}`, meta: request.id };
  switch (request.status) {
    case 'assigned':
      return {
        ...identity,
        tone: 'good',
        title: 'Help is on the way',
        body: `${request.assignedTeam ?? 'A team'} has been sent to you.`,
      };
    case 'resolved':
      return {
        ...identity,
        tone: 'good',
        title: 'Request resolved',
        body: 'The team marked your request as resolved.',
      };
    default:
      return {
        ...identity,
        tone: 'info',
        title: 'Request back in the queue',
        body: 'Your request is waiting for a team again.',
      };
  }
}
