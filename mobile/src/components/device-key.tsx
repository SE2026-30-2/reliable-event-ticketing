import { useState } from "react";
import { Text } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Body, Button, Card, Feedback, Heading, styles } from "./ui-kit";
import { messageOf } from "@/lib/types";

export function DeviceKey({
  value,
  onClose,
}: {
  value: string;
  onClose: () => void;
}) {
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  return (
    <Card>
      <Heading>Khóa thiết bị mới</Heading>
      <Body>Khóa chỉ hiển thị lần này. Sao chép và lưu trước khi đóng.</Body>
      <Text
        selectable
        accessibilityLabel="Khóa thiết bị mới"
        style={styles.text}
      >
        {value}
      </Text>
      <Feedback message={error} />
      {!!notice && <Body>{notice}</Body>}
      <Button
        title="Sao chép khóa thiết bị"
        onPress={async () => {
          setError("");
          try {
            if (
              !(await Clipboard.setStringAsync(value, {
                android: { isSensitive: true },
              }))
            )
              throw new Error(
                "Không thể sao chép. Hãy chọn và sao chép khóa trong ô trên.",
              );
            setNotice("Đã sao chép khóa thiết bị.");
          } catch (error) {
            setError(messageOf(error));
          }
        }}
      />
      <Button secondary title="Đã lưu khóa, đóng" onPress={onClose} />
    </Card>
  );
}
