import { useEffect, useRef, useState, type ReactNode } from "react";

export function ScaledSlide({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setScale(Math.min(entry.contentRect.width / 1920, entry.contentRect.height / 1080));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="scaled-slide-container" ref={ref}>
      <div className="scaled-slide" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
