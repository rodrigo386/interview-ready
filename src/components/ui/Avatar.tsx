export function Avatar({
  src,
  alt,
  size,
  className = "",
}: {
  src: string;
  alt: string;
  size: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- avatar URL is external (Gravatar / Supabase CDN), Image not needed
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full object-cover bg-line ${className}`}
    />
  );
}
