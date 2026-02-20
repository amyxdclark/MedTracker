import { useState } from 'react';
import { useNavigate } from 'react-router';
import { QrCode, Search } from 'lucide-react';
import { db } from '@/db/database';
import { Button, Card } from '@/components';

export default function ScanPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLookup = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setError('');
    setLoading(true);
    try {
      const item = await db.inventoryItems.where('qrCode6').equals(trimmed).first();
      if (item) {
        navigate(`/inventory/${item.id}`);
      } else {
        setError(`No item found with code "${trimmed}".`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">Scan / Look Up</h1>

      <Card className="space-y-4">
        <div className="flex items-center gap-3 text-slate-400">
          <QrCode className="h-8 w-8" />
          <p className="text-sm text-slate-400">
            Enter the 6-character code printed on the item label.
          </p>
        </div>

        <div>
          <label htmlFor="qr-input" className="block text-sm font-medium text-slate-300 mb-1">
            QR Code
          </label>
          <input
            id="qr-input"
            type="text"
            maxLength={6}
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handleLookup(); }}
            placeholder="e.g. A1B2C3"
            className="w-full px-3 py-2 rounded-lg border bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 text-lg tracking-widest text-center font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <Button onClick={handleLookup} disabled={loading || code.trim().length === 0} icon={<Search className="h-4 w-4" />} className="w-full">
          Look Up
        </Button>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </Card>

      <p className="text-xs text-slate-400 text-center">
        Camera-based QR scanning may be added in a future update.
      </p>
    </div>
  );
}
