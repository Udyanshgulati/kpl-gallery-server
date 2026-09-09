# KPL Gallery Server — Deployment Runbook

> **STATUS: LIVE** since 2026-09-09 — https://media.korfballpremierleague.com
> Deployed on the shared VPS `200.141.13.226` with full isolation from the
> existing Thoda Logic service (`node /root/forh` on port 4000, untouched).
> KPL app runs on **port 4010** (4000 was already taken). See "Deployed values".

Standalone service for **https://media.korfballpremierleague.com**.
Hard rule: **nothing** here touches Thoda Logic's Nginx config, SSL certs, or
media folders. Separate server block, separate cert, separate directory,
separate Coolify app. If any step would modify an existing Thoda Logic file,
stop and confirm first.

---

## 0. Deployed values

| Thing | Value |
|---|---|
| Subdomain | `media.korfballpremierleague.com` (Cloudflare A → `200.141.13.226`, proxied) |
| App port (host + container) | **`4010`** (port 4000 belongs to the existing `node /root/forh`) |
| KPL-only media dir | `/var/www/kpl-media` — bind-mounted into the container at the same path |
| Nginx server block file | `/etc/nginx/sites-available/media.korfballpremierleague.com` (NEW file, symlinked into sites-enabled) |
| TLS | Let's Encrypt via `certbot --nginx --cert-name media.korfballpremierleague.com` (separate lineage from `media.thodalogic.com`) |
| Coolify | project `korfball-premier-league` / env `production` / app `kpl-gallery-server`, Dockerfile build pack |
| GitHub repo | `Udyanshgulati/kpl-gallery-server` |
| VPS | `200.141.13.226` (shared with Thoda Logic; KPL fully isolated by port + dir + nginx file + cert) |

Env vars set in Coolify: `GALLERY_UPLOAD_KEY` (secret, held by owner), `GALLERY_PUBLIC_BASE=https://media.korfballpremierleague.com`, `PORT=4010`, `MEDIA_ROOT=/var/www/kpl-media`.

---

## 1. GitHub repo

```bash
git init
git add .
git commit -m "KPL gallery server: standalone media service"
gh repo create kpl-gallery-server --private --source=. --push
```

---

## 2. VPS — dedicated KPL directory

SSH in (user + auth TBD — no key currently on the deploy machine).

```bash
# KPL-only tree, completely separate from any Thoda Logic media dir
sudo mkdir -p /var/www/kpl-media/gallery/grid
sudo mkdir -p /var/www/kpl-media/gallery/full
# owner = the uid Coolify runs the container as (adjust if needed)
sudo chown -R 1000:1000 /var/www/kpl-media
```

Confirm it is NOT under, and shares no parent with, any existing
`media.thodalogic.com` / TL media path.

---

## 3. Cloudflare DNS (korfballpremierleague.com zone)

Add ONE record:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `media` | `<VPS IP>` | Proxied (orange cloud) |

Leave every existing record untouched.

---

## 4. New Nginx server block  +  its own SSL cert

Create a **new** file — do not edit any existing one:
`/etc/nginx/sites-available/media.korfballpremierleague.com`

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name media.korfballpremierleague.com;

    client_max_body_size 30M;

    # optimized WebP files served straight off disk
    location /media/ {
        alias /var/www/kpl-media/;
        expires 7d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # API -> Node app on 4010
    location /api/gallery {
        proxy_pass http://127.0.0.1:4010;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/media.korfballpremierleague.com \
           /etc/nginx/sites-enabled/media.korfballpremierleague.com
sudo nginx -t          # MUST pass before reload — aborts if it doesn't
sudo systemctl reload nginx

# cert for ONLY this hostname, so nothing else is re-touched
sudo certbot --nginx -d media.korfballpremierleague.com \
     --cert-name media.korfballpremierleague.com
```

`--cert-name` keeps this cert lineage separate from `media.thodalogic.com`.

---

## 5. Coolify — new application

- **Name:** `kpl-gallery-server`
- **Source:** the GitHub repo from step 1
- **Build pack:** Dockerfile (included in repo)
- **Ports exposes:** `4010`  •  **Port mappings:** `4010:4010`
- **Domain in Coolify:** leave blank — Nginx (step 4) is the public entrypoint,
  Coolify only needs to publish the port on localhost.
- **Persistent storage / bind mount:** host `/var/www/kpl-media` → container
  `/var/www/kpl-media`

---

## 6. Environment variables (in Coolify)

| Key | Value |
|---|---|
| `GALLERY_UPLOAD_KEY` | *(strong random secret — generated separately, shared with owner out of band)* |
| `GALLERY_PUBLIC_BASE` | `https://media.korfballpremierleague.com` |
| `PORT` | `4010` |
| `MEDIA_ROOT` | `/var/www/kpl-media` |

---

## 7. Deploy + smoke test

```bash
# upload a test photo
curl -sS -X POST https://media.korfballpremierleague.com/api/gallery/upload \
  -H "x-api-key: $GALLERY_UPLOAD_KEY" \
  -F "photo=@test.jpg" | tee /tmp/kpl-upload.json

# open the grid + full URLs from that JSON in a browser — should be WebP

curl -sS "https://media.korfballpremierleague.com/api/gallery"
curl -sS "https://media.korfballpremierleague.com/api/gallery/full?offset=0&limit=6"
```

## 8. Clean up test photo

```bash
ID=$(jq -r .id /tmp/kpl-upload.json)
curl -sS -X DELETE "https://media.korfballpremierleague.com/api/gallery/$ID" \
  -H "x-api-key: $GALLERY_UPLOAD_KEY"
```
