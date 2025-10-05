"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Layers,
  Maximize2,
  Pencil,
  ScanSearch,
  Search,
  Sparkles,
  Telescope,
  ZoomIn,
  ZoomOut,
  Eye,
  Plus,
  X,
  Tag as TagIcon,
  Link as LinkIcon,
  Flag,
} from "lucide-react";
// (Annotorious removed for simple text notes)

type Dataset = {
  id: string;
  title: string;
  description: string;
  category: string;
  dziUrl: string; // DZI/IIIF URL or empty for uploaded images
  imageUrl?: string; // For uploaded JPG/PNG/JPEG
  thumbnailUrl: string;
  tags: string[];
};

type OSDViewport = {
  zoomBy: (factor: number) => void;
  applyConstraints: () => void;
};

type OSDViewer = {
  viewport: OSDViewport;
  setFullScreen: (flag: boolean) => void;
  open: (tileSource: string | { type: "image"; url: string }) => void;
  addHandler: (eventName: string, handler: (event: unknown) => void) => void;
};

type OSDGestureSettings = {
  clickToZoom?: boolean;
  dblClickToZoom?: boolean;
  flickEnabled?: boolean;
  pinchToZoom?: boolean;
  scrollToZoom?: boolean;
};

type OSDOptions = {
  element: HTMLElement;
  prefixUrl?: string;
  showNavigator?: boolean;
  showRotationControl?: boolean;
  animationTime?: number;
  maxZoomPixelRatio?: number;
  visibilityRatio?: number;
  constrainDuringPan?: boolean;
  gestureSettingsMouse?: OSDGestureSettings;
  tileSources: string | { type: "image"; url: string };
};

type OSDTileSource = {
  getTileUrl: (level: number, x: number, y: number) => string;
  _getTileUrlOriginal?: (level: number, x: number, y: number) => string;
};

type OSDItem = {
  source?: OSDTileSource;
  getTileSource?: () => OSDTileSource | undefined;
};

type OSDWorld = {
  getItemCount: () => number;
  getItemAt: (index: number) => OSDItem | null;
};

//

const SAMPLE_DATASETS: Dataset[] = [
  {
    id: "andromeda-demo",
    title: "Andromeda Galaxy (Demo Tiles)",
    description:
      "Zoom into a gigapixel-scale galaxy sample. Demonstrates deep zoom fluidity.",
    category: "Galaxy",
    dziUrl:
      "https://openseadragon.github.io/example-images/highsmith/highsmith.dzi",
    thumbnailUrl:
      "https://openseadragon.github.io/example-images/highsmith/highsmith_files/10/0_0.jpg",
    tags: ["galaxy", "stars", "deep field"],
  },
  {
    id: "moon-demo",
    title: "Lunar Highlands (Demo Tiles)",
    description:
      "Explore moon-like detail with a sample tiling source. Great for craters.",
    category: "Moon",
    dziUrl: "https://openseadragon.github.io/example-images/duomo/duomo.dzi",
    thumbnailUrl:
      "https://openseadragon.github.io/example-images/duomo/duomo_files/10/0_0.jpg",
    tags: ["moon", "craters", "lunar"],
  },
  {
    id: "mars-demo",
    title: "Mars Dune Fields (Demo Tiles)",
    description:
      "Pan across patterns reminiscent of martian dunes using demo tiles.",
    category: "Mars",
    dziUrl: "https://openseadragon.github.io/example-images/highsmith/highsmith.dzi",
    thumbnailUrl:
      "https://openseadragon.github.io/example-images/highsmith/highsmith_files/10/0_0.jpg",
    tags: ["mars", "dunes", "patterns"],
  },
  {
    id: "earth-demo",
    title: "Earth Swirls (Demo Tiles)",
    description:
      "Aesthetic swirls stand in for high-res Earth observation imagery.",
    category: "Earth",
    dziUrl: "https://openseadragon.github.io/example-images/nga/nga.dzi",
    thumbnailUrl:
      "https://openseadragon.github.io/example-images/nga/nga_files/10/0_0.jpg",
    tags: ["earth", "ocean", "clouds"],
  },
  {
    id: "nebula-demo",
    title: "Colorful Nebula (Demo Tiles)",
    description:
      "A vibrant target to showcase color channels and contrast in zoom.",
    category: "Deep Space",
    dziUrl: "https://openseadragon.github.io/example-images/iod/iod.dzi",
    thumbnailUrl:
      "https://openseadragon.github.io/example-images/iod/iod_files/10/0_0.jpg",
    tags: ["nebula", "gas", "clouds"],
  },
];

type NasaItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  thumbnailUrl: string;
  tags: string[];
};

type Note = { id: string; type: "note"; text: string; createdAt: string };
type PointAnnotation = {
  id: string;
  type: "point";
  xpct: number;
  ypct: number;
  label: string;
  createdAt: string;
};

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDataset, setSelectedDataset] = useState<Dataset>(
    SAMPLE_DATASETS[0]
  );
  const [nasaItems, setNasaItems] = useState<NasaItem[]>([]);
  const [tileError, setTileError] = useState<string | null>(null);
  const [aiEnhance, setAiEnhance] = useState<boolean>(false);
  const [customDatasets, setCustomDatasets] = useState<Dataset[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("NASA");
  const [newDescription, setNewDescription] = useState("");
  const [newTileUrl, setNewTileUrl] = useState("");
  const [newThumbUrl, setNewThumbUrl] = useState("");
  const [newTags, setNewTags] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false); // unused in notes mode
  // simple notes (no drawing)

  const viewerContainerRef = useRef<HTMLDivElement | null>(null);
  const viewerInstanceRef = useRef<OSDViewer | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState("");
  const imageDimsRef = useRef<{ width: number; height: number } | null>(null);
  const [pointAnnotations, setPointAnnotations] = useState<PointAnnotation[]>([]);
  const pinElsRef = useRef<Map<string, HTMLElement>>(new Map());
  const [pinPopup, setPinPopup] = useState<{
    visible: boolean;
    left: number;
    top: number;
    xpct: number;
    ypct: number;
    tempLabel: string;
  }>({ visible: false, left: 0, top: 0, xpct: 0, ypct: 0, tempLabel: "" });

  const filteredDatasets = useMemo(() => {
    const all: Array<Dataset | (NasaItem & { dziUrl?: string })> = [
      ...customDatasets,
      ...SAMPLE_DATASETS,
      ...nasaItems.map((n) => ({
        id: `nasa-${n.id}`,
        title: n.title,
        description: n.description,
        category: n.category,
        dziUrl: "", // NASA APOD not deep-zoom; opens thumbnail placeholder
        thumbnailUrl: n.thumbnailUrl,
        tags: n.tags,
      })),
    ];
    if (!searchQuery.trim()) return all as Dataset[];
    const q = searchQuery.toLowerCase();
    return (all as Dataset[]).filter((d) =>
      [
        d.title.toLowerCase(),
        d.description.toLowerCase(),
        d.category.toLowerCase(),
        d.tags.join(" ").toLowerCase(),
      ].some((field) => field.includes(q))
    );
  }, [searchQuery, nasaItems, customDatasets]);

  useEffect(() => {
    async function loadAPOD() {
      try {
        const res = await fetch("/api/nasa/apod?count=9");
        if (!res.ok) return;
        const data = (await res.json()) as Array<{
          id: string;
          title: string;
          explanation: string;
          url: string;
          thumbnail_url?: string;
          media_type: string;
          date: string;
        }>;
        const mapped: NasaItem[] = data
          .filter((i) => i.media_type === "image")
          .map((i) => ({
            id: i.id ?? i.date,
            title: i.title,
            description: i.explanation,
            category: "NASA APOD",
            imageUrl: i.url,
            thumbnailUrl: i.thumbnail_url || i.url,
            tags: ["nasa", "apod"],
          }));
        setNasaItems(mapped);
      } catch {
        // ignore
      }
    }
    loadAPOD();
  }, []);

  useEffect(() => {
    let disposed = false;
    async function ensureViewer() {
      const OpenSeadragon = (await import("openseadragon")).default as unknown as (
        options: OSDOptions
      ) => OSDViewer;
      // no annotorious in simple note mode
      if (disposed) return;
      if (!viewerInstanceRef.current) {
        const instance = OpenSeadragon({
          element: viewerContainerRef.current!,
          prefixUrl: "https://openseadragon.github.io/openseadragon/images/",
          showNavigator: true,
          showRotationControl: false,
          animationTime: 0.8,
          maxZoomPixelRatio: 3,
          visibilityRatio: 1,
          constrainDuringPan: true,
          gestureSettingsMouse: {
            clickToZoom: true,
            dblClickToZoom: true,
            flickEnabled: true,
            pinchToZoom: true,
            scrollToZoom: true,
          },
          tileSources: selectedDataset.imageUrl
            ? { type: "image", url: selectedDataset.imageUrl }
            : selectedDataset.dziUrl,
        });
        // Fallback handler in case tile source fails
        instance.addHandler("open-failed", () => {
          setTileError("Tile source failed to load. Switched to fallback.");
          instance.open(
            "https://openseadragon.github.io/example-images/duomo/duomo.dzi"
          );
        });
        instance.addHandler("open", async () => {
          setTileError(null);
          // apply AI rewrite when viewer opens
          try {
            applyAiRewrite(instance, aiEnhance);
          } catch {}
          // Load existing notes & pins for this dataset
          try {
            const res = await fetch(`/api/annotations?datasetId=${encodeURIComponent(selectedDataset.id)}`);
            if (res.ok) {
              const data = (await res.json()) as unknown;
              const arr = Array.isArray(data) ? (data as unknown[]) : [];
              const allNotes: Note[] = arr.filter((d): d is Note => {
                return (
                  typeof d === "object" && d !== null &&
                  (d as { type?: string }).type === "note" &&
                  typeof (d as { text?: unknown }).text === "string"
                );
              });
              setNotes(allNotes);
              const pins: PointAnnotation[] = arr.filter((d): d is PointAnnotation => {
                return (
                  typeof d === "object" && d !== null &&
                  (d as { type?: string }).type === "point" &&
                  typeof (d as { xpct?: unknown }).xpct === "number" &&
                  typeof (d as { ypct?: unknown }).ypct === "number" &&
                  typeof (d as { label?: unknown }).label === "string"
                );
              });
              setPointAnnotations(pins);
              // Prepare for pin overlay rendering after dimensions known
            }
          } catch {}

          // Enable placing pins on click when pin mode is on
          try {
            (instance as unknown as { addHandler: (ev: string, cb: (e: { position: { x: number; y: number }; preventDefaultAction?: boolean }) => void) => void }).addHandler(
              "canvas-click",
              (e) => {
                if (!drawMode) return;
                const web = e.position;
                const vp = (instance as unknown as { viewport: { pointFromPixel: (p: { x: number; y: number }) => { x: number; y: number } } }).viewport.pointFromPixel(web);
                const item = (instance as unknown as { world: { getItemAt: (i: number) => { viewportToImageCoordinates: (p: { x: number; y: number }) => { x: number; y: number }; source: { width?: number; height?: number; dimensions?: { x?: number; y?: number; width?: number; height?: number } } } } }).world.getItemAt(0);
                const img = item.viewportToImageCoordinates(vp);
                const ts = item.source;
                const iw = ts.width ?? ts.dimensions?.x ?? ts.dimensions?.width ?? 1;
                const ih = ts.height ?? ts.dimensions?.y ?? ts.dimensions?.height ?? 1;
                imageDimsRef.current = { width: iw, height: ih };
                const xpct = img.x / iw;
                const ypct = img.y / ih;
                setPinPopup({ visible: true, left: web.x, top: web.y, xpct, ypct, tempLabel: "" });
                e.preventDefaultAction = true;
              }
            );
          } catch {}
        });
        viewerInstanceRef.current = instance;
      } else {
        viewerInstanceRef.current.open(
          selectedDataset.imageUrl
            ? { type: "image", url: selectedDataset.imageUrl }
            : selectedDataset.dziUrl
        );
      }
    }
    ensureViewer();
    return () => {
      disposed = true;
    };
  }, [selectedDataset, aiEnhance, drawMode]);

  // Position pins after viewport/tiles fully ready
  useEffect(() => {
    const viewer = viewerInstanceRef.current as unknown as {
      world: { getItemAt: (i: number) => { source: { width?: number; height?: number; dimensions?: { x?: number; y?: number; width?: number; height?: number } }; imageToViewportCoordinates: (x: number, y: number) => { x: number; y: number } } };
      addHandler: (ev: string, cb: () => void) => void;
    };
    if (!viewer) return;
    const item = viewer.world.getItemAt(0);
    if (!item) return;
    const ts = item.source;
    const iw = ts.width ?? ts.dimensions?.x ?? ts.dimensions?.width ?? 1;
    const ih = ts.height ?? ts.dimensions?.y ?? ts.dimensions?.height ?? 1;
    imageDimsRef.current = { width: iw, height: ih };
    renderAllPins(pointAnnotations);
    // Reposition pins on zoom/pan
    const onAnim = () => renderAllPins(pointAnnotations);
    (viewer as unknown as { addHandler: (e: string, cb: () => void) => void }).addHandler("animation", onAnim);
    (viewer as unknown as { addHandler: (e: string, cb: () => void) => void }).addHandler("animation-finish", onAnim);
  }, [pointAnnotations]);

  // While pin mode is on, disable click-to-zoom so clicks place pins
  useEffect(() => {
    const viewer = viewerInstanceRef.current as unknown as {
      gestureSettingsMouse?: { clickToZoom?: boolean; dblClickToZoom?: boolean };
    } | null;
    if (!viewer || !viewer.gestureSettingsMouse) return;
    if (drawMode) {
      viewer.gestureSettingsMouse.clickToZoom = false;
      viewer.gestureSettingsMouse.dblClickToZoom = false;
    } else {
      viewer.gestureSettingsMouse.clickToZoom = true;
      viewer.gestureSettingsMouse.dblClickToZoom = true;
    }
  }, [drawMode]);

  function applyAiRewrite(viewer: OSDViewer, enabled: boolean) {
    // Access world using unknown casting but keep typed locals to avoid `any`.
    const world = (viewer as unknown as { world?: OSDWorld }).world;
    if (!world || world.getItemCount() < 1) return;
    const item = world.getItemAt(0) ?? undefined;
    const source: OSDTileSource | undefined = item?.source ?? item?.getTileSource?.();
    if (!source || typeof source.getTileUrl !== "function") return;
    if (enabled) {
      if (!source._getTileUrlOriginal) {
        source._getTileUrlOriginal = source.getTileUrl.bind(source);
      }
      const original: (level: number, x: number, y: number) => string = source._getTileUrlOriginal;
      source.getTileUrl = (level: number, x: number, y: number) => {
        const raw = original(level, x, y);
        const proxied = `/api/ai/superres?url=${encodeURIComponent(raw)}&scale=2&model=swinir-x2`;
        return proxied;
      };
    } else if (source._getTileUrlOriginal) {
      source.getTileUrl = source._getTileUrlOriginal;
    }
  }

  // No drawing/editor in simple notes mode

  // pin overlay removed

  // simple notes save
  async function saveNote(text: string) {
    const n: Note = {
      id: `note-${Date.now()}`,
      type: "note",
      text,
      createdAt: new Date().toISOString(),
    };
    setNotes((prev) => [n, ...prev]);
    await fetch("/api/annotations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ datasetId: selectedDataset.id, annotation: n }),
    });
    setNoteText("");
  }

  function clearPins() {
    pinElsRef.current.forEach((el) => el.remove());
    pinElsRef.current.clear();
  }

  function renderAllPins(pins: PointAnnotation[]) {
    clearPins();
    const viewer = viewerInstanceRef.current as unknown as {
      world: { getItemAt: (i: number) => { imageToViewportCoordinates: (x: number, y: number) => { x: number; y: number } } };
      viewport: { pixelFromPoint: (pt: { x: number; y: number }) => { x: number; y: number } };
    };
    const dims = imageDimsRef.current;
    if (!viewer || !dims) return;
    const item = viewer.world.getItemAt(0);
    for (const p of pins) {
      const imgX = p.xpct * dims.width;
      const imgY = p.ypct * dims.height;
      const vp = item.imageToViewportCoordinates(imgX, imgY);
      const web = viewer.viewport.pixelFromPoint(vp);
      const el = document.createElement("div");
      el.className = "absolute -translate-x-1/2 -translate-y-full z-20";
      el.style.left = `${web.x}px`;
      el.style.top = `${web.y}px`;
      el.innerHTML = `<div class=\"rounded-full bg-fuchsia-500 shadow shadow-fuchsia-500/50 text-white w-6 h-6 grid place-items-center\"><svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"16\" height=\"16\"><path fill=\"currentColor\" d=\"M12 2c3.31 0 6 2.69 6 6 0 4.5-6 14-6 14S6 12.5 6 8c0-3.31 2.69-6 6-6zm0 8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z\"/></svg></div>`;
      viewerContainerRef.current?.appendChild(el);
      pinElsRef.current.set(p.id, el);
    }
  }

  function zoomIn() {
    const viewer = viewerInstanceRef.current;
    if (!viewer) return;
    viewer.viewport.zoomBy(1.2);
    viewer.viewport.applyConstraints();
  }

  function zoomOut() {
    const viewer = viewerInstanceRef.current;
    if (!viewer) return;
    viewer.viewport.zoomBy(0.8);
    viewer.viewport.applyConstraints();
  }

  function goFullscreen() {
    const viewer = viewerInstanceRef.current;
    if (!viewer) return;
    try {
      viewer.setFullScreen(true);
    } catch {}
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0b12] via-[#0d0f25] to-[#0b0b12] text-white">
      {/* Top Nav */}
      <header className="sticky top-0 z-30 backdrop-blur border-b border-white/10 bg-black/30">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-fuchsia-500 to-cyan-400 grid place-items-center shadow-lg shadow-fuchsia-500/30">
              <Telescope className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Cosmos Explorer</span>
          </div>

          <form
            className="hidden md:flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 border border-white/10 shadow-inner shadow-black/30 w-[520px]"
            onSubmit={(e) => e.preventDefault()}
          >
            <Search className="h-4 w-4 text-white/70" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search: Mars dunes, Andromeda, moon craters…"
              className="bg-transparent outline-none w-full text-sm placeholder:text-white/40"
            />
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-xs px-2 py-1 rounded-full bg-white/10 hover:bg-white/15"
            >
              Clear
            </button>
          </form>

          <div className="flex items-center gap-2" />
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div className="text-center space-y-6">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">
            Explore NASA-scale imagery
            <span className="block bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 via-cyan-300 to-emerald-300">
              zoom to the tiniest details
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-white/70">
            Deep-zoom tiles, slick UI, and collaborative annotations. Compare
            places, overlay datasets, and discover patterns across time.
          </p>
          <div className="flex items-center justify-center gap-3">
            <a
              href="#viewer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black font-semibold hover:brightness-110"
            >
              <Sparkles className="h-5 w-5" /> Start exploring
            </a>
            <a
              href="#gallery"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10"
            >
              <ScanSearch className="h-5 w-5" /> Browse datasets
            </a>
          </div>
        </div>

        {/* Mobile search */}
        <form
          className="mt-8 md:hidden items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 border border-white/10 shadow-inner shadow-black/30 flex"
          onSubmit={(e) => e.preventDefault()}
        >
          <Search className="h-4 w-4 text-white/70" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search datasets"
            className="bg-transparent outline-none w-full text-sm placeholder:text-white/40"
          />
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-xs px-2 py-1 rounded-full bg-white/10 hover:bg-white/15"
          >
            Clear
          </button>
        </form>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: <Layers className="h-5 w-5" />,
            title: "Overlay & compare",
            text: "Stack related images and swipe to compare.",
          },
          {
            icon: <Pencil className="h-5 w-5" />,
            title: "Annotate collaboratively",
            text: "Label storms, craters, and features (login required).",
          },
          {
            icon: <Sparkles className="h-5 w-5" />,
            title: "AI-powered search",
            text: "Search by coordinates, names, or natural language.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.06)]"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-white/10 grid place-items-center">
                {f.icon}
              </div>
              <h3 className="font-semibold">{f.title}</h3>
            </div>
            <p className="mt-2 text-sm text-white/70">{f.text}</p>
          </div>
        ))}
      </section>

      {/* Gallery */}
      <section id="gallery" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-end justify-between">
          <h2 className="text-xl sm:text-2xl font-bold">Featured datasets</h2>
          <span className="text-xs text-white/50">
            {filteredDatasets.length} result{filteredDatasets.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
          >
            <Plus className="h-4 w-4" /> Add NASA/IIIF/DZI dataset
          </button>
          <span className="text-xs text-white/50">
            Paste a DZI or IIIF Image/Manifest URL
          </span>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const input = e.currentTarget.elements.namedItem("file") as HTMLInputElement;
              if (!input.files || !input.files[0]) return;
              const form = new FormData();
              form.append("file", input.files[0]);
              const res = await fetch("/api/upload", { method: "POST", body: form });
              if (!res.ok) return;
              const { url } = (await res.json()) as { url: string };
              const ds: Dataset = {
                id: `upload-${Date.now()}`,
                title: input.files[0].name,
                description: "Uploaded image",
                category: "Upload",
                dziUrl: "",
                imageUrl: url,
                thumbnailUrl: url,
                tags: ["upload"],
              };
              setCustomDatasets((prev) => [ds, ...prev]);
              setSelectedDataset(ds);
              input.value = "";
            }}
            className="inline-flex items-center gap-2"
          >
            <input name="file" type="file" accept="image/jpeg,image/png,image/jpg" className="text-xs" />
            <button type="submit" className="text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10">
              Upload
            </button>
          </form>
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDatasets.map((d) => (
            <div
              key={d.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedDataset(d)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedDataset(d);
                }
              }}
              className={
                "group cursor-pointer text-left rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition shadow hover:shadow-fuchsia-500/10 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/70"
              }
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.thumbnailUrl}
                  alt={d.title}
                  className="h-full w-full object-cover group-hover:scale-[1.03] transition duration-300"
                  loading="lazy"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between">
                  <span className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10">
                    {"category" in d ? (d as Dataset).category : "NASA APOD"}
                  </span>
                  <span className="text-xs text-white/70">Click to view</span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold tracking-tight">{d.title}</h3>
                <p className="mt-1 text-sm text-white/70 line-clamp-2">{d.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {d.tags.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/60"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {showAddModal && (
        <div className="fixed inset-0 z-[100] grid place-items-center p-4 bg-black/60">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#121223] p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Add dataset (DZI or IIIF)</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="h-8 w-8 grid place-items-center rounded-lg bg-white/10 hover:bg-white/15"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <label className="text-sm">
                <span className="text-white/70">Title</span>
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none"
                  placeholder="e.g., MRO Mars Mosaic (2020)"
                />
              </label>
              <label className="text-sm">
                <span className="text-white/70">Category</span>
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none"
                  placeholder="Mars, Moon, Earth, Deep Space..."
                />
              </label>
              <label className="text-sm">
                <span className="text-white/70">Description</span>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none min-h-24"
                  placeholder="What can users explore here?"
                />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="text-white/70 flex items-center gap-1"><LinkIcon className="h-3 w-3" /> DZI or IIIF URL</span>
                  <input
                    value={newTileUrl}
                    onChange={(e) => setNewTileUrl(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none"
                    placeholder="https://... .dzi or IIIF image/manifest"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-white/70">Thumbnail URL</span>
                  <input
                    value={newThumbUrl}
                    onChange={(e) => setNewThumbUrl(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none"
                    placeholder="https://... preview.jpg"
                  />
                </label>
              </div>
              <label className="text-sm">
                <span className="text-white/70 flex items-center gap-1"><TagIcon className="h-3 w-3" /> Tags (comma-separated)</span>
                <input
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none"
                  placeholder="craters, dust storm, infrared"
                />
              </label>
              {formError && (
                <div className="text-amber-300 text-sm">{formError}</div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setFormError(null);
                  const isIIIFManifest = /\/manifest(\.json)?$/i.test(newTileUrl);
                  const isIIIFImage = /\/info\.json$/i.test(newTileUrl);
                  const isDZI = /\.dzi(\?|$)/i.test(newTileUrl);
                  if (!newTitle || !newTileUrl) {
                    setFormError("Title and DZI/IIIF URL are required.");
                    return;
                  }
                  let dziUrl = newTileUrl;
                  if (isIIIFManifest) {
                    // naive: keep manifest URL; real impl would parse and select image
                    dziUrl = newTileUrl;
                  } else if (isIIIFImage) {
                    dziUrl = newTileUrl;
                  } else if (!isDZI) {
                    setFormError("Provide a valid .dzi, IIIF manifest, or IIIF info.json URL.");
                    return;
                  }
                  const ds: Dataset = {
                    id: `custom-${Date.now()}`,
                    title: newTitle,
                    description: newDescription || "User provided dataset",
                    category: newCategory || "NASA",
                    dziUrl,
                    thumbnailUrl: newThumbUrl || newTileUrl,
                    tags: newTags
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  };
                  setCustomDatasets((prev) => [ds, ...prev]);
                  setSelectedDataset(ds);
                  setShowAddModal(false);
                  setNewTitle("");
                  setNewCategory("NASA");
                  setNewDescription("");
                  setNewTileUrl("");
                  setNewThumbUrl("");
                  setNewTags("");
                }}
                className="px-3 py-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black font-semibold text-sm"
              >
                Add dataset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewer */}
      <section
        id="viewer"
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 pb-16"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/40 relative">
              <div className="absolute z-10 top-3 left-3 flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10">
                  Live Viewer
                </span>
              </div>
              {tileError && (
                <div className="absolute top-3 right-3 z-20 text-xs px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-200">
                  {tileError}
                </div>
              )}
              <div ref={viewerContainerRef} className="h-[60vh] min-h-[420px] w-full" />
              <div className="absolute z-10 bottom-3 left-3 right-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={zoomOut}
                    className="h-9 w-9 grid place-items-center rounded-xl bg-white/10 hover:bg-white/15 border border-white/10"
                    title="Zoom out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <button
                    onClick={zoomIn}
                    className="h-9 w-9 grid place-items-center rounded-xl bg-white/10 hover:bg-white/15 border border-white/10"
                    title="Zoom in"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDrawMode((v) => !v)}
                    className={`h-9 px-3 inline-flex items-center gap-2 rounded-xl border text-sm ${
                      drawMode
                        ? "bg-gradient-to-r from-emerald-500 to-cyan-400 text-black border-white/20"
                        : "bg-white/10 hover:bg-white/15 border-white/10"
                    }`}
                    title="Toggle pin mode (click to place flag)"
                  >
                    <Flag className="h-4 w-4" /> {drawMode ? "Pin On" : "Pin Off"}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAiEnhance((v) => !v)}
                    className={`h-9 px-3 inline-flex items-center gap-2 rounded-xl border text-sm ${
                      aiEnhance
                        ? "bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black border-white/20"
                        : "bg-white/10 hover:bg-white/15 border-white/10"
                    }`}
                    title="AI super-resolution proxy"
                  >
                    <Sparkles className="h-4 w-4" /> {aiEnhance ? "AI On" : "AI Off"}
                  </button>
                  <button
                    onClick={goFullscreen}
                    className="h-9 w-9 grid place-items-center rounded-xl bg-white/10 hover:bg-white/15 border border-white/10"
                    title="Fullscreen"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            {selectedDataset.dziUrl === "" && !selectedDataset.imageUrl && (
              <div className="mt-3 text-xs text-white/60">No deep-zoom source. Upload an image or select a DZI/IIIF dataset.</div>
            )}
          </div>
          {/* Pin popup for labeling specific regions */}
          {pinPopup.visible && (
            <div className="absolute z-30" style={{ left: pinPopup.left, top: pinPopup.top }}>
              <div className="translate-y-2 rounded-2xl border border-white/10 bg-[#0f1022] p-3 w-64 shadow-xl">
                <div className="text-xs text-white/60 mb-2">Add pin label</div>
                <input
                  autoFocus
                  value={pinPopup.tempLabel}
                  onChange={(e) => setPinPopup({ ...pinPopup, tempLabel: e.target.value })}
                  placeholder="e.g., Dust devil"
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none text-sm"
                />
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setPinPopup({ ...pinPopup, visible: false, tempLabel: "" })}
                    className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const dims = imageDimsRef.current;
                      if (!dims) return;
                      const p: PointAnnotation = {
                        id: `pin-${Date.now()}`,
                        type: "point",
                        xpct: pinPopup.xpct,
                        ypct: pinPopup.ypct,
                        label: pinPopup.tempLabel || "",
                        createdAt: new Date().toISOString(),
                      };
                      setPointAnnotations((prev) => [...prev, p]);
                      await fetch("/api/annotations", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({ datasetId: selectedDataset.id, annotation: p }),
                      });
                      setPinPopup({ ...pinPopup, visible: false, tempLabel: "" });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black text-xs font-semibold"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
          <aside className="lg:col-span-4 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="font-semibold tracking-tight">{selectedDataset.title}</h3>
              <p className="mt-1 text-sm text-white/70">{selectedDataset.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedDataset.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/60"
                  >
                    {t}
                  </span>
                ))}
              </div>
              {aiEnhance && (
                <div className="mt-3 inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/30 text-fuchsia-200">
                  <Sparkles className="h-3 w-3" /> AI enhanced tiles (proxy)
                </div>
              )}
            </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
              <h4 className="font-semibold tracking-tight">Actions</h4>
              <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setDrawMode((v) => !v)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm ${
                      drawMode
                        ? "bg-gradient-to-r from-emerald-500 to-cyan-400 text-black border-white/20"
                        : "bg-white/5 hover:bg-white/10 border-white/10"
                    }`}
                    title="Toggle pin mode"
                  >
                    <Flag className="h-4 w-4" /> {drawMode ? "Pin On" : "Pin Off"}
                  </button>
                  {drawMode && (
                    <span className="text-xs text-white/60">Click the image to place a pin</span>
                  )}
                <button
                  disabled
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm bg-white/5 opacity-60"
                  title="Coming soon"
                >
                  <Layers className="h-4 w-4" /> Overlay
                </button>
                <button
                  disabled
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm bg-white/5 opacity-60"
                  title="Coming soon"
                >
                  <Eye className="h-4 w-4" /> Compare
                </button>
              </div>
                <div className="pt-3 border-t border-white/10">
                  <div className="text-sm font-semibold mb-2">Notes</div>
                  <div className="flex items-center gap-2">
                    <input
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Type a note/label..."
                      className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none text-sm"
                    />
                    <button
                      onClick={() => noteText.trim() && saveNote(noteText.trim())}
                      className="px-3 py-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-black text-sm font-semibold"
                    >
                      Add
                    </button>
                  </div>
                  <ul className="mt-3 space-y-2 max-h-48 overflow-auto pr-1">
                    {notes.map((n) => (
                      <li key={n.id} className="text-xs text-white/80 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                        {n.text}
                      </li>
                    ))}
                  </ul>
                </div>
              <p className="text-xs text-white/50">
                  Notes are saved locally per dataset.
              </p>
            </div>
          </aside>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10 text-center text-sm text-white/60">
        Built for exploration • Demo tiles courtesy of OpenSeadragon • NASA datasets
        supported via IIIF/DZI in app.
      </footer>
    </div>
  );
}
