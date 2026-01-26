import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, NavLink } from 'react-router-dom';
import { LayoutDashboard, Layers, Map as MapIcon, Key, Menu, X, Bell, User, Globe } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import LayerManagement from './pages/LayerManagement';
import MapBuilder from './pages/MapBuilder';
import KeyManagement from './pages/KeyManagement';
import BasemapManagement from './pages/BasemapManagement';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 p-6 flex flex-col gap-8 transition-transform duration-300 lg:translate-x-0 lg:static
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
              <MapIcon size={24} className="text-white" />
            </div>
            <span className="font-bold text-2xl tracking-tight text-slate-800">MapViewer</span>
          </div>
          <button className="lg:hidden text-slate-400" onClick={() => setSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>

        <nav className="flex flex-col gap-2">
          <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <NavItem to="/layers" icon={<Layers size={20} />} label="Layers" />
          <NavItem to="/basemaps" icon={<Globe size={20} />} label="Basemaps" />
          <NavItem to="/maps" icon={<MapIcon size={20} />} label="Maps" />
          <NavItem to="/keys" icon={<Key size={20} />} label="API Keys" />
        </nav>

        <div className="mt-auto p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-slate-600">All Systems Operational</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-600"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold text-slate-800 hidden sm:block">Admin Console</h1>
          </div>

          <div className="flex items-center gap-3 lg:gap-6">
            <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all">
              <Bell size={20} />
            </button>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-slate-800 leading-none">Admin User</p>
                <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-wider">Superadmin</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                <User size={20} />
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8 flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

const NavItem = ({ to, icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `
      flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300
      ${isActive
        ? 'sidebar-active shadow-blue-200'
        : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}
    `}
  >
    {icon}
    <span className="font-semibold">{label}</span>
  </NavLink>
);

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/layers" element={<LayerManagement />} />
          <Route path="/basemaps" element={<BasemapManagement />} />
          <Route path="/maps" element={<MapBuilder />} />
          <Route path="/keys" element={<KeyManagement />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
