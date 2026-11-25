// Configuration - Change this to switch between variants
const RING_VARIANT = 'doubleRing'; // See all options below

type RingVariant =
    | 'doubleRing' | 'boldGlow' | 'segmented' | 'minimal' | 'hexagon'
    | 'dualArc' | 'starburst' | 'liquidFill' | 'circuit' | 'orbital'
    | 'trophy' | 'powerUp' | 'crystal' | 'shield' | 'speedometer'
    | 'pixel' | 'spiral' | 'pulse' | 'lightning' | 'gear'
    // NEW VARIANTS
    | 'radar' | 'constellation' | 'thermometer' | 'dna' | 'equalizer'
    | 'compass' | 'halo' | 'matrix' | 'hourglass' | 'vortex';

interface ScoreRingProps {
    score: number | null;
    variant?: RingVariant;
}

export const ScoreRing = ({ score, variant = RING_VARIANT }: ScoreRingProps) => {
    if (typeof score !== 'number' || Number.isNaN(score)) return <span className="text-slate-500">-</span>;

    // Shared gradient definitions
    const getGradientId = () => {
        if (score >= 90) return 'gradient-excellent';
        if (score >= 75) return 'gradient-great';
        if (score >= 60) return 'gradient-good';
        if (score >= 40) return 'gradient-average';
        return 'gradient-poor';
    };

    const gradientId = getGradientId();

    // Shared SVG gradients
    const gradientDefs = (
        <defs>
            <linearGradient id="gradient-excellent" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
            <linearGradient id="gradient-great" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="50%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
            <linearGradient id="gradient-good" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#fb923c" />
            </linearGradient>
            <linearGradient id="gradient-average" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fb923c" />
                <stop offset="50%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
            <linearGradient id="gradient-poor" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="50%" stopColor="#f43f5e" />
                <stop offset="100%" stopColor="#e11d48" />
            </linearGradient>
            {/* Radial gradient for glow effect */}
            <radialGradient id={`glow-${gradientId}`}>
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
            {/* Filter for drop shadow */}
            <filter id="glow-filter">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
            </filter>
        </defs>
    );

    // Variant 1: Double Ring (Original)
    const DoubleRingVariant = () => {
        const outerCircumference = 2 * Math.PI * 15.9155;
        const outerOffset = outerCircumference - (score / 100) * outerCircumference;
        const innerCircumference = 2 * Math.PI * 12.5;
        const innerOffset = innerCircumference - (score / 100) * innerCircumference;

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                {gradientDefs}
                <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#1e293b" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round" opacity="0.25" />
                <circle cx="18" cy="18" r="15.9155" fill="none" stroke={`url(#${gradientId})`} strokeWidth="2" strokeLinecap="round" strokeDasharray="3 5" strokeDashoffset={outerOffset} className="transition-all duration-700 ease-out" />
                <circle cx="18" cy="18" r="12.5" fill="none" stroke="#1e293b" strokeWidth="1.5" opacity="0.2" />
                <circle cx="18" cy="18" r="12.5" fill="none" stroke={`url(#${gradientId})`} strokeWidth="1.5" strokeLinecap="round" strokeDasharray={innerCircumference} strokeDashoffset={innerOffset} opacity="0.5" className="transition-all duration-700 ease-out" />
            </svg>
        );
    };

    // Variant 2: Bold Ring with Glow
    const BoldGlowVariant = () => {
        const circumference = 2 * Math.PI * 14;
        const offset = circumference - (score / 100) * circumference;

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                {gradientDefs}
                <circle cx="18" cy="18" r="16" fill={`url(#glow-${gradientId})`} opacity="0.3" className="transition-all duration-700" />
                <circle cx="18" cy="18" r="14" fill="none" stroke="#1e293b" strokeWidth="4" opacity="0.3" />
                <circle cx="18" cy="18" r="14" fill="none" stroke={`url(#${gradientId})`} strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} filter="url(#glow-filter)" className="transition-all duration-700 ease-out" />
            </svg>
        );
    };

    // Variant 3: Segmented Ring
    const SegmentedVariant = () => {
        const segments = 20;
        const segmentAngle = 360 / segments;
        const filledSegments = Math.floor((score / 100) * segments);

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                {gradientDefs}
                {Array.from({ length: segments }).map((_, i) => {
                    const angle = i * segmentAngle;
                    const isFilled = i < filledSegments;
                    const radius = 14;
                    const x1 = 18 + radius * Math.cos((angle - 4) * Math.PI / 180);
                    const y1 = 18 + radius * Math.sin((angle - 4) * Math.PI / 180);
                    const x2 = 18 + radius * Math.cos((angle + 4) * Math.PI / 180);
                    const y2 = 18 + radius * Math.sin((angle + 4) * Math.PI / 180);

                    return (
                        <path
                            key={i}
                            d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`}
                            fill="none"
                            stroke={isFilled ? `url(#${gradientId})` : '#1e293b'}
                            strokeWidth="3"
                            strokeLinecap="round"
                            opacity={isFilled ? 1 : 0.2}
                            className="transition-all duration-700 ease-out"
                            style={{ transitionDelay: `${i * 20}ms` }}
                        />
                    );
                })}
            </svg>
        );
    };

    // Variant 4: Minimal Thin Ring
    const MinimalVariant = () => {
        const circumference = 2 * Math.PI * 15;
        const offset = circumference - (score / 100) * circumference;

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                {gradientDefs}
                <circle cx="18" cy="18" r="15" fill="none" stroke="#1e293b" strokeWidth="1.5" opacity="0.25" />
                <circle cx="18" cy="18" r="15" fill="none" stroke={`url(#${gradientId})`} strokeWidth="1.5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-700 ease-out" />
                <circle
                    cx="18"
                    cy="3"
                    r="2"
                    fill={`url(#${gradientId})`}
                    className="transition-all duration-700 ease-out"
                    style={{
                        transformOrigin: '18px 18px',
                        transform: `rotate(${(score / 100) * 360}deg)`
                    }}
                />
            </svg>
        );
    };

    // Variant 5: Hexagon
    const HexagonVariant = () => {
        const createHexagonPath = (radius: number) => {
            const points = [];
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i - Math.PI / 2;
                const x = 18 + radius * Math.cos(angle);
                const y = 18 + radius * Math.sin(angle);
                points.push(`${x},${y}`);
            }
            return `M ${points.join(' L ')} Z`;
        };

        const hexPath = createHexagonPath(13);
        const pathLength = 78;
        const offset = pathLength - (score / 100) * pathLength;

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                <path d={hexPath} fill="none" stroke="#1e293b" strokeWidth="2.5" opacity="0.25" />
                <path
                    d={hexPath}
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={pathLength}
                    strokeDashoffset={offset}
                    className="transition-all duration-700 ease-out"
                />
                {Array.from({ length: 6 }).map((_, i) => {
                    const angle = (Math.PI / 3) * i - Math.PI / 2;
                    const x = 18 + 13 * Math.cos(angle);
                    const y = 18 + 13 * Math.sin(angle);
                    const isFilled = (i / 6) <= (score / 100);

                    return (
                        <circle
                            key={i}
                            cx={x}
                            cy={y}
                            r="1.5"
                            fill={isFilled ? `url(#${gradientId})` : '#1e293b'}
                            opacity={isFilled ? 1 : 0.3}
                            className="transition-all duration-700 ease-out"
                        />
                    );
                })}
            </svg>
        );
    };

    // Variant 6: Dual Arc
    const DualArcVariant = () => {
        const radius = 14;
        const circumference = Math.PI * radius;
        const offset = circumference - (score / 100) * circumference;

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                {gradientDefs}
                <path d="M 18 4 A 14 14 0 0 1 18 32" fill="none" stroke="#1e293b" strokeWidth="3" opacity="0.25" />
                <path d="M 18 32 A 14 14 0 0 1 18 4" fill="none" stroke="#1e293b" strokeWidth="3" opacity="0.25" />
                <path
                    d="M 18 4 A 14 14 0 0 1 18 32"
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className="transition-all duration-700 ease-out"
                />
                <path
                    d="M 18 32 A 14 14 0 0 1 18 4"
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    opacity="0.6"
                    className="transition-all duration-700 ease-out"
                    style={{ transitionDelay: '100ms' }}
                />
            </svg>
        );
    };

    // Variant 7: Starburst
    const StarburstVariant = () => {
        const points = 12;
        const filledPoints = Math.floor((score / 100) * points);

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                <circle cx="18" cy="18" r="8" fill="none" stroke={`url(#${gradientId})`} strokeWidth="1.5" opacity="0.3" />
                {Array.from({ length: points }).map((_, i) => {
                    const angle = (360 / points) * i;
                    const isFilled = i < filledPoints;
                    const x1 = 18 + 9 * Math.cos((angle - 90) * Math.PI / 180);
                    const y1 = 18 + 9 * Math.sin((angle - 90) * Math.PI / 180);
                    const x2 = 18 + 15 * Math.cos((angle - 90) * Math.PI / 180);
                    const y2 = 18 + 15 * Math.sin((angle - 90) * Math.PI / 180);

                    return (
                        <g key={i}>
                            <line
                                x1={x1}
                                y1={y1}
                                x2={x2}
                                y2={y2}
                                stroke={isFilled ? `url(#${gradientId})` : '#1e293b'}
                                strokeWidth={isFilled ? "2.5" : "1.5"}
                                strokeLinecap="round"
                                opacity={isFilled ? 1 : 0.2}
                                className="transition-all duration-500 ease-out"
                                style={{ transitionDelay: `${i * 30}ms` }}
                            />
                            {isFilled && (
                                <circle
                                    cx={x2}
                                    cy={y2}
                                    r="1.5"
                                    fill={`url(#${gradientId})`}
                                    className="transition-all duration-500 ease-out"
                                    style={{ transitionDelay: `${i * 30}ms` }}
                                />
                            )}
                        </g>
                    );
                })}
            </svg>
        );
    };

    // Variant 8: Liquid Fill
    const LiquidFillVariant = () => {
        const fillHeight = (score / 100) * 28;
        const waveOffset = 0;

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                <defs>
                    <clipPath id="circle-clip">
                        <circle cx="18" cy="18" r="14" />
                    </clipPath>
                </defs>
                <circle cx="18" cy="18" r="14" fill="none" stroke="#1e293b" strokeWidth="2" opacity="0.3" />
                <g clipPath="url(#circle-clip)">
                    <rect
                        x="4"
                        y={32 - fillHeight}
                        width="28"
                        height={fillHeight}
                        fill={`url(#${gradientId})`}
                        opacity="0.8"
                        className="transition-all duration-700 ease-out"
                    />
                    <path
                        d={`M 4 ${32 - fillHeight + waveOffset} Q 11 ${32 - fillHeight - 2 + waveOffset}, 18 ${32 - fillHeight + waveOffset} T 32 ${32 - fillHeight + waveOffset} V 32 H 4 Z`}
                        fill={`url(#${gradientId})`}
                        opacity="0.4"
                        className="transition-all duration-700 ease-out"
                    />
                </g>
                <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 14}
                    strokeDashoffset={(2 * Math.PI * 14) - (score / 100) * (2 * Math.PI * 14)}
                    className="transition-all duration-700 ease-out"
                />
            </svg>
        );
    };

    // Variant 9: Circuit
    const CircuitVariant = () => {
        const circumference = 2 * Math.PI * 13;
        const offset = circumference - (score / 100) * circumference;

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-45">
                {gradientDefs}
                {[0, 90, 180, 270].map((angle, i) => {
                    const isFilled = (i / 4) <= (score / 100);
                    return (
                        <g key={angle} transform={`rotate(${angle} 18 18)`}>
                            <line
                                x1="18"
                                y1="2"
                                x2="18"
                                y2="6"
                                stroke={isFilled ? `url(#${gradientId})` : '#1e293b'}
                                strokeWidth="2"
                                strokeLinecap="round"
                                opacity={isFilled ? 1 : 0.2}
                                className="transition-all duration-500 ease-out"
                            />
                            <circle
                                cx="18"
                                cy="2"
                                r="1.5"
                                fill={isFilled ? `url(#${gradientId})` : '#1e293b'}
                                opacity={isFilled ? 1 : 0.2}
                                className="transition-all duration-500 ease-out"
                            />
                        </g>
                    );
                })}
                <circle cx="18" cy="18" r="13" fill="none" stroke="#1e293b" strokeWidth="2" strokeDasharray="10 5" opacity="0.2" />
                <circle cx="18" cy="18" r="13" fill="none" stroke={`url(#${gradientId})`} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="10 5" strokeDashoffset={offset} className="transition-all duration-700 ease-out" />
                <circle cx="18" cy="18" r="9" fill="none" stroke={`url(#${gradientId})`} strokeWidth="0.5" opacity="0.3" />
                <circle cx="18" cy="18" r="6" fill="none" stroke={`url(#${gradientId})`} strokeWidth="0.5" opacity="0.2" />
            </svg>
        );
    };

    // Variant 10: Orbital
    const OrbitalVariant = () => {
        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                <circle cx="18" cy="18" r="14" fill="none" stroke="#1e293b" strokeWidth="1" opacity="0.2" />
                <g className="-rotate-90" style={{ transformOrigin: '18px 18px' }}>
                    <circle cx="18" cy="18" r="12" fill="none" stroke="#1e293b" strokeWidth="2.5" opacity="0.25" />
                    <circle
                        cx="18"
                        cy="18"
                        r="12"
                        fill="none"
                        stroke={`url(#${gradientId})`}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 12}
                        strokeDashoffset={(2 * Math.PI * 12) - (score / 100) * (2 * Math.PI * 12)}
                        className="transition-all duration-700 ease-out"
                    />
                </g>
                {[0, 120, 240].map((angle, i) => {
                    const shouldShow = (i / 3) <= (score / 100);
                    return (
                        <circle
                            key={angle}
                            cx="18"
                            cy="4"
                            r="1.5"
                            fill={shouldShow ? `url(#${gradientId})` : '#1e293b'}
                            opacity={shouldShow ? 1 : 0.2}
                            className="transition-all duration-500"
                            style={{
                                transformOrigin: '18px 18px',
                                transform: `rotate(${angle}deg)`
                            }}
                        />
                    );
                })}
                <circle cx="18" cy="18" r="7" fill={`url(#${gradientId})`} opacity="0.1" />
            </svg>
        );
    };

    // Variant 11: Trophy
    const TrophyVariant = () => {
        const stars = 5;
        const filledStars = Math.ceil((score / 100) * stars);
        const circumference = 2 * Math.PI * 13;
        const offset = circumference - (score / 100) * circumference;

        const createStar = (cx: number, cy: number, size: number) => {
            const points = [];
            for (let i = 0; i < 10; i++) {
                const angle = (Math.PI / 5) * i - Math.PI / 2;
                const radius = i % 2 === 0 ? size : size / 2;
                const x = cx + radius * Math.cos(angle);
                const y = cy + radius * Math.sin(angle);
                points.push(`${x},${y}`);
            }
            return `M ${points.join(' L ')} Z`;
        };

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                <circle cx="18" cy="18" r="13" fill="none" stroke="#1e293b" strokeWidth="2" opacity="0.2" className="-rotate-90" style={{ transformOrigin: '18px 18px' }} />
                <circle
                    cx="18"
                    cy="18"
                    r="13"
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className="transition-all duration-700 ease-out -rotate-90"
                    style={{ transformOrigin: '18px 18px' }}
                />
                {Array.from({ length: stars }).map((_, i) => {
                    const angle = (360 / stars) * i - 90;
                    const x = 18 + 13 * Math.cos((angle * Math.PI) / 180);
                    const y = 18 + 13 * Math.sin((angle * Math.PI) / 180);
                    const isFilled = i < filledStars;

                    return (
                        <path
                            key={i}
                            d={createStar(x, y, 2.5)}
                            fill={isFilled ? `url(#${gradientId})` : '#1e293b'}
                            opacity={isFilled ? 1 : 0.2}
                            className="transition-all duration-500 ease-out"
                            style={{ transitionDelay: `${i * 100}ms` }}
                        />
                    );
                })}
            </svg>
        );
    };

    // Variant 12: Power-Up
    const PowerUpVariant = () => {
        const bars = 8;
        const filledBars = Math.ceil((score / 100) * bars);

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                <circle cx="18" cy="18" r="15" fill={`url(#${gradientId})`} opacity="0.15" className="transition-opacity duration-700" />
                {Array.from({ length: bars }).map((_, i) => {
                    const angle = (360 / bars) * i - 90;
                    const isFilled = i < filledBars;
                    const innerRadius = 10;
                    const outerRadius = 15;
                    const barWidth = 12;

                    const x1 = 18 + innerRadius * Math.cos(((angle - barWidth / 2) * Math.PI) / 180);
                    const y1 = 18 + innerRadius * Math.sin(((angle - barWidth / 2) * Math.PI) / 180);
                    const x2 = 18 + outerRadius * Math.cos(((angle - barWidth / 2) * Math.PI) / 180);
                    const y2 = 18 + outerRadius * Math.sin(((angle - barWidth / 2) * Math.PI) / 180);
                    const x3 = 18 + outerRadius * Math.cos(((angle + barWidth / 2) * Math.PI) / 180);
                    const y3 = 18 + outerRadius * Math.sin(((angle + barWidth / 2) * Math.PI) / 180);
                    const x4 = 18 + innerRadius * Math.cos(((angle + barWidth / 2) * Math.PI) / 180);
                    const y4 = 18 + innerRadius * Math.sin(((angle + barWidth / 2) * Math.PI) / 180);

                    return (
                        <path
                            key={i}
                            d={`M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`}
                            fill={isFilled ? `url(#${gradientId})` : '#1e293b'}
                            opacity={isFilled ? 1 : 0.2}
                            className="transition-all duration-500 ease-out"
                            style={{ transitionDelay: `${i * 50}ms` }}
                        />
                    );
                })}
                <circle cx="18" cy="18" r="8" fill="none" stroke={`url(#${gradientId})`} strokeWidth="1" opacity="0.4" />
            </svg>
        );
    };

    // Variant 13: Crystal
    const CrystalVariant = () => {
        const facets = 8;
        const filledFacets = Math.ceil((score / 100) * facets);

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                {Array.from({ length: facets }).map((_, i) => {
                    const angle1 = (360 / facets) * i;
                    const angle2 = (360 / facets) * (i + 1);
                    const isFilled = i < filledFacets;

                    const x1 = 18 + 14 * Math.cos(((angle1 - 90) * Math.PI) / 180);
                    const y1 = 18 + 14 * Math.sin(((angle1 - 90) * Math.PI) / 180);
                    const x2 = 18 + 14 * Math.cos(((angle2 - 90) * Math.PI) / 180);
                    const y2 = 18 + 14 * Math.sin(((angle2 - 90) * Math.PI) / 180);

                    return (
                        <g key={i}>
                            <path
                                d={`M 18 18 L ${x1} ${y1} L ${x2} ${y2} Z`}
                                fill={isFilled ? `url(#${gradientId})` : '#1e293b'}
                                opacity={isFilled ? 0.6 : 0.15}
                                stroke={isFilled ? `url(#${gradientId})` : '#1e293b'}
                                strokeWidth="0.5"
                                className="transition-all duration-500 ease-out"
                                style={{ transitionDelay: `${i * 60}ms` }}
                            />
                            <line
                                x1="18"
                                y1="18"
                                x2={x1}
                                y2={y1}
                                stroke={isFilled ? `url(#${gradientId})` : '#1e293b'}
                                strokeWidth="1"
                                opacity={isFilled ? 0.8 : 0.2}
                                className="transition-all duration-500 ease-out"
                            />
                        </g>
                    );
                })}
                <circle cx="18" cy="18" r="14" fill="none" stroke={`url(#${gradientId})`} strokeWidth="1.5" opacity="0.6" />
                <circle cx="18" cy="18" r="4" fill={`url(#${gradientId})`} opacity="0.4" />
            </svg>
        );
    };

    // Variant 14: Shield
    const ShieldVariant = () => {
        const createShieldPath = () => {
            return `M 18 4 
                    Q 26 6, 28 12 
                    Q 28 18, 28 24 
                    Q 26 30, 18 32 
                    Q 10 30, 8 24 
                    Q 8 18, 8 12 
                    Q 10 6, 18 4 Z`;
        };

        const layers = 4;
        const filledLayers = Math.ceil((score / 100) * layers);

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                {Array.from({ length: layers }).map((_, i) => {
                    const isFilled = i < filledLayers;
                    const scale = 1 - (i * 0.15);

                    return (
                        <path
                            key={i}
                            d={createShieldPath()}
                            fill="none"
                            stroke={isFilled ? `url(#${gradientId})` : '#1e293b'}
                            strokeWidth="1.5"
                            opacity={isFilled ? (1 - i * 0.2) : 0.15}
                            className="transition-all duration-500 ease-out"
                            style={{
                                transformOrigin: '18px 18px',
                                transform: `scale(${scale})`,
                                transitionDelay: `${i * 100}ms`
                            }}
                        />
                    );
                })}
                <circle
                    cx="18"
                    cy="18"
                    r="5"
                    fill={`url(#${gradientId})`}
                    opacity={score > 50 ? 0.5 : 0.2}
                    className="transition-opacity duration-700"
                />
            </svg>
        );
    };

    // Variant 15: Speedometer
    const SpeedometerVariant = () => {
        const needleAngle = -135 + (270 * score / 100);
        const ticks = 9;

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                <path
                    d="M 6 25 A 13 13 0 1 1 30 25"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="3"
                    opacity="0.2"
                />
                <path
                    d="M 6 25 A 13 13 0 1 1 30 25"
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={13 * Math.PI * 1.5}
                    strokeDashoffset={13 * Math.PI * 1.5 - (score / 100) * 13 * Math.PI * 1.5}
                    className="transition-all duration-700 ease-out"
                />
                {Array.from({ length: ticks }).map((_, i) => {
                    const angle = -135 + (270 / (ticks - 1)) * i;
                    const isFilled = (i / (ticks - 1)) <= (score / 100);
                    const x1 = 18 + 11 * Math.cos((angle * Math.PI) / 180);
                    const y1 = 18 + 11 * Math.sin((angle * Math.PI) / 180);
                    const x2 = 18 + 13 * Math.cos((angle * Math.PI) / 180);
                    const y2 = 18 + 13 * Math.sin((angle * Math.PI) / 180);

                    return (
                        <line
                            key={i}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke={isFilled ? `url(#${gradientId})` : '#1e293b'}
                            strokeWidth={i % 2 === 0 ? "2" : "1"}
                            strokeLinecap="round"
                            opacity={isFilled ? 1 : 0.3}
                            className="transition-all duration-500 ease-out"
                        />
                    );
                })}
                <line
                    x1="18"
                    y1="18"
                    x2={18 + 10 * Math.cos((needleAngle * Math.PI) / 180)}
                    y2={18 + 10 * Math.sin((needleAngle * Math.PI) / 180)}
                    stroke={`url(#${gradientId})`}
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                />
                <circle cx="18" cy="18" r="2" fill={`url(#${gradientId})`} />
            </svg>
        );
    };

    // Variant 16: Pixel
    const PixelVariant = () => {
        const pixels = 16;
        const filledPixels = Math.floor((score / 100) * pixels);

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                {gradientDefs}
                {Array.from({ length: pixels }).map((_, i) => {
                    const angle = (360 / pixels) * i;
                    const isFilled = i < filledPixels;
                    const x = 18 + 12 * Math.cos((angle * Math.PI) / 180);
                    const y = 18 + 12 * Math.sin((angle * Math.PI) / 180);

                    return (
                        <rect
                            key={i}
                            x={x - 1.5}
                            y={y - 1.5}
                            width="3"
                            height="3"
                            fill={isFilled ? `url(#${gradientId})` : '#1e293b'}
                            opacity={isFilled ? 1 : 0.2}
                            className="transition-all duration-500 ease-out"
                            style={{ transitionDelay: `${i * 30}ms` }}
                        />
                    );
                })}
                {Array.from({ length: 12 }).map((_, i) => {
                    const angle = (360 / 12) * i;
                    const isFilled = i < Math.floor((score / 100) * 12);
                    const x = 18 + 7 * Math.cos((angle * Math.PI) / 180);
                    const y = 18 + 7 * Math.sin((angle * Math.PI) / 180);

                    return (
                        <rect
                            key={`inner-${i}`}
                            x={x - 1}
                            y={y - 1}
                            width="2"
                            height="2"
                            fill={isFilled ? `url(#${gradientId})` : '#1e293b'}
                            opacity={isFilled ? 0.6 : 0.15}
                            className="transition-all duration-500 ease-out"
                        />
                    );
                })}
            </svg>
        );
    };

    // Variant 17: Spiral
    const SpiralVariant = () => {
        const createSpiralPath = (startAngle: number, turns: number, progress: number) => {
            const points = [];
            const steps = 50;
            for (let i = 0; i <= steps * progress; i++) {
                const t = i / steps;
                const angle = startAngle + t * turns * 360;
                const radius = 4 + t * 10;
                const x = 18 + radius * Math.cos((angle * Math.PI) / 180);
                const y = 18 + radius * Math.sin((angle * Math.PI) / 180);
                points.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
            }
            return points.join(' ');
        };

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                <path
                    d={createSpiralPath(0, 2, score / 100)}
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="2"
                    strokeLinecap="round"
                    opacity="0.8"
                    className="transition-all duration-700 ease-out"
                />
                <path
                    d={createSpiralPath(180, 2, score / 100)}
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="2"
                    strokeLinecap="round"
                    opacity="0.5"
                    className="transition-all duration-700 ease-out"
                />
                {Array.from({ length: 8 }).map((_, i) => {
                    const t = (i / 7) * (score / 100);
                    const angle = t * 2 * 360;
                    const radius = 4 + t * 10;
                    const x = 18 + radius * Math.cos((angle * Math.PI) / 180);
                    const y = 18 + radius * Math.sin((angle * Math.PI) / 180);
                    const isFilled = i / 7 <= score / 100;

                    return (
                        <circle
                            key={i}
                            cx={x}
                            cy={y}
                            r="1.5"
                            fill={isFilled ? `url(#${gradientId})` : '#1e293b'}
                            opacity={isFilled ? 1 : 0.2}
                            className="transition-all duration-500 ease-out"
                        />
                    );
                })}
            </svg>
        );
    };

    // Variant 18: Pulse
    const PulseVariant = () => {
        const rings = 5;
        const activeRing = Math.floor((score / 100) * rings);

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                {Array.from({ length: rings }).map((_, i) => {
                    const radius = 5 + i * 2.5;
                    const isActive = i <= activeRing;

                    return (
                        <circle
                            key={i}
                            cx="18"
                            cy="18"
                            r={radius}
                            fill="none"
                            stroke={isActive ? `url(#${gradientId})` : '#1e293b'}
                            strokeWidth="1.5"
                            opacity={isActive ? (1 - i * 0.15) : 0.1}
                            className="transition-all duration-700 ease-out"
                            style={{ transitionDelay: `${i * 80}ms` }}
                        />
                    );
                })}
                <path
                    d={`M 4 18 L 10 18 L 12 ${18 - (score / 100) * 8} L 14 ${18 + (score / 100) * 8} L 16 18 L 20 18 L 22 ${18 - (score / 100) * 6} L 24 ${18 + (score / 100) * 6} L 26 18 L 32 18`}
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.6"
                    className="transition-all duration-700 ease-out"
                />
            </svg>
        );
    };

    // Variant 19: Lightning
    const LightningVariant = () => {
        const bolts = 6;
        const activeBolts = Math.ceil((score / 100) * bolts);

        const createBolt = (angle: number) => {
            const x1 = 18 + 5 * Math.cos((angle * Math.PI) / 180);
            const y1 = 18 + 5 * Math.sin((angle * Math.PI) / 180);
            const x2 = 18 + 10 * Math.cos(((angle + 15) * Math.PI) / 180);
            const y2 = 18 + 10 * Math.sin(((angle + 15) * Math.PI) / 180);
            const x3 = 18 + 15 * Math.cos(((angle - 10) * Math.PI) / 180);
            const y3 = 18 + 15 * Math.sin(((angle - 10) * Math.PI) / 180);

            return `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3}`;
        };

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                <circle cx="18" cy="18" r="5" fill={`url(#${gradientId})`} opacity="0.3" />
                <circle cx="18" cy="18" r="5" fill="none" stroke={`url(#${gradientId})`} strokeWidth="1.5" opacity="0.6" />
                {Array.from({ length: bolts }).map((_, i) => {
                    const angle = (360 / bolts) * i;
                    const isActive = i < activeBolts;

                    return (
                        <path
                            key={i}
                            d={createBolt(angle)}
                            fill="none"
                            stroke={isActive ? `url(#${gradientId})` : '#1e293b'}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity={isActive ? 1 : 0.2}
                            className="transition-all duration-500 ease-out"
                            style={{ transitionDelay: `${i * 70}ms` }}
                        />
                    );
                })}
                <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="0.5"
                    opacity={(score / 100) * 0.4}
                    className="transition-all duration-700"
                />
            </svg>
        );
    };

    // Variant 20: Gear
    const GearVariant = () => {
        const teeth = 12;
        const filledTeeth = Math.floor((score / 100) * teeth);

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                {Array.from({ length: teeth }).map((_, i) => {
                    const angle = (360 / teeth) * i - 90;
                    const isFilled = i < filledTeeth;
                    const outerRadius = 14;
                    const innerRadius = 12;
                    const toothWidth = 8;

                    const angle1 = angle;
                    const angle2 = angle1 + toothWidth;
                    const angle3 = angle2 + (360 / teeth - toothWidth * 2) / 2;
                    const angle4 = angle3 + toothWidth;

                    const x1 = 18 + outerRadius * Math.cos((angle1 * Math.PI) / 180);
                    const y1 = 18 + outerRadius * Math.sin((angle1 * Math.PI) / 180);
                    const x2 = 18 + outerRadius * Math.cos((angle2 * Math.PI) / 180);
                    const y2 = 18 + outerRadius * Math.sin((angle2 * Math.PI) / 180);
                    const x3 = 18 + innerRadius * Math.cos((angle2 * Math.PI) / 180);
                    const y3 = 18 + innerRadius * Math.sin((angle2 * Math.PI) / 180);
                    const x4 = 18 + innerRadius * Math.cos((angle4 * Math.PI) / 180);
                    const y4 = 18 + innerRadius * Math.sin((angle4 * Math.PI) / 180);
                    const x5 = 18 + outerRadius * Math.cos((angle4 * Math.PI) / 180);
                    const y5 = 18 + outerRadius * Math.sin((angle4 * Math.PI) / 180);

                    return (
                        <path
                            key={i}
                            d={`M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} L ${x5} ${y5} Z`}
                            fill={isFilled ? `url(#${gradientId})` : '#1e293b'}
                            stroke={isFilled ? `url(#${gradientId})` : '#1e293b'}
                            strokeWidth="0.5"
                            opacity={isFilled ? 0.9 : 0.2}
                            className="transition-all duration-500 ease-out"
                            style={{ transitionDelay: `${i * 40}ms` }}
                        />
                    );
                })}
                <circle cx="18" cy="18" r="6" fill="none" stroke={`url(#${gradientId})`} strokeWidth="2" opacity="0.5" />
                <circle cx="18" cy="18" r="3" fill={`url(#${gradientId})`} opacity="0.4" />
            </svg>
        );
    };

    // ============ 10 NEW VARIANTS ============

    // Variant 21: Radar (Scanning Sweep)
    const RadarVariant = () => {
        const sweepAngle = (score / 100) * 360;
        const gridRings = 3;
        const gridLines = 8;

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                {/* Grid rings */}
                {Array.from({ length: gridRings }).map((_, i) => (
                    <circle
                        key={`ring-${i}`}
                        cx="18"
                        cy="18"
                        r={6 + i * 4}
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth="0.5"
                        opacity="0.3"
                    />
                ))}
                {/* Grid lines */}
                {Array.from({ length: gridLines }).map((_, i) => {
                    const angle = (360 / gridLines) * i;
                    const x = 18 + 14 * Math.cos(((angle - 90) * Math.PI) / 180);
                    const y = 18 + 14 * Math.sin(((angle - 90) * Math.PI) / 180);
                    return (
                        <line
                            key={`line-${i}`}
                            x1="18"
                            y1="18"
                            x2={x}
                            y2={y}
                            stroke="#1e293b"
                            strokeWidth="0.5"
                            opacity="0.2"
                        />
                    );
                })}
                {/* Sweep beam */}
                <path
                    d={`M 18 18 L 18 4 A 14 14 0 0 1 ${18 + 14 * Math.sin((sweepAngle * Math.PI) / 180)} ${18 - 14 * Math.cos((sweepAngle * Math.PI) / 180)} Z`}
                    fill={`url(#${gradientId})`}
                    opacity="0.3"
                    className="transition-all duration-700 ease-out"
                />
                {/* Sweep line */}
                <line
                    x1="18"
                    y1="18"
                    x2={18 + 14 * Math.sin((sweepAngle * Math.PI) / 180)}
                    y2={18 - 14 * Math.cos((sweepAngle * Math.PI) / 180)}
                    stroke={`url(#${gradientId})`}
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                />
                {/* Outer ring */}
                <circle cx="18" cy="18" r="14" fill="none" stroke={`url(#${gradientId})`} strokeWidth="2" opacity="0.6" />
                {/* Center dot */}
                <circle cx="18" cy="18" r="2" fill={`url(#${gradientId})`} />
            </svg>
        );
    };

    // Variant 22: Constellation (Connected Stars)
    const ConstellationVariant = () => {
        const stars = 8;
        const activeStars = Math.floor((score / 100) * stars);

        const starPositions = Array.from({ length: stars }).map((_, i) => {
            const angle = (360 / stars) * i - 90;
            return {
                x: 18 + 12 * Math.cos((angle * Math.PI) / 180),
                y: 18 + 12 * Math.sin((angle * Math.PI) / 180),
                active: i < activeStars
            };
        });

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                {/* Connecting lines */}
                {starPositions.map((star, i) => {
                    if (i === 0) return null;
                    const prevStar = starPositions[i - 1];
                    const isActive = star.active && prevStar.active;
                    return (
                        <line
                            key={`line-${i}`}
                            x1={prevStar.x}
                            y1={prevStar.y}
                            x2={star.x}
                            y2={star.y}
                            stroke={isActive ? `url(#${gradientId})` : '#1e293b'}
                            strokeWidth="1.5"
                            opacity={isActive ? 0.6 : 0.2}
                            className="transition-all duration-500 ease-out"
                            style={{ transitionDelay: `${i * 60}ms` }}
                        />
                    );
                })}
                {/* Stars */}
                {starPositions.map((star, i) => (
                    <g key={`star-${i}`}>
                        <circle
                            cx={star.x}
                            cy={star.y}
                            r="2.5"
                            fill={star.active ? `url(#${gradientId})` : '#1e293b'}
                            opacity={star.active ? 1 : 0.2}
                            className="transition-all duration-500 ease-out"
                            style={{ transitionDelay: `${i * 60}ms` }}
                        />
                        {star.active && (
                            <circle
                                cx={star.x}
                                cy={star.y}
                                r="4"
                                fill="none"
                                stroke={`url(#${gradientId})`}
                                strokeWidth="0.5"
                                opacity="0.5"
                            />
                        )}
                    </g>
                ))}
                {/* Center star */}
                <circle cx="18" cy="18" r="3" fill={`url(#${gradientId})`} opacity="0.4" />
            </svg>
        );
    };

    // Variant 23: Thermometer (Vertical Fill)
    const ThermometerVariant = () => {
        const fillHeight = (score / 100) * 20;

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                {/* Thermometer bulb */}
                <circle cx="18" cy="28" r="5" fill="none" stroke="#1e293b" strokeWidth="2" opacity="0.3" />
                <circle
                    cx="18"
                    cy="28"
                    r="5"
                    fill={`url(#${gradientId})`}
                    opacity="0.6"
                    className="transition-all duration-700"
                />
                {/* Thermometer tube */}
                <rect x="15" y="8" width="6" height="20" rx="3" fill="none" stroke="#1e293b" strokeWidth="2" opacity="0.3" />
                {/* Mercury fill */}
                <rect
                    x="15.5"
                    y={28 - fillHeight}
                    width="5"
                    height={fillHeight}
                    fill={`url(#${gradientId})`}
                    opacity="0.8"
                    className="transition-all duration-700 ease-out"
                />
                {/* Tick marks */}
                {Array.from({ length: 5 }).map((_, i) => {
                    const y = 10 + i * 4;
                    const isFilled = (28 - y) <= fillHeight;
                    return (
                        <line
                            key={i}
                            x1="21"
                            y1={y}
                            x2="23"
                            y2={y}
                            stroke={isFilled ? `url(#${gradientId})` : '#1e293b'}
                            strokeWidth="1"
                            opacity={isFilled ? 1 : 0.3}
                            className="transition-all duration-500 ease-out"
                        />
                    );
                })}
                {/* Outer glow circle */}
                <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="0.5"
                    opacity={(score / 100) * 0.3}
                    className="transition-all duration-700"
                />
            </svg>
        );
    };

    // Variant 24: DNA (Double Helix)
    const DnaVariant = () => {
        const pairs = 6;
        const activePairs = Math.ceil((score / 100) * pairs);

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                {/* DNA strands */}
                <path
                    d="M 12 6 Q 15 10, 12 14 Q 9 18, 12 22 Q 15 26, 12 30"
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="2"
                    opacity="0.6"
                />
                <path
                    d="M 24 6 Q 21 10, 24 14 Q 27 18, 24 22 Q 21 26, 24 30"
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth="2"
                    opacity="0.6"
                />
                {/* Base pairs */}
                {Array.from({ length: pairs }).map((_, i) => {
                    const y = 8 + i * 4;
                    const isActive = i < activePairs;
                    const x1 = 12 + 3 * Math.sin((i * Math.PI) / 2);
                    const x2 = 24 - 3 * Math.sin((i * Math.PI) / 2);

                    return (
                        <g key={i}>
                            <line
                                x1={x1}
                                y1={y}
                                x2={x2}
                                y2={y}
                                stroke={isActive ? `url(#${gradientId})` : '#1e293b'}
                                strokeWidth="1.5"
                                opacity={isActive ? 0.8 : 0.2}
                                className="transition-all duration-500 ease-out"
                                style={{ transitionDelay: `${i * 80}ms` }}
                            />
                            <circle
                                cx={x1}
                                cy={y}
                                r="1.5"
                                fill={isActive ? `url(#${gradientId})` : '#1e293b'}
                                opacity={isActive ? 1 : 0.2}
                                className="transition-all duration-500 ease-out"
                            />
                            <circle
                                cx={x2}
                                cy={y}
                                r="1.5"
                                fill={isActive ? `url(#${gradientId})` : '#1e293b'}
                                opacity={isActive ? 1 : 0.2}
                                className="transition-all duration-500 ease-out"
                            />
                        </g>
                    );
                })}
            </svg>
        );
    };

    // Variant 25: Equalizer (Music Bars)
    const EqualizerVariant = () => {
        const bars = 7;
        const barHeights = Array.from({ length: bars }).map((_, i) => {
            const baseHeight = 4 + (i % 3) * 3;
            const progress = (score / 100) * bars;
            return i < progress ? baseHeight + (score / 100) * 6 : baseHeight;
        });

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                {/* Equalizer bars */}
                {Array.from({ length: bars }).map((_, i) => {
                    const x = 7 + i * 3.5;
                    const height = barHeights[i];
                    const isActive = i < (score / 100) * bars;

                    return (
                        <rect
                            key={i}
                            x={x}
                            y={26 - height}
                            width="2.5"
                            height={height}
                            rx="1"
                            fill={isActive ? `url(#${gradientId})` : '#1e293b'}
                            opacity={isActive ? 1 : 0.2}
                            className="transition-all duration-500 ease-out"
                            style={{ transitionDelay: `${i * 50}ms` }}
                        />
                    );
                })}
                {/* Base line */}
                <line x1="6" y1="27" x2="30" y2="27" stroke="#1e293b" strokeWidth="1" opacity="0.3" />
                {/* Outer ring */}
                <circle cx="18" cy="18" r="15" fill="none" stroke={`url(#${gradientId})`} strokeWidth="1" opacity="0.3" />
            </svg>
        );
    };

    // Variant 26: Compass (Directional Needle)
    const CompassVariant = () => {
        const needleAngle = (score / 100) * 360;
        const directions = ['N', 'E', 'S', 'W'];

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                {/* Outer ring */}
                <circle cx="18" cy="18" r="14" fill="none" stroke="#1e293b" strokeWidth="2" opacity="0.3" />
                <circle cx="18" cy="18" r="14" fill="none" stroke={`url(#${gradientId})`} strokeWidth="2" strokeDasharray="3 3" opacity="0.5" />
                {/* Direction markers */}
                {directions.map((dir, i) => {
                    const angle = i * 90;
                    const x = 18 + 11 * Math.cos(((angle - 90) * Math.PI) / 180);
                    const y = 18 + 11 * Math.sin(((angle - 90) * Math.PI) / 180);
                    const isActive = Math.abs((needleAngle % 360) - angle) < 45 || Math.abs((needleAngle % 360) - angle - 360) < 45;

                    return (
                        <text
                            key={dir}
                            x={x}
                            y={y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill={isActive ? `url(#${gradientId})` : '#1e293b'}
                            opacity={isActive ? 1 : 0.3}
                            fontSize="8"
                            fontWeight="bold"
                            className="transition-all duration-500"
                        >
                            {dir}
                        </text>
                    );
                })}
                {/* Compass needle */}
                <g style={{ transformOrigin: '18px 18px', transform: `rotate(${needleAngle}deg)` }} className="transition-all duration-700 ease-out">
                    <path
                        d="M 18 8 L 20 18 L 18 20 L 16 18 Z"
                        fill={`url(#${gradientId})`}
                        opacity="0.9"
                    />
                    <path
                        d="M 18 28 L 20 18 L 18 16 L 16 18 Z"
                        fill="#1e293b"
                        opacity="0.5"
                    />
                </g>
                {/* Center dot */}
                <circle cx="18" cy="18" r="2" fill={`url(#${gradientId})`} />
            </svg>
        );
    };

    // Variant 27: Halo (Expanding Rings)
    const HaloVariant = () => {
        const halos = 4;
        const activeHalos = Math.ceil((score / 100) * halos);

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                {/* Expanding halos */}
                {Array.from({ length: halos }).map((_, i) => {
                    const radius = 8 + i * 2;
                    const isActive = i < activeHalos;

                    return (
                        <circle
                            key={i}
                            cx="18"
                            cy="18"
                            r={radius}
                            fill="none"
                            stroke={isActive ? `url(#${gradientId})` : '#1e293b'}
                            strokeWidth="2"
                            opacity={isActive ? (1 - i * 0.2) : 0.1}
                            className="transition-all duration-700 ease-out"
                            style={{ transitionDelay: `${i * 100}ms` }}
                        />
                    );
                })}
                {/* Particle ring */}
                {Array.from({ length: 12 }).map((_, i) => {
                    const angle = (360 / 12) * i;
                    const isActive = i < (score / 100) * 12;
                    const radius = 13;
                    const x = 18 + radius * Math.cos(((angle - 90) * Math.PI) / 180);
                    const y = 18 + radius * Math.sin(((angle - 90) * Math.PI) / 180);

                    return (
                        <circle
                            key={i}
                            cx={x}
                            cy={y}
                            r="1"
                            fill={isActive ? `url(#${gradientId})` : '#1e293b'}
                            opacity={isActive ? 1 : 0.2}
                            className="transition-all duration-500 ease-out"
                            style={{ transitionDelay: `${i * 40}ms` }}
                        />
                    );
                })}
                {/* Core */}
                <circle cx="18" cy="18" r="5" fill={`url(#${gradientId})`} opacity="0.4" />
                <circle cx="18" cy="18" r="5" fill="none" stroke={`url(#${gradientId})`} strokeWidth="1.5" opacity="0.8" />
            </svg>
        );
    };

    // Variant 28: Matrix (Digital Grid)
    const MatrixVariant = () => {
        const gridSize = 5;
        const activeCells = Math.floor((score / 100) * gridSize * gridSize);

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                {/* Grid cells */}
                {Array.from({ length: gridSize }).map((_, row) =>
                    Array.from({ length: gridSize }).map((_, col) => {
                        const index = row * gridSize + col;
                        const isActive = index < activeCells;
                        const x = 8 + col * 4;
                        const y = 8 + row * 4;

                        return (
                            <rect
                                key={`${row}-${col}`}
                                x={x}
                                y={y}
                                width="3"
                                height="3"
                                rx="0.5"
                                fill={isActive ? `url(#${gradientId})` : '#1e293b'}
                                opacity={isActive ? (1 - index / (gridSize * gridSize) * 0.5) : 0.2}
                                className="transition-all duration-500 ease-out"
                                style={{ transitionDelay: `${index * 20}ms` }}
                            />
                        );
                    })
                )}
                {/* Outer frame */}
                <rect x="7" y="7" width="22" height="22" fill="none" stroke={`url(#${gradientId})`} strokeWidth="1.5" opacity="0.5" />
                {/* Corner accents */}
                {[[7, 7], [29, 7], [7, 29], [29, 29]].map(([x, y], i) => {
                    const isActive = i < (score / 100) * 4;
                    return (
                        <circle
                            key={i}
                            cx={x}
                            cy={y}
                            r="1.5"
                            fill={isActive ? `url(#${gradientId})` : '#1e293b'}
                            opacity={isActive ? 1 : 0.2}
                            className="transition-all duration-500"
                        />
                    );
                })}
            </svg>
        );
    };

    // Variant 29: Hourglass (Timer Sand)
    const HourglassVariant = () => {
        const topSand = Math.max(0, 100 - score);
        const bottomSand = score;

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                {/* Hourglass frame */}
                <path
                    d="M 12 6 L 24 6 L 18 18 L 24 30 L 12 30 L 18 18 Z"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="2"
                    opacity="0.3"
                />
                {/* Top sand */}
                <path
                    d={`M 12 6 L 24 6 L ${12 + (topSand / 100) * 12} ${6 + (topSand / 100) * 10} L ${24 - (topSand / 100) * 12} ${6 + (topSand / 100) * 10} Z`}
                    fill={`url(#${gradientId})`}
                    opacity="0.6"
                    className="transition-all duration-700 ease-out"
                />
                {/* Bottom sand */}
                <path
                    d={`M 12 30 L 24 30 L ${24 - (bottomSand / 100) * 12} ${30 - (bottomSand / 100) * 10} L ${12 + (bottomSand / 100) * 12} ${30 - (bottomSand / 100) * 10} Z`}
                    fill={`url(#${gradientId})`}
                    opacity="0.8"
                    className="transition-all duration-700 ease-out"
                />
                {/* Falling sand particles */}
                {score > 0 && score < 100 && (
                    <circle
                        cx="18"
                        cy="18"
                        r="0.5"
                        fill={`url(#${gradientId})`}
                        opacity="0.8"
                    />
                )}
                {/* Outer circle */}
                <circle cx="18" cy="18" r="15" fill="none" stroke={`url(#${gradientId})`} strokeWidth="0.5" opacity="0.3" />
            </svg>
        );
    };

    // Variant 30: Vortex (Swirling Spiral)
    const VortexVariant = () => {
        const rings = 5;
        const activeRings = Math.ceil((score / 100) * rings);

        return (
            <svg viewBox="0 0 36 36" className="h-full w-full">
                {gradientDefs}
                {/* Vortex spirals */}
                {Array.from({ length: rings }).map((_, i) => {
                    const radius = 4 + i * 2.5;
                    const isActive = i < activeRings;
                    const rotation = (score / 100) * 180 + i * 30;

                    return (
                        <g
                            key={i}
                            style={{
                                transformOrigin: '18px 18px',
                                transform: `rotate(${rotation}deg)`
                            }}
                            className="transition-all duration-700 ease-out"
                        >
                            <path
                                d={`M 18 ${18 - radius} A ${radius} ${radius} 0 1 1 ${18 + 0.01} ${18 - radius}`}
                                fill="none"
                                stroke={isActive ? `url(#${gradientId})` : '#1e293b'}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeDasharray="5 5"
                                opacity={isActive ? (1 - i * 0.15) : 0.1}
                                className="transition-all duration-700"
                            />
                        </g>
                    );
                })}
                {/* Center vortex */}
                <circle cx="18" cy="18" r="3" fill={`url(#${gradientId})`} opacity="0.6" />
                {/* Outer particles */}
                {Array.from({ length: 8 }).map((_, i) => {
                    const angle = (360 / 8) * i + (score / 100) * 45;
                    const isActive = i < (score / 100) * 8;
                    const x = 18 + 14 * Math.cos(((angle - 90) * Math.PI) / 180);
                    const y = 18 + 14 * Math.sin(((angle - 90) * Math.PI) / 180);

                    return (
                        <circle
                            key={i}
                            cx={x}
                            cy={y}
                            r="1.5"
                            fill={isActive ? `url(#${gradientId})` : '#1e293b'}
                            opacity={isActive ? 1 : 0.2}
                            className="transition-all duration-500 ease-out"
                        />
                    );
                })}
            </svg>
        );
    };

    const variantMap = {
        doubleRing: DoubleRingVariant,
        boldGlow: BoldGlowVariant,
        segmented: SegmentedVariant,
        minimal: MinimalVariant,
        hexagon: HexagonVariant,
        dualArc: DualArcVariant,
        starburst: StarburstVariant,
        liquidFill: LiquidFillVariant,
        circuit: CircuitVariant,
        orbital: OrbitalVariant,
        trophy: TrophyVariant,
        powerUp: PowerUpVariant,
        crystal: CrystalVariant,
        shield: ShieldVariant,
        speedometer: SpeedometerVariant,
        pixel: PixelVariant,
        spiral: SpiralVariant,
        pulse: PulseVariant,
        lightning: LightningVariant,
        gear: GearVariant,
        // NEW VARIANTS
        radar: RadarVariant,
        constellation: ConstellationVariant,
        thermometer: ThermometerVariant,
        dna: DnaVariant,
        equalizer: EqualizerVariant,
        compass: CompassVariant,
        halo: HaloVariant,
        matrix: MatrixVariant,
        hourglass: HourglassVariant,
        vortex: VortexVariant,
    };

    const VariantComponent = variantMap[variant];

    return (
        <div className="relative h-12 w-12">
            <VariantComponent />
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-base font-bold text-slate-100">
                    {score}
                </span>
            </div>
        </div>
    );
};