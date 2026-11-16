# Scenario guide

All flood contours, depths, closures, response posts, relief availability and announcements are fictional exercise data. Geography is a visual context, not a prediction of where a real flood will spread.

## Compare all four areas

Choose a place from **Citizen is at** above the phone. Each area includes three danger levels and one outside-zone location.

| Area          | Severe                           | High                               | Moderate                          | Outside the zones               |
| ------------- | -------------------------------- | ---------------------------------- | --------------------------------- | ------------------------------- |
| Sunway–Monash | `L7` Monash University           | `L9` South Quay                    | `L8` Sun-U Residence              | `L10` Sunway Pyramid            |
| Shah Alam     | `L1` Jalan Mewah                 | `L2` Sri Muda residential junction | `L3` Seksyen 25 northern approach | `L11` Relief reception          |
| Subang Jaya   | `L4` USJ 9 junction              | `L12` USJ 9 residential access     | `L5` USJ 9 shop row               | `L13` USJ 7 reception           |
| Klang         | `L6` Bukit Raja western approach | `L14` River crossing approach      | `L15` Northern housing edge       | `L16` Southern relief reception |

Contours are irregular, nested severity outlines. The worst overlapping level wins. All relief and medical listings are outside every marked contour; each selectable place has stored routes to the three listings for its area.

## Read the map

- **Red, orange, amber volumes:** severe, high and moderate flood levels. Heights are exaggerated for legibility, not a physical water simulation.
- **Green shelter and cross pins:** relief and medical listings. Their labels identify the service type; tap for notes.
- **Blue shield:** police response post. **Amber flame:** fire and rescue staging. **Purple parcel:** aid distribution.
- **Red barrier marker:** police roadblock. **Red dashed segment:** closed-road illustration. Tap the marker for its scenario reason.
- **Green path:** stored walking geometry. It does not avoid the flood shapes or closure segments.

Use **Map layers** to toggle operational posts or closures. Controls are omitted from the small guide preview. The full map has a 2D/3D switch, zoom and compass.

Response posts are fictional staging locations, not a verified directory of real stations. Medical listings do not prove that a clinic is staffed or reachable. Some road-network paths involve long detours; request handling is available separately from route selection.

## Update timeline

The fixture contains 27 updates. Eight appear immediately after startup or reset. The rest arrive from 20 seconds through seven minutes. The map's contours and closure state stay fixed so the same locations and routes remain reproducible; bulletins do not silently mutate the map.

| Time after reset | Examples                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Immediately      | Four area situation reports, relief readiness and a fictional Putrajaya coordination bulletin |
| 20–80 seconds    | Sunway relief opening, Sri Muda boats, USJ diversion and Klang supplies                       |
| 95–145 seconds   | Medical triage, drain inspection, crossing restrictions and a fictional aid convoy            |
| 165–230 seconds  | Family enquiries, rescue staging, utility checks and another boat unit                        |
| 255–420 seconds  | Damage surveys, conditions easing, further supplies and recovery assessments                  |

PMO, NADMA, PDRM, BOMBA, JKM and ministry references are labelled **Simulated** and describe an exercise. Only the separate MET Malaysia section contains official live warnings.

## Editing checklist

1. Edit the JSON fixture; keep IDs unique and incident references valid.
2. Keep every ring closed, in `[longitude, latitude]` order, with distinct vertices.
3. Preserve one example for each level and one outside the zones in each area.
4. Keep relief and medical listings outside every contour.
5. Rebuild routes after coordinates move: `node tools/update-routes.mjs --all`.
6. Keep operations and closures tagged `sourceType: "simulation"`; sort update seeds by release time.
7. Run `npm test`, `npm run build` and the browser walkthrough. Format the JSON before committing.
