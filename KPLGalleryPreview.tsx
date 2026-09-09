// ─────────────────────────────────────────────────────────────
// KPLGalleryPreview — Homepage gallery teaser (KPL-only)
// ─────────────────────────────────────────────────────────────
// Fetches the live, pre-optimized photo list from the KPL media
// server and shows a "featured + 2×2" mosaic that always fills
// whatever Frame height it's placed in (no fixed row heights, so
// no overflow / no gap on any device).
//
//   API:  https://media.korfballpremierleague.com/api/gallery
//
// LAYOUT
//   Desktop : big featured image on the left (full height) +
//             up to 4 thumbnails as a 2×2 block on the right.
//   Phone   : featured across the top + 2×2 below (3 equal rows).
//   A photo that fails to load is dropped automatically instead
//   of leaving a blank tile.
//
// SIZING
//   This component does NOT set its own height — it fills 100% of
//   its Frame. Set the Frame's height per breakpoint in vh from
//   Framer's right panel (e.g. Desktop 55vh / Tablet 50vh /
//   Phone 45vh).
//
// The fullscreen preview (tap any photo) has a Download button
// that saves the full-size WebP via the server's attachment
// endpoint (works even though Framer is a different origin).
// The `images` prop is a manual fallback, used only if the fetch
// fails or `apiUrl` is blank.
// ─────────────────────────────────────────────────────────────

import { addPropertyControls, ControlType } from "framer"
import { useEffect, useMemo, useState } from "react"

interface Props {
    apiUrl: string
    images: string[]
    previewCount: number
    galleryUrl: string
    viewMoreLabel: string
    heading: string
    accentColor: string
    btnBg: string
    btnTextColor: string
    gap: number
    borderRadius: number
    width: number
}

const SAMPLE = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80",
    "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=800&q=80",
    "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800&q=80",
    "https://images.unsplash.com/photo-1546961342-ea5f60b193e3?w=800&q=80",
    "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&q=80",
]

// …/media/gallery/grid|full/<id>.webp  →  …/api/gallery/<id>/download
// so the "Download" button saves the file instead of just opening it
// (a plain <a download> is ignored cross-origin).
function downloadHrefFor(src: string) {
    const m = src.match(
        /^(https?:\/\/[^/]+)\/media\/gallery\/(?:grid|full)\/([0-9a-f-]{36})\.webp/i
    )
    return m ? `${m[1]}/api/gallery/${m[2]}/download` : src
}

// grid thumbnail URL → full-size URL for the fullscreen view
function fullOf(src: string) {
    return src.replace("/media/gallery/grid/", "/media/gallery/full/")
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
    const ctrlBtn: React.CSSProperties = {
        height: 38,
        borderRadius: 999,
        background: "rgba(255,255,255,0.09)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: "#fff",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui",
    }
    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                background: "rgba(5,8,20,0.97)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "system-ui",
            }}
        >
            <style>{`@keyframes imgIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}`}</style>
            <div
                style={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    display: "flex",
                    gap: 10,
                    zIndex: 1,
                }}
            >
                <a
                    href={downloadHrefFor(src)}
                    download
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        ...ctrlBtn,
                        padding: "0 16px",
                        gap: 7,
                        fontSize: 14,
                        fontWeight: 600,
                        textDecoration: "none",
                    }}
                >
                    <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download
                </a>
                <button
                    onClick={onClose}
                    style={{ ...ctrlBtn, width: 38, fontSize: 20 }}
                >
                    ×
                </button>
            </div>
            <img
                src={src}
                onClick={(e) => e.stopPropagation()}
                style={{
                    maxWidth: "92vw",
                    maxHeight: "92vh",
                    objectFit: "contain",
                    borderRadius: 10,
                    animation: "imgIn 0.15s ease",
                    boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
                    display: "block",
                }}
            />
        </div>
    )
}

function Cell({
    src,
    style,
    borderRadius,
    onClick,
    onError,
}: {
    src: string
    style?: React.CSSProperties
    borderRadius: number
    onClick: () => void
    onError: () => void
}) {
    const [hov, setHov] = useState(false)
    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                borderRadius,
                overflow: "hidden",
                cursor: "pointer",
                position: "relative",
                background: "#eef1f9",
                minHeight: 0, // lets grid rows shrink instead of overflowing
                ...style,
            }}
        >
            <img
                src={src}
                alt=""
                loading="lazy"
                onError={onError}
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "center top",
                    display: "block",
                    transform: hov ? "scale(1.05)" : "scale(1)",
                    transition:
                        "transform 0.38s cubic-bezier(0.25,0.46,0.45,0.94)",
                }}
            />
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background: `rgba(8,12,40,${hov ? 0.34 : 0})`,
                    transition: "background 0.25s",
                    pointerEvents: "none",
                }}
            />
        </div>
    )
}

export default function KPLGalleryPreview({
    apiUrl = "https://media.korfballpremierleague.com/api/gallery",
    images = SAMPLE,
    previewCount = 5,
    galleryUrl = "/gallery",
    viewMoreLabel = "View all photos",
    heading = "Inside KPL",
    accentColor = "#213873",
    btnBg = "#213873",
    btnTextColor = "#ffffff",
    gap = 6,
    borderRadius = 10,
    width = 900,
}: Props) {
    const [lightbox, setLightbox] = useState<string | null>(null)
    const [fetched, setFetched] = useState<string[] | null>(null)
    const [broken, setBroken] = useState<Record<string, boolean>>({})
    const [mqNarrow, setMqNarrow] = useState(false)

    useEffect(() => {
        if (!apiUrl) return
        let cancelled = false
        fetch(apiUrl)
            .then((r) => r.json())
            .then((list: string[]) => {
                if (!cancelled && Array.isArray(list) && list.length > 0) {
                    setFetched(list)
                }
            })
            .catch(() => {
                // keep the fallback `images` prop on network/API failure
            })
        return () => {
            cancelled = true
        }
    }, [apiUrl])

    // Responsive without relying on Framer passing a real `width`.
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return
        const mq = window.matchMedia("(max-width: 600px)")
        const on = () => setMqNarrow(mq.matches)
        on()
        mq.addEventListener?.("change", on)
        return () => mq.removeEventListener?.("change", on)
    }, [])

    const source = fetched ?? (images?.length > 0 ? images : SAMPLE)
    const data = useMemo(
        () =>
            source
                .filter((s) => !broken[s])
                .slice(0, Math.max(3, previewCount)),
        [source, broken, previewCount]
    )

    const isMobile = mqNarrow || width < 520
    const first = data[0]
    const rest = data.slice(1, 5) // mosaic right side holds up to 4

    const markBroken = (s: string) =>
        setBroken((b) => (b[s] ? b : { ...b, [s]: true }))

    const gridStyle: React.CSSProperties = isMobile
        ? {
              gridTemplateColumns: "1fr 1fr",
              gridTemplateRows: "1fr 1fr 1fr",
          }
        : {
              gridTemplateColumns:
                  rest.length >= 3 ? "1.7fr 1fr 1fr" : "1.6fr 1fr",
              gridTemplateRows: "1fr 1fr",
          }

    const heroStyle: React.CSSProperties = isMobile
        ? { gridColumn: "1 / 3", gridRow: "1 / 2" }
        : { gridColumn: "1 / 2", gridRow: "1 / 3" }

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                fontFamily: "system-ui, sans-serif",
            }}
        >
            {heading && (
                <div style={{ marginBottom: 12, flexShrink: 0 }}>
                    <div
                        style={{
                            fontSize: "clamp(18px, 2.4vw, 26px)",
                            fontWeight: 800,
                            color: accentColor,
                            letterSpacing: "-0.02em",
                            lineHeight: 1.15,
                        }}
                    >
                        {heading}
                    </div>
                </div>
            )}

            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    display: "grid",
                    gap,
                    ...gridStyle,
                }}
            >
                {first && (
                    <Cell
                        src={first}
                        style={heroStyle}
                        borderRadius={borderRadius}
                        onClick={() => setLightbox(fullOf(first))}
                        onError={() => markBroken(first)}
                    />
                )}
                {rest.map((src) => (
                    <Cell
                        key={src}
                        src={src}
                        borderRadius={borderRadius}
                        onClick={() => setLightbox(fullOf(src))}
                        onError={() => markBroken(src)}
                    />
                ))}
            </div>

            {lightbox && (
                <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
            )}
        </div>
    )
}

addPropertyControls(KPLGalleryPreview, {
    apiUrl: {
        type: ControlType.String,
        title: "Gallery API URL",
        defaultValue: "https://media.korfballpremierleague.com/api/gallery",
        description:
            "Fetches live, pre-optimized photo list from your server. Leave blank to use manual Images below.",
    },
    images: {
        type: ControlType.Array,
        title: "Images (fallback)",
        control: { type: ControlType.Image },
        description: "Only used if API fetch fails or apiUrl is blank.",
    },
    previewCount: {
        type: ControlType.Number,
        title: "Preview count",
        defaultValue: 5,
        min: 3,
        max: 8,
        step: 1,
        displayStepper: true,
        description: "Teaser shows 1 featured + up to 4 thumbnails.",
    },
    heading: {
        type: ControlType.String,
        title: "Heading",
        defaultValue: "Inside KPL",
    },
    galleryUrl: {
        type: ControlType.String,
        title: "Gallery page URL",
        defaultValue: "/gallery",
    },
    viewMoreLabel: {
        type: ControlType.String,
        title: "Button label",
        defaultValue: "View all photos",
    },
    btnBg: {
        type: ControlType.Color,
        title: "Button bg",
        defaultValue: "#213873",
    },
    btnTextColor: {
        type: ControlType.Color,
        title: "Button text",
        defaultValue: "#ffffff",
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        defaultValue: 6,
        min: 0,
        max: 16,
        step: 1,
        displayStepper: true,
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Corner radius",
        defaultValue: 10,
        min: 0,
        max: 20,
        step: 2,
        displayStepper: true,
    },
    accentColor: {
        type: ControlType.Color,
        title: "Accent colour",
        defaultValue: "#213873",
    },
})
