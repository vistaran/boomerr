import { useEffect, useState, useMemo } from "react";
import {
    ComposableMap,
    Geographies,
    Geography,
    Marker,
    ZoomableGroup,
} from "react-simple-maps";
import {
    Globe,
    Server,
    MapPin,
    Activity,
    Clock,
    ArrowDown,
    ArrowUp,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    X,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Zap,
    BarChart3,
    ShieldCheck,
    Cpu,
    Radio,
    Maximize2,
    Info,
} from "lucide-react";
import {
    getDomainRegionalStatus,
    type DomainRegionalStatus,
    type DomainRegionalStatusPoint,
} from "../../services/api-service";
import DateTimeDisplay from "../common/date-time-display";
import RollingNumber from "./RollingNumber";
import { InfoTooltip } from "../common/info-tooltip";

// Standard TopoJSON World Atlas URL
const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

export type RegionGeoInfo = {
    name: string;
    coordinates: [number, number]; // [lng, lat]
    countryCode: string;
    countryName: string;
};

// Comprehensive exact coordinates for AWS monitoring regions
export const REGION_COORDINATES: Record<string, RegionGeoInfo> = {
    "ap-south-1": {
        name: "Mumbai",
        countryName: "India",
        coordinates: [72.8777, 19.076],
        countryCode: "in",
    },
    "ap-south-2": {
        name: "Hyderabad",
        countryName: "India",
        coordinates: [78.4867, 17.385],
        countryCode: "in",
    },
    "us-east-1": {
        name: "N. Virginia",
        countryName: "USA",
        coordinates: [-77.4874, 39.0438],
        countryCode: "us",
    },
    "us-east-2": {
        name: "Ohio",
        countryName: "USA",
        coordinates: [-82.9988, 39.9612],
        countryCode: "us",
    },
    "us-west-1": {
        name: "N. California",
        countryName: "USA",
        coordinates: [-121.8947, 37.3382],
        countryCode: "us",
    },
    "us-west-2": {
        name: "Oregon",
        countryName: "USA",
        coordinates: [-119.4179, 44.0],
        countryCode: "us",
    },
    "ca-central-1": {
        name: "Montreal",
        countryName: "Canada",
        coordinates: [-73.5673, 45.5017],
        countryCode: "ca",
    },
    "ca-west-1": {
        name: "Calgary",
        countryName: "Canada",
        coordinates: [-114.0719, 51.0447],
        countryCode: "ca",
    },
    "eu-central-1": {
        name: "Frankfurt",
        countryName: "Germany",
        coordinates: [8.6821, 50.1109],
        countryCode: "de",
    },
    "eu-central-2": {
        name: "Zurich",
        countryName: "Switzerland",
        coordinates: [8.5417, 47.3769],
        countryCode: "ch",
    },
    "eu-north-1": {
        name: "Stockholm",
        countryName: "Sweden",
        coordinates: [18.0686, 59.3293],
        countryCode: "se",
    },
    "eu-west-1": {
        name: "Dublin",
        countryName: "Ireland",
        coordinates: [-6.2603, 53.3498],
        countryCode: "ie",
    },
    "eu-west-2": {
        name: "London",
        countryName: "UK",
        coordinates: [-0.1276, 51.5074],
        countryCode: "gb",
    },
    "eu-west-3": {
        name: "Paris",
        countryName: "France",
        coordinates: [2.3522, 48.8566],
        countryCode: "fr",
    },
    "eu-south-1": {
        name: "Milan",
        countryName: "Italy",
        coordinates: [9.19, 45.4642],
        countryCode: "it",
    },
    "eu-south-2": {
        name: "Spain",
        countryName: "Spain",
        coordinates: [-3.7038, 40.4168],
        countryCode: "es",
    },
    "ap-east-1": {
        name: "Hong Kong",
        countryName: "Hong Kong",
        coordinates: [114.1694, 22.3193],
        countryCode: "hk",
    },
    "ap-southeast-1": {
        name: "Singapore",
        countryName: "Singapore",
        coordinates: [103.8198, 1.3521],
        countryCode: "sg",
    },
    "ap-southeast-2": {
        name: "Sydney",
        countryName: "Australia",
        coordinates: [151.2093, -33.8688],
        countryCode: "au",
    },
    "ap-southeast-3": {
        name: "Jakarta",
        countryName: "Indonesia",
        coordinates: [106.8456, -6.2088],
        countryCode: "id",
    },
    "ap-southeast-4": {
        name: "Melbourne",
        countryName: "Australia",
        coordinates: [144.9631, -37.8136],
        countryCode: "au",
    },
    "ap-northeast-1": {
        name: "Tokyo",
        countryName: "Japan",
        coordinates: [139.6917, 35.6895],
        countryCode: "jp",
    },
    "ap-northeast-2": {
        name: "Seoul",
        countryName: "South Korea",
        coordinates: [126.978, 37.5665],
        countryCode: "kr",
    },
    "ap-northeast-3": {
        name: "Osaka",
        countryName: "Japan",
        coordinates: [135.5023, 34.6937],
        countryCode: "jp",
    },
    "sa-east-1": {
        name: "São Paulo",
        countryName: "Brazil",
        coordinates: [-46.6333, -23.5505],
        countryCode: "br",
    },
    "me-south-1": {
        name: "Bahrain",
        countryName: "Bahrain",
        coordinates: [50.5577, 26.0667],
        countryCode: "bh",
    },
    "me-central-1": {
        name: "UAE",
        countryName: "United Arab Emirates",
        coordinates: [55.2708, 25.2048],
        countryCode: "ae",
    },
    "af-south-1": {
        name: "Cape Town",
        countryName: "South Africa",
        coordinates: [18.4241, -33.9249],
        countryCode: "za",
    },
    "il-central-1": {
        name: "Tel Aviv",
        countryName: "Israel",
        coordinates: [34.7818, 32.0853],
        countryCode: "il",
    },
};

export function getRegionGeoInfo(awsRegion?: string | null): RegionGeoInfo | null {
    if (!awsRegion || awsRegion === 'all') return null;
    const normalizedKey = awsRegion.trim().toLowerCase();
    const info = REGION_COORDINATES[normalizedKey];
    if (!info) return null;
    return {
        ...info,
        countryCode: info.countryCode.trim().toLowerCase(),
    };
}

export type MarkerStatusType = "up" | "down" | "degraded" | "nodata";

function getMarkerStatus(regionData?: DomainRegionalStatus): MarkerStatusType {
    if (!regionData || !regionData.status) return "nodata";
    if (regionData.status === "down") return "down";
    if (regionData.response_time_ms && regionData.response_time_ms > 800) {
        return "degraded";
    }
    return "up";
}

function getStatusColor(status: MarkerStatusType) {
    switch (status) {
        case "up":
            return {
                fill: "#10b981", // emerald-500
                stroke: "#34d399",
                glow: "rgba(16, 185, 129, 0.5)",
                badgeBg: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
                text: "Up / Healthy",
            };
        case "degraded":
            return {
                fill: "#f59e0b", // amber-500
                stroke: "#fbbf24",
                glow: "rgba(245, 158, 11, 0.5)",
                badgeBg: "bg-amber-500/15 text-amber-400 border-amber-500/30",
                text: "Degraded Latency",
            };
        case "down":
            return {
                fill: "#f43f5e", // rose-500
                stroke: "#fb7185",
                glow: "rgba(244, 63, 94, 0.6)",
                badgeBg: "bg-rose-500/15 text-rose-400 border-rose-500/30",
                text: "Down / Offline",
            };
        case "nodata":
        default:
            return {
                fill: "#64748b", // slate-500
                stroke: "#94a3b8",
                glow: "rgba(100, 116, 139, 0.3)",
                badgeBg: "bg-slate-500/15 text-slate-400 border-slate-500/30",
                text: "No Recent Data",
            };
    }
}

// Response time color helpers based on thresholds
export function getLatencyTextColor(ms: number | null | undefined): string {
    if (ms === null || ms === undefined) return "text-slate-500";
    if (ms <= 600 && ms > 0) return "text-emerald-300";
    if (ms <= 1500 && ms > 600) return "text-amber-500";
    if (ms <= 2800 && ms > 1500) return "text-orange-500";
    if (ms > 2800) return "text-rose-500";
    return "text-slate-500";
}

export function getLatencyBarBg(ms: number | null | undefined, isDown?: boolean): string {
    if (isDown) return "bg-rose-500 hover:bg-rose-400";
    if (ms === null || ms === undefined || ms <= 0) return "bg-slate-500 hover:bg-slate-400";
    if (ms <= 600 && ms > 0) return "bg-emerald-400 hover:bg-emerald-300";
    if (ms <= 1500 && ms > 600) return "bg-amber-500 hover:bg-amber-400";
    if (ms <= 2800 && ms > 1500) return "bg-orange-500 hover:bg-orange-400";
    if (ms > 2800) return "bg-rose-500 hover:bg-rose-400";
    return "bg-slate-500 hover:bg-slate-400";
}

export function RegionalMonitoring({ domainId }: { domainId: string }) {
    const [regions, setRegions] = useState<DomainRegionalStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Interactive state
    const [zoom, setZoom] = useState(1.25);
    const [center, setCenter] = useState<[number, number]>([15, 10]);
    const [hoveredRegion, setHoveredRegion] = useState<{
        data: DomainRegionalStatus;
        geo: RegionGeoInfo;
    } | null>(null);
    const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

    // Selected region for Side Panel
    const [selectedRegionCode, setSelectedRegionCode] = useState<string | null>(null);
    const [selectedRegionDetail, setSelectedRegionDetail] = useState<DomainRegionalStatus | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    const fetchRegions = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getDomainRegionalStatus(domainId);
            setRegions(data);
        } catch (err: any) {
            setError(err.message || "Failed to load regional status");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRegions();
        const intervalId = setInterval(fetchRegions, 30000);
        return () => clearInterval(intervalId);
    }, [domainId]);

    // Handle Marker Click -> Fetch detailed regional history and open Side Panel
    const handleSelectRegion = async (regionCode: string) => {
        setSelectedRegionCode(regionCode);
        setLoadingDetail(true);
        try {
            const data = await getDomainRegionalStatus(domainId, regionCode);
            const found = data.find((r) => r.region === regionCode);
            if (found) {
                setSelectedRegionDetail(found);
            } else {
                // Fallback to existing loaded state
                const localFound = regions.find((r) => r.region === regionCode);
                setSelectedRegionDetail(localFound || null);
            }
        } catch (e) {
            const localFound = regions.find((r) => r.region === regionCode);
            setSelectedRegionDetail(localFound || null);
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleZoomIn = () => setZoom((z) => Math.min(z * 1.4, 6));
    const handleZoomOut = () => setZoom((z) => Math.max(z / 1.4, 0.9));
    const handleResetZoom = () => {
        setZoom(1.25);
        setCenter([15, 10]);
    };

    // Calculate map stats
    const statsSummary = useMemo(() => {
        const total = regions.length;
        const upCount = regions.filter((r) => r.status === "up").length;
        const downCount = regions.filter((r) => r.status === "down").length;
        const degradedCount = regions.filter(
            (r) => r.status === "up" && r.response_time_ms && r.response_time_ms > 800
        ).length;
        const validLatencies = regions
            .map((r) => r.response_time_ms)
            .filter((v): v is number => v !== null);

        const avgLatency =
            validLatencies.length > 0
                ? Math.round(
                    validLatencies.reduce((a, b) => a + b, 0) / validLatencies.length
                )
                : null;

        return { total, upCount, downCount, degradedCount, avgLatency };
    }, [regions]);

    if (loading && regions.length === 0) {
        return (
            <div className="mt-8 mb-6">
                <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-800 mb-6" />
                <div className="h-[450px] animate-pulse rounded-2xl bg-slate-900/80 border border-slate-800" />
            </div>
        );
    }

    if (error && regions.length === 0) {
        return (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 mt-8 text-rose-300 shadow-[0_0_30px_rgba(244,63,94,0.1)]">
                <div className="flex items-center gap-3 font-semibold text-lg">
                    <XCircle className="w-6 h-6" />
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className="mb-8 relative">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                        <Globe className="h-5 w-5 text-sky-400 flex-shrink-0" />
                        <span>Global Edge Monitoring Network</span>
                        <InfoTooltip text="Live multi-region latency & uptime telemetry">
                            <Info className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-slate-300 ml-0.5" />
                        </InfoTooltip>
                    </h3>
                </div>

                {/* Quick Summary Pill Bar */}
                <div className="flex items-center gap-2 backdrop-blur-md shadow-lg text-xs">
                    <div className="px-3 py-1.5 rounded-lg bg-slate-800/50 flex items-center gap-2">
                        <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                        <span className="text-slate-400 font-medium">Nodes:</span>
                        <span className="font-bold text-white">{statsSummary.total} Active</span>
                    </div>
                    {/* <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        {statsSummary.upCount} Healthy
                    </div>
                    {statsSummary.degradedCount > 0 && (
                        <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            {statsSummary.degradedCount} Degraded
                        </div>
                    )} */}
                    {statsSummary.downCount > 0 && (
                        <div className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-300 font-bold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                            {statsSummary.downCount} Offline
                        </div>
                    )}
                    {statsSummary.avgLatency !== null && (
                        <div className="px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-300 font-bold flex items-center gap-1.5">
                            <Zap className="w-3.5 h-3.5 text-sky-400" />
                            Avg {statsSummary.avgLatency}ms
                        </div>
                    )}
                </div>
            </div>

            {/* Interactive World Map Container */}
            <div
                className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-[#060911] shadow-2xl backdrop-blur-xl group min-h-[580px] h-[580px]"
                onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltipPos({
                        x: e.clientX - rect.left,
                        y: e.clientY - rect.top,
                    });
                }}
                onMouseLeave={() => {
                    setHoveredRegion(null);
                    setTooltipPos(null);
                }}
            >
                {/* Decorative Grid Mesh & Ambient Glow */}
                <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1.2px,transparent_1.2px)] [background-size:24px_24px] opacity-40 pointer-events-none" />
                <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

                {/* Map Control Buttons */}
                <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 backdrop-blur-md shadow-xl">
                    <button
                        onClick={handleZoomIn}
                        className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="Zoom In"
                    >
                        <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleZoomOut}
                        className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        title="Zoom Out"
                    >
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleResetZoom}
                        className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border-t border-slate-800 mt-1 pt-2"
                        title="Reset View"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </div>

                {/* Status Legend (Bottom Left) */}
                <div className="absolute bottom-4 left-4 z-20 bg-slate-900/90 px-3.5 py-2.5 rounded-xl border border-slate-800/80 backdrop-blur-md shadow-xl flex items-center gap-4 text-xs font-semibold text-slate-300">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                        <span>Up</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"></span>
                        <span>Degraded (&gt;800ms)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
                        <span>Down</span>
                    </div>
                </div>

                {/* Composable React World Map */}
                <ComposableMap
                    projection="geoMercator"
                    projectionConfig={{
                        scale: 130,
                    }}
                    style={{ width: "100%", height: "550px" }}
                >
                    <ZoomableGroup
                        zoom={zoom}
                        center={center}
                        onMoveEnd={({ coordinates, zoom }) => {
                            setCenter(coordinates as [number, number]);
                            setZoom(zoom);
                        }}
                    >
                        <Geographies geography={GEO_URL}>
                            {({ geographies }) =>
                                geographies.map((geo) => (
                                    <Geography
                                        key={geo.rsmKey}
                                        geography={geo}
                                        style={{
                                            default: {
                                                fill: "#1e2f4d",
                                                stroke: "#334766",
                                                strokeWidth: 0.75,
                                                outline: "none",
                                            },
                                            hover: {
                                                fill: "#1e2f4d",
                                                stroke: "#334766",
                                                strokeWidth: 0.75,
                                                outline: "none",
                                                cursor: "default",
                                            },
                                            pressed: {
                                                fill: "#1e2f4d",
                                                stroke: "#334766",
                                                strokeWidth: 0.75,
                                                outline: "none",
                                            },
                                        }}
                                    />
                                ))
                            }
                        </Geographies>

                        {/* Render Active Geo-Coordinate Markers */}
                        {regions.map((regionData) => {
                            const geo = getRegionGeoInfo(regionData.region);
                            if (!geo) return null; // Safety check if unmapped

                            const status = getMarkerStatus(regionData);
                            const colors = getStatusColor(status);

                            return (
                                <Marker
                                    key={regionData.region}
                                    coordinates={geo.coordinates}
                                    onMouseEnter={() => {
                                        setHoveredRegion({ data: regionData, geo });
                                    }}
                                    onMouseLeave={() => {
                                        setHoveredRegion(null);
                                    }}
                                    onClick={() => handleSelectRegion(regionData.region)}
                                >
                                    {/* Pulse Animation Outer Ring */}
                                    <circle
                                        r={12 / Math.sqrt(zoom)}
                                        fill={colors.fill}
                                        opacity={0.35}
                                        className="animate-ping"
                                    />

                                    {/* Glow Aura */}
                                    <circle
                                        r={8 / Math.sqrt(zoom)}
                                        fill={colors.fill}
                                        opacity={0.6}
                                        style={{ filter: "drop-shadow(0px 0px 6px " + colors.glow + ")" }}
                                    />

                                    {/* Inner Solid Marker Circle */}
                                    <circle
                                        r={5 / Math.sqrt(zoom)}
                                        fill={colors.fill}
                                        stroke="#ffffff"
                                        strokeWidth={1.5 / Math.sqrt(zoom)}
                                        className="cursor-pointer transition-transform duration-200 hover:scale-150"
                                    />
                                </Marker>
                            );
                        })}
                    </ZoomableGroup>
                </ComposableMap>

                {/* Hover Tooltip (Floating Overlay) */}
                {hoveredRegion && tooltipPos && (
                    <div
                        className="absolute z-50 pointer-events-none bg-slate-900/95 border border-slate-700/80 rounded-xl p-3.5 shadow-2xl backdrop-blur-xl w-64 text-xs transition-all duration-150"
                        style={{
                            left: Math.min(tooltipPos.x + 15, window.innerWidth - 300),
                            top: Math.max(tooltipPos.y - 100, 10),
                        }}
                    >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2 gap-1 mb-2.5">
                            <div className="flex items-center gap-2 font-bold text-slate-100 text-sm truncate">
                                <img
                                    src={`https://flagcdn.com/${hoveredRegion.geo.countryCode}.svg`}
                                    alt={hoveredRegion.geo.countryName}
                                    className="w-5 h-3.5 object-cover rounded-sm shadow-sm"
                                />
                                <span>{hoveredRegion.data.region_name}</span>
                            </div>
                            <span
                                className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase border ${getStatusColor(getMarkerStatus(hoveredRegion.data)).badgeBg
                                    }`}
                            >
                                {hoveredRegion.data.status}
                            </span>
                        </div>

                        <div className="space-y-1.5 text-slate-300">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 font-medium flex items-center gap-1">
                                    <MapPin className="w-3 h-3 text-sky-400" /> Location:
                                </span>
                                <span className="font-semibold text-slate-200">
                                    {hoveredRegion.data.location || hoveredRegion.geo.name}
                                </span>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 font-medium flex items-center gap-1">
                                    <Activity className="w-3 h-3 text-sky-400" /> Current Latency:
                                </span>
                                <span className={`font-bold ${getLatencyTextColor(hoveredRegion.data.response_time_ms)}`}>
                                    {hoveredRegion.data.response_time_ms !== null
                                        ? `${hoveredRegion.data.response_time_ms} ms`
                                        : "-"}
                                </span>
                            </div>

                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 font-medium flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" /> Last Checked:
                                </span>
                                <span className="font-medium text-slate-300">
                                    {hoveredRegion.data.checked_at ? (
                                        <DateTimeDisplay value={hoveredRegion.data.checked_at} />
                                    ) : (
                                        "-"
                                    )}
                                </span>
                            </div>

                            <div className="pt-2 mt-2 border-t border-slate-800 grid grid-cols-3 gap-1 text-center text-[10px]">
                                <div className="bg-slate-800/40 p-1 rounded border border-slate-700/50">
                                    <div className="text-slate-400">Min</div>
                                    <div className={`font-bold ${getLatencyTextColor(hoveredRegion.data.min_response_time_ms)}`}>
                                        {hoveredRegion.data.min_response_time_ms !== null
                                            ? `${hoveredRegion.data.min_response_time_ms}ms`
                                            : "-"}
                                    </div>
                                </div>
                                <div className="bg-slate-800/40 p-1 rounded border border-slate-700/50">
                                    <div className="text-slate-400">Avg</div>
                                    <div className={`font-bold ${getLatencyTextColor(hoveredRegion.data.avg_response_time_ms)}`}>
                                        {hoveredRegion.data.avg_response_time_ms !== null
                                            ? `${hoveredRegion.data.avg_response_time_ms}ms`
                                            : "-"}
                                    </div>
                                </div>
                                <div className="bg-slate-800/40 p-1 rounded border border-slate-700/50">
                                    <div className="text-slate-400">Max</div>
                                    <div className={`font-bold ${getLatencyTextColor(hoveredRegion.data.max_response_time_ms)}`}>
                                        {hoveredRegion.data.max_response_time_ms !== null
                                            ? `${hoveredRegion.data.max_response_time_ms}ms`
                                            : "-"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[10px] text-sky-400 font-semibold text-center flex items-center justify-center gap-1">
                            <Maximize2 className="w-2.5 h-2.5" /> Click marker for telemetry analysis
                        </div>
                    </div>
                )}

                {/* Detailed Regional Statistics Right Sidebar */}
                {selectedRegionCode && (
                    <div
                        className="absolute top-0 right-0 bottom-0 z-30 w-full sm:w-80 md:w-96 bg-slate-900/95 border-l border-slate-800 shadow-2xl backdrop-blur-xl flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Sidebar Header */}
                        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/60 shrink-0">
                            <div className="flex items-center gap-3">
                                {(() => {
                                    const selectedGeo = getRegionGeoInfo(selectedRegionCode);
                                    return (
                                        <>
                                            {selectedGeo && (
                                                <div className="p-1.5 bg-slate-800/80 rounded-lg border border-slate-700/60 shrink-0">
                                                    <img
                                                        src={`https://flagcdn.com/${selectedGeo.countryCode}.svg`}
                                                        alt={selectedRegionCode}
                                                        className="w-7 h-5 object-cover rounded-[3px] shadow-sm"
                                                    />
                                                </div>
                                            )}
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-base font-bold text-white leading-snug">
                                                        {selectedRegionDetail?.region_name}
                                                    </h4>
                                                </div>
                                                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                    <MapPin className="w-3 h-3 text-sky-400" />
                                                    {selectedRegionDetail?.location || selectedGeo?.name}
                                                </p>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedRegionCode(null);
                                    setSelectedRegionDetail(null);
                                }}
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Sidebar Body */}
                        <div className="p-4 overflow-y-auto space-y-3.5 flex-1 text-xs">
                            {loadingDetail ? (
                                <div className="py-8 flex flex-col items-center justify-center gap-2">
                                    <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
                                    <span className="text-xs text-slate-400">Loading telemetry...</span>
                                </div>
                            ) : selectedRegionDetail ? (
                                <>
                                    {/* Status & Key Metrics Grid */}
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="p-2.5 bg-slate-800/40 rounded-xl border border-slate-800">
                                            <div className="text-[10px] text-slate-400 font-medium mb-1 uppercase tracking-wider">Status</div>
                                            <div>
                                                {selectedRegionDetail.status === "up" ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                        <CheckCircle2 className="w-3 h-3" /> ONLINE
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                                        <XCircle className="w-3 h-3" /> OFFLINE
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="p-2.5 bg-slate-800/40 rounded-xl border border-slate-800">
                                            <div className="text-[10px] text-slate-400 font-medium mb-1 uppercase tracking-wider">Latency</div>
                                            <div className={`text-base font-black ${getLatencyTextColor(selectedRegionDetail.response_time_ms)}`}>
                                                {selectedRegionDetail.response_time_ms !== null
                                                    ? `${selectedRegionDetail.response_time_ms} ms`
                                                    : "-"}
                                            </div>
                                        </div>

                                        <div className="p-2.5 bg-slate-800/40 rounded-xl border border-slate-800">
                                            <div className="text-[10px] text-slate-400 font-medium mb-1 uppercase tracking-wider">24h Uptime</div>
                                            <div className="text-base font-black text-emerald-400">
                                                {selectedRegionDetail.uptime_percent !== undefined
                                                    ? `${selectedRegionDetail.uptime_percent}%`
                                                    : "100%"}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Min / Avg / Max breakdown */}
                                    <div className="p-3 rounded-xl border border-slate-800 bg-slate-800/20 grid grid-cols-3 gap-2 text-center text-[11px]">
                                        <div>
                                            <div className="text-slate-400 text-[10px] flex items-center justify-center gap-1 mb-0.5">
                                                <ArrowDown className="w-3 h-3 text-emerald-400" /> Min
                                            </div>
                                            <div className={`font-bold ${getLatencyTextColor(selectedRegionDetail.min_response_time_ms)}`}>
                                                {selectedRegionDetail.min_response_time_ms !== null
                                                    ? `${selectedRegionDetail.min_response_time_ms}ms`
                                                    : "-"}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-slate-400 text-[10px] flex items-center justify-center gap-1 mb-0.5">
                                                <Zap className="w-3 h-3 text-sky-400" /> Avg
                                            </div>
                                            <div className={`font-bold ${getLatencyTextColor(selectedRegionDetail.avg_response_time_ms)}`}>
                                                {selectedRegionDetail.avg_response_time_ms !== null
                                                    ? `${selectedRegionDetail.avg_response_time_ms}ms`
                                                    : "-"}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-slate-400 text-[10px] flex items-center justify-center gap-1 mb-0.5">
                                                <ArrowUp className="w-3 h-3 text-amber-400" /> Max
                                            </div>
                                            <div className={`font-bold ${getLatencyTextColor(selectedRegionDetail.max_response_time_ms)}`}>
                                                {selectedRegionDetail.max_response_time_ms !== null
                                                    ? `${selectedRegionDetail.max_response_time_ms}ms`
                                                    : "-"}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Response History Telemetry Chart */}
                                    <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h5 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                                                <BarChart3 className={`w-3.5 h-3.5 ${getLatencyTextColor(selectedRegionDetail.avg_response_time_ms ?? selectedRegionDetail.response_time_ms)}`} />
                                                Latency History
                                            </h5>
                                            <span className="text-[10px] text-slate-400 font-mono">
                                                {selectedRegionDetail.history?.length || 0} samples
                                            </span>
                                        </div>

                                        {selectedRegionDetail.history && selectedRegionDetail.history.length > 0 ? (
                                            <div className="h-20 flex items-end gap-1 pt-3 pb-0.5 px-0.5">
                                                {selectedRegionDetail.history.map((pt, idx) => {
                                                    const isDown = pt.status === "down";
                                                    const ms = pt.response_time_ms || 0;
                                                    const maxVal = Math.max(
                                                        ...selectedRegionDetail.history!.map(
                                                            (h) => h.response_time_ms || 0
                                                        ),
                                                        100
                                                    );
                                                    const heightPct = isDown
                                                        ? 100
                                                        : Math.max((ms / maxVal) * 100, 12);

                                                    return (
                                                        <div
                                                            key={pt.id || idx}
                                                            className="flex-1 min-w-[6px] group/bar relative flex flex-col justify-end h-full"
                                                        >
                                                            <div
                                                                className={`w-full rounded-t transition-all ${getLatencyBarBg(pt.response_time_ms, isDown)}`}
                                                                style={{ height: `${heightPct}%` }}
                                                            />
                                                            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover/bar:flex flex-col bg-slate-900 text-[10px] p-1 rounded border border-slate-700 whitespace-nowrap z-30 shadow-lg pointer-events-none">
                                                                <span className={`font-bold ${isDown ? "text-rose-400" : getLatencyTextColor(pt.response_time_ms)}`}>
                                                                    {isDown ? "DOWN" : `${ms} ms`}
                                                                </span>
                                                                <span className="text-slate-400 text-[9px]">
                                                                    {pt.checked_at
                                                                        ? new Date(pt.checked_at).toLocaleTimeString([], {
                                                                            hour: "2-digit",
                                                                            minute: "2-digit",
                                                                        })
                                                                        : ""}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="py-4 text-center text-[11px] text-slate-500">
                                                Telemetry points accumulating...
                                            </div>
                                        )}
                                    </div>

                                    {/* Recent Incidents */}
                                    {selectedRegionDetail.recent_incidents &&
                                        selectedRegionDetail.recent_incidents.length > 0 && (
                                            <div className="p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-2">
                                                <h5 className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                                                    Incidents
                                                </h5>
                                                <div className="space-y-1.5">
                                                    {selectedRegionDetail.recent_incidents.map((inc) => (
                                                        <div
                                                            key={inc.id}
                                                            className="p-2 bg-slate-900/60 rounded-lg text-[11px] flex justify-between items-start border border-rose-500/10"
                                                        >
                                                            <div className="font-medium text-rose-300 truncate pr-2">
                                                                {inc.error_message}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 shrink-0">
                                                                {inc.checked_at ? (
                                                                    <DateTimeDisplay value={inc.checked_at} />
                                                                ) : (
                                                                    "-"
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                </>
                            ) : null}
                        </div>

                        {/* Sidebar Footer */}
                        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end text-[11px] text-slate-400 shrink-0">
                            <button
                                onClick={() => {
                                    setSelectedRegionCode(null);
                                    setSelectedRegionDetail(null);
                                }}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Region Selector Pills (Below Map) */}
            <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {regions.map((region) => {
                    const geo = getRegionGeoInfo(region.region);
                    const status = getMarkerStatus(region);
                    const colors = getStatusColor(status);
                    const isSelected = selectedRegionCode === region.region;

                    return (
                        <button
                            key={region.region}
                            onClick={() => handleSelectRegion(region.region)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border backdrop-blur-md ${isSelected
                                ? "bg-slate-800 border-sky-500 text-white shadow-[0_0_15px_rgba(56,189,248,0.2)]"
                                : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
                                }`}
                        >
                            {geo && (
                                <img
                                    src={`https://flagcdn.com/${geo.countryCode}.svg`}
                                    alt={region.region}
                                    className="w-4 h-3 object-cover rounded-sm"
                                />
                            )}
                            <span>{region.region_name}</span>
                            <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: colors.fill }}
                            />
                            {region.response_time_ms !== null && (
                                <span className={`text-[11px] font-bold ${getLatencyTextColor(region.response_time_ms)}`}>
                                    {region.response_time_ms}ms
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
