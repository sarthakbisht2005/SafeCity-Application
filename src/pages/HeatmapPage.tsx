import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/services/api';
import type { HeatmapPoint } from '@/types';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Settings2, RotateCcw } from 'lucide-react';

const riskColors = {
  low: { fill: '#22c55e', stroke: '#16a34a', bg: 'bg-success/10', text: 'text-success' },
  medium: { fill: '#f59e0b', stroke: '#d97706', bg: 'bg-warning/10', text: 'text-warning' },
  high: { fill: '#ef4444', stroke: '#dc2626', bg: 'bg-emergency/10', text: 'text-emergency' },
};

function getRisk(intensity: number) {
  if (intensity >= 0.7) return 'high';
  if (intensity >= 0.4) return 'medium';
  return 'low';
}

function getColor(intensity: number) {
  return riskColors[getRisk(intensity)];
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

export default function HeatmapPage() {
  const [points, setPoints] = useState<HeatmapPoint[]>([]);
  const [filter, setFilter] = useState('all');
  const [timePeriod, setTimePeriod] = useState('all');
  const [loadError, setLoadError] = useState('');
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  // Tunable danger-zone thresholds (persisted)
  const DEFAULT_THRESHOLDS = { high: 50, medium: 25 };
  const [thresholds, setThresholds] = useState<{ high: number; medium: number }>(() => {
    try {
      const raw = localStorage.getItem('heatmap-thresholds');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.high === 'number' && typeof parsed.medium === 'number') return parsed;
      }
    } catch { /* ignore */ }
    return DEFAULT_THRESHOLDS;
  });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    try { localStorage.setItem('heatmap-thresholds', JSON.stringify(thresholds)); } catch { /* ignore */ }
  }, [thresholds]);

  const setHigh = (v: number) => {
    setThresholds(t => ({ high: v, medium: Math.min(t.medium, v - 1) }));
  };
  const setMedium = (v: number) => {
    setThresholds(t => ({ medium: v, high: Math.max(t.high, v + 1) }));
  };
  const resetThresholds = () => setThresholds(DEFAULT_THRESHOLDS);

  const fetchData = useCallback(async () => {
    try {
      const days = timePeriod === 'all' ? null : Number(timePeriod.replace('d', ''));
      const data = await api.getHeatmapData(days, filter === 'all' ? null : filter);
      setPoints(data);
      setLoadError('');
    } catch {
      setPoints([]);
      setLoadError('Aggregated heatmap data is unavailable. Check that the latest Supabase migrations have been applied.');
    }
  }, [filter, timePeriod]);

  useEffect(() => {
    void fetchData();
    const interval = window.setInterval(() => void fetchData(), 60_000);
    return () => window.clearInterval(interval);
  }, [fetchData]);

  // Map init
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current).setView([30.3165, 78.0322], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  const filteredPoints = useMemo(() => {
    if (filter === 'all') return points;
    return points.filter(p => p.type === filter);
  }, [points, filter]);

  const dangerZones = useMemo(() => {
    const grid = new Map<string, { lat: number; lng: number; count: number; intensitySum: number }>();
    filteredPoints.forEach(point => {
      const key = `${point.lat.toFixed(2)}_${point.lng.toFixed(2)}`;
      const count = point.incidentCount || 0;
      const cell = grid.get(key) || { lat: point.lat, lng: point.lng, count: 0, intensitySum: 0 };
      cell.count += count;
      cell.intensitySum += point.intensity * count;
      grid.set(key, cell);
    });
    return Array.from(grid.values()).map(z => {
      const averageIntensity = z.count ? z.intensitySum / z.count : 0;
      const score = Math.min(100, Math.round(z.count * 6 + averageIntensity * 20));
      const level: 'high' | 'medium' | 'low' =
        score >= thresholds.high ? 'high' : score >= thresholds.medium ? 'medium' : 'low';
      return { ...z, score, level };
    });
  }, [filteredPoints, thresholds]);

  const areaStats = useMemo(() => {
    const map = new Map<string, { incidents: number; highestRisk: string; types: Set<string> }>();
    filteredPoints.forEach(p => {
      const name = `Approx. area (${p.lat.toFixed(2)}, ${p.lng.toFixed(2)})`;
      const existing = map.get(name) || { incidents: 0, highestRisk: 'low', types: new Set<string>() };
      existing.incidents += (p.incidentCount || 1);
      existing.types.add(p.type);
      const risk = getRisk(p.intensity);
      if (risk === 'high' || (risk === 'medium' && existing.highestRisk === 'low')) {
        existing.highestRisk = risk;
      }
      map.set(name, existing);
    });
    return Array.from(map.entries())
      .map(([name, data]) => ({ name, ...data, types: Array.from(data.types) }))
      .sort((a, b) => b.incidents - a.incidents);
  }, [filteredPoints]);

  // Update map markers
  useEffect(() => {
    if (!layerGroupRef.current) return;
    layerGroupRef.current.clearLayers();

    // Danger zone overlays
    dangerZones.forEach(z => {
      const color = z.level === 'high' ? '#ef4444' : z.level === 'medium' ? '#f59e0b' : '#22c55e';
      const advice = z.level === 'high'
        ? 'Police surveillance required'
        : z.level === 'medium'
        ? 'Be cautious'
        : 'Safe area';
      L.circle([z.lat, z.lng], {
        radius: 450,
        color,
        fillColor: color,
        fillOpacity: 0.12,
        weight: 1.5,
        dashArray: z.level === 'high' ? '4,4' : undefined,
      })
        .bindTooltip(
          `<div style="padding:6px"><div style="font-weight:700;text-transform:capitalize;color:${color}">${z.level} risk zone</div><div style="font-size:12px">Risk score: ${z.score}/100</div><div style="font-size:12px">${z.count} incident(s)</div><div style="font-size:12px;margin-top:4px;font-style:italic">${advice}</div></div>`,
          { direction: 'top' }
        )
        .addTo(layerGroupRef.current!);
    });

    filteredPoints.forEach(point => {
      const colors = getColor(point.intensity);
      const risk = getRisk(point.intensity);
      const areaName = escapeHtml(point.areaName || 'Unknown Area');
      const incidents = point.incidentCount || 1;

      const tooltipContent = `
        <div style="padding:8px;min-width:180px">
          <div style="font-weight:700;font-size:14px;margin-bottom:6px">${areaName}</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:2px"><span style="color:#888">Crime Type</span><span style="text-transform:capitalize">${escapeHtml(point.type)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:2px"><span style="color:#888">Risk Level</span><span style="text-transform:capitalize;color:${colors.fill}">${risk}</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:2px"><span style="color:#888">Incidents</span><span>${incidents}</span></div>
          <div style="display:flex;justify-content:space-between"><span style="color:#888">Intensity</span><span>${(point.intensity * 100).toFixed(0)}%</span></div>
        </div>
      `;

      L.circleMarker([point.lat, point.lng], {
        radius: point.intensity * 25 + 8,
        fillColor: colors.fill,
        color: colors.stroke,
        weight: 2,
        fillOpacity: 0.4,
      })
        .bindTooltip(tooltipContent, { permanent: false, direction: 'top', className: 'heatmap-tooltip', offset: [0, -10] })
        .addTo(layerGroupRef.current!);
    });

  }, [filteredPoints, dangerZones]);

  const types = ['all', 'theft', 'assault', 'vandalism', 'robbery', 'fraud', 'harassment'];
  const totalIncidents = areaStats.reduce((sum, a) => sum + a.incidents, 0);
  const highRiskAreas = areaStats.filter(a => a.highestRisk === 'high').length;
  const dangerHigh = dangerZones.filter(z => z.level === 'high').length;
  const categoryStats = useMemo(() => {
    const counts = new Map<string, number>();
    filteredPoints.forEach(point => counts.set(point.type, (counts.get(point.type) || 0) + (point.incidentCount || 0)));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredPoints]);

  return (
    <div className="min-h-screen py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold mb-2">Crime Heatmap</h1>
        <p className="text-muted-foreground mb-6">Approximate, aggregated reports; new submissions may be unverified</p>
        {loadError && <p role="alert" className="text-sm text-destructive mb-4">{loadError}</p>}

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="stat-card text-center">
            <div className="text-2xl font-bold text-primary">{totalIncidents}</div>
            <div className="text-sm text-muted-foreground">Reports Shown</div>
          </div>
          <div className="stat-card text-center">
            <div className="text-2xl font-bold text-emergency">{highRiskAreas}</div>
            <div className="text-sm text-muted-foreground">High Report Areas</div>
          </div>
          <div className="stat-card text-center">
            <div className="text-2xl font-bold text-success">{areaStats.length}</div>
            <div className="text-sm text-muted-foreground">Approximate Areas</div>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {/* Crime type filter */}
          <div className="flex flex-wrap gap-2">
            {types.map(t => (
              <button key={t} onClick={() => setFilter(t)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
                  filter === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-accent'
                }`}>
                {t}
              </button>
            ))}
          </div>

          {/* Time period filter */}
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Time period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Legend + threshold settings */}
        <div className="glass-card rounded-2xl p-4 mb-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full bg-success" />
              <span className="font-medium">Low</span>
              <span className="text-muted-foreground text-xs">score &lt; {thresholds.medium}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full bg-warning" />
              <span className="font-medium">Medium</span>
              <span className="text-muted-foreground text-xs">{thresholds.medium}–{thresholds.high - 1}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full bg-emergency" />
              <span className="font-medium">High</span>
              <span className="text-muted-foreground text-xs">≥ {thresholds.high}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="font-medium">Incident marker</span>
            </div>
            <button
              onClick={() => setShowSettings(s => !s)}
              className="ml-auto flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-secondary hover:bg-accent transition-colors"
            >
              <Settings2 className="w-4 h-4" />
              {showSettings ? 'Hide' : 'Tune'} thresholds
            </button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
              </span>
              Periodic updates
            </div>
          </div>

          {showSettings && (
            <div className="mt-4 pt-4 border-t border-border space-y-4">
              <p className="text-xs text-muted-foreground">
                Risk score uses aggregated report count and average severity, capped at 100.
                A zone is flagged High if its score ≥ <span className="font-semibold">{thresholds.high}</span> and Medium if ≥ <span className="font-semibold">{thresholds.medium}</span>.
              </p>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <label className="font-medium flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emergency" />
                    High risk threshold
                  </label>
                  <span className="font-mono text-emergency">{thresholds.high}</span>
                </div>
                <Slider
                  value={[thresholds.high]}
                  min={10}
                  max={100}
                  step={1}
                  onValueChange={(v) => setHigh(v[0])}
                />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <label className="font-medium flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-warning" />
                    Medium risk threshold
                  </label>
                  <span className="font-mono text-warning">{thresholds.medium}</span>
                </div>
                <Slider
                  value={[thresholds.medium]}
                  min={1}
                  max={99}
                  step={1}
                  onValueChange={(v) => setMedium(v[0])}
                />
              </div>
              <button
                onClick={resetThresholds}
                className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-accent transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to defaults (50 / 25)
              </button>
            </div>
          )}
        </div>

        {/* Map */}
        <div ref={mapContainerRef} className="w-full h-[500px] rounded-2xl overflow-hidden glass-card mb-8" />

        {/* Aggregate summaries */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="glass-card rounded-2xl p-5">
            <h3 className="font-semibold mb-1">Approximate Risk Areas</h3>
            <p className="text-sm text-muted-foreground mb-3">Risk-scored clusters from aggregated reports</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-emergency/10">
                <div className="text-2xl font-bold text-emergency">{dangerHigh}</div>
                <div className="text-xs text-muted-foreground">High</div>
              </div>
              <div className="p-3 rounded-xl bg-warning/10">
                <div className="text-2xl font-bold text-warning">{dangerZones.filter(z => z.level === 'medium').length}</div>
                <div className="text-xs text-muted-foreground">Medium</div>
              </div>
              <div className="p-3 rounded-xl bg-success/10">
                <div className="text-2xl font-bold text-success">{dangerZones.filter(z => z.level === 'low').length}</div>
                <div className="text-xs text-muted-foreground">Low</div>
              </div>
            </div>
            {dangerHigh > 0 && (
              <div className="mt-3 text-xs text-emergency font-medium">🚨 {dangerHigh} zone(s) require police surveillance</div>
            )}
          </div>

          <div className="glass-card rounded-2xl p-5">
            <h3 className="font-semibold mb-1">Report Categories</h3>
            <p className="text-sm text-muted-foreground mb-3">Categories are grouped by approximate area; reports may not be verified</p>
            <div className="space-y-2">
              {categoryStats.map(([category, count]) => (
                <div key={category} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{category}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
              ))}
              {categoryStats.length === 0 && <p className="text-sm text-muted-foreground">No reports match the selected filters.</p>}
            </div>
          </div>
        </div>

        {/* Area Stats Panel */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="text-xl font-bold mb-4">Area-wise Crime Statistics</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {areaStats.map((area, i) => {
              const riskStyle = riskColors[area.highestRisk as keyof typeof riskColors];
              return (
                <motion.div key={area.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{area.name}</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${riskStyle.bg} ${riskStyle.text}`}>
                      {area.highestRisk}
                    </span>
                  </div>
                  <div className="text-2xl font-bold mb-1">{area.incidents}</div>
                  <div className="text-sm text-muted-foreground mb-2">incidents reported</div>
                  <div className="flex flex-wrap gap-1">
                    {area.types.map(t => (
                      <span key={t} className="text-xs bg-accent px-2 py-0.5 rounded capitalize">{t}</span>
                    ))}
                  </div>
                </motion.div>
              );
            })}
            {areaStats.length === 0 && <p className="text-sm text-muted-foreground">No reports match the selected filters.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
