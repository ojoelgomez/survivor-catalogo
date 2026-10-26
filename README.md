# SURVIVOR · Catálogo online

Catálogo de camisetas de fútbol de SURVIVOR (Medellín). Sitio estático publicado gratis en GitHub Pages:

**https://ojoelgomez.github.io/survivor-catalogo/**

Cada vez que se sube un cambio a la rama `main`, una GitHub Action optimiza las fotos, arma el catálogo y publica el sitio. Tarda unos 2 minutos.

---

## Cómo agregar camisetas nuevas

### 1. Prepara las fotos

Cada camiseta va en su propia carpeta, dentro de la carpeta del equipo:

```
fotos/
  Real Madrid/
    Local 2025-26/
      01.jpg   ← la primera es la portada
      02.jpg
      03.webp
    Tercera 2024-25/
      01.jpg
      ...
  Nacional/                ← equipo nuevo
    Local 2026/
      01.jpg
```

Reglas:

- **Carpeta del equipo:** el nombre tal como quieres que se vea (`Real Madrid`, `Atlético Nacional`).
- **Carpeta de la camiseta:** el nombre que verá el cliente. Usa estas palabras para que el sitio reconozca el tipo:
  - `Local`, `Visitante`, `Tercera`, `Arquero` o `Edicion Especial`. Escribe "Edicion" sin tilde; el sitio la muestra con tilde.
  - Si es retro, agrega `Retro` (ej. `Local Retro 2006`). Así aparece al buscar "retro" y lleva la etiqueta **Retro**.
  - Si es de manga larga, agrega `Manga Larga`.
- **Fotos:** JPG, PNG o WebP, de cualquier tamaño (el sitio las optimiza solo). Nómbralas `01`, `02`, `03`… en el orden en que quieres mostrarlas; la `01` es la portada.
- **No uses** los caracteres `? / \ : * " < > |` en los nombres.
- Las carpetas que empiezan con `_` (ej. `_parches`) se ignoran.

### 2. Súbelas a GitHub

**Opción A: desde el navegador (sin instalar nada)**

1. Entra a https://github.com/ojoelgomez/survivor-catalogo e inicia sesión.
2. Abre la carpeta `fotos`, y luego la del equipo. Si el equipo es nuevo, quédate en `fotos`.
3. Haz clic en **Add file → Upload files**.
4. Arrastra **la carpeta completa** desde tu computador (ej. la carpeta `Local 2026`, o la del equipo completo si es nuevo). GitHub conserva la estructura de carpetas. Funciona en Chrome y Edge.
5. Abajo, en **Commit changes**, escribe algo como `Agrego Nacional Local 2026`, deja marcado **Commit directly to the main branch** y haz clic en **Commit changes**.
6. Ve a la pestaña **Actions**. Verás la publicación en curso (círculo amarillo). Cuando quede en verde ✓, la camiseta ya está en el sitio. Si no la ves, recarga la página.

**Opción B: desde este computador (con terminal)**

```bash
npm run build      # opcional: genera el catálogo para probar
npm run serve      # abre http://localhost:8080 para revisarlo
git add fotos
git commit -m "Agrego Nacional Local 2026"
git push
```

### 3. Si el equipo es nuevo: liga y color

Un equipo nuevo aparece en el chip **Otros**, con borde verde lima. Para ponerle su liga y su color, edita `data/overrides.json`. En GitHub: abre el archivo, haz clic en el lápiz ✏️, edita y luego **Commit changes**.

```json
"teams": {
  "Real Madrid": { "order": 10 },
  "Atlético Nacional": { "league": "Otros", "color": "#00843D", "tags": ["verdolaga", "colombia", "medellin"], "order": 15 }
}
```

- `league`: una de `La Liga`, `Premier`, `Serie A`, `Bundesliga`, `Ligue 1`, `Selecciones`, `Otros`.
- `color`: el color del club en formato `#RRGGBB`. Lo puedes sacar de Google buscando "color hex de [equipo]".
- `tags`: palabras extra con las que lo pueden buscar.
- `order`: número más bajo = sale más arriba. Los equipos sin `order` van después, en orden alfabético.

### 4. Otros ajustes en `data/overrides.json`

Cada camiseta tiene un `id` hecho con el equipo y la carpeta. Ejemplo: `fotos/Real Madrid/Local 2025-26` → `real-madrid-local-2025-26`.

```json
"products": {
  "real-madrid-local-2025-26": { "name": "Local 25/26", "order": 1 },
  "barcelona-local-2023-24":   { "hidden": true },
  "argentina-edicion-especial-messi": { "cover": "02.webp" }
}
```

| Campo | Para qué sirve |
|---|---|
| `name` | Cambiar el nombre que se muestra |
| `hidden` | `true` para ocultarla sin borrar las fotos (ej. agotada) |
| `cover` | Usar otra foto como portada |
| `order` | Orden dentro del catálogo |
| `tags` | Palabras extra para el buscador |

**Para quitar una camiseta** definitivamente, borra su carpeta en `fotos/`. Si un cliente la tenía en su selección, desaparece sola.

### Detalles automáticos

- **Frase del encabezado:** con 11 equipos o menos dice "11 gigantes. 1 precio. $159.000"; con más, "Los gigantes del fútbol".
- **Imagen para compartir:** se arma con las portadas de los 4 primeros equipos.
- **Cambio de precio:** cambia `price` en `data/overrides.json`, y también el texto `$159.000` en `index.html` (encabezado y descripción) y en `js/app.js` (`TAGLINE_SMALL`).

---

## Cómo poner un dominio propio (ej. survivor.co)

### 1. Compra el dominio

Cómpralo en cualquier proveedor: GoDaddy, Namecheap, Cloudflare, o uno colombiano para `.co` / `.com.co`. Cuesta aproximadamente entre USD 10 y 40 al año.

### 2. Configura el DNS en el proveedor del dominio

En el panel del proveedor, busca **DNS** o **Administrar registros DNS**. Borra los registros `A` o `CNAME` que vengan por defecto para `@` y `www`, y crea estos:

| Tipo | Nombre / Host | Valor |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |
| CNAME | `www` | `ojoelgomez.github.io` |

(Los `AAAA` son opcionales, para IPv6. Si tu proveedor no los permite, omítelos.)

### 3. Verifica el dominio en GitHub (recomendado)

Esto evita que otra persona pueda usar tu dominio en GitHub.

1. Ve a https://github.com/settings/pages, en la configuración de **tu cuenta**, no del repositorio.
2. **Add a domain** → escribe `survivor.co`.
3. GitHub te dará un registro **TXT**. Créalo en el DNS del proveedor igual que en el paso 2.
4. Vuelve y haz clic en **Verify**. Puede tardar unos minutos.

### 4. Conecta el dominio al sitio

1. Ve a https://github.com/ojoelgomez/survivor-catalogo/settings/pages
2. En **Custom domain** escribe `survivor.co` y haz clic en **Save**.
3. Espera a que diga **DNS check successful**. Puede tardar desde minutos hasta 24 horas mientras el DNS se propaga.
4. Marca **Enforce HTTPS**. Si aparece gris, espera un rato: GitHub está creando el certificado.
5. Ve a **Actions** → **Publicar catálogo** → **Run workflow**, para que la imagen y los enlaces para compartir usen el dominio nuevo.

Listo: `survivor.co` y `www.survivor.co` mostrarán el catálogo, y la dirección `ojoelgomez.github.io/survivor-catalogo` redirigirá allí.

> Nota: las selecciones que los clientes tenían guardadas en el navegador no pasan al dominio nuevo, porque cada dirección guarda las suyas por separado. Solo afecta el día del cambio.

### Para revisar que todo quedó bien

- Abre `https://survivor.co` en el celular.
- Envía el enlace por WhatsApp y revisa que salga la imagen con el logo y las camisetas. Si WhatsApp sigue mostrando una vista previa vieja, prueba enviando `https://survivor.co/?v=2`.

---

## Para desarrolladores

| Archivo | Qué hace |
|---|---|
| `scripts/build-catalog.js` | Lee `fotos/`, genera `img/` (WebP 400 px, WebP 1600 px, JPG 1200 px), `img/og-image.jpg` y `data/catalog.json` |
| `scripts/make-logos.js` | Genera el logo blanco y los íconos con la S. Solo hace falta si cambia el logo |
| `data/overrides.json` | Precio, WhatsApp, liga/color/orden por equipo y ajustes por camiseta |
| `index.html`, `css/`, `js/` | El sitio. Sin framework ni paso de compilación |
| `.github/workflows/deploy.yml` | Corre el script y publica en GitHub Pages |

`img/` y `data/catalog.json` no se guardan en el repositorio; se generan en cada publicación.

```bash
npm install
npm run build     # primera vez ~1,5 min; luego solo procesa fotos nuevas (--force regenera todo)
npm run serve     # http://localhost:8080
```
