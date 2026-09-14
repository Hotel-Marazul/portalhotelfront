# Fotos adicionais — Hotel Marazul

## Revisão posterior: remoção da marca d’água

A pedido explícito do usuário, a ferramenta integrada ImageGen removeu o texto e sublinhado no canto inferior direito das duas imagens do restaurante. Resultados inspecionados visualmente e salvos em `frontend/public/hotel/tratadas/restaurante-sem-marca.png` e `frontend/public/hotel/tratadas/cafe-da-manha-sem-marca.png`, ambos PNG 1536 × 1024. As versões anteriores permanecem disponíveis. Estas são as versões mais recentes para seleção. Nenhuma referência do site foi substituída.

### restaurante-sem-marca

```text
Precise localized image edit. Remove ONLY the white watermark text 'fotos por ClicLitoralSUL.com.br' AND its horizontal white underline and shadow at the bottom-right of this supplied restaurant photograph. Seamlessly reconstruct the small area beneath the lettering using the existing floor tiles, cabinet surface and cropped wooden chair. Preserve every other pixel/region as faithfully as possible: all tables, chairs, floral tablecloths, food, buffet, lighting, ceiling, background, colors, textures, camera angle and crop. No other edits, no new objects, no reframing. Same 3:2 photograph. Output without this watermark.
```

### cafe-da-manha-sem-marca

```text
Precise localized edit of supplied breakfast buffet photo. Remove ONLY the white bottom-right watermark 'fotos por ClicLitoralSUL.com.br' together with its underline/drop shadow. Reconstruct its narrow covered region using existing stone counter, metal surface and white cups, preserving all those objects. Everything outside this little watermark region must remain as unchanged as possible: all food and drink, bowls, cups and glasses, jugs, utensils, furniture, floral cloths, appliances, cables, stone texture, lighting, colors, camera angle and full 3:2 crop. Do not remove any cups or food to erase the lettering. No further enhancement, staging, reframing or other changes. Same photograph without the watermark.
```


Tratamento de 2026-09-13 realizado com a ferramenta integrada ImageGen. Três entradas fornecidas pelo usuário no chat; originais copiados para `frontend/public/hotel/originais-adicionais/` com os mesmos nomes das versões tratadas abaixo.

| Versão em `frontend/public/hotel/tratadas/` | Dimensões |
| --- | --- |
| restaurante.png | 1536 × 1024 |
| cafe-da-manha.png | 1536 × 1024 |
| sala-de-jogos.png | 1448 × 1086 |

Inspeção visual: móveis, mesas, alimentos e equipamentos principais permanecem representados. Créditos ClicLitoralSUL preservados nas duas fotos do restaurante. Exposição, cores e definição foram melhoradas. Os originais de baixa resolução limitam a fidelidade; detalhes pequenos, texturas e perspectiva podem ser reconstruídos pela edição generativa. Não tratar a ampliação como recuperação comprovada de detalhes reais. As versões foram salvas para revisão; referências da landing não foram alteradas.

## Prompts enviados

### restaurante

```text
Conservative photographic restoration of this EXACT supplied Hotel Marazul breakfast dining room photo, sole edit target. Improve exposure in shadows, gentle neutral white balance, reduce compression/noise and slightly improve sharpness. Tone down harsh glare halos around ceiling lamps while keeping every actual lamp and natural lighting. Preserve original 3:2 frame and viewpoint, ALL wooden chairs/tables including cropped ones, floral tablecloths with their existing prints/colors, breakfast buffet cabinet, stone counters, every food platter, cup, juice jug, glass and utensil, cereal dispenser, column, bar, white cabinet, wall decorations, crucifix, clock, doors, ceiling panels and gray patterned floor. No furniture removal or rearrangement, no simplified buffet, no added food or amenities, no renovations, no repainting or changes to room dimensions. Preserve the existing small white bottom-right photo credit verbatim: 'fotos por ClicLitoralSUL.com.br', in its original position and style, do not remove or obscure it. Realistic texture, moderate natural tones, no HDR, no synthetic luxury aesthetic. The same real hotel photo with careful restrained quality improvement.
```

### cafe-da-manha

```text
Conservative photographic restoration of this EXACT original Hotel Marazul breakfast buffet photo, image is sole edit target. Improve only exposure, gentle white balance, reduce compression artifacts/noise and natural sharpness; preserve realistic food textures and restrained true colors. Keep EXACT original 3:2 viewpoint/framing, stone counter and recessed metal tray, bowls of preserves/yogurt/fruit, every juice/water/coffee/pink-drink jug, all cups, inverted glasses, plates, breads/cakes/fruit already present, sandwich grill and its cable, sockets, wood cabinet, upper shelf with cereal dispenser and three plant decorations, background chairs/tables with floral cloths, door and bar, gray patterned tile floor. All furniture, food, crockery and appliances are intentional and must remain in original positions and quantities. Do NOT add foods, remove objects, simplify, upgrade appliances, rearrange furniture, remodel or change perspective. Preserve existing bottom-right photographer credit verbatim 'fotos por ClicLitoralSUL.com.br' in its existing location and style, do not obscure or remove. Keep the same scene with better photographic clarity, not a new buffet setup. No HDR or synthetic render.
```

### sala-de-jogos

```text
Conservative photo restoration of the provided real Hotel Marazul games room. Sole edit target is this exact low-resolution original. Gently lift underexposed shadows, neutralize the dull green/yellow cast while retaining warm cream walls, reduce compression noise, improve moderate realistic sharpness and soften blown sunlight highlights without inventing hidden detail. Lock exact original 4:3 camera angle, framing and perspective. Preserve BOTH brown wood green-felt billiard tables: center table and large foreground table cut off at right/bottom, same rail details, legs and hanging white net pockets. Preserve blue table-tennis table with net behind them, dark wooden foosball table at far left rear, exact floor tile grid, walls, doorway, ceiling beams/paneling/lights, vertical wall conduits and framed blue-bordered sign on right wall. Keep all equipment counts, original positions, room dimensions and surface appearance. Do not remove, add, replace, relocate or remodel anything. No balls, cues, chairs, people, new signs, decorations, fancy fixtures or luxury makeover. Retain natural sun stripe directions and floor shadows. No HDR, rendering, cartoon outlines or invented text. Produce the same factual photo with restrained photographic quality improvement.
```
