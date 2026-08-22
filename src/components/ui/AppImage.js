import Image from "next/image";

export function AppImage({ alt = "", width = 96, height = 96, ...props }) {
  return (
    <Image
      alt={alt}
      width={width}
      height={height}
      {...props}
    />
  );
}
