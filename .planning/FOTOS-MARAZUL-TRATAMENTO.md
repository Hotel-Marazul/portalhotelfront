# Tratamento das fotos do Hotel Marazul

Data: 2026-09-13.

## Entrega

Sete versões tratadas com a ferramenta integrada de edição de imagens (ImageGen), salvas em `frontend/public/hotel/tratadas/`, PNG RGB 1448 × 1086. Os sete originais locais permanecem intactos. As referências da landing continuam apontando para os originais; estas versões estão disponíveis para revisão.

| Original em `frontend/public/hotel/` | Versão em `tratadas/` |
| --- | --- |
| piscina.jpeg | piscina-v2.png |
| chegada.jpeg | chegada-sem-placa-v2.png |
| lobby.jpeg | lobby.png |
| apartamento-super-luxo.jpg | apartamento-super-luxo.png |
| apartamento-luxo.jpg | apartamento-luxo.png |
| apartamento-standard.jpg | apartamento-standard.png |
| apartamento-simples.jpg | apartamento-simples.png |

## Direção e revisão

O usuário rejeitou a primeira piscina porque foram retiradas cadeiras e guarda-sóis. Ela não faz parte desta entrega. A segunda versão foi refeita a partir do original com instrução explícita de preservar cadeiras, mesas, espreguiçadeiras e guarda-sóis. A fachada teve remoção localizada da placa do restaurante no extremo direito, solicitada posteriormente pelo usuário. A identificação principal Hotel Marazul e o número 250 continuam visíveis.

As imagens foram inspecionadas visualmente na saída de cada edição. Os quartos e a sala receberam tratamento de exposição/cor e redução de ruído; seus móveis principais permanecem presentes. A edição generativa pode reconstruir detalhes de textura, perspectiva, reflexos e objetos pequenos, mesmo com instruções conservadoras; não equivale a uma correção fotográfica pixel a pixel. Os originais são a referência para conferir fidelidade.

Escopo concluído: as sete fotos já presentes no projeto, não a galeria completa do site externo. Nenhuma alteração em código, dados, deploy ou arquivos originais foi feita nesta etapa.

## Prompts enviados

### piscina-tratada-v2

```text
Edit the supplied ORIGINAL Hotel Marazul pool photograph with extremely conservative photographic retouching. This original is the sole edit target. Keep the EXACT composition, perspective, pool geometry, architecture, tile patterns, equipment, plants, and ALL furniture. MOST IMPORTANT: preserve EVERY white chair, table, lounger and parasol/umbrella in its original position, including partially cropped ones at both edges, balcony furniture, and the parasols across the top corners. Do not remove, rearrange or replace a single piece of furniture or umbrella. Apply only subtle exposure and white-balance correction, gentle shadow recovery, noise/compression reduction and natural sharpness. Small cleanup allowed ONLY: remove the loose red foam pool noodles and the visible distant people, reconstructing only their small covered areas. Preserve cables, decorations and all other objects. Retain natural water reflections and sunlight. No architectural changes, new details, staging, homogenized surfaces, HDR or artificial luxury. The result should look like the SAME photograph carefully retouched, not a newly generated hotel. Original 4:3 framing.
```

### chegada-tratada

```text
Use case: precise-object-edit. Retouch the provided original Hotel Marazul entrance photograph very conservatively for a hotel website. Preserve the exact same framing, facade, architecture, doors, windows, balcony railings, air conditioner, EVERY table and chair, plants, trash bin, decorative lights, restaurant sign, address number 250, and the Hotel Marazul / HM / HOTEL signage with exact lettering. Do not remove furniture, umbrellas, signs or decorations and do not remodel or rearrange the scene. Only remove the walking person in the central doorway and the photographer/person and car reflected in the left glass, reconstruct those small areas with plausible glass reflections of the EXISTING surroundings. Improve exposure slightly in the shadows, neutral white balance, natural sharpness and compression noise; keep the original facade colors and daylight. Preserve all architectural details and original 4:3 perspective. No additions or new text, no luxury makeover, no oversaturation, no HDR. Keep the hotel identity and photographic realism.
```

### lobby-tratado

```text
Use case: lighting-weather (conservative photographic tonal correction). Input image is the sole edit target: original Hotel Marazul lobby photograph. Retouch this SAME photograph with subtle natural exposure improvement, white balance correction to retain warm beige walls, gently lifted dark furniture detail, mild compression/noise reduction and realistic sharpness. This room has no clutter to remove: retain EVERY object, four-seat patterned wood sofa, both patterned armchairs, glass coffee table, all books AND white remote on table, both tall potted palms, white mini-fridge, wall artwork with exact composition, curtains, edge glass tables, all ceiling and floor details. Preserve exact positions, count, dimensions, materials, upholstery pattern, artwork, crop and perspective. Do not simplify, remove furniture/decor, add objects, remodel, create luxury furnishings, or invent surface detail. Preserve natural shadows and existing side daylight. Keep original 4:3 framing, photographic realism, no HDR or artificial staging.
```

### chegada-tratada-v2-sem-placa

```text
Precise localized object removal. The supplied facade photo is the edit target. Remove ONLY the small partially cropped blue/white/green restaurant advertising sign on the extreme RIGHT edge, in the upper right quadrant above the canopy (roughly x=94.5%-100%, y=23%-36%). Fill its small footprint by continuing the existing facade wall/column/background architecture with matching perspective and texture. Leave EVERY OTHER part of the photograph unchanged. Especially preserve the large central peach sign with 'Hotel Marazul' and 'HM', vertical HOTEL letters, house number 250, ALL tables/chairs, balcony railings/furniture, air conditioner, festive hanging lights, glass reflections, doors/windows, exposure/colors, camera position and entire crop. No other cleanup, no new image composition, no sign substitutions. Same 4:3 aspect ratio. Just erase the restaurant sign at the far right.
```

### apartamento-super-luxo-tratado

```text
Conservative photographic retouch of the supplied original Hotel Marazul Super Luxo bedroom photo. Edit target Image 1. Improve only brightness in dark areas, neutral white balance, mild noise/compression reduction and gentle natural detail. Reduce harsh highlight glare without changing the real exterior street view. Keep the exact original camera angle and crop, room size, walls, ceiling light, doors and dark frames, tall wood wardrobe, little television, white desk/shelves, split AC, curtains, king bed and pillows/blanket, side tables and small remote, and the bed and fan visible in the adjacent room. Keep ALL furnishings and objects in EXACT original positions, counts and proportions. Preserve wood grain, fabric texture and natural bedding creases. No objects are clutter to remove in this image. Do not add, remove, replace, stage, remodel or enlarge anything. Do not replace the exterior with sea/nature. No HDR, synthetic finish or luxury redesign. Same honest real hotel photograph, only gently better photographic exposure and color. 4:3.
```

### apartamento-luxo-tratado

```text
Conservative retouch ONLY of the supplied original Hotel Marazul Luxo bedroom photo. Improve exposure gently, lift shadows and correct excessive yellow cast while retaining the actual warm beige wall color. Reduce compression noise and gently improve photographic sharpness. Preserve exact original viewpoint and 4:3 crop, room dimensions, bed with ONE pillow, original white linen creases, headboard with its two separated horizontal dark wood pieces, small attached bedside surfaces, wall television and all its cables, wall painting at left edge, brown door/window, curtain and rod, AC, ceiling bare light bulb, tiled floor, trim and right-edge door frame. Retain ALL objects and furniture, exact positions and counts, all materials and real window exterior. Do not remove the bulb/cables or improve physical fixtures. No renovation, staging, extra pillows, added lighting, changed decorations, widened room, replacement furniture, HDR or synthetic finish. Only tone/color and noise correction of the same real hotel photograph.
```

### apartamento-standard-tratado

```text
Conservative photographic retouch of the supplied original Hotel Marazul Standard bedroom. Only balance exposure, gently recover shadow detail and reduce glare, neutral white balance, reduce noise/compression and subtly improve sharpness. Lock exact original 4:3 framing and camera position. Preserve ALL original objects and furnishings: double bed with two pillows, single bed with one pillow and folded gray towel, white sheets and bed skirts with actual creases, continuous light wood headboard and small bedside shelf, wood dresser at left with black remote, TV at left edge and its cables, split AC, bare ceiling bulb, beige curtains and rod, wood balcony door with its shutters/cross-bracing and exact real exterior, tiled floor, electrical items and surface texture. No object removal, new objects, new pillows, furniture replacement, repainting, alterations to room dimensions or window view. Keep realistic softness and daylight shadows. This is the same factual hotel photograph, just gently improved photographic quality; no HDR or rendering.
```

### apartamento-simples-tratado

```text
Conservative retouch of the supplied original Hotel Marazul Simples bedroom photograph. This image is the edit target. Lift dark shadows slightly, improve neutral white balance while preserving beige walls, soften excessive window highlight glare only through exposure, reduce compression artifacts and improve natural sharpness. Preserve the EXACT original 4:3 viewpoint, room geometry and framing, dark wood double bed with two pillows and gray blanket, complete dark wood two-tier bunk bed at left with its original bedding/pillows/folded towels on both levels, both pale bedside tables, center small fridge, ceiling fan/light with exact blades, wall-mounted window AC, switches, tile floor grid, dark balcony door and open shutter and existing exterior. Keep ALL furniture, fixtures and objects exactly positioned and with same count, size and material; preserve natural linen creases. No decluttering needed here: do not remove objects. No new beds or pillows, no remodeling, repainting, redecoration, wider room, added light fixtures or changed exterior. Faithful realistic original hotel photo with subtle tonal polish only; no HDR or synthetic look.
```

