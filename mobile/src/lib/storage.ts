import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
export const storage = {
  async get(key: string) {
    if (Platform.OS === "web")
      return typeof sessionStorage === "undefined"
        ? null
        : sessionStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string) {
    if (Platform.OS === "web") {
      sessionStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string) {
    if (Platform.OS === "web") {
      if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};
