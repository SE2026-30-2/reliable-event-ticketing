import type { PropsWithChildren } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "./eventhub-icons";
import { colors } from "./ui-kit";

export function BottomSheet({
  children,
  title,
  close,
  busy = false,
}: PropsWithChildren<{ title: string; close: () => void; busy?: boolean }>) {
  return (
    <Modal
      transparent
      animationType="slide"
      visible
      onRequestClose={() => {
        if (!busy) close();
      }}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "#17113966",
        }}
      >
        <Pressable
          accessibilityLabel="Đóng bảng thao tác"
          accessibilityRole="button"
          disabled={busy}
          onPress={close}
          style={{ position: "absolute", inset: 0 }}
        />
        <SafeAreaView
          edges={["bottom"]}
          style={{
            backgroundColor: colors.background,
            width: "100%",
            maxWidth: 600,
            alignSelf: "center",
            maxHeight: "90%",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
          }}
        >
          <View
            style={{
              width: 42,
              height: 5,
              backgroundColor: "#cbc5df",
              alignSelf: "center",
              borderRadius: 3,
              marginTop: 10,
            }}
          />
          <View
            style={{
              padding: 18,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                flex: 1,
                color: colors.ink,
                fontSize: 18,
                fontWeight: "800",
              }}
            >
              {title}
            </Text>
            <Pressable
              disabled={busy}
              accessibilityLabel={`Đóng ${title.toLowerCase()}`}
              accessibilityRole="button"
              hitSlop={10}
              onPress={close}
            >
              <Icon name="close" color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 18, paddingTop: 0, gap: 14 }}
          >
            {children}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
