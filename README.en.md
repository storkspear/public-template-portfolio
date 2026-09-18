# template-portfolio-blog

A static portfolio plus a blog you actually write in. **Zero JavaScript for visitors.**

> 한국어: [README.md](README.md) — the code and UI are in Korean.

Syntax highlighting, diagrams, and fonts are all **baked into static HTML at publish
time**. A reader's browser downloads no scripts at all. The writing side, on the other
hand, is a real editor: tables, code blocks, Mermaid and draw.io diagrams, images, and
styled title banners.

---

## Requirements

- **Docker** — that's it
- (optional) Node 24, only if you want to modify the admin UI

## Getting started

```bash
git clone https://github.com/storkspear/public-template-portfolio.git my-site
cd my-site
docker compose up -d --build
```

**That's the whole thing.** No Node, no `npm install`, no `.env` — the admin bundle is
built inside the image and everything else has a default. On first boot it creates the
schema, seeds the account and three example posts, and bakes them once.

| | |
|---|---|
| **Public site** | <http://localhost:8080> — what visitors see |
| **Admin** | <http://localhost:8081> — only you |
| **Default login** | username `admin` · password `admin` |

> ⚠ **`admin`/`admin` is local-only.**
> The moment you change `origin` in `site.config.mjs` to your own domain, the server
> **refuses to start** with this password. See "Deploying" below.

If those ports are taken, create the env file once:

```bash
cp .env.example .env     # only needed when you want to change something
```

and move them there:

```
WEB_PORT=8088
ADMIN_PORT=8089
```

`.env` **overrides the defaults** when present. It holds per-machine values like
passwords and database credentials, and is never committed.

`docker compose down` stops everything; your posts and images **survive** (named
volumes). `docker compose down -v` wipes them — there is no undo.

---

## Making it yours

### 1. `site.config.mjs` — one file

```js
export default {
  name: 'my-site',                    // DB schema and container name stem
  origin: 'http://localhost:8080',    // https://example.com once deployed
  siteTitle: 'HONG GILDONG',
  brand: 'Hong Gildong',
  description: 'Notes on things that tripped me up.',
  copyright: 'HONG GILDONG',
  github: '',                         // empty = no GitHub link in the footer
  nav: [ … ],
}
```

These values are used by **published posts** (header, footer, `<title>`, canonical URL)
and by the admin UI.

> ⚠ After editing this file, bring the stack back up with **`docker compose up -d --build`**.
> The admin's "view post" URL is baked in at build time, so a plain restart keeps the old one.
> (`npm run up` always passes `--build`.)

### 2. The landing and portfolio pages — two ways

You choose per page in the admin's **"홈디자인" (Design)** screen. `site.config.mjs`
is not involved.

**Direct design (default) — edit the code**

Open `pages/main.html` and `pages/portfolio.html` directly. These files hold only what
goes *inside* `<body>` — the `<head>`, the shared header and the footer are added by the
baker. There is no build step, so you edit and hit "사이트에 반영" (Publish). Everything
in them is placeholder content, and comments mark what to change.

Empty a file and you get a blank white canvas. That is a fine place to start.

**Start from a sample.** With Direct design selected, "사용할 파일" (File to use) lists
**your file** and five samples per page (`sample-pages/`). Clicking a sample swaps the
preview; "사이트에 반영" (Publish) serves that sample as is — nothing is copied, only the
chosen name is saved in the settings. To customise one, run
`cp sample-pages/main2.html pages/main.html`, edit it, and pick "내 파일" (your file).
Do not edit the sample files themselves; template updates may change them.

**Template — pick it in the admin**

Pick colours, fonts, header, section order and layout; a live preview sits next to it,
and "사이트에 반영" (Publish) makes the baker rebuild the page. With the portfolio on
Template, portfolio items are written in the admin like posts (a "포트폴리오" entry
appears in the left menu).

| | Direct design | Template |
|---|---|---|
| Landing page | `pages/main.html` | chosen in the admin, baked |
| Portfolio | `pages/portfolio.html` | items entered in the admin |
| Who edits it | someone who touches code | anyone |
| Undo | git | "이전 판으로" (Revert) button |

The two pages are **independent** — hand-write the landing page and still put the
portfolio on a template.

The **shared header** is a separate switch, per page. Only the blog has it on by default.

The landing page carries its own large name block, and the portfolio fragment brings its
own `<header>` — it needs the section-jump links in the middle, and those only exist on
that page, so there is no room for them in a header shared by the whole site.

> If a fragment has its own `<header>` and you also turn the shared header on, you get
> two. The baker refuses by name, so trying it cannot break the site.

### 3. Favicon

Replace `public/favicon.svg`.

---

## Writing

Write in the admin at <http://localhost:8081>.

- **Drafts** and **published** versions live in separate columns — nobody sees drafts
- Publishing bakes static HTML on the spot and it appears on the public site
- Hiding a post removes the page but **keeps the image originals** — unhide and it's back
- Images are stored per post number; deleting a post deletes its images too

### Post URLs

Posts get **`/blog/{post number}/`** and portfolio items get **`/portfolio/{number}/`**.
The number is assigned once, when the item is created, and never changes.

**String slugs (`/blog/my-post/`) are not supported.** Converting a Korean title into a slug
produces things like `%ED%95%9C…`, and using the number means a post shares one folder with
the images uploaded to it — one place to write, one place to clean up when it's taken down.

### What gets baked

| | |
|---|---|
| Code blocks | Highlighting is computed **at publish time** and written into the HTML |
| Diagrams | Mermaid and draw.io are rendered to SVG and inlined |
| Titles | Font, size, colour, and banner are stored as part of the post |
| Images | Originals plus `attachment://` rewritten to real URLs |

---

## Deploying

**Use the same compose file.** If local and production differ, "works on my machine"
starts happening.

```bash
# 1. Point at your domain
#    site.config.mjs → origin: 'https://example.com'

# 2. Fresh password and token secret (the server won't boot without this)
node -p "require('node:crypto').randomBytes(32).toString('base64url')"
#    put the result in ADMIN_TOKEN_SECRET in .env

docker compose up -d --build db api          # api refuses to start — that's expected
docker compose exec api node server/set-password.mjs admin
#    then leave ADMIN_PASSWORD empty in .env

docker compose up -d --build
```

Bring your own domain and TLS. In `docker/nginx.conf` you only need to change the two
`server_name` lines and the `listen` ports — **that file stands on its own**, with no
dependency on config outside the repo.

Don't expose the admin port (8081) to the internet. Put it behind a firewall or VPN, or
add another layer of authentication in front of nginx.

---

## Working on the admin UI

If rebuilding the container is too slow:

```bash
docker compose up -d          # keep API, DB, and the public site running
npm install
npm run admin:dev             # http://localhost:5173
```

Vite proxies `/api`, `/blog`, and `/assets` to the compose stack, so you edit the UI
against the **real API and real images**. When you're done: `npm run admin:build`.

---

## Checks

```bash
npm run check
```

| | |
|---|---|
| `check-public.mjs` | 8 checks that no JavaScript leaked into public pages |
| `check-summary.mjs` | 18 checks that list-page excerpting still behaves |
| `check-fonts.mjs` | 7 checks that every shipped font is **legal to redistribute** |

Publishing also makes the baker **inspect its own output** — missing posts, unresolved
attachments, and broken structure fail right there.

---

## Licence and fonts

- Code: **MIT** ([LICENSE](LICENSE))
- Fonts: all **OFL** — all 121 files come from npm packages, and each package's full
  licence text ships alongside them in `public/fonts/licenses/`. See [CREDITS.md](CREDITS.md)

**Read CREDITS.md before adding a font.** "Free for web embedding" is not the same as
"free to redistribute the file". `npm run check:fonts` enforces this.

---

## Layout

```
public/            what ships — landing, portfolio, CSS, fonts
  assets/          site.css (hand-written) · fonts.css, prose.css (generated)
    templates/     CSS the baked pages use when pages:true
  fonts/           font files + licenses/ (full licence texts)
admin/             admin SPA (React + @storkspear/post-editor-react)
shared/            vocabulary the admin and the baker **both** use — colours, fonts, layouts
server/            API and baker. Its own package.json, its own dependency tree
  vendor/          editor pieces the baker needs (refreshed by vendor:sync)
  seed/            example posts — seeded once, never overwritten
docker/            nginx.conf · api.Dockerfile · web.Dockerfile
sql/schema.sql     table definitions
site.config.mjs    ★ everything site-specific
```

The editor itself is on npm as
[`@storkspear/post-editor-react`](https://www.npmjs.com/package/@storkspear/post-editor-react).
`npm update` picks up new versions.
