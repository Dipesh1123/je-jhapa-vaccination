import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { Dashboard } from './pages/Dashboard'
import { Palika } from './pages/Palika'
import { Ward } from './pages/Ward'
import { Downloads } from './pages/Downloads'
import { Spinner } from './components/Spinner'

// maplibre-gl alone is ~460KB gzipped - split it into its own chunk so a
// dashboard-only visit (the common case) never downloads the map engine.
const MapView = lazy(() => import('./pages/MapView').then((m) => ({ default: m.MapView })))

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="map" element={<Suspense fallback={<div className="p-6"><Spinner /></div>}><MapView /></Suspense>} />
          <Route path="palika/:code" element={<Palika />} />
          <Route path="ward/:code" element={<Ward />} />
          <Route path="downloads" element={<Downloads />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
