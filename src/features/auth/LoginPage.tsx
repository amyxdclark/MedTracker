import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth';
import { seedDemoData } from '@/db/seed';
import { Database } from 'lucide-react';

export default function LoginPage() {
  const { login, currentUser, currentService } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (currentUser) {
      if (currentService) {
        navigate('/home', { replace: true });
      } else {
        navigate('/select-service', { replace: true });
      }
    }
  }, [currentUser, currentService, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const ok = await login(email, password);
    setLoading(false);
    if (!ok) {
      setError('Invalid email or password.');
    }
  };

  const handleSeed = async () => {
    try {
      setSeeding(true);
      await seedDemoData();
      setSeeding(false);
      setSeeded(true);
      setEmail('demo@medtracker.app');
      setPassword('demo1234');
    } catch (e) {
      console.error('Seed error:', e);
      setError('Failed to seed demo data: ' + String(e));
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">M+</div>
          <span className="text-2xl font-bold text-slate-900">MedTracker</span>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h1 className="text-lg font-semibold text-slate-900">Sign In</h1>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {seeded && <p className="text-sm text-green-600">Demo data loaded! Credentials pre-filled.</p>}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg transition-colors"
          >
            <Database size={16} />
            {seeding ? 'Loading…' : 'Load Demo Data'}
          </button>
        </div>
        {seeded && (
          <div className="mt-3 bg-blue-50 rounded-lg p-3 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">Demo accounts:</p>
            <p>demo@medtracker.app / demo1234 (Paramedic + Supervisor)</p>
            <p>admin@medtracker.app / admin1234 (System Admin)</p>
            <p>driver@medtracker.app / driver1234 (Driver)</p>
          </div>
        )}
      </div>
    </div>
  );
}
