import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Modal } from './Modal';

interface HelpButtonProps {
  title: string;
  content: string;
}

export function HelpButton({ title, content }: HelpButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="p-1 text-slate-400 hover:text-blue-600 rounded-full" aria-label={`Help: ${title}`}>
        <HelpCircle size={18} />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <p className="text-slate-400">{content}</p>
      </Modal>
    </>
  );
}
