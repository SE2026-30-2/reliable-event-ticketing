import { View } from "react-native";
import { Image } from "expo-image";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
export function AuthArtwork({
  kind = "concert",
}: {
  kind?: "concert" | "lock" | "mail" | "success" | "pending" | "failure";
}) {
  if (kind === "concert")
    return (
      <View
        style={{
          height: 150,
          marginVertical: 2,
          overflow: "hidden",
          borderTopLeftRadius: 95,
          borderBottomRightRadius: 80,
          borderTopRightRadius: 35,
          borderBottomLeftRadius: 30,
          transform: [{ rotate: "-3deg" }],
        }}
      >
        <Image
          source={require("../../assets/eventhub/concert.jpg")}
          contentFit="cover"
          style={{ width: "100%", height: "100%" }}
        />
        <View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "#6830ff",
            opacity: 0.17,
          }}
        />
      </View>
    );
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={
        kind === "pending"
          ? "Kết quả đang chờ xác nhận"
          : kind === "failure"
            ? "Kết quả không thành công"
            : kind === "success"
              ? "Kết quả thành công"
              : "Minh họa bảo mật tài khoản"
      }
      style={{
        height: kind === "success" ? 110 : 180,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 320 180">
        <Defs>
          <LinearGradient id="purple" x1="0" y1="0" x2="1" y2="1">
            <Stop stopColor="#bda3ff" />
            <Stop offset="1" stopColor="#5635ff" />
          </LinearGradient>
        </Defs>
        <Path
          d="M41 105C3 50 107 35 151 22s99 1 114 40 57 69-9 90S76 163 41 105"
          fill="#eee7ff"
        />
        {kind === "lock" ? (
          <>
            <Rect
              x="195"
              y="66"
              width="72"
              height="57"
              rx="10"
              fill="#d8c6ff"
              transform="rotate(-15 195 66)"
            />
            <Path
              d="M119 83V62c0-54 77-54 77 0v21"
              stroke="#6341ff"
              strokeWidth="14"
              fill="none"
            />
            <Rect
              x="101"
              y="77"
              width="112"
              height="86"
              rx="18"
              fill="url(#purple)"
            />
            <Circle cx="157" cy="111" r="10" fill="#2c1c9c" />
            <Path d="M157 116v18" stroke="#2c1c9c" strokeWidth="9" />
          </>
        ) : kind === "mail" ? (
          <>
            <Path d="m72 76 86-52 91 52v77H72z" fill="#5c35ef" />
            <Rect x="94" y="45" width="132" height="96" rx="10" fill="white" />
            <Path d="M111 63h94m-94 15h94" stroke="#eae4ff" strokeWidth="5" />
            <Path d="m72 77 88 52 89-52v76H72z" fill="url(#purple)" />
            <Circle cx="161" cy="89" r="24" fill="#20bd57" />
            <Path
              d="m150 89 8 8 16-19"
              fill="none"
              stroke="white"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <Circle
              cx="160"
              cy="91"
              r="59"
              fill={
                kind === "failure"
                  ? "#ffe3e8"
                  : kind === "pending"
                    ? "#fff0cf"
                    : "#ddf6e4"
              }
            />
            <Circle
              cx="160"
              cy="91"
              r="40"
              fill={
                kind === "failure"
                  ? "#d52c46"
                  : kind === "pending"
                    ? "#db8c16"
                    : "#1cbd55"
              }
            />
            <Path
              d={
                kind === "failure"
                  ? "m145 76 30 30m0-30-30 30"
                  : kind === "pending"
                    ? "M160 66v25l17 12"
                    : "m138 91 16 16 30-35"
              }
              stroke="white"
              fill="none"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
        <Path
          d="m42 40 4 10 10 4-10 4-4 10-4-10-10-4 10-4m240 65 4 10 10 4-10 4-4 10-4-10-10-4 10-4"
          fill="#7140ff"
        />
      </Svg>
    </View>
  );
}
