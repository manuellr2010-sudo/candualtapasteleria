# Procedencia de los recursos 3D

| Recurso | Archivo en el proyecto | Origen | Autor | Licencia |
|---|---|---|---|---|
| Plato de madera tallada | `public/models/carved_wooden_plate.glb` | [Poly Haven · Carved Wooden Plate](https://polyhaven.com/a/carved_wooden_plate) | Jan Martens | CC0 (dominio público) |
| Granada | `public/models/food_pomegranate_01.glb` | [Poly Haven · Food Pomegranate 01](https://polyhaven.com/a/food_pomegranate_01) | Oliver Harries | CC0 (dominio público) |
| Limón | `public/models/lemon.glb` | [Poly Haven · Lemon](https://polyhaven.com/a/lemon) | Kuutti Siitonen | CC0 (dominio público) |

- Descargados de la API oficial de Poly Haven (versión glTF 1k) el 19/11/2026. CC0 permite el uso comercial sin atribución; se anota igualmente por transparencia.
- Optimización: texturas reducidas a 512 px (JPEG) y empaquetadas en un único `.glb` por modelo (~630 KB en total). La geometría no se ha modificado.
- **El entremet** (glaseado, mousse, inserto, bizcocho, base, frambuesas y pan de oro) es una **ilustración procedural** programada en `src/components/site/entremet-scene.ts`. No es un producto real de Candú: la web lo indica como «Ilustración 3D» y los nombres de las capas describen la técnica de un entremet, no los ingredientes de ninguna pieza a la venta.
- Las fotografías de `public/obrador/` son trabajos reales de Candú descargados de su web actual (candualtapasteleria.com) con autorización previa del propietario de este proyecto.
- Tipografías: Fraunces e Instrument Sans (Google Fonts, licencia SIL Open Font License), servidas por Next.js desde el propio dominio.
