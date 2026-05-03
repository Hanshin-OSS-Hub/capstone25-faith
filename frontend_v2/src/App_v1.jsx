import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Menu, 
  X 
} from 'lucide-react';

import HomeView from './views/HomeView';
import AboutView from './views/AboutView';

const App = () => {
  const [currentView, setCurrentView] = useState('home');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div 
              className="flex items-center gap-2 cursor-pointer group" 
              onClick={() => setCurrentView('home')}
            >
              <div className="bg-blue-600 p-1.5 rounded-lg text-white group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <span className="text-2xl font-black tracking-tighter text-blue-600">FAITH</span>
            </div>

            {/* Desktop Menu */}
            <nav className="hidden md:flex space-x-8 text-sm font-bold text-slate-500">
              <button 
                onClick={() => setCurrentView('home')} 
                className={`${currentView === 'home' ? 'text-blue-600 border-b-2 border-blue-600' : 'hover:text-blue-600'} py-5 transition-all`}
              >홈</button>
              <button 
                onClick={() => setCurrentView('about')} 
                className={`${currentView === 'about' ? 'text-blue-600 border-b-2 border-blue-600' : 'hover:text-blue-600'} py-5 transition-all`}
              >서비스 소개</button>
            </nav>

            {/* Mobile Toggle */}
            <div className="md:hidden flex items-center">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-slate-500">
                {isMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Dropdown */}
        {isMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-6 space-y-1">
            <button onClick={() => {setCurrentView('home'); setIsMenuOpen(false)}} className="block w-full text-left px-3 py-3 font-bold">홈</button>
            <button onClick={() => {setCurrentView('about'); setIsMenuOpen(false)}} className="block w-full text-left px-3 py-3 font-bold">서비스 소개</button>
          </div>
        )}
      </header>

      {/* Main Viewport */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {currentView === 'home' ? <HomeView /> : <AboutView />}
      </main>

      {/* Global Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 text-white font-black text-2xl tracking-tighter mb-2">
            <ShieldCheck className="text-blue-500 w-8 h-8" /> FAITH
          </div>
          <p className="text-xs">© 2025 FAITH Project. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default App;