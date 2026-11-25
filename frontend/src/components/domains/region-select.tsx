import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { getRegionGeoInfo } from './regional-monitoring';
import type { MonitoringRegion } from '../../services/api-service';

export function RegionSelect({
    regions,
    selectedRegion,
    onChange,
    hideAllOption = false
}: {
    regions: MonitoringRegion[];
    selectedRegion: string;
    onChange: (val: string) => void;
    hideAllOption?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const normSelectedRegion = selectedRegion ? selectedRegion.trim().toLowerCase() : (hideAllOption ? '' : 'all');

    const selected = (normSelectedRegion === 'all' && !hideAllOption)
        ? { aws_region: 'all', name: 'All Regions' }
        : regions.find(r => r.aws_region?.trim().toLowerCase() === normSelectedRegion) || regions[0] || { aws_region: selectedRegion, name: selectedRegion || 'Unknown' };

    const selectedGeo = selected.aws_region !== 'all' ? getRegionGeoInfo(selected.aws_region) : null;

    return (
        <div className="relative text-xs sm:text-sm z-10" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 bg-slate-900 border border-slate-800 text-slate-300 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 hover:bg-slate-800 focus:ring-1 focus:ring-sky-500 transition-colors w-40 sm:w-48 justify-between shadow-sm"
            >
                <div className="flex items-center gap-2.5 truncate">
                    {selectedGeo ? (
                        <img
                            src={`https://flagcdn.com/${selectedGeo.countryCode}.svg`}
                            alt={selectedGeo.countryName}
                            className="w-4 h-3 object-cover rounded-sm opacity-90"
                        />
                    ) : (
                        <Globe className="w-4 h-4 text-slate-400" />
                    )}
                    <span className="truncate">{selected.name}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
            </button>

            {open && (
                <div className="absolute top-full right-0 mt-1.5 w-48 sm:w-56 bg-slate-900 border border-slate-700/80 rounded-lg shadow-2xl z-50 overflow-hidden">
                    <div className="max-h-86 overflow-y-auto py-1 custom-scrollbar">
                        {!hideAllOption && (
                            <button
                                type="button"
                                onClick={() => { onChange('all'); setOpen(false); }}
                                className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-slate-800/80 transition-colors ${normSelectedRegion === 'all' ? 'bg-slate-800/50 text-sky-400' : 'text-slate-300'}`}
                            >
                                <Globe className="w-4 h-4 text-slate-400" />
                                <span>All Regions</span>
                            </button>
                        )}
                        {regions.map(r => {
                            const geo = getRegionGeoInfo(r.aws_region);
                            const isSelected = normSelectedRegion === (r.aws_region ? r.aws_region.trim().toLowerCase() : '');
                            return (
                                <button
                                    key={r.aws_region}
                                    type="button"
                                    onClick={() => { onChange(r.aws_region); setOpen(false); }}
                                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-slate-800/80 transition-colors ${isSelected ? 'bg-slate-800/50 text-sky-400' : 'text-slate-300'}`}
                                >
                                    {geo ? (
                                        <img
                                            src={`https://flagcdn.com/${geo.countryCode}.svg`}
                                            alt={geo.countryName}
                                            className="w-4 h-3 object-cover rounded-sm opacity-90"
                                        />
                                    ) : (
                                        <Globe className="w-4 h-4 text-slate-500" />
                                    )}
                                    <span className="truncate">{r.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

