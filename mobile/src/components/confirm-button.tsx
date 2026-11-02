import { useRef, useState } from "react";
import { Body, Button } from "@/components/ui-kit";
import { BottomSheet } from "./bottom-sheet";
export function ConfirmButton({
  title,
  description,
  onConfirm,
  disabled,
  danger = true,
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
  disabled?: boolean;
  danger?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  if (!confirming)
    return (
      <Button
        danger={danger}
        title={title}
        disabled={disabled}
        onPress={() => setConfirming(true)}
      />
    );
  return (
    <BottomSheet title={title} close={() => setConfirming(false)} busy={busy}>
      <Body>{description}</Body>
      <Button
        danger={danger}
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
    </BottomSheet>
  );
}
