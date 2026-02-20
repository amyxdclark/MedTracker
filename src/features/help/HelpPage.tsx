import { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { Card } from '@/components';

interface HelpTopic {
  title: string;
  content: string;
}

const TOPICS: HelpTopic[] = [
  {
    title: 'Getting Started',
    content:
      'Welcome to MedTracker! After logging in, select your service to begin. The home dashboard shows an overview of your inventory status, recent activity, and upcoming tasks. Use the navigation menu to access different features.',
  },
  {
    title: 'Daily Checks',
    content:
      'Navigate to Checks to perform daily inventory verification. Select a location, verify the seal if applicable, then confirm each item is present and accounted for. The system tracks check frequency and highlights overdue locations.',
  },
  {
    title: 'Administering Medication',
    content:
      'Go to Administer to log medication administration. Scan or enter the item QR code, fill in patient details, dosage, and route. After submission, the item status is updated and an audit trail is created automatically.',
  },
  {
    title: 'Managing Inventory',
    content:
      'The Inventory page lists all items for your service. You can view details, transfer items between locations, log waste, and handle expired exchanges. Use the search and filter options to find specific items quickly.',
  },
  {
    title: 'Reports & Audit Log',
    content:
      'Access Reports to view audit logs, compliance summaries, and activity history. All actions in the system are logged automatically. Use date filters to narrow results and export data as needed.',
  },
  {
    title: 'Troubleshooting',
    content:
      'If you experience issues, try refreshing the page first. For login problems, verify your email and password are correct. If data appears missing, check that you have the correct service selected. Contact your administrator for role or access issues.',
  },
];

export default function HelpPage() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggle = (i: number) => setExpandedIndex(expandedIndex === i ? null : i);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
        <HelpCircle size={24} /> Help Center
      </h1>
      <p className="text-slate-500">Browse common topics below to learn how to use MedTracker.</p>

      <div className="space-y-3">
        {TOPICS.map((topic, i) => (
          <Card key={topic.title}>
            <button
              type="button"
              className="w-full flex items-center justify-between text-left"
              onClick={() => toggle(i)}
              aria-expanded={expandedIndex === i}
            >
              <span className="font-semibold text-slate-900">{topic.title}</span>
              {expandedIndex === i ? (
                <ChevronDown size={18} className="text-slate-400 shrink-0" />
              ) : (
                <ChevronRight size={18} className="text-slate-400 shrink-0" />
              )}
            </button>
            {expandedIndex === i && (
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">{topic.content}</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
