"use client";

import { useEffect, useMemo, useState } from "react";
import { layoutNota, PAGE, type Measure, type Primitive } from "@/lib/layout";
import type { NotaData } from "@/lib/nota";
import { obterMedidor } from "@/lib/pdf";

/** Medidor aproximado usado até as métricas reais da fonte estarem carregadas. */
const medidorAproximado: Measure = (text, size, bold) => text.length * size * (bold ? 0.56 : 0.52);

/** Calcula as primitivas da nota com as mesmas métricas de texto usadas no PDF. */
export function useLayoutNota(nota: NotaData): Primitive[] {
  const [medidor, setMedidor] = useState<Measure | null>(null);
  useEffect(() => {
    let ativo = true;
    obterMedidor().then((m) => {
      if (ativo) setMedidor(() => m);
    });
    return () => {
      ativo = false;
    };
  }, []);
  return useMemo(() => layoutNota(nota, medidor ?? medidorAproximado), [nota, medidor]);
}

const FONTE = "Arial, Helvetica, 'Liberation Sans', sans-serif";

/** Página A4 desenhada em SVG a partir das primitivas partilhadas com o PDF. */
export function NotaSvg({ primitivas, className }: { primitivas: Primitive[]; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${PAGE.w} ${PAGE.h}`}
      xmlns="http://www.w3.org/2000/svg"
      xmlSpace="preserve"
      className={className}
      role="img"
      aria-label="Pré-visualização da nota de pagamento"
    >
      <rect x="0" y="0" width={PAGE.w} height={PAGE.h} fill="#ffffff" />
      {primitivas.map((p, i) => {
        if (p.kind === "rect") return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill} />;
        if (p.kind === "line")
          return (
            <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={p.color} strokeWidth={p.width} />
          );
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            fontSize={p.size}
            fontFamily={FONTE}
            fontWeight={p.bold ? 700 : 400}
            fill={p.color}
            textAnchor={p.align === "right" ? "end" : p.align === "center" ? "middle" : "start"}
          >
            {p.text}
          </text>
        );
      })}
    </svg>
  );
}
