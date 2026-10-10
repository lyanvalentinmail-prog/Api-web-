# /assets — Imágenes estáticas del proyecto

Carpeta con las imágenes que usan los generadores y la web. **Brat no usa assets**:
su salida es 100 % tipográfica (fondo plano + Arial Narrow con blur), igual que
[bratgenerator.com](https://www.bratgenerator.com/).

La carpeta se sirve completa en `GET /assets/*` y también se incrusta en las
respuestas SVG mediante `src/lib/assets.js` (`dataUri()` para raster, `inlineSvg()`
para vectores), de modo que cada imagen generada es autónoma.

```text
assets/
├── iqc/                    # iPhone Quoted Chat (IQC)
│   ├── avatars/
│   │   ├── avatar-ana.jpg      # Contacto por defecto (foto sintetizada, 192×192)
│   │   ├── avatar-marco.jpg
│   │   ├── avatar-cat.jpg
│   │   ├── ava-lila.svg        # Avatares vectoriales (se incrustan como <svg>)
│   │   ├── ava-theo.svg
│   │   ├── ava-mia.svg
│   │   └── ava-bot.svg
│   └── wallpapers/
│       ├── wp-aurora.svg       # Fondo oscuro del chat
│       └── wp-dawn.svg         # Fondo claro del chat
├── cards/                  # Tarjetas Canvas (welcome, certificado, perfil…)
│   ├── pattern-dots.svg        # Patrón de puntos (currentColor → hereda el acento)
│   └── badge-verified.svg      # Insignia de verificado (currentColor)
└── ui/                     # Identidad de la web
    ├── logo.svg                # Logotipo (barra de navegación)
    ├── favicon.svg             # Favicon
    └── og.jpg                  # Imagen Open Graph (1200×630)
```

## Convenciones

- Los **SVG vectoriales** se escriben con `viewBox` y **sin** atributos `width/height`
  fijos para poder anidarlos con `inlineSvg(rel, x, y, w, h)`.
- Los **raster** (JPG) se limitan a 192×192 / 1200×630 y < 60 KB para no inflar
  las respuestas ni el repositorio.
- Usa `currentColor` en SVG reutilizables para heredar el color de acento del tema.
