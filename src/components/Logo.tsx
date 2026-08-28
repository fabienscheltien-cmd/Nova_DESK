import fullLogo from "@/assets/nova-serenity-logo.png.asset.json";
import compactSymbol from "@/assets/nova-zen-symbol.png.asset.json";

export function Concierge({ className = "h-9 w-auto" }: { className?: string }) {
  return (
    <img
      src={fullLogo.url}
      alt="Nova Serenity"
      className={className}
      width={648}
      height={392}
      loading="eager"
    />
  );
}

export function NovaZenSymbol({ className = "h-9 w-auto" }: { className?: string }) {
  return (
    <img
      src={compactSymbol.url}
      alt="NOVA"
      className={className}
      width={648}
      height={392}
      loading="eager"
    />
  );
}
