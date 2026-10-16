import React, { useState } from 'react';
import { Eye, Calculator, Sparkles, MessageCircle, Layers, CheckCircle2, RotateCcw } from 'lucide-react';
import { sampleProducts, branding } from '../mockData';

type Lang = 'en' | 'si' | 'ta';

const translations = {
  en: {
    title: "Virtual Room Visualizer",
    subtitle: "See tiles and bathroom fittings rendered in your dream space before purchasing.",
    wallTiles: "Wall Tiles",
    floorTiles: "Floor Tiles",
    fixtures: "Fixtures & Accents",
    gloss: "Gloss Reflection",
    calcTitle: "Room Tile Calculator",
    roomLength: "Length (Feet)",
    roomWidth: "Width (Feet)",
    wasteMargin: "Include 10% cutting waste",
    calcResult: "Required Tiles",
    cartons: "Cartons (approx)",
    estimatedCost: "Estimated Cost",
    whatsappInquiry: "Inquire on WhatsApp",
    selectedTile: "Current Selection",
    pricePerSqFt: "per sq.ft"
  },
  si: {
    title: "අතථ්‍ය කාමර නිරූපකය",
    subtitle: "මිලදී ගැනීමට පෙර ඔබේ නානකාමරයේ ටයිල් සහ උපකරණ අලංකාරව බලන්න.",
    wallTiles: "බිත්ති ටයිල්",
    floorTiles: "බිම් ටයිල්",
    fixtures: "නානකාමර උපකරණ",
    gloss: "දිලිසෙන පරාවර්තනය",
    calcTitle: "ටයිල් ප්‍රමාණ ගණකය",
    roomLength: "දිග (අඩි)",
    roomWidth: "පළල (අඩි)",
    wasteMargin: "10% අමතර කැපුම් සහිතව",
    calcResult: "අවශ්‍ය ටයිල් ප්‍රමාණය",
    cartons: "පෙට්ටි ගණන",
    estimatedCost: "ඇස්තමේන්තු මුදල",
    whatsappInquiry: "WhatsApp මඟින් විමසන්න",
    selectedTile: "තෝරාගත් ටයිල් එක",
    pricePerSqFt: "වර්ග අඩියකට"
  },
  ta: {
    title: "மெய்நிகர் அறை காட்சிப்படுத்துபவர்",
    subtitle: "வாங்குவதற்கு முன் உங்கள் அறையில் டைல்ஸ் மற்றும் பொருத்துதல்களை பாருங்கள்.",
    wallTiles: "சுவர் டைல்ஸ்",
    floorTiles: "தரை டைல்ஸ்",
    fixtures: "பொருத்துதல்கள்",
    gloss: "பளபளப்பான பிரதிபலிப்பு",
    calcTitle: "டைல் கால்குலேட்டர்",
    roomLength: "நீளம் (அடி)",
    roomWidth: "அகலம் (அடி)",
    wasteMargin: "10% வெட்டு கழிவு சேர்க்கவும்",
    calcResult: "தேவையான டைல்ஸ்",
    cartons: "பெட்டிகள் (சுமார்)",
    estimatedCost: "மதிப்பிடப்பட்ட தொகை",
    whatsappInquiry: "WhatsApp மூலம் விசாரிக்கவும்",
    selectedTile: "தேர்ந்தெடுக்கப்பட்ட டைல்",
    pricePerSqFt: "ஒரு சதுர அடிக்கு"
  }
};

const tileTextures = [
  { id: 'beige', name: 'Royal Spanish Beige', color: '#d9cdb8', pattern: 'radial-gradient(#c2b49d 15%, transparent 16%) 0 0/16px 16px, #d9cdb8', price: 490 },
  { id: 'grey', name: 'Carrara Marble Grey', color: '#c4c8cb', pattern: 'linear-gradient(45deg, #a6abb0 25%, transparent 25%) 0 0/24px 24px, #c4c8cb', price: 580 },
  { id: 'pink', name: 'Moroccan Blush Pink', color: '#ddb5ae', pattern: 'radial-gradient(#caa29b 20%, transparent 20%) 0 0/20px 20px, #ddb5ae', price: 640 },
  { id: 'ivory', name: 'Ivory Pure Porcelain', color: '#f5efe1', pattern: 'linear-gradient(90deg, rgba(200,190,170,0.15) 1px, transparent 1px) 0 0/32px 32px, #f5efe1', price: 520 }
];

export default function RoomVisualizer() {
  const [lang, setLang] = useState<Lang>('en');
  const [wallTile, setWallTile] = useState(tileTextures[0]);
  const [floorTile, setFloorTile] = useState(tileTextures[1]);
  const [glossOn, setGlossOn] = useState(true);
  const [activeFixture, setActiveFixture] = useState<'commode' | 'shower' | 'both'>('both');

  // Calculator state
  const [lengthFt, setLengthFt] = useState('10');
  const [widthFt, setWidthFt] = useState('8');
  const [includeWaste, setIncludeWaste] = useState(true);

  const t = translations[lang];

  const l = parseFloat(lengthFt) || 0;
  const w = parseFloat(widthFt) || 0;
  const rawArea = l * w;
  const totalArea = includeWaste ? Math.ceil(rawArea * 1.1) : Math.ceil(rawArea);
  const cartonsNeeded = Math.ceil(totalArea / 15.5); // standard ~15.5 sq.ft per box for 60x60
  const estimatedCost = totalArea * floorTile.price;

  const handleWhatsApp = () => {
    const text = encodeURIComponent(
      `Hello Royal Bath Hub! I am interested in:
- Wall Tile: ${wallTile.name}
- Floor Tile: ${floorTile.name}
- Room Area: ${totalArea} sq.ft (${cartonsNeeded} cartons)
- Estimated: ${branding.currency_symbol} ${estimatedCost.toLocaleString()}
Please send availability and quote.`
    );
    window.open(`https://wa.me/94777999219?text=${text}`, '_blank');
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-16">
      {/* Header & Lang Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0a140e]/75 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Eye className="w-5 h-5 text-[#d4af37]" />
            {t.title}
          </h2>
          <p className="text-xs text-white/50 mt-1">{t.subtitle}</p>
        </div>

        {/* Trilingual Switcher */}
        <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl p-1">
          <button
            onClick={() => setLang('en')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              lang === 'en' ? 'bg-[#d4af37] text-[#062e21]' : 'text-white/60 hover:text-white'
            }`}
          >
            English
          </button>
          <button
            onClick={() => setLang('si')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              lang === 'si' ? 'bg-[#d4af37] text-[#062e21]' : 'text-white/60 hover:text-white'
            }`}
          >
            සිංහල
          </button>
          <button
            onClick={() => setLang('ta')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              lang === 'ta' ? 'bg-[#d4af37] text-[#062e21]' : 'text-white/60 hover:text-white'
            }`}
          >
            தமிழ்
          </button>
        </div>
      </div>

      {/* Main Grid: Visualizer Scene + Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 3D Perspective Virtual Room */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <div className="relative aspect-[16/10] sm:aspect-[16/11] rounded-2xl overflow-hidden border border-[#d4af37]/40 shadow-2xl bg-black">
            {/* Upper 55%: Wall Plane with Perspective Shading */}
            <div
              className="absolute top-0 inset-x-0 h-[56%] transition-all duration-500 overflow-hidden"
              style={{
                backgroundColor: wallTile.color,
                background: wallTile.pattern
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/30 pointer-events-none" />
              {/* Back wall corner depth line */}
              <div className="absolute top-0 bottom-0 left-1/3 w-px bg-black/20 shadow-md" />
              <div className="absolute top-0 bottom-0 right-1/3 w-px bg-black/20 shadow-md" />
            </div>

            {/* Skirting board */}
            <div className="absolute top-[54.5%] inset-x-0 h-[3%] bg-gradient-to-b from-stone-200 to-stone-400 border-b border-black/30 shadow-md z-10" />

            {/* Lower 45%: Floor Plane with 3D Perspective Transform */}
            <div className="absolute top-[56%] inset-x-0 bottom-0 overflow-hidden" style={{ perspective: '600px' }}>
              <div
                className="absolute -inset-x-1/2 bottom-0 h-[280%] origin-bottom transition-all duration-500"
                style={{
                  transform: 'rotateX(68deg)',
                  backgroundColor: floorTile.color,
                  background: floorTile.pattern,
                  backgroundSize: '40px 40px'
                }}
              >
                {/* Tile grid lines overlay */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.15) 1px, transparent 1px)',
                    backgroundSize: '48px 48px'
                  }}
                />
              </div>

              {/* Gloss reflection overlay */}
              {glossOn && (
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/30 via-white/5 to-transparent transition-opacity duration-300" />
              )}
            </div>

            {/* Bathroom Fixture Overlays (Hand-crafted SVG silhouettes for crisp high fidelity) */}
            <div className="absolute inset-0 pointer-events-none z-20 flex items-end justify-around px-8 pb-4">
              {/* Luxury Commode */}
              {(activeFixture === 'commode' || activeFixture === 'both') && (
                <div className="w-24 sm:w-32 drop-shadow-[0_15px_15px_rgba(0,0,0,0.6)] transition-all transform hover:scale-105 pointer-events-auto">
                  <svg viewBox="0 0 100 120" className="w-full text-white">
                    <rect x="25" y="10" width="50" height="50" rx="8" fill="#fdfdfd" stroke="#cbd5e1" strokeWidth="2" />
                    <rect x="42" y="16" width="16" height="6" rx="3" fill="#d4af37" />
                    <path d="M20 55 C20 90, 80 90, 80 55 Z" fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" />
                    <ellipse cx="50" cy="55" rx="28" ry="12" fill="#e2e8f0" stroke="#64748b" strokeWidth="1.5" />
                    <rect x="30" y="85" width="40" height="30" rx="4" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="2" />
                  </svg>
                  <div className="text-[10px] text-center font-bold tracking-wider text-white bg-black/60 rounded px-1 mt-1">
                    Royal Commode
                  </div>
                </div>
              )}

              {/* Rainfall Shower System */}
              {(activeFixture === 'shower' || activeFixture === 'both') && (
                <div className="w-20 sm:w-28 drop-shadow-[0_15px_15px_rgba(0,0,0,0.6)] mb-8 transition-all transform hover:scale-105 pointer-events-auto">
                  <svg viewBox="0 0 80 140" className="w-full text-amber-300">
                    <rect x="38" y="10" width="4" height="110" fill="#d4af37" />
                    <path d="M40 10 Q65 10 65 30" fill="none" stroke="#d4af37" strokeWidth="4" />
                    <ellipse cx="65" cy="30" rx="14" ry="4" fill="#c9a227" stroke="#e8cf7a" strokeWidth="1" />
                    {/* Water droplets */}
                    <line x1="58" y1="36" x2="58" y2="50" stroke="rgba(255,255,255,0.7)" strokeDasharray="3 3" strokeWidth="1.5" />
                    <line x1="65" y1="36" x2="65" y2="54" stroke="rgba(255,255,255,0.7)" strokeDasharray="3 3" strokeWidth="1.5" />
                    <line x1="72" y1="36" x2="72" y2="48" stroke="rgba(255,255,255,0.7)" strokeDasharray="3 3" strokeWidth="1.5" />
                    {/* Thermostatic mixer handle */}
                    <rect x="32" y="70" width="16" height="8" rx="2" fill="#d4af37" />
                    <circle cx="40" cy="74" r="2" fill="#062e21" />
                  </svg>
                  <div className="text-[10px] text-center font-bold tracking-wider text-white bg-black/60 rounded px-1 mt-1">
                    Brass Rain Shower
                  </div>
                </div>
              )}
            </div>

            {/* Floating Selection Badge */}
            <div className="absolute top-4 left-4 z-30 bg-[#0a140e]/90 border border-[#d4af37]/40 px-3 py-1.5 rounded-xl backdrop-blur-md flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
              <span className="text-xs text-white/90">
                Wall: <strong className="text-[#e8cf7a]">{wallTile.name}</strong> · Floor: <strong className="text-[#e8cf7a]">{floorTile.name}</strong>
              </span>
            </div>

            {/* Controls Bar at bottom-right of viewer */}
            <div className="absolute bottom-4 right-4 z-30 flex items-center gap-2">
              <button
                onClick={() => setGlossOn(!glossOn)}
                className={`px-3 py-1 rounded-lg text-xs font-medium border backdrop-blur-md transition-colors ${
                  glossOn ? 'bg-[#d4af37] text-[#062e21] border-[#d4af37]' : 'bg-black/50 text-white/70 border-white/20'
                }`}
              >
                {t.gloss}: {glossOn ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          {/* Quick Selection Swatches */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Wall Tile Selector */}
            <div className="bg-[#0a140e]/75 border border-white/10 rounded-xl p-4">
              <span className="text-xs font-bold text-[#e8cf7a] uppercase tracking-wider block mb-2">{t.wallTiles}</span>
              <div className="grid grid-cols-2 gap-2">
                {tileTextures.map(tile => (
                  <button
                    key={'wall-' + tile.id}
                    onClick={() => setWallTile(tile)}
                    className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs border transition-all ${
                      wallTile.id === tile.id
                        ? 'border-[#d4af37] bg-[#d4af37]/15 text-white font-semibold'
                        : 'border-white/10 hover:border-white/25 text-white/70'
                    }`}
                  >
                    <div className="w-5 h-5 rounded border border-white/20" style={{ backgroundColor: tile.color }} />
                    <span className="truncate">{tile.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Floor Tile Selector */}
            <div className="bg-[#0a140e]/75 border border-white/10 rounded-xl p-4">
              <span className="text-xs font-bold text-[#e8cf7a] uppercase tracking-wider block mb-2">{t.floorTiles}</span>
              <div className="grid grid-cols-2 gap-2">
                {tileTextures.map(tile => (
                  <button
                    key={'floor-' + tile.id}
                    onClick={() => setFloorTile(tile)}
                    className={`flex items-center gap-2 p-2 rounded-lg text-left text-xs border transition-all ${
                      floorTile.id === tile.id
                        ? 'border-[#d4af37] bg-[#d4af37]/15 text-white font-semibold'
                        : 'border-white/10 hover:border-white/25 text-white/70'
                    }`}
                  >
                    <div className="w-5 h-5 rounded border border-white/20" style={{ backgroundColor: tile.color }} />
                    <span className="truncate">{tile.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Area Calculator & Order Inquiry */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-[#0a140e]/75 border border-[#d4af37]/30 rounded-2xl p-6 backdrop-blur-md shadow-xl flex flex-col">
            <h3 className="text-base font-bold text-[#e8cf7a] uppercase tracking-wider flex items-center gap-2 mb-4">
              <Calculator className="w-4 h-4" />
              {t.calcTitle}
            </h3>

            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1 block">{t.roomLength}</label>
                  <input
                    type="number"
                    value={lengthFt}
                    onChange={e => setLengthFt(e.target.value)}
                    className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-white/60 mb-1 block">{t.roomWidth}</label>
                  <input
                    type="number"
                    value={widthFt}
                    onChange={e => setWidthFt(e.target.value)}
                    className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={includeWaste}
                  onChange={e => setIncludeWaste(e.target.checked)}
                  className="rounded border-white/20 text-[#d4af37] focus:ring-[#d4af37]"
                />
                <span>{t.wasteMargin}</span>
              </label>

              {/* Calculation Breakdown Card */}
              <div className="bg-black/30 border border-white/10 rounded-xl p-4 mt-3 flex flex-col gap-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/60">{t.calcResult}:</span>
                  <span className="text-white font-bold">{totalArea} sq.ft</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/60">{t.cartons}:</span>
                  <span className="text-[#e8cf7a] font-bold">{cartonsNeeded} boxes</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/60">Rate ({floorTile.name}):</span>
                  <span className="text-white/80">{branding.currency_symbol} {floorTile.price} /sq.ft</span>
                </div>
                <div className="h-px bg-white/10 my-1" />
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-white/80">{t.estimatedCost}:</span>
                  <span className="text-lg font-bold text-[#d4af37]">
                    {branding.currency_symbol} {estimatedCost.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Action Button: WhatsApp Direct Link */}
              <button
                onClick={handleWhatsApp}
                className="mt-4 w-full bg-[#25D366] hover:bg-[#20ba59] text-white py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
              >
                <MessageCircle className="w-5 h-5" />
                {t.whatsappInquiry}
              </button>

              <div className="text-[11px] text-white/40 text-center mt-2">
                Showroom: {branding.address} · Tel: {branding.phone}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
