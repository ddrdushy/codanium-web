'use client';

export function LogosSection() {
  return (
    <section className="py-16 border-y border-slate-800/60 bg-slate-900/40 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {[
            { label: 'Specialized AI Agents', value: '23+' },
            { label: 'LLM Providers Supported', value: '10+' },
            { label: 'Self-host & Fork', value: 'MIT' },
            { label: 'Cost to Run', value: 'Your keys' },
          ].map((metric) => (
            <div key={metric.label} className="flex flex-col items-center justify-center p-4 text-center">
              <span className="text-3xl font-bold text-white mb-2 tracking-tight">{metric.value}</span>
              <span className="text-xs sm:text-sm font-medium text-slate-400 uppercase tracking-wide">{metric.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
