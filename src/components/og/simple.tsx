import type { ReactNode } from "react";

import { Badge } from "@/components/og/badge";
import { BrandMark } from "@/components/og/brand-mark";

export interface SimpleProps {
  label: string;
  title: string;
  description: string;
  brand: string;
  logo?: string;
  /** Placeholder mark shown when no logo is supplied. */
  mark?: ReactNode;
}

const FONT = "Noto Sans SC";

/** Keep Chinese headlines on one or two balanced lines. */
function titleSize(length: number): number {
  if (length <= 13) return 72;
  if (length <= 20) return 64;
  if (length <= 30) return 56;
  return 48;
}

export const Simple = ({
  label,
  title,
  description,
  brand,
  logo,
  mark,
}: SimpleProps) => {
  const size = titleSize(title.length)

  return (
  <div
    style={{
      alignItems: "center",
      backgroundColor: "#0b1215",
      backgroundImage:
        "radial-gradient(circle at 50% 0%, rgba(37,180,225,0.26), rgba(11,18,21,0) 62%)",
      color: "#f0f3f4",
      display: "flex",
      flexDirection: "column",
      fontFamily: FONT,
      height: "100%",
      justifyContent: "center",
      padding: "96px",
      position: "relative",
      width: "100%",
    }}
  >
    <div
      style={{
        border: "2px solid rgba(37,180,225,0.2)",
        borderRadius: "50%",
        height: "760px",
        left: "50%",
        marginLeft: "-380px",
        marginTop: "-380px",
        position: "absolute",
        top: "50%",
        width: "760px",
      }}
    />

    <Badge
      background="rgba(250,250,250,0.04)"
      borderColor="rgba(250,250,250,0.14)"
      color="#d8e2e6"
      style={{ fontSize: "24px", fontWeight: 500, padding: "8px 18px" }}
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
        lineHeight: 1.14,
        marginTop: "40px",
        maxWidth: "920px",
        textAlign: "center",
      }}
    >
      {title}
    </div>

    <div
      style={{
        color: "#9fb0b8",
        display: "flex",
        fontSize: "30px",
        lineHeight: 1.5,
        marginTop: "28px",
        maxWidth: "780px",
        textAlign: "center",
      }}
    >
      {description}
    </div>

    <div
      style={{
        alignItems: "center",
        bottom: "56px",
        color: "#f0f3f4",
        display: "flex",
        fontSize: "26px",
        fontWeight: 600,
        gap: "12px",
        position: "absolute",
      }}
    >
      <BrandMark background="rgba(37,180,225,0.9)" radius={8} size={30} src={logo}>
        {mark ?? (
          <div style={{ color: "#ffffff", fontSize: "17px", fontWeight: 700 }}>
            宇
          </div>
        )}
      </BrandMark>
      {brand}
    </div>
  </div>
);
};
