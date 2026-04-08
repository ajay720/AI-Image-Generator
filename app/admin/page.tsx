'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface User {
  id: string;
  email: string;
  credits: number;
  created_at: string;
}

interface Generation {
  id: string;
  prompt: string;
  model: string;
  created_at: string;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userGenerations, setUserGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'users' | 'generations'>('users');
  const [newCredits, setNewCredits] = useState('');
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    setUsers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isInitialLoadDone) {
      setIsInitialLoadDone(true);
      loadUsers();
    }
  }, [isInitialLoadDone, loadUsers]);

  const loadUserGenerations = async (userId: string) => {
    const { data } = await supabase
      .from('generations')
      .select('id, prompt, model, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setUserGenerations(data || []);
  };

  const updateCredits = async () => {
    if (!selectedUser || !newCredits) return;
    
    const { error } = await supabase
      .from('profiles')
      .update({ credits: parseInt(newCredits) })
      .eq('id', selectedUser.id);

    if (!error) {
      setUsers(users.map(u => 
        u.id === selectedUser.id ? { ...u, credits: parseInt(newCredits) } : u
      ));
      setSelectedUser({ ...selectedUser, credits: parseInt(newCredits) });
      setNewCredits('');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (!error) {
      setUsers(users.filter(u => u.id !== userId));
      setSelectedUser(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Panel</h1>
          <a href="/generate" className="text-blue-400 hover:text-blue-300">
            Go to Generator
          </a>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setTab('users')}
            className={`px-4 py-2 rounded ${tab === 'users' ? 'bg-blue-600' : 'bg-gray-700'}`}
          >
            Users ({users.length})
          </button>
        </div>

        {tab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {loading ? (
                <p className="text-gray-400">Loading...</p>
              ) : (
                <div className="bg-gray-800 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="p-3 text-left">Email</th>
                        <th className="p-3 text-left">Credits</th>
                        <th className="p-3 text-left">Joined</th>
                        <th className="p-3 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-t border-gray-700">
                          <td className="p-3">{user.email || 'No email'}</td>
                          <td className="p-3">{user.credits}</td>
                          <td className="p-3">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                loadUserGenerations(user.id);
                              }}
                              className="text-blue-400 hover:text-blue-300 mr-2"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {selectedUser && (
              <div className="bg-gray-800 p-6 rounded-lg h-fit">
                <h2 className="text-xl font-bold mb-4">Manage User</h2>
                <p className="text-gray-400 mb-2">User ID: {selectedUser.id.slice(0, 8)}...</p>
                <p className="text-gray-400 mb-4">Current Credits: {selectedUser.credits}</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Update Credits</label>
                    <input
                      type="number"
                      value={newCredits}
                      onChange={(e) => setNewCredits(e.target.value)}
                      placeholder="New credits"
                      className="w-full p-2 bg-gray-700 rounded"
                    />
                    <button
                      onClick={updateCredits}
                      className="mt-2 w-full py-2 bg-blue-600 rounded hover:bg-blue-700"
                    >
                      Update Credits
                    </button>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2">Recent Generations</h3>
                    {userGenerations.length === 0 ? (
                      <p className="text-gray-400">No generations yet</p>
                    ) : (
                      <div className="space-y-2">
                        {userGenerations.slice(0, 5).map((gen) => (
                          <div key={gen.id} className="bg-gray-700 p-2 rounded text-sm">
                            <p className="truncate">{gen.prompt}</p>
                            <p className="text-gray-400 text-xs">
                              {gen.model} • {new Date(gen.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => deleteUser(selectedUser.id)}
                    className="w-full py-2 bg-red-600 rounded hover:bg-red-700"
                  >
                    Delete User
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}