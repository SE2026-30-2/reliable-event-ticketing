import Svg, {
  Path,
  Rect,
  Circle,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";
import { useId } from "react";
import type { ColorValue } from "react-native";
const paths = {
  mail: "m3 6 9 7 9-7M3 5h18v14H3z",
  lock: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3",
  user: "M4 21v-3c0-6 16-6 16 0v3M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  search: "m16 16 5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  calendar: "M4 5h16v16H4zM8 2v6M16 2v6M4 10h16",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  ticket: "M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4zM16 5v3m0 3v2m0 3v3",
  back: "m15 4-8 8 8 8",
  next: "m9 4 8 8-8 8",
  check: "m5 12 4 4L20 5",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  home: "m2 11 10-9 10 9M5 9v12h5v-7h4v7h5V9",
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  scan: "M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5M6 12h12M8 8v8m8-8v8",
  shield: "m12 2 9 4v6c0 6-9 10-9 10S3 18 3 12V6zM8 12l3 3 5-6",
  logout: "M10 3H3v18h7M8 12h13m-5-5 5 5-5 5",
  plus: "M12 4v16M4 12h16",
  close: "m5 5 14 14M19 5 5 19",
  clock: "M12 7v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  wallet: "M3 5h17v16H3zM3 5V3h14M15 10h7v6h-7zM18 13h1",
  copy: "M8 8h13v13H8zM16 8V3H3v13h5",
  filter: "M3 5h18M6 12h12M9 19h6M8 3v4m8 3v4m-4 3v4",
  music: "M9 17V4l11-2v13M9 17c0 4-7 4-7 0s7-4 7 0M20 15c0 4-7 4-7 0s7-4 7 0",
  info: "M12 11v6m0-11v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
} as const;
export type IconName = keyof typeof paths;
export function ButtonGradient() {
  const id = useId().replace(/:/g, "");
  return (
    <Svg
      pointerEvents="none"
      width="100%"
      height="100%"
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <Defs>
        <LinearGradient id={id} x1="0%" x2="100%">
          <Stop stopColor="#974cff" />
          <Stop offset="1" stopColor="#4c30ff" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" rx={12} fill={`url(#${id})`} />
    </Svg>
  );
}
export function Icon({
  name,
  size = 20,
  color = "#6540ff",
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d={paths[name]}
        stroke={color ?? "#6540ff"}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Rect
        x="5"
        y="9"
        width="30"
        height="23"
        rx="7"
        fill="#7041ff"
        transform="rotate(-25 20 20)"
      />
      <Path d="m18 12-4 8h6l-2 8 9-12h-7l2-4" fill="white" />
      <Circle cx="7" cy="6" r="2" fill="#8e66ff" />
      <Circle cx="34" cy="33" r="2" fill="#8e66ff" />
    </Svg>
  );
}
