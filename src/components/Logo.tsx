import logoAsset from "@/assets/nova-serenity-logo.png.asset.json";

export function Concierge({ className = "h-9 w-auto" }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Nova Serenity"
      className={className}
      width={648}
      height={392}
      loading="eager"
    />
  );
}

export function LogoSymbol({ className = "h-8" }: { className?: string }) {
  return (
    <div className={`overflow-hidden ${className}`} aria-hidden="true">
      <img
        src={logoAsset.url}
        alt=""
        className="h-auto w-auto"
        width={648}
        height={392}
        loading="eager"
      />
    </div>
  );
}
