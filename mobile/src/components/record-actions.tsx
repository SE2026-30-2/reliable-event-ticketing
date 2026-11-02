import { useState, type PropsWithChildren } from "react";
import { Pressable, Text, View } from "react-native";
import { colors } from "./ui-kit";
export function RecordActions({
  children,
  label,
}: PropsWithChildren<{ label: string }>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Thao tác với ${label}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{
          alignSelf: "flex-end",
          marginTop: -28,
          paddingHorizontal: 10,
          minHeight: 38,
          justifyContent: "center",
          borderRadius: 9,
          backgroundColor: open ? colors.soft : "transparent",
        }}
      >
        <Text style={{ color: colors.ink, fontSize: 22 }}>···</Text>
      </Pressable>
      {open && (
        <View
          style={{
            gap: 8,
            borderTopColor: colors.line,
            borderTopWidth: 1,
            paddingTop: 10,
          }}
        >
          {children}
        </View>
      )}
    </>
  );
}
