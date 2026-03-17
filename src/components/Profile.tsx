import React, { useState } from 'react';
import { User, Camera, Save, ArrowLeft, Loader2, CheckCircle2, X, Mail, Shield, LogOut } from 'lucide-react';
import { User as FirebaseUser, updateProfile } from 'firebase/auth';
import { logout } from '../firebase';

interface ProfileProps {
  user: FirebaseUser;
  onBack: () => void;
}

export default function Profile({ user, onBack }: ProfileProps) {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      await updateProfile(user, {
        displayName: displayName.trim(),
        photoURL: photoURL.trim()
      });
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to update profile' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
      onBack();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="bg-white border-b border-teal-100 px-4 py-4 flex items-center gap-4 sticky top-0 z-20 shadow-sm">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-teal-50 rounded-full transition-colors text-[#00796b]"
          aria-label="Back to chat"
        >
          <ArrowLeft size={22} aria-hidden="true" />
        </button>
        <h1 className="text-xl font-bold text-gray-800">Profile Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10">
        <div className="max-w-2xl mx-auto space-y-8">
          
          {/* Profile Header Card */}
          <div className="bg-white rounded-3xl shadow-sm border border-teal-50 overflow-hidden">
            <div className="h-24 bg-[#00796b] relative">
              <div className="absolute -bottom-12 left-8 p-1 bg-white rounded-full shadow-lg">
                <div className="relative">
                  {photoURL ? (
                    <img 
                      src={photoURL} 
                      alt="Profile" 
                      className="w-24 h-24 rounded-full object-cover border-4 border-white"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 border-4 border-white">
                      <User size={40} />
                    </div>
                  )}
                  <div className="absolute bottom-0 right-0 bg-[#00796b] text-white p-1.5 rounded-full border-2 border-white shadow-sm">
                    <Camera size={12} />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="pt-14 pb-6 px-8">
              <h2 className="text-2xl font-bold text-gray-900">{user.displayName || 'User'}</h2>
              <div className="text-gray-500 flex items-center gap-2 mt-1">
                <div className="w-4 h-4 flex items-center justify-center text-teal-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                </div>
                {user.email?.split('@')[0] || 'No number'}
              </div>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-3xl shadow-sm border border-teal-50 p-8">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <Shield size={20} className="text-teal-600" />
              Personal Information
            </h3>

            <form onSubmit={handleUpdate} className="space-y-6">
              {message && (
                <div 
                  className={`p-4 rounded-xl flex items-center gap-3 ${
                    message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                  }`}
                >
                  {message.type === 'success' ? <CheckCircle2 size={18} /> : <X size={18} />}
                  <span className="text-sm font-medium">{message.text}</span>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="display-name" className="text-sm font-bold text-gray-700 ml-1">Full Name</label>
                  <input 
                    id="display-name"
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-[#00796b] outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="photo-url" className="text-sm font-bold text-gray-700 ml-1">Profile Photo URL</label>
                  <input 
                    id="photo-url"
                    type="url" 
                    value={photoURL}
                    onChange={(e) => setPhotoURL(e.target.value)}
                    placeholder="https://example.com/photo.jpg"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-[#00796b] outline-none transition-all"
                  />
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-[#00796b] text-white py-3 rounded-xl font-bold hover:bg-teal-800 disabled:opacity-50 transition-all shadow-md shadow-teal-600/10 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  Save Changes
                </button>
                <button 
                  type="button"
                  onClick={handleSignOut}
                  className="px-6 py-3 border border-red-100 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                >
                  <LogOut size={18} />
                  Sign Out
                </button>
              </div>
            </form>
          </div>

          {/* Account Details */}
          <div className="bg-white rounded-3xl shadow-sm border border-teal-50 p-8">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Account Security</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">User ID</p>
                  <p className="text-sm font-mono text-gray-600 mt-0.5">{user.uid.substring(0, 12)}...</p>
                </div>
                <div className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-[10px] font-bold uppercase">
                  Active
                </div>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Login Method</p>
                  <p className="text-sm text-gray-600 mt-0.5">Mobile Number</p>
                </div>
                <CheckCircle2 size={16} className="text-green-500" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
