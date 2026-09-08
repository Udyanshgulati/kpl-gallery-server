/**
 * gallery-server.js — KPL-only gallery service
 * ─────────────────────────────────────────────────────────────
 * This is deliberately standalone: its own git repo, its own
 * subdomain (media.korfballpremierleague.com), its own folder
 * on disk, its own Coolify app. Nothing here touches or lives
 * inside Thoda Logic's shared media server — separate Nginx
 * server block, separate SSL cert, separate everything.
 *
 * WHAT IT DOES
 * 1. POST /api/gallery/upload   (auth required)
 *    - Accepts a photo upload
 *    - Sharp resizes + converts to WebP at 2 sizes (grid + full)
 *    - Never writes the raw/heavy original to disk at all
 *    - Appends the new photo to manifest.json
 * 2. GET /api/gallery
 *    - Public, no auth — full list of grid-size photo URLs.
 *      Used by the homepage teaser (KPLGalleryPreview).
 * 3. GET /api/gallery/full?offset=&limit=
 *    - Public, paginated — used by the gallery page's Load More
 *      (KPLGalleryPage). Returns { total, hasMore, items }.
 * 4. DELETE /api/gallery/:id   (auth required)
 *    - Removes a photo (files + manifest entry)
 *
 * FOLDER LAYOUT (all under MEDIA_ROOT — a KPL-only directory)
 *   gallery/grid/<id>.webp   (800px wide  — homepage grid)
 *   gallery/full/<id>.webp   (1920px wide — lightbox / full page)
 *   gallery/manifest.json    (ordered list of ids + timestamps)
 *
 * WHY THIS HELPS ON MATCH DAYS
 * - Every image served is already small WebP, not the original
 *   phone/DSLR upload → far less bandwidth per pageview.
 * - Nginx + Cloudflare in front of media.korfballpremierleague.com
 *   cache these at the edge, so a traffic spike doesn't hit the
 *   VPS repeatedly.
 * - The GET endpoint is one cached JSON call, not N calls.
 *
 * SETUP
 *   npm install
 *   npm start
 *   (Coolify: deploy this repo as its own app, expose port 4000
 *    internally, proxy /api/gallery/* to it from the KPL-only
 *    Nginx server block for media.korfballpremierleague.com)
 *
 * ENV VARS
 *   GALLERY_UPLOAD_KEY   shared secret for upload/delete auth
 *   GALLERY_PUBLIC_BASE  https://media.korfballpremierleague.com
 *   MEDIA_ROOT           KPL-only folder path on disk (NOT shared
 *                        with any Thoda Logic media directory)
 *   PORT                 defaults to 4000
 * ─────────────────────────────────────────────────────────────
 */

const express = require("express")
const multer = require("multer")
const sharp = require("sharp")
const cors = require("cors")
const fs = require("fs/promises")
const path = require("path")
const crypto = require("crypto")

const PORT = process.env.PORT || 4000
const UPLOAD_KEY = process.env.GALLERY_UPLOAD_KEY || "change-me"
const PUBLIC_BASE = process.env.GALLERY_PUBLIC_BASE || "https://media.korfballpremierleague.com"
const MEDIA_ROOT = process.env.MEDIA_ROOT || path.join(__dirname, "media")

const app = express()
app.use(cors())

// multer stores the raw upload in memory only — never written to
// disk as-is, so there's no heavy original to clean up later.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB cap per photo
})

function requireAuth(req, res, next) {
    if (req.headers["x-api-key"] !== UPLOAD_KEY) {
        return res.status(401).json({ error: "unauthorized" })
    }
    next()
}

async function galleryDirs() {
    const base = path.join(MEDIA_ROOT, "gallery")
    const grid = path.join(base, "grid")
    const full = path.join(base, "full")
    await fs.mkdir(grid, { recursive: true })
    await fs.mkdir(full, { recursive: true })
    return { base, grid, full, manifest: path.join(base, "manifest.json") }
}

async function readManifest(manifestPath) {
    try {
        const raw = await fs.readFile(manifestPath, "utf-8")
        return JSON.parse(raw)
    } catch {
        return []
    }
}

async function writeManifest(manifestPath, list) {
    await fs.writeFile(manifestPath, JSON.stringify(list, null, 2))
}

function newestFirst(list) {
    return [...list].sort(
        (a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)
    )
}

// ── GET /api/gallery — public, cached ───────────────────────────
// Used by the homepage teaser (KPLGalleryPreview).
app.get("/api/gallery", async (req, res) => {
    const { manifest } = await galleryDirs()
    const list = newestFirst(await readManifest(manifest))

    res.set("Cache-Control", "public, max-age=300")
    res.json(list.map((item) => `${PUBLIC_BASE}/media/gallery/grid/${item.id}.webp`))
})

// ── GET /api/gallery/full — public, cached, PAGINATED ────────────
// Used by the gallery page's Load More (KPLGalleryPage).
app.get("/api/gallery/full", async (req, res) => {
    const { manifest } = await galleryDirs()
    const list = newestFirst(await readManifest(manifest))

    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0)
    const hasLimit = req.query.limit !== undefined
    const limit = hasLimit ? Math.max(1, parseInt(req.query.limit, 10) || 6) : list.length

    const page = list.slice(offset, offset + limit)

    res.set("Cache-Control", "public, max-age=300")
    res.json({
        total: list.length,
        offset,
        limit,
        hasMore: offset + page.length < list.length,
        items: page.map((item) => ({
            id: item.id,
            grid: `${PUBLIC_BASE}/media/gallery/grid/${item.id}.webp`,
            full: `${PUBLIC_BASE}/media/gallery/full/${item.id}.webp`,
        })),
    })
})

// ── POST /api/gallery/upload — auth required ─────────────────────
app.post("/api/gallery/upload", requireAuth, upload.single("photo"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "no file" })

    const { grid, full, manifest } = await galleryDirs()
    const id = crypto.randomUUID()

    try {
        await sharp(req.file.buffer)
            .resize({ width: 800, withoutEnlargement: true })
            .webp({ quality: 78 })
            .toFile(path.join(grid, `${id}.webp`))

        await sharp(req.file.buffer)
            .resize({ width: 1920, withoutEnlargement: true })
            .webp({ quality: 85 })
            .toFile(path.join(full, `${id}.webp`))

        // req.file.buffer only ever lived in memory — nothing heavy
        // to delete from disk. Nothing else to clean up here.

        const list = await readManifest(manifest)
        list.push({ id, uploadedAt: new Date().toISOString() })
        await writeManifest(manifest, list)

        res.json({
            id,
            grid: `${PUBLIC_BASE}/media/gallery/grid/${id}.webp`,
            full: `${PUBLIC_BASE}/media/gallery/full/${id}.webp`,
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "processing failed" })
    }
})

// ── DELETE /api/gallery/:id — auth required ───────────────────────
app.delete("/api/gallery/:id", requireAuth, async (req, res) => {
    const { id } = req.params
    const { grid, full, manifest } = await galleryDirs()

    await fs.rm(path.join(grid, `${id}.webp`), { force: true })
    await fs.rm(path.join(full, `${id}.webp`), { force: true })

    const list = await readManifest(manifest)
    await writeManifest(manifest, list.filter((item) => item.id !== id))

    res.json({ deleted: id })
})

// serve the optimized files themselves (Nginx should take over this
// in production for less Node overhead — see deployment notes)
app.use("/media", express.static(MEDIA_ROOT, { maxAge: "7d", immutable: true }))

app.listen(PORT, () => {
    console.log(`KPL gallery server running on port ${PORT}`)
})
