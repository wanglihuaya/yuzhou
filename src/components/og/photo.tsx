import type { ReactNode } from "react";

import { Badge } from "@/components/og/badge";
import { BrandMark } from "@/components/og/brand-mark";

export interface PhotoProps {
  image?: string;
  label: string;
  title: string;
  brand: string;
  logo?: string;
  /** Placeholder mark shown when no logo is supplied. */
  mark?: ReactNode;
}

const FONT = "Noto Sans SC";

const FALLBACK =
  "linear-gradient(135deg, #062028 0%, #0a7ca0 55%, #25b4e1 100%)";

/** Chinese titles are much wider than Latin ones, so size by character count. */
function titleSize(length: number): number {
  if (length <= 22) return 88;
  if (length <= 30) return 76;
  if (length <= 40) return 64;
  return 54;
}

export const Photo = ({
  image,
  label,
  title,
  brand,
  logo = "",
  mark,
}: PhotoProps) => {
  const size = titleSize(title.length);

  return (
    <div
      style={{
        backgroundColor: "#0b1215",
        backgroundImage: image ? `url(${image})` : FALLBACK,
        backgroundPosition: "center",
        backgroundSize: "cover",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        fontFamily: FONT,
        height: "100%",
        justifyContent: "flex-end",
        padding: "80px",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(4,12,16,0.18) 0%, rgba(4,12,16,0.5) 52%, rgba(4,12,16,0.92) 100%)",
          bottom: 0,
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
        }}
      />

      <Badge
        background="rgba(8,20,26,0.55)"
        borderColor="rgba(255,255,255,0.34)"
        color="#ffffff"
        style={{ alignSelf: "flex-start" }}
      >
        <div
          style={{
            backgroundColor: "#5ac8e8",
            borderRadius: "999px",
            height: "10px",
            width: "10px",
          }}
        />
        {label}
      </Badge>

      <div
        style={{
          display: "block",
          fontSize: size,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          lineClamp: 3,
          lineHeight: 1.12,
          marginTop: "28px",
          maxWidth: "1000px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          textShadow: "0 2px 24px rgba(0,0,0,0.45)",
        }}
      >
        {title}
      </div>

      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: "12px",
          marginTop: "32px",
        }}
      >
        <BrandMark background="rgba(37,180,225,0.9)" radius={9} size={38} src={logo}>
          {mark ?? (
            <div style={{ color: "#ffffff", fontSize: "22px", fontWeight: 700 }}>
              宇
            </div>
          )}
        </BrandMark>
        <div
          style={{
            color: "rgba(255,255,255,0.88)",
            fontSize: "28px",
            fontWeight: 600,
          }}
        >
          {brand}
        </div>
      </div>
    </div>
  );
};
