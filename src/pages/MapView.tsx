import { useEffect, useRef, useState } from 'react'
// v6 is ESM-only with no default export - namespace import is required
// (import maplibregl from 'maplibre-gl' silently breaks the build).
import * as maplibregl from 'maplibre-gl'
import type { Map as MlMap, Popup } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Link } from 'react-router-dom'
import { Table } from 'lucide-react'
import { api, type MapData, type PalikaRow, type WardRow } from '../lib/api'
import { coverageFillExpression } from '../lib/geo'
import { sequentialBlue } from '../lib/palette'
import { formatNumeral } from '../lib/nepali'
import { useLang, type Lang, type TranslationKey } from '../lib/i18n'
import { ErrorBanner } from '../components/ErrorBanner'
import { Spinner } from '../components/Spinner'

// Jhapa district's exact bounding box, computed from
// public/data/jhapa-palikas.geojson (scripts/build_palika_geojson.py).
// [[west, south], [east, north]]
const JHAPA_BOUNDS: [[number, number], [number, number]] = [
  [87.6383, 26.3608],
  [88.1906, 26.8055],
]

// Keeps panning from wandering off into the rest of Nepal or India. The
// district mask (below) is what actually guarantees only Jhapa is ever
// visible regardless of zoom/pan, so this only needs enough room that the
// zoom-out control has real headroom before MapLibre's own maxBounds-derived
// zoom floor kicks in - a tight box here was capping zoom-out after one
// click, which read as the control being broken.
const MAX_BOUNDS: [[number, number], [number, number]] = [
  [86.9, 25.7],
  [88.9, 27.4],
]

// Free, no-API-key basemap - keeps this at $0 like everything else here.
const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/bright'

// maplibre-gl resolves its worker script relative to its own bundled
// chunk's import.meta.url at runtime, which Vite can't statically pick up
// as a build asset - the request 404s, and the SPA catch-all rewrite
// masks that 404 by serving index.html, which then fails as invalid JS.
// Point it at the copy of maplibre-gl-worker.mjs checked into public/
// instead (see package.json's postinstall / the file's own header).
maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs')

type Layer = 'palika' | 'ward'

export function MapView() {
  const { lang, t } = useLang()
  // The mousemove/hover handlers below are attached once, inside an effect
  // that only re-runs when the map data changes - not on every render - so
  // a closure capturing `t`/`lang` directly would freeze at whatever
  // language was active on first load. A ref always reads the current
  // translator at hover time instead.
  const i18nRef = useRef({ lang, t })
  useEffect(() => { i18nRef.current = { lang, t } }, [lang, t])

  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const popupRef = useRef<Popup | null>(null)

  const [data, setData] = useState<MapData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [layer, setLayer] = useState<Layer>('palika')
  const [wardGeoAvailable, setWardGeoAvailable] = useState<boolean | null>(null)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    api.map().then(setData).catch((e) => setError(String(e)))
    // Ward boundaries are a known gap (see plan risk #2) - probe once so the
    // toggle can disable itself instead of silently failing on click.
    fetch('/data/jhapa-wards.geojson', { method: 'HEAD' })
      .then((r) => setWardGeoAvailable(r.ok))
      .catch(() => setWardGeoAvailable(false))
  }, [])

  // Map init - once.
  useEffect(() => {
    if (!containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      bounds: JHAPA_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      maxBounds: MAX_BOUNDS,
    })
    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.on('load', () => {
      // Defensive: the container sits inside several flex/percentage
      // ancestors (masthead + sidebar layout). A resize once the style is
      // actually ready is cheap insurance against maplibre-gl having
      // latched onto a size from an earlier layout pass.
      map.resize()
      setMapReady(true)
    })
    mapRef.current = map
    popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false })
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // District mask - hides everything outside Jhapa completely (a world
  // rectangle with the district's own outline cut out as a hole, see
  // scripts/build_jhapa_mask.py). Fully opaque: only Jhapa itself is
  // visible, nothing from neighbouring districts shows through. Independent
  // of `data`/facility state, so it appears immediately once the map itself
  // is ready.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    fetch('/data/jhapa-mask.geojson')
      .then((r) => r.json())
      .then((geojson: GeoJSON.FeatureCollection) => {
        if (map.getSource('jhapa-mask')) return
        map.addSource('jhapa-mask', { type: 'geojson', data: geojson })
        map.addLayer({
          id: 'jhapa-mask-fill',
          type: 'fill',
          source: 'jhapa-mask',
          paint: { 'fill-color': '#f8fafc', 'fill-opacity': 1 },
        })
      })
      .catch((e) => setError(String(e)))
  }, [mapReady])

  // Palika choropleth + facility points - added once data and map are both ready.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !data) return

    fetch('/data/jhapa-palikas.geojson')
      .then((r) => r.json())
      .then((geojson: GeoJSON.FeatureCollection) => {
        const byCode = new Map(data.palikas.map((p: PalikaRow) => [p.local_level_code, p]))
        for (const f of geojson.features) {
          const code = f.properties?.code as string
          const row = byCode.get(code)
          f.properties = { ...f.properties, coverage_pct: row?.coverage_pct ?? 0, total_doses: row?.total_doses ?? 0 }
        }

        if (map.getSource('palikas')) {
          ;(map.getSource('palikas') as maplibregl.GeoJSONSource).setData(geojson)
        } else {
          map.addSource('palikas', { type: 'geojson', data: geojson })
          map.addLayer({
            id: 'palikas-fill',
            type: 'fill',
            source: 'palikas',
            paint: { 'fill-color': coverageFillExpression('coverage_pct'), 'fill-opacity': 0.75 },
          })
          map.addLayer({
            id: 'palikas-outline',
            type: 'line',
            source: 'palikas',
            paint: { 'line-color': '#ffffff', 'line-width': 1 },
          })

          map.on('mousemove', 'palikas-fill', (e) => {
            map.getCanvas().style.cursor = 'pointer'
            const f = e.features?.[0]
            if (!f || !popupRef.current) return
            const p = f.properties as { name: string; coverage_pct: number; total_doses: number }
            const { lang: l, t: tr } = i18nRef.current
            popupRef.current
              .setLngLat(e.lngLat)
              .setHTML(
                `<div style="font-family:'Noto Sans Devanagari',sans-serif;font-size:13px">
                   <strong>${p.name}</strong><br/>
                   ${tr('popupProgress')}: ${formatNumeral(p.coverage_pct.toFixed(1), l)}%<br/>
                   ${tr('popupVaccinated')}: ${formatNumeral(Math.round(p.total_doses).toLocaleString(), l)}
                 </div>`
              )
              .addTo(map)
          })
          map.on('mouseleave', 'palikas-fill', () => {
            map.getCanvas().style.cursor = ''
            popupRef.current?.remove()
          })
        }
      })
      .catch((e) => setError(String(e)))
  }, [mapReady, data])

  // Ward choropleth - same pattern as the palika layer, joined on ward_code.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !data || !wardGeoAvailable) return

    fetch('/data/jhapa-wards.geojson')
      .then((r) => r.json())
      .then((geojson: GeoJSON.FeatureCollection) => {
        const byCode = new Map(data.wards.map((w: WardRow) => [w.ward_code, w]))
        for (const f of geojson.features) {
          const code = f.properties?.code as string
          const row = byCode.get(code)
          f.properties = {
            ...f.properties,
            local_level_name: row?.local_level_name ?? '',
            coverage_pct: row?.coverage_pct ?? 0,
            total_doses: row?.total_doses ?? 0,
          }
        }

        if (map.getSource('wards')) {
          ;(map.getSource('wards') as maplibregl.GeoJSONSource).setData(geojson)
        } else {
          map.addSource('wards', { type: 'geojson', data: geojson })
          map.addLayer({
            id: 'wards-fill',
            type: 'fill',
            source: 'wards',
            layout: { visibility: 'none' },
            paint: { 'fill-color': coverageFillExpression('coverage_pct'), 'fill-opacity': 0.75 },
          })
          map.addLayer({
            id: 'wards-outline',
            type: 'line',
            source: 'wards',
            layout: { visibility: 'none' },
            paint: { 'line-color': '#ffffff', 'line-width': 0.75 },
          })

          map.on('mousemove', 'wards-fill', (e) => {
            map.getCanvas().style.cursor = 'pointer'
            const f = e.features?.[0]
            if (!f || !popupRef.current) return
            const p = f.properties as { local_level_name: string; ward_no: number; coverage_pct: number; total_doses: number }
            const { lang: l, t: tr } = i18nRef.current
            popupRef.current
              .setLngLat(e.lngLat)
              .setHTML(
                `<div style="font-family:'Noto Sans Devanagari',sans-serif;font-size:13px">
                   <strong>${p.local_level_name} ${tr('wardLabel', { n: formatNumeral(p.ward_no, l) })}</strong><br/>
                   ${tr('popupProgress')}: ${formatNumeral(p.coverage_pct.toFixed(1), l)}%<br/>
                   ${tr('popupVaccinated')}: ${formatNumeral(Math.round(p.total_doses).toLocaleString(), l)}
                 </div>`
              )
              .addTo(map)
          })
          map.on('mouseleave', 'wards-fill', () => {
            map.getCanvas().style.cursor = ''
            popupRef.current?.remove()
          })
        }
      })
      .catch((e) => setError(String(e)))
  }, [mapReady, data, wardGeoAvailable])

  // Toggle which choropleth is visible - both layer pairs stay loaded, only
  // their `visibility` layout property flips, so switching back and forth
  // is instant and never re-fetches.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    for (const id of ['palikas-fill', 'palikas-outline']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', layer === 'palika' ? 'visible' : 'none')
    }
    for (const id of ['wards-fill', 'wards-outline']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', layer === 'ward' ? 'visible' : 'none')
    }
  }, [layer, mapReady, data, wardGeoAvailable])

  // Facility points.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !data) return

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: data.facilities.map((f) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [f.facility_lon, f.facility_lat] },
        properties: { name: f.facility_name || null, doses: f.total_doses },
      })),
    }

    if (map.getSource('facilities')) {
      ;(map.getSource('facilities') as maplibregl.GeoJSONSource).setData(geojson)
    } else {
      map.addSource('facilities', { type: 'geojson', data: geojson })
      map.addLayer({
        id: 'facilities-point',
        type: 'circle',
        source: 'facilities',
        paint: {
          'circle-radius': 4,
          'circle-color': '#ffffff',
          'circle-stroke-color': '#1e293b',
          'circle-stroke-width': 1.5,
        },
      })
      map.on('mousemove', 'facilities-point', (e) => {
        map.getCanvas().style.cursor = 'pointer'
        const f = e.features?.[0]
        if (!f || !popupRef.current) return
        const p = f.properties as { name: string | null; doses: number }
        const { lang: l, t: tr } = i18nRef.current
        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(`<div style="font-family:'Noto Sans Devanagari',sans-serif;font-size:13px"><strong>${p.name || tr('unnamedFacility')}</strong><br/>${tr('popupDoses')}: ${formatNumeral(p.doses, l)}</div>`)
          .addTo(map)
      })
      map.on('mouseleave', 'facilities-point', () => {
        map.getCanvas().style.cursor = ''
        popupRef.current?.remove()
      })
    }
  }, [mapReady, data])

  if (error) return <div className="p-6"><ErrorBanner message={error} /></div>

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 md:p-6 pb-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">{t('mapTitle')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t('mapSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white border border-slate-200 rounded-lg p-0.5">
            <button
              onClick={() => setLayer('palika')}
              className={`px-3 py-1.5 text-sm rounded-md ${layer === 'palika' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-500'}`}
            >
              {t('layerLocalLevel')}
            </button>
            <button
              onClick={() => wardGeoAvailable && setLayer('ward')}
              disabled={!wardGeoAvailable}
              title={wardGeoAvailable === false ? t('wardGeoUnavailable') : undefined}
              className={`px-3 py-1.5 text-sm rounded-md ${layer === 'ward' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-500'} ${!wardGeoAvailable ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {t('layerWard')}
            </button>
          </div>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline">
            <Table size={15} /> {t('viewAsTable')}
          </Link>
        </div>
      </div>

      {!wardGeoAvailable && layer === 'ward' && (
        <div className="mx-4 md:mx-6 mb-2">
          <WardFallbackTable palikas={data?.palikas ?? []} lang={lang} t={t} />
        </div>
      )}

      <div className="relative flex-1">
        {!data && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
            <Spinner />
          </div>
        )}
        {/* maplibre-gl.css defines `.maplibregl-map { position: relative }`,
            and maplibre-gl adds that exact class to whatever element it's
            given as `container`. Bundled into the same stylesheet as
            Tailwind, that rule has equal specificity to `.absolute` and can
            win the cascade by source order, silently turning this div's
            position back to relative and collapsing its height to 0 (no
            content, no explicit height). Giving maplibre its own nested
            plain div - sized with width/height instead of position - avoids
            the collision entirely. */}
        <div className="absolute inset-0">
          <div ref={containerRef} className="w-full h-full" />
        </div>
        <Legend lang={lang} t={t} />
      </div>
    </div>
  )
}

function Legend({ lang, t }: { lang: Lang; t: (key: TranslationKey) => string }) {
  const steps: [number, string][] = [
    [0, sequentialBlue[100]], [20, sequentialBlue[250]], [40, sequentialBlue[350]],
    [60, sequentialBlue[450]], [80, sequentialBlue[550]], [100, sequentialBlue[700]],
  ]
  return (
    <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur rounded-lg border border-slate-200 px-3 py-2 shadow-sm">
      <p className="text-xs font-medium text-slate-600 mb-1.5">{t('legendProgress')}</p>
      <div className="flex items-center gap-0.5">
        {steps.map(([pct, color]) => (
          <div key={pct} className="w-6 h-3" style={{ backgroundColor: color }} title={`${pct}%`} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
        <span>{formatNumeral(0, lang)}%</span>
        <span>{formatNumeral(100, lang)}%</span>
      </div>
    </div>
  )
}

// Ward geometry is a documented gap (plan risk #2) - a sortable heat-table
// stands in for the choropleth until official ward boundaries are available.
function WardFallbackTable({ palikas, lang, t }: { palikas: PalikaRow[]; lang: Lang; t: (key: TranslationKey, vars?: Record<string, string | number>) => string }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
      {t('wardFallbackMsg')}
      <Link to="/" className="underline font-medium">{t('wardFallbackLink')}</Link>
      {palikas.length > 0 && (
        <span className="block mt-1 text-amber-700">
          {t('wardFallbackCount', { n: formatNumeral(palikas.length, lang) })}
        </span>
      )}
    </div>
  )
}
