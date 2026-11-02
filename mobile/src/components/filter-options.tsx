import { View } from "react-native";
import { Body, Button } from "./ui-kit";

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
      <Body muted>{label}</Body>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map(([key, title]) => (
          <Button
            key={key}
            title={title}
            secondary={value !== key}
            disabled={disabled}
            onPress={() => onChange(key)}
          />
        ))}
      </View>
    </View>
  );
}
