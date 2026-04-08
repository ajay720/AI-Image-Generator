'use client';

 

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const styles = [
  { id: 'anime', label: 'Anime', icon: '🎨', desc: 'Studio Ghibli style' },
  { id: 'oil-painting', label: 'Oil Painting', icon: '🖼️', desc: 'Classic art' },
  { id: 'cinematic', label: 'Cinematic', icon: '🎬', desc: 'Movie scene' },
  { id: 'neon-glow', label: 'Neon', icon: '💜', desc: 'Cyberpunk' },
];

const presets = [
  'A cat portrait', 'Mountain landscape', 'Sunset beach', 'Space galaxy',
  'Abstract art', 'Forest walk', 'City skyline', 'Flower close-up'
];

export default function GeneratePage() {
  const [, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ generation?: { image_urls?: string[] } } | null>(null);
  const [activeTab, setActiveTab] = useState<'create' | 'gallery'>('create');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      if (!currentUser) redirect('/login');
    });
  }, []);

  const handleLogout = async (): Promise<void> => {
    await supabase.auth.signOut();
    redirect('/login');
  };

  const handleDownload = async (url: string): Promise<void> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `generated-image-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch {
      setError('Download failed');
    }
  };

  const handleGenerate = async (): Promise<void> => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(window.location.origin + '/api/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': session?.access_token ? `Bearer ${session.access_token}` : ''
        },
        body: JSON.stringify({ prompt, style: selectedStyle }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.error || 'Generation failed');
      else setResult(data);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-md bg-black/30 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              ✨
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              AI Image Gen
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleLogout} className="text-gray-400 hover:text-white transition">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Tab Switcher */}
        <div className="flex gap-2 mb-8">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-6 py-2 rounded-full transition ${activeTab === 'create' ? 'bg-gradient-to-r from-purple-600 to-pink-600' : 'bg-white/10 hover:bg-white/20'}`}
          >
            Create
          </button>
          <button
            onClick={() => setActiveTab('gallery')}
            className={`px-6 py-2 rounded-full transition ${activeTab === 'gallery' ? 'bg-gradient-to-r from-purple-600 to-pink-600' : 'bg-white/10 hover:bg-white/20'}`}
          >
            Gallery
          </button>
        </div>

        {activeTab === 'create' && (
          <div className="space-y-6">
            {/* Prompt Input */}
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your image in detail..."
                className="w-full h-40 p-4 bg-white/5 border border-white/10 rounded-2xl resize-none focus:outline-none focus:border-purple-500/50 transition text-lg"
                maxLength={500}
              />
              <div className="absolute bottom-4 right-4 text-sm text-gray-500">{prompt.length}/500</div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setPrompt(preset)}
                  className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-full text-sm text-gray-300 transition"
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Style Selection */}
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Choose Style</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {styles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style.id)}
                    className={`p-4 rounded-xl transition-all ${selectedStyle === style.id 
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 ring-2 ring-purple-400' 
                      : 'bg-white/5 hover:bg-white/10 border border-white/10'}`}
                  >
                    <div className="text-2xl mb-1">{style.icon}</div>
                    <div className="font-medium">{style.label}</div>
                    <div className="text-xs text-gray-400">{style.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="w-full py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 rounded-2xl font-bold text-lg disabled:opacity-50 hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating...
                </span>
              ) : (
                '✨ Generate Image'
              )}
            </button>

            {/* Error */}
            {error && (
              <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400">
                {error}
              </div>
            )}

            {/* Result */}
            {result?.generation?.image_urls && (
              <div className="mt-8 animate-fade-in">
                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                  <span>✅</span> Your Image
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.generation.image_urls.map((url: string, i: number) => (
                    <div key={i} className="relative rounded-2xl overflow-hidden border border-white/10">
                      <Image
                        src={url}
                        alt="Generated"
                        width={512}
                        height={512}
                        className="w-full h-auto"
                      />
                      <button 
                        onClick={() => handleDownload(url)}
                        className="absolute bottom-2 right-2 px-3 py-1 bg-black/50 backdrop-blur rounded-lg text-sm hover:bg-black/70 transition"
                      >
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'gallery' && (
          <div className="text-center py-20 text-gray-400">
            <div className="text-6xl mb-4">🖼️</div>
            <p>Your gallery is empty</p>
            <p className="text-sm mt-2">Start generating images to see them here!</p>
          </div>
        )}
      </main>
    </div>
  );
}