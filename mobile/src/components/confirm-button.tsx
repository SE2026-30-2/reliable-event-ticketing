import { useRef, useState } from "react";
import { Body, Button, Card } from "@/components/ui-kit";
export function ConfirmButton({
  title,
  description,
  onConfirm,
  disabled,
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
  disabled?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  if (!confirming)
    return (
      <Button
        danger
        title={title}
        disabled={disabled}
        onPress={() => setConfirming(true)}
      />
    );
  return (
    <Card>
      <Body>{description}</Body>
      <Button
        danger
        title={`Xác nhận ${title.toLowerCase()}`}
        busy={busy}
        disabled={disabled}
        onPress={async () => {
          if (disabled || lock.current) return;
          lock.current = true;
          setBusy(true);
          try {
            await onConfirm();
          } finally {
            lock.current = false;
            setBusy(false);
            setConfirming(false);
          }
        }}
      />
      <Button
        secondary
        title="Hủy"
        disabled={busy}
        onPress={() => setConfirming(false)}
      />
    </Card>
  );
}
