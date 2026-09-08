// ─────────────────────────────────────────────────────────────
// KPLGalleryPage — full gallery, opens when "View More" is clicked
// on the homepage teaser. Loads photos in batches with a
// "Load More" button (default batch of 6, configurable 5-8).
// ─────────────────────────────────────────────────────────────
//
// HOW TO USE
// 1. Add this component to your /gallery page in Framer
// 2. It fills its Frame's width; height grows with content
//    (this page is meant to scroll — only the homepage teaser
//    needs the one-viewport constraint)
// 3. apiUrl defaults to your gallery-server /full endpoint —
//    same server as the homepage teaser, just the paginated one
// ─────────────────────────────────────────────────────────────

import { addPropertyControls, ControlType } from "framer"
import { useState, useEffect, useCallback } from "react"

interface Photo {
    id: string
    grid: string
    full: string
}

interface Props {
    apiUrl: string
    batchSize: number
    columns: number
    gap: number
    borderRadius: number
    heading: string
    accentColor: string
    loadMoreLabel: string
    loadingLabel: string
    noMoreLabel: string
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
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
            <button
                onClick={onClose}
                style={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.09)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#fff",
                    fontSize: 20,
                    cursor: "pointer",
                }}
            >
                ×
            </button>
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

function GridCell({
    photo,
    borderRadius,
    onClick,
}: {
    photo: Photo
    borderRadius: number
    onClick: () => void
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
                aspectRatio: "1 / 1",
            }}
        >
            <img
                src={photo.grid}
                alt=""
                loading="lazy"
                style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                    transform: hov ? "scale(1.05)" : "scale(1)",
                    transition: "transform 0.35s ease",
                }}
            />
        </div>
    )
}

export default function KPLGalleryPage({
    apiUrl = "https://media.korfballpremierleague.com/api/gallery/full",
    batchSize = 6,
    columns = 3,
    gap = 10,
    borderRadius = 10,
    heading = "Full Gallery",
    accentColor = "#213873",
    loadMoreLabel = "Load more",
    loadingLabel = "Loading…",
    noMoreLabel = "That's all for now",
}: Props) {
    const [photos, setPhotos] = useState<Photo[]>([])
    const [offset, setOffset] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    const [loading, setLoading] = useState(false)
    const [lightbox, setLightbox] = useState<string | null>(null)
    const [error, setError] = useState(false)

    const loadBatch = useCallback(
        async (currentOffset: number) => {
            setLoading(true)
            setError(false)
            try {
                const url = `${apiUrl}?offset=${currentOffset}&limit=${batchSize}`
                const res = await fetch(url)
                const data = await res.json()
                setPhotos((prev) => [...prev, ...(data.items ?? [])])
                setOffset(currentOffset + (data.items?.length ?? 0))
                setHasMore(Boolean(data.hasMore))
            } catch {
                setError(true)
            } finally {
                setLoading(false)
            }
        },
        [apiUrl, batchSize]
    )

    // first batch on mount
    useEffect(() => {
        loadBatch(0)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiUrl])

    return (
        <div style={{ width: "100%", fontFamily: "system-ui, sans-serif" }}>
            {heading && (
                <div
                    style={{
                        fontSize: 28,
                        fontWeight: 800,
                        color: accentColor,
                        letterSpacing: "-0.02em",
                        marginBottom: 18,
                    }}
                >
                    {heading}
                </div>
            )}

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                    gap,
                }}
            >
                {photos.map((photo) => (
                    <GridCell
                        key={photo.id}
                        photo={photo}
                        borderRadius={borderRadius}
                        onClick={() => setLightbox(photo.full)}
                    />
                ))}
            </div>

            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    marginTop: 28,
                }}
            >
                {hasMore ? (
                    <button
                        onClick={() => loadBatch(offset)}
                        disabled={loading}
                        style={{
                            padding: "12px 28px",
                            borderRadius: 999,
                            border: "none",
                            background: accentColor,
                            color: "#fff",
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: loading ? "default" : "pointer",
                            opacity: loading ? 0.7 : 1,
                        }}
                    >
                        {loading ? loadingLabel : loadMoreLabel}
                    </button>
                ) : (
                    photos.length > 0 && (
                        <div style={{ color: "#8a8fa3", fontSize: 14 }}>
                            {noMoreLabel}
                        </div>
                    )
                )}
            </div>

            {error && (
                <div
                    style={{
                        textAlign: "center",
                        color: "#c0392b",
                        fontSize: 13,
                        marginTop: 10,
                    }}
                >
                    Couldn't load photos. Check the server / apiUrl.
                </div>
            )}

            {lightbox && (
                <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
            )}
        </div>
    )
}

addPropertyControls(KPLGalleryPage, {
    apiUrl: {
        type: ControlType.String,
        title: "Gallery API URL",
        defaultValue: "https://media.korfballpremierleague.com/api/gallery/full",
    },
    batchSize: {
        type: ControlType.Number,
        title: "Load more batch size",
        defaultValue: 6,
        min: 5,
        max: 8,
        step: 1,
        displayStepper: true,
    },
    columns: {
        type: ControlType.Number,
        title: "Grid columns",
        defaultValue: 3,
        min: 2,
        max: 5,
        step: 1,
        displayStepper: true,
        description: "Set lower (e.g. 2) on the phone breakpoint override.",
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        defaultValue: 10,
        min: 0,
        max: 24,
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
    heading: {
        type: ControlType.String,
        title: "Heading",
        defaultValue: "Full Gallery",
    },
    accentColor: {
        type: ControlType.Color,
        title: "Accent colour",
        defaultValue: "#213873",
    },
    loadMoreLabel: {
        type: ControlType.String,
        title: "Load more label",
        defaultValue: "Load more",
    },
    loadingLabel: {
        type: ControlType.String,
        title: "Loading label",
        defaultValue: "Loading…",
    },
    noMoreLabel: {
        type: ControlType.String,
        title: "End-of-list label",
        defaultValue: "That's all for now",
    },
})
