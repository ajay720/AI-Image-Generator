'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-client';

interface Generation {
  id: string;
  prompt: string;
  image_urls: string[];
  created_at: string;
}

export default function GalleryPage() {
  const [generations, setGenerations] = useState<Generation[]>([]);

  useEffect(() => {
    const fetchGenerations = async () => {
      const { data, error } = await supabase
        .from('generations')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error) setGenerations(data);
    };

    fetchGenerations();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">My Gallery</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {generations.map((gen) => (
            <div key={gen.id} className="bg-gray-800 rounded-lg overflow-hidden">
              <img src={gen.image_urls[0]} alt={gen.prompt} className="w-full h-48 object-cover" />
              <div className="p-4">
                <p className="text-sm text-gray-400">{gen.prompt}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}