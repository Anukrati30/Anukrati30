"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Layers,
  LogIn,
  Maximize2,
  Pencil,
  ScanSearch,
  Search,
  Sparkles,
  Telescope,
  UserPlus,
  ZoomIn,
  ZoomOut,
  Eye,
} from "lucide-react";

type Dataset = {
  id: string;
  title: string;
  description: string;
  category: string;
  dziUrl: string;
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
  open: (tileSource: string) => void;
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
  tileSources: string;
};

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

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDataset, setSelectedDataset] = useState<Dataset>(
    SAMPLE_DATASETS[0]
  );
  const [isLoggedIn] = useState(false); // placeholder until auth is wired
  const [nasaItems, setNasaItems] = useState<NasaItem[]>([]);
  const [tileError, setTileError] = useState<string | null>(null);

  const viewerContainerRef = useRef<HTMLDivElement | null>(null);
  const viewerInstanceRef = useRef<OSDViewer | null>(null);

  const filteredDatasets = useMemo(() => {
    const all: Array<Dataset | (NasaItem & { dziUrl?: string })> = [
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
  }, [searchQuery, nasaItems]);

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
          tileSources: selectedDataset.dziUrl,
        });
        // Fallback handler in case tile source fails
        instance.addHandler("open-failed", () => {
          setTileError("Tile source failed to load. Switched to fallback.");
          instance.open(
            "https://openseadragon.github.io/example-images/duomo/duomo.dzi"
          );
        });
        instance.addHandler("open", () => setTileError(null));
        viewerInstanceRef.current = instance;
      } else {
        viewerInstanceRef.current.open(selectedDataset.dziUrl);
      }
    }
    ensureViewer();
    return () => {
      disposed = true;
    };
  }, [selectedDataset]);

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

          <div className="flex items-center gap-2">
            <button className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-sm">
              <LogIn className="h-4 w-4" /> Login
            </button>
            <button className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 hover:brightness-110 text-black text-sm font-semibold shadow-[0_0_0_2px_rgba(255,255,255,0.2)]">
              <UserPlus className="h-4 w-4" /> Register
            </button>
          </div>
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
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDatasets.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDataset(d)}
              className="group text-left rounded-2xl overflow-hidden border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition shadow hover:shadow-fuchsia-500/10"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.thumbnailUrl}
                  alt={d.title}
                  className="h-full w-full object-cover group-hover:scale-[1.03] transition duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
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
            </button>
          ))}
        </div>
      </section>

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
              <div
                ref={viewerContainerRef}
                className="h-[60vh] min-h-[420px] w-full"
              />
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
                </div>
                <div className="flex items-center gap-2">
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
            {selectedDataset.dziUrl === "" && (
              <div className="mt-3 text-xs text-white/60">
                This NASA APOD item is not a deep-zoom tile source, displaying thumbnail instead.
              </div>
            )}
          </div>
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
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
              <h4 className="font-semibold tracking-tight">Actions</h4>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={!isLoggedIn}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm bg-white/5 disabled:opacity-50"
                  title={isLoggedIn ? "Add annotation" : "Login to annotate"}
                >
                  <Pencil className="h-4 w-4" /> Annotate
                </button>
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
              <p className="text-xs text-white/50">
                Annotations require an account. Your labels are saved to your profile and
                can be shared with your team.
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
