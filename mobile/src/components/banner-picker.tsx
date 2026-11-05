import { useRef, useState } from "react";
import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Banner, Body, Button, Feedback } from "./ui-kit";

export type BannerAsset = ImagePicker.ImagePickerAsset;
export function BannerPicker({
  value,
  disabled,
  onSelect,
  onBusyChange,
}: {
  value: string;
  disabled: boolean;
  onSelect: (asset: BannerAsset | null) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function select() {
    if (disabled || lock.current) return;
    lock.current = true;
    onBusyChange(true);
    setError("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const size = asset.fileSize ?? asset.file?.size;
      const type = asset.mimeType ?? asset.file?.type;
      if (
        !size ||
        size > 5 * 1024 * 1024 ||
        !["image/jpeg", "image/png"].includes(type || "") ||
        asset.width < 1 ||
        asset.height < 1 ||
        asset.width * asset.height > 20_000_000
      )
        throw new Error(
          "Chọn ảnh JPG hoặc PNG, tối đa 5 MB và 20 triệu điểm ảnh.",
        );
      onSelect(asset);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Không đọc được ảnh. Vui lòng thử lại.",
      );
    } finally {
      lock.current = false;
      onBusyChange(false);
    }
  }
  return (
    <>
      {!!value && <Banner uri={value} />}
      <Button
        secondary
        title="Chọn ảnh bìa từ thiết bị"
        disabled={disabled}
        onPress={select}
      />
      <Body muted>JPG, PNG · Tối đa 5 MB · 20 triệu điểm ảnh</Body>
      <Feedback message={error} />
    </>
  );
}

export function bannerBody(asset: BannerAsset) {
  const body = new FormData();
  if (Platform.OS === "web") {
    if (!asset.file)
      throw new Error("Không đọc được tệp ảnh. Vui lòng chọn lại.");
    body.append("file", asset.file, asset.fileName || "banner.jpg");
  } else {
    body.append("file", {
      uri: asset.uri,
      type: asset.mimeType,
      name:
        asset.fileName ||
        (asset.mimeType === "image/png" ? "banner.png" : "banner.jpg"),
    } as unknown as Blob);
  }
  return body;
}
