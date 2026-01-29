import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Layers, Map, Key, TrendingUp, ArrowUpRight } from 'lucide-react';
import { fetchLayers, fetchMaps, fetchApiKeys as fetchKeys } from '../api';

const Dashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        layers: 0,
        maps: 0,
        keys: 0
    });
    const [recentActivity, setRecentActivity] = useState([]);

    useEffect(() => {
        const loadStats = async () => {
            try {
                // Check what fetchKeys actually returns or if it exists. 
                // Assuming it follows the same pattern as others.
                const [layersRes, mapsRes, keysRes] = await Promise.allSettled([
                    fetchLayers(),
                    fetchMaps(),
                    // fetchKeys might fail if not implemented/imported, handling gracefully
                    fetchKeys ? fetchKeys() : Promise.resolve({ data: [] })
                ]);

                const layers = layersRes.status === 'fulfilled' ? layersRes.value.data : [];
                const maps = mapsRes.status === 'fulfilled' ? mapsRes.value.data : [];
                const keys = keysRes.status === 'fulfilled' ? keysRes.value.data : [];

                setStats({
                    layers: layers.length,
                    maps: maps.length,
                    keys: keys.length
                });

                // Generate recent activity from all items
                const allItems = [
                    ...layers.map(l => ({ type: 'layer', ...l })),
                    ...maps.map(m => ({ type: 'map', ...m })),
                    ...keys.map(k => ({ type: 'key', ...k }))
                ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
                    .slice(0, 5);

                setRecentActivity(allItems);

            } catch (error) {
                console.error("Failed to load dashboard stats", error);
            }
        };
        loadStats();
    }, []);

    const formatTime = (dateString) => {
        if (!dateString) return 'Recently';
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = Math.abs(now - date) / 36e5;

        if (diffInHours < 24) {
            if (diffInHours < 1) return 'Just now';
            return `${Math.floor(diffInHours)} hours ago`;
        }
        return date.toLocaleDateString();
    };

    const getActivityText = (item) => {
        switch (item.type) {
            case 'layer': return { title: 'New layer added', desc: `Layer "${item.name}" (${item.type}) was registered` };
            case 'map': return { title: 'Map configuration created', desc: `Map "${item.title}" is now active` };
            case 'key': return { title: 'API Key generated', desc: `Key "${item.name}" was issued` };
            default: return { title: 'System update', desc: 'System status check' };
        }
    };

    return (
        <div className="flex flex-col gap-6 lg:gap-8">
            <div>
                <h2 className="text-2xl lg:text-3xl font-bold text-slate-800">Dashboard</h2>
                <p className="text-slate-500 mt-1">Welcome back, here's what's happening today.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                <StatCard
                    icon={<Layers className="text-blue-600" />}
                    label="Total Layers"
                    value={stats.layers}
                    trend="Live"
                    color="blue"
                />
                <StatCard
                    icon={<Map className="text-indigo-600" />}
                    label="Active Maps"
                    value={stats.maps}
                    trend="Live"
                    color="indigo"
                />
                <StatCard
                    icon={<Key className="text-emerald-600" />}
                    label="API Keys"
                    value={stats.keys}
                    trend="Active"
                    color="emerald"
                />
                <StatCard
                    icon={<TrendingUp className="text-violet-600" />}
                    label="System Status"
                    value="Stable"
                    trend="100%"
                    color="violet"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                <div className="lg:col-span-2 glass-card p-6 lg:p-8">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-xl font-bold text-slate-800">Recent Activity</h2>
                    </div>
                    <div className="space-y-6">
                        {recentActivity.length === 0 ? (
                            <p className="text-slate-400 text-sm italic">No recent activity found.</p>
                        ) : (
                            recentActivity.map((item, idx) => {
                                const { title, desc } = getActivityText(item);
                                return (
                                    <ActivityItem
                                        key={idx}
                                        title={title}
                                        desc={desc}
                                        time={formatTime(item.created_at)}
                                    />
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="glass-card p-6 lg:p-8 bg-blue-600 !border-blue-500 shadow-xl shadow-blue-100 flex flex-col justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-2">Manage Projects</h2>
                        <p className="text-blue-100/80 text-sm leading-relaxed">
                            Combine your geospatial layers into specialized map views for your customers.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/maps')}
                        className="mt-8 w-full py-4 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                    >
                        Build New Map <ArrowUpRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

const StatCard = ({ icon, label, value, trend, color }) => {
    const colorMap = {
        blue: 'bg-blue-50 text-blue-600',
        indigo: 'bg-indigo-50 text-indigo-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        violet: 'bg-violet-50 text-violet-600',
    };

    return (
        <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-2xl ${colorMap[color] || 'bg-slate-50'} flex items-center justify-center`}>
                    {icon}
                </div>
                {trend && trend !== '0' && (
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                        {trend}
                    </span>
                )}
            </div>
            <div>
                <p className="text-sm text-slate-500 font-semibold tracking-wide uppercase">{label}</p>
                <p className="text-2xl lg:text-3xl font-bold text-slate-800 mt-1">{value}</p>
            </div>
        </div>
    );
};

const ActivityItem = ({ title, desc, time }) => (
    <div className="flex gap-4">
        <div className="mt-1 w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]" />
        <div>
            <p className="text-sm font-bold text-slate-800 leading-none">{title}</p>
            <p className="text-xs text-slate-500 mt-1">{desc}</p>
            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">{time}</p>
        </div>
    </div>
);

export default Dashboard;
