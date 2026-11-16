# Third-party data and software

FLARE's source code is covered by [LICENSE](LICENSE). Map data, weather feeds and third-party components keep their own terms.

| Resource                         | Use in FLARE                                                      | Source and terms                                                                                                                                     |
| -------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenStreetMap contributors       | Streets, buildings and stored walking geometry                    | [Copyright and ODbL](https://www.openstreetmap.org/copyright)                                                                                        |
| OpenFreeMap                      | Hosted vector basemap                                             | [OpenFreeMap](https://openfreemap.org/); the map displays its supplied attribution                                                                   |
| OpenMapTiles                     | Basemap schema and cartography credits                            | [Attribution guidance](https://openmaptiles.org/docs/terminology/attribution/)                                                                       |
| OSRM                             | Walking paths stored in the fixture                               | [OSRM](https://project-osrm.org/), [public routing service](https://routing.openstreetmap.de/); derived road data remains subject to OSM attribution |
| MET Malaysia through data.gov.my | Live official weather warnings                                    | [Weather API](https://developer.data.gov.my/realtime-api/weather), CC BY 4.0                                                                         |
| mapcn                            | Adapted React map component in `client/src/components/ui/map.tsx` | [Source](https://github.com/AnmolSaini16/mapcn), MIT notice below                                                                                    |
| MapLibre GL JS                   | Map renderer                                                      | [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js), BSD-3-Clause                                                                           |
| Lucide                           | Interface icons                                                   | [Lucide](https://lucide.dev/license), ISC                                                                                                            |
| Geist                            | Interface font                                                    | [Geist](https://github.com/vercel/geist-font), SIL Open Font License 1.1                                                                             |

Installed packages include their individual license files. This notice does not replace them or relicense their data.

## mapcn notice

The adapted map component retains the following upstream notice:

```text
MIT License

Copyright (c) 2025 Anmoldeep Singh

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
