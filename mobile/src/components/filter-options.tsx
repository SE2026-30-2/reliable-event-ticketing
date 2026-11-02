import { ScrollView, View, Pressable, Text } from "react-native";
import { colors } from "./ui-kit";

export function FilterOptions({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 7, paddingVertical: 2 }}
      >
        {options.map(([key, title]) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityState={{
              selected: value === key,
              disabled: !!disabled,
            }}
            disabled={disabled}
            onPress={() => onChange(key)}
            style={{
              minHeight: 38,
              justifyContent: "center",
              paddingHorizontal: 13,
              borderRadius: 11,
              borderWidth: 1,
              borderColor: value === key ? colors.primary : colors.line,
              backgroundColor: value === key ? colors.primary : "#faf8ff",
              opacity: disabled ? 0.45 : 1,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: value === key ? "#fff" : colors.ink,
              }}
            >
              {title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
