// Feature notes belong to the desktop viewer, outside the citizen's phone screen.
import { useEffect } from 'react';

export type PhoneFeature = 'guide' | 'map' | 'news' | 'help' | 'profile' | 'requests' | 'dispatch';
export const PHONE_FEATURE_EVENT = 'flare:phone-feature';

export const PHONE_NOTES: Record<PhoneFeature, { title: string; body: string; tips: string[] }> = {
  guide: {
    title: 'Know what to do first',
    body: 'The guide changes with the citizen’s location and the worst flood zone around them.',
    tips: [
      'Move between places above to compare danger levels.',
      'Find immediate steps, emergency contacts and nearby relief points.',
      'Move outside the zones to see the preparedness view.',
    ],
  },
  map: {
    title: 'Read the situation around you',
    body: 'Water height and colour show the illustrated severity. Labels identify relief points, medical care and response services.',
    tips: [
      'Tap a service or roadblock for details.',
      'Use Map layers to show services and closures.',
      'Hide info clears the legend and route card off the map.',
      'Routes follow streets; they are not checked for flood safety.',
    ],
  },
  news: {
    title: 'Follow the changing situation',
    body: 'Area updates arrive over time: road closures, relief supplies, rescue deployments and recovery checks.',
    tips: [
      'Near me filters to the selected area.',
      'Official shows live MET Malaysia weather warnings.',
      'Ministry and agency scenario announcements are labelled Simulated.',
    ],
  },
  help: {
    title: 'Ask for help and follow its progress',
    body: 'Choose the need and number of people. Extra details are optional, so a request can be sent quickly.',
    tips: [
      'The request appears in the responder console.',
      'Switch to First responder and send a team.',
      'Come back to watch Waiting change to Team on the way, then Resolved.',
    ],
  },
  profile: {
    title: 'Tell responders who you are',
    body: 'The profile holds a name, age, ID number, medical notes and how to recognise the person. It travels with a request for help.',
    tips: [
      'Edit the profile; it is saved on this device.',
      'Send a request, then open it as First responder to see the profile.',
      'Sharing can be turned off on the request form.',
    ],
  },
  requests: {
    title: 'See who needs help',
    body: 'The responder queue groups incoming requests by status, with the waiting requests first.',
    tips: [
      'Filter between waiting, en route and resolved requests.',
      'Select a queue item or map marker to open its details.',
      'New requests arrive without reloading the page.',
    ],
  },
  dispatch: {
    title: 'Coordinate a response',
    body: 'The selected request brings together its location, number of people, need and any extra details.',
    tips: [
      'Choose a team and send it to the citizen.',
      'Resolve the request when the operation is complete.',
      'Citizen status updates arrive through the shared live stream.',
    ],
  },
};

/** Tell the same-origin phone viewer which feature is open; send no personal data. */
export function usePhoneFeature(feature: PhoneFeature) {
  useEffect(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: PHONE_FEATURE_EVENT, feature }, window.location.origin);
    }
  }, [feature]);
}
