'use client';

export function LogosSection() {
  return (
    <section className="py-16 border-y border-slate-800/60 bg-slate-900/40 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {[
            { label: 'Lines of Code Generated', value: '1.2M+' },
            { label: 'SDLC Phases Automated', value: '8/8' },
            { label: 'Average Time to Deploy', value: '< 2 days' },
            { label: 'Quad-Layer Sign-offs', value: '100% Coverage' },
          ].map((metric) => (
            <div key={metric.label} className="flex flex-col items-center justify-center p-4 text-center">
              <span className="text-3xl font-bold text-white mb-2 tracking-tight">{metric.value}</span>
              <span className="text-sm font-medium text-slate-400 uppercase tracking-wide">{metric.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
