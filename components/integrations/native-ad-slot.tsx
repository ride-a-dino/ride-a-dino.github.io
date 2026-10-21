// Shared ad slot for any non-fixed page template. All loading is
// owned by the single AdsterraManager in the root layout.
export function NativeAdSlot() {
  return <div data-adsterra-native-slot="" className="adsterra-slot" />;
}
