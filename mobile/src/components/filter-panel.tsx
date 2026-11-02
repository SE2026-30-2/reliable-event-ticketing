import { useState, type PropsWithChildren } from "react";
import { View } from "react-native";
import { Button, Card } from "./ui-kit";
export function FilterPanel({
  children,
  title = "Bộ lọc",
}: PropsWithChildren<{ title?: string }>) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 10 }}>
      <Button
        compact
        secondary
        icon="filter"
        title={open ? `Đóng ${title.toLowerCase()}` : title}
        onPress={() => setOpen(!open)}
      />
      {open && <Card>{children}</Card>}
    </View>
  );
}
