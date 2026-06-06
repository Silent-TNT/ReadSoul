interface SectionCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export default function SectionCard({
  title,
  subtitle,
  action,
  className = "",
  children,
}: SectionCardProps) {
  return (
    <section className={`soul-card ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="soul-card-title">{title}</h2>
          {subtitle && <p className="soul-card-sub">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
