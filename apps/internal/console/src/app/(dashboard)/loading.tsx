import { LoaderCircle } from 'lucide-react';
export default function LoadingWorkspace() {
    return <section className="p-6" role="status" aria-live="polite"><div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-6 text-subdued"><LoaderCircle size={20} className="motion-safe:animate-spin" />Loading workspace…</div></section>;
}
