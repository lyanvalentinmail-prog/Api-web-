# Proyectos anteriores (preservados)

Este directorio guarda el proyecto que ocupaba la raíz de `main` **antes** de fusionar FreeAPI Hub
(PR #5). No se ha eliminado nada: es una copia exacta de la rama `main` en el commit `316ebde`
(PR #4 de `arena/a67ed2db-api-web`), trasladada aquí para que FreeAPI Hub pudiera ocupar la raíz
del repositorio.

## `api-console/` — API Console (Español) v3.0.0

REST API pública sin clave con **184 endpoints en 16 categorías** y un Playground interactivo en
`/playground`. Construida sobre Express 5 con `@resvg/resvg-js`, `qrcode`, `jpeg-js` y `webp-wasm`.
Todo su código, sus assets (fuentes japonesas, avatares, canvas Sakura), sus scripts y su
`package.json` están aquí completos.

### Ejecutarlo tal cual estaba

```bash
cd legacy/api-console
npm install
npm start          # usa su propio server.js, package.json y .gitignore
```

### Recuperarlo en la raíz de `main`

```bash
# Opción A: restaurar sólo los archivos del proyecto anterior en la raíz
git checkout 316ebde -- .

# Opción B: deshacer por completo el merge de la PR #5
git revert -m 1 <hash-del-commit-de-merge-de-la-PR-5>

# Opción C: volver temporalmente a aquel estado para inspeccionarlo
git switch --detach 316ebde
```

### Aviso sobre despliegues

La raíz del repositorio ahora es FreeAPI Hub (su `package.json`, `render.yaml`, `Procfile` y
`server.js`). Si tenías un servicio en **Render**, **Railway** o similar apuntando a este
repositorio, al fusionar pasará a desplegar FreeAPI Hub. Para seguir desplegando API Console:

- apunta el servicio a esta carpeta (`legacy/api-console`) en un servicio nuevo, o
- restaura el proyecto en la raíz con la opción A de arriba (y, si quieres, en una rama aparte).

Nada de lo anterior se ha borrado: todo sigue también en el historial de Git
(`git log origin/main`, commit `316ebde`).
