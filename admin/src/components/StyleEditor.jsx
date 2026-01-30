import React, { useState, useEffect } from 'react';
import { Palette, Circle, Type, Layout, ChevronDown, ChevronRight } from 'lucide-react';

const StyleEditor = ({ value, onChange, availableFields }) => {
    // Parse initial value if string
    const initialStyle = typeof value === 'string' ? (value ? JSON.parse(value) : {}) : (value || {});

    const [style, setStyle] = useState({
        fill: { color: 'rgba(255, 255, 255, 0.4)' },
        stroke: { color: '#3399CC', width: 1.25 },
        circle: { radius: 5, fill: { color: '#3399CC' }, stroke: { color: '#fff', width: 1 } },
        label: { field: '', font: '13px Calibri,sans-serif', color: '#000', haloColor: '#fff', haloWidth: 3 },
        ...initialStyle
    });

    const [activeSection, setActiveSection] = useState('polygon'); // polygon, line, point, label

    useEffect(() => {
        onChange(style);
    }, [style]);

    const updateStyle = (section, key, val) => {
        setStyle(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: val
            }
        }));
    };

    const updateNestedStyle = (section, subsection, key, val) => {
        setStyle(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [subsection]: {
                    ...prev[section]?.[subsection],
                    [key]: val
                }
            }
        }));
    };

    return (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex border-b border-slate-200 bg-white">
                <button
                    type="button"
                    onClick={() => setActiveSection('polygon')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeSection === 'polygon' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <Layout size={14} /> Fill
                </button>
                <button
                    type="button"
                    onClick={() => setActiveSection('line')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeSection === 'line' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <Palette size={14} /> Stroke
                </button>
                <button
                    type="button"
                    onClick={() => setActiveSection('point')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeSection === 'point' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <Circle size={14} /> Point
                </button>
                <button
                    type="button"
                    onClick={() => setActiveSection('label')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeSection === 'label' ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <Type size={14} /> Label
                </button>
            </div>

            <div className="p-4">
                {/* Polygon / Fill Section */}
                {activeSection === 'polygon' && (
                    <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-700">Fill Color</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={style.fill?.color || ''}
                                    onChange={(e) => updateStyle('fill', 'color', e.target.value)}
                                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
                                    placeholder="rgba(255, 255, 255, 0.4)"
                                />
                                <input
                                    type="color"
                                    value={style.fill?.color?.startsWith('#') ? style.fill.color : '#ffffff'}
                                    onChange={(e) => updateStyle('fill', 'color', e.target.value)} // Sets Hex
                                    className="w-8 h-8 cursor-pointer rounded-lg border border-slate-200 p-0.5"
                                    title="Pick a color (Hex)"
                                />
                            </div>
                            <p className="text-[10px] text-slate-400">Supports RGBA (text) or Hex (picker).</p>
                        </div>
                    </div>
                )}

                {/* Line / Stroke Section */}
                {activeSection === 'line' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-700">Stroke Color</label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={style.stroke?.color || '#3399CC'}
                                        onChange={(e) => updateStyle('stroke', 'color', e.target.value)}
                                        className="w-full h-8 cursor-pointer rounded-lg border border-slate-200 p-0.5"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-700">Width (px)</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={style.stroke?.width || 1.25}
                                    onChange={(e) => updateStyle('stroke', 'width', parseFloat(e.target.value))}
                                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Point / Circle Section */}
                {activeSection === 'point' && (
                    <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-700">Radius</label>
                            <input
                                type="number"
                                min="1"
                                value={style.circle?.radius || 5}
                                onChange={(e) => updateStyle('circle', 'radius', parseInt(e.target.value))}
                                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-700">Point Fill</label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={style.circle?.fill?.color || '#3399CC'}
                                        onChange={(e) => updateNestedStyle('circle', 'fill', 'color', e.target.value)}
                                        className="w-full h-8 cursor-pointer rounded-lg border border-slate-200 p-0.5"
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-700">Point Stroke</label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={style.circle?.stroke?.color || '#ffffff'}
                                        onChange={(e) => updateNestedStyle('circle', 'stroke', 'color', e.target.value)}
                                        className="w-full h-8 cursor-pointer rounded-lg border border-slate-200 p-0.5"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Label Section */}
                {activeSection === 'label' && (
                    <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-700">Label Field</label>
                            {availableFields && availableFields.length > 0 ? (
                                <select
                                    value={style.label?.field || ''}
                                    onChange={(e) => updateStyle('label', 'field', e.target.value)}
                                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-blue-500"
                                >
                                    <option value="">-- No Label --</option>
                                    {availableFields.map(f => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    placeholder="Attribute name (e.g. name)"
                                    value={style.label?.field || ''}
                                    onChange={(e) => updateStyle('label', 'field', e.target.value)}
                                    className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs"
                                />
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-700">Text Color</label>
                                <input
                                    type="color"
                                    value={style.label?.color || '#000000'}
                                    onChange={(e) => updateStyle('label', 'color', e.target.value)}
                                    className="w-full h-8 cursor-pointer rounded-lg border border-slate-200 p-0.5"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-bold text-slate-700">Halo Color</label>
                                <input
                                    type="color"
                                    value={style.label?.haloColor || '#ffffff'}
                                    onChange={(e) => updateStyle('label', 'haloColor', e.target.value)}
                                    className="w-full h-8 cursor-pointer rounded-lg border border-slate-200 p-0.5"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-slate-700">Font</label>
                            <input
                                type="text"
                                value={style.label?.font || '13px Calibri,sans-serif'}
                                onChange={(e) => updateStyle('label', 'font', e.target.value)}
                                className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
                            />
                        </div>
                    </div>
                )}
            </div>
            {/* Real-time JSON Preview (Optional/Debug) */}
            {/* <div className="bg-slate-900 p-4 border-t border-slate-800">
                <code className="text-[10px] text-green-400 font-mono block whitespace-pre-wrap">
                    {JSON.stringify(style, null, 2)}
                </code>
            </div> */}
        </div>
    );
};

export default StyleEditor;
