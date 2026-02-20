import { useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, ChevronDown, MapPin, Lock } from 'lucide-react';
import { db } from '@/db/database';
import { useAuth } from '@/auth';
import { Badge, Card } from '@/components';
import { getComplianceStatus, complianceBadgeVariant } from '@/utils/compliance';
import type { Location, InventoryItem } from '@/db/types';

interface TreeNode {
  location: Location;
  children: TreeNode[];
}

function buildTree(locations: Location[]): TreeNode[] {
  const map = new Map<number, TreeNode>();
  const roots: TreeNode[] = [];
  for (const loc of locations) {
    map.set(loc.id!, { location: loc, children: [] });
  }
  for (const loc of locations) {
    const node = map.get(loc.id!)!;
    if (loc.parentId && map.has(loc.parentId)) {
      map.get(loc.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function getLocationCompliance(loc: Location, items: InventoryItem[]) {
  const locItems = items.filter((i) => i.locationId === loc.id && i.isActive);
  if (locItems.length === 0) return 'OK' as const;
  const statuses = locItems.map((i) => getComplianceStatus(i.lastCheckedAt, loc.checkFrequencyHours));
  if (statuses.includes('Overdue')) return 'Overdue' as const;
  if (statuses.includes('DueSoon')) return 'DueSoon' as const;
  return 'OK' as const;
}

function LocationNode({ node, items, depth }: { node: TreeNode; items: InventoryItem[]; depth: number }) {
  const [expanded, setExpanded] = useState(depth === 0);
  const loc = node.location;
  const compliance = getLocationCompliance(loc, items);
  const hasChildren = node.children.length > 0;

  return (
    <div style={{ marginLeft: depth > 0 ? '1.5rem' : 0 }}>
      <Card className="mb-2">
        <div className="flex items-center gap-2">
          {hasChildren ? (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded hover:bg-slate-100"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : (
            <span className="w-7" />
          )}
          <MapPin size={16} className="text-slate-400 shrink-0" />
          <Link to={`/locations/${loc.id}`} className="font-medium text-blue-600 hover:underline">
            {loc.name}
          </Link>
          <Badge variant="neutral">{loc.type}</Badge>
          {loc.sealed && (
            <Badge variant="info">
              <Lock size={10} className="mr-1 inline" />
              Sealed
            </Badge>
          )}
          <Badge variant={complianceBadgeVariant(compliance)}>{compliance}</Badge>
        </div>
      </Card>
      {expanded && hasChildren && node.children.map((child) => (
        <LocationNode key={child.location.id} node={child} items={items} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function LocationsPage() {
  const { currentService } = useAuth();
  const serviceId = currentService?.id ?? 0;

  const locations = useLiveQuery(
    () => db.locations.where('serviceId').equals(serviceId).filter((l) => l.isActive).toArray(),
    [serviceId]
  );

  const items = useLiveQuery(
    () => db.inventoryItems.where('serviceId').equals(serviceId).filter((i) => i.isActive).toArray(),
    [serviceId]
  );

  if (!locations || !items) {
    return <p className="text-slate-500 p-4">Loading...</p>;
  }

  const tree = buildTree(locations);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-4">Locations</h1>
      {tree.length === 0 ? (
        <p className="text-slate-500">No locations found for this service.</p>
      ) : (
        tree.map((node) => <LocationNode key={node.location.id} node={node} items={items} depth={0} />)
      )}
    </div>
  );
}
