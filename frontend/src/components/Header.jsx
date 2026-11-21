import HealthBadge from './HealthBadge';

export default function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        {/* App name */}
        <h1 className="text-lg font-bold tracking-tight text-gray-900">
          <span className="text-indigo-600">Form</span> Auto Filler
        </h1>

        {/* Health badge */}
        <HealthBadge />
      </div>
    </header>
  );
}

