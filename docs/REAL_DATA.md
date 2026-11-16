# Data boundaries

FLARE combines a repeatable flood-response scenario with a live regional weather feed. The two are labelled throughout the interface.

## Live and external data

| Information               | Source                                                                                            | How it is used                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Regional weather warnings | MET Malaysia through [data.gov.my](https://developer.data.gov.my/realtime-api/weather), CC BY 4.0 | Shown under **Official weather warnings**, with source and issue time.                                              |
| Streets and buildings     | OpenStreetMap contributors, served by OpenFreeMap                                                 | The 3D basemap, with attribution supplied by the style.                                                             |
| Walking geometry          | OpenStreetMap road network through the OSRM walking service                                       | Prepared once and stored with the fixture.                                                                          |
| Emergency contacts        | Malaysian government, Civil Defence and NADMA publications                                        | **999** for integrated emergency response; `03-8064 2400` for the NADMA/NDCC line. See [references](REFERENCES.md). |

MET warnings describe regional weather. They do not establish a flooded street, measured water depth or evacuation instruction at a specific point.

## Scenario data

Every flood footprint, depth, damage level, closure, roadblock, response post, aid delivery, shelter status, request and government-style announcement is simulated. Contours are illustrative and are not a hydrological model.

The map uses real geography as context. Scenario place labels and operational posts are not a verified directory of shelters, clinics, police stations or fire stations. A listing does not confirm opening, staffing or safe access. Marker popups and scenario news say **Simulation** or **Simulated**.

Agency names describe roles in an exercise. Statements attributed to the Prime Minister's Office, NADMA, PDRM, BOMBA, JKM or a ministry are fictional bulletins, not live reports or endorsements. They never enter the official weather section.

## Routes and closures

Routes follow the walking road network but do not avoid illustrated flood polygons or closure lines. Distances and times are network estimates; some detours are long. A drawn route is not proof that it is passable or suitable during a flood. Closure lines illustrate affected segments and are not verified street surveys.

Each relief or medical point lies outside every drawn flood zone. That is a fixture invariant checked by tests, not a real-world safety certification.

## Failure handling and privacy

- Weather requests time out after four seconds. Good responses are cached for two minutes; failures for 30 seconds. Still-valid items remain available, but expired warnings are removed on every read.
- Weather retrieval never blocks the guide or request workflow. An empty official section can mean no warnings or an unavailable feed; the interface explains both possibilities.
- If basemap retrieval fails, the map uses a blank style and still draws scenario overlays. A browser that cannot start the map shows a fallback message.
- Optional GPS only selects the nearest scenario place inside the browser. Raw GPS does not reach the server.
- The citizen profile is a fictional person, and its ID number and phone numbers are not real. Edits stay in the browser; the profile is sent only with a request, and only when sharing is left on.
- Request coordinates are scenario locations, rounded by the API. There are no accounts; use fictional request details when exploring the prototype.

Sources and terms: [REFERENCES.md](REFERENCES.md), [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
