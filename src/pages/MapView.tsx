import { useEffect, useRef, useState } from 'react'
// v6 is ESM-only with no default export - namespace import is required
// (import maplibregl from 'maplibre-gl' silently breaks the build).
import * as maplibregl from 'maplibre-gl'
import type { Map as MlMap, Popup } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Link } from 'react-router-dom'
import { Table } from 'lucide-react'
import { api, type MapData, type PalikaRow } from '../lib/api'
import { coverageFillExpression } from '../lib/geo'
import { sequentialBlue } from '../lib/palette'
import { toNepaliNumeral } from '../lib/nepali'
import { ErrorBanner } from '../components/ErrorBanner'
import { Spinner } from '../components/Spinner'

// Computed from public/data/jhapa-palikas.geojson's own bounding box - see
// scripts/build_palika_geojson.py.
const JHAPA_CENTER: [number, number] = [87.9145, 26.5831]
const JHAPA_ZOOM = 9.2

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
      center: JHAPA_CENTER,
      zoom: JHAPA_ZOOM,
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
            popupRef.current
              .setLngLat(e.lngLat)
              .setHTML(
                `<div style="font-family:'Noto Sans Devanagari',sans-serif;font-size:13px">
                   <strong>${p.name}</strong><br/>
                   प्रगति: ${p.coverage_pct.toFixed(1)}%<br/>
                   खोप लगाइएको: ${Math.round(p.total_doses).toLocaleString()}
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

  // Facility points.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !data) return

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: data.facilities.map((f) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [f.facility_lon, f.facility_lat] },
        properties: { name: f.facility_name ?? 'नामविहीन संस्था', doses: f.total_doses },
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
        const p = f.properties as { name: string; doses: number }
        popupRef.current
          .setLngLat(e.lngLat)
          .setHTML(`<div style="font-family:'Noto Sans Devanagari',sans-serif;font-size:13px"><strong>${p.name}</strong><br/>खोप: ${p.doses}</div>`)
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
          <h1 className="text-lg font-semibold text-slate-800">नक्सा</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            प्रगति % अनुसार स्थानीय तहको नक्सा र संस्था स्थानहरू
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white border border-slate-200 rounded-lg p-0.5">
            <button
              onClick={() => setLayer('palika')}
              className={`px-3 py-1.5 text-sm rounded-md ${layer === 'palika' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-500'}`}
            >
              स्थानीय तह
            </button>
            <button
              onClick={() => wardGeoAvailable && setLayer('ward')}
              disabled={!wardGeoAvailable}
              title={wardGeoAvailable === false ? 'वडा सीमाना डेटा अझै उपलब्ध छैन' : undefined}
              className={`px-3 py-1.5 text-sm rounded-md ${layer === 'ward' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-500'} ${!wardGeoAvailable ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              वडा
            </button>
          </div>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline">
            <Table size={15} /> तालिका रूपमा हेर्नुहोस्
          </Link>
        </div>
      </div>

      {!wardGeoAvailable && layer === 'ward' && (
        <div className="mx-4 md:mx-6 mb-2">
          <WardFallbackTable palikas={data?.palikas ?? []} />
        </div>
      )}

      <div className="relative flex-1">
        {!data && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10">
            <Spinner />
          </div>
        )}
        <div ref={containerRef} className="absolute inset-0" />
        <Legend />
      </div>
    </div>
  )
}

function Legend() {
  const steps: [number, string][] = [
    [0, sequentialBlue[100]], [20, sequentialBlue[250]], [40, sequentialBlue[350]],
    [60, sequentialBlue[450]], [80, sequentialBlue[550]], [100, sequentialBlue[700]],
  ]
  return (
    <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur rounded-lg border border-slate-200 px-3 py-2 shadow-sm">
      <p className="text-xs font-medium text-slate-600 mb-1.5">प्रगति %</p>
      <div className="flex items-center gap-0.5">
        {steps.map(([pct, color]) => (
          <div key={pct} className="w-6 h-3" style={{ backgroundColor: color }} title={`${pct}%`} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
        <span>{toNepaliNumeral(0)}%</span>
        <span>{toNepaliNumeral(100)}%</span>
      </div>
    </div>
  )
}

// Ward geometry is a documented gap (plan risk #2) - a sortable heat-table
// stands in for the choropleth until official ward boundaries are available.
function WardFallbackTable({ palikas }: { palikas: PalikaRow[] }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
      वडा सीमानाको आधिकारिक डेटा अझै प्राप्त भएको छैन। तल स्थानीय तह अनुसार प्रगति हेर्नुहोस्, वा प्रत्येक
      स्थानीय तहको वडागत तालिकाका लागि{' '}
      <Link to="/" className="underline font-medium">ड्यासबोर्डको तालिका</Link> हेर्नुहोस्।
      {palikas.length > 0 && (
        <span className="block mt-1 text-amber-700">
          ({toNepaliNumeral(palikas.length)} स्थानीय तह उपलब्ध)
        </span>
      )}
    </div>
  )
}
