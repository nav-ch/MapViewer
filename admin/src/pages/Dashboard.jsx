import React from 'react';
import { Box, Layers, Map, Key, TrendingUp, ArrowUpRight } from 'lucide-react';

const Dashboard = () => {
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
                    value="12"
                    trend="+2"
                    color="blue"
                />
                <StatCard
                    icon={<Map className="text-indigo-600" />}
                    label="Active Maps"
                    value="4"
                    trend="0"
                    color="indigo"
                />
                <StatCard
                    icon={<Key className="text-emerald-600" />}
                    label="API Keys"
                    value="3"
                    trend="+1"
                    color="emerald"
                />
                <StatCard
                    icon={<TrendingUp className="text-violet-600" />}
                    label="Total Traffic"
                    value="1.2k"
                    trend="+18%"
                    color="violet"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                <div className="lg:col-span-2 glass-card p-6 lg:p-8">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-xl font-bold text-slate-800">Recent Activity</h2>
                        <button className="text-sm font-bold text-blue-600 hover:text-blue-700">View All</button>
                    </div>
                    <div className="space-y-6">
                        <ActivityItem
                            title="New layer created"
                            desc="Vegetation Index layer was added for the Sales Map"
                            time="2 hours ago"
                        />
                        <ActivityItem
                            title="API Key generated"
                            desc="New key issued for Mobile Site"
                            time="5 hours ago"
                        />
                        <ActivityItem
                            title="Map updated"
                            desc="Retail Locations Map configuration updated"
                            time="Yesterday"
                        />
                    </div>
                </div>

                <div className="glass-card p-6 lg:p-8 bg-blue-600 !border-blue-500 shadow-xl shadow-blue-100 flex flex-col justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-2">Manage Projects</h2>
                        <p className="text-blue-100/80 text-sm leading-relaxed">
                            Combine your geospatial layers into specialized map views for your customers.
                        </p>
                    </div>
                    <button className="mt-8 w-full py-4 bg-white text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-all flex items-center justify-center gap-2">
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
