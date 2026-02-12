import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { CaseProvider } from '@/context/CaseContext'
import { APIProvider } from '@/context/APIContext'
import { LoadingPage } from '@/components/ui/LoadingPage'
import MainLayout from './layouts/MainLayout'

// Lazy load pages
const CasesPage = lazy(() => import('./pages/CasesPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const IleappPage = lazy(() => import('./pages/IleappPage'))
const AleappPage = lazy(() => import('./pages/AleappPage'))
const BackupPage = lazy(() => import('./pages/BackupPage'))
const SpatialPage = lazy(() => import('./pages/SpatialPage'))
const TimelinePage = lazy(() => import('./pages/TimelinePage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

function App() {
    return (
        <APIProvider>
            <CaseProvider>
                <Suspense fallback={<LoadingPage />}>
                    <Routes>
                        {/* Root redirect */}
                        <Route path="/" element={<Navigate to="/cases" replace />} />

                        {/* Cases page (no sidebar) */}
                        <Route path="/cases" element={<CasesPage />} />

                        {/* Settings page (no sidebar) */}
                        <Route path="/settings" element={<SettingsPage />} />

                        {/* Main layout routes (with sidebar) */}
                        <Route element={<MainLayout />}>
                            <Route path="/dashboard" element={<DashboardPage />} />
                            <Route path="/reports" element={<ReportsPage />} />
                            <Route path="/ileapp" element={<IleappPage />} />
                            <Route path="/aleapp" element={<AleappPage />} />
                            <Route path="/backup" element={<BackupPage />} />
                            <Route path="/spatial" element={<SpatialPage />} />
                            <Route path="/timeline" element={<TimelinePage />} />
                        </Route>
                    </Routes>
                </Suspense>
            </CaseProvider>
        </APIProvider>
    )
}

export default App
