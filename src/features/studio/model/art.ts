/**
 * Which catalogue products appear in the room, and what they are drawn as.
 *
 * This is curation, not synced data, which is why it lives here rather than in
 * `scripts/sync-catalog.mjs`: changing a verdict is a code review, not a network
 * round trip, and the rules are covered by `art.test.ts`.
 */

/**
 * Products that have bespoke isometric art, keyed by monis.rent slug. Several
 * products may share one asset: a 27" panel looks the same on an isometric desk
 * whoever made it.
 */
export const ART_BY_SLUG: Readonly<Record<string, string>> = {
  "electrical-adjustable-desk": "desk-electric-standing",
  "adjustable-wooden-desk": "desk-mechanical-wooden",
  "dual-motor-electric-standing-desk": "desk-dual-motor",

  "ergonomic-office-chair": "chair-ergonomic-mesh",

  "full-hd-office-24": "monitor-24-fhd",
  "24-full-hd-office-monitor-a24i-2": "monitor-24-fhd",
  "24-full-hd-office-monitor-a24i-2026": "monitor-24-fhd",

  "27-4-k-multimedia-monitor": "monitor-27-4k",
  "27-work-monitor-a27i": "monitor-27-4k",
  "27-work-monitor-mi-d": "monitor-27-4k",
  "apple-studio-display": "monitor-27-4k",
  "ben-q-2-k-grading-monitor-27": "monitor-27-4k",
  "4k-grading-monitor-27": "monitor-27-4k",

  "mi-30-curved-monitor": "monitor-34-ultrawide",
  "32-4-k-ergonomic-monitor": "monitor-34-ultrawide",
  "4-k-ultra-wide-34": "monitor-34-ultrawide",
  "34-4-k-curved-monitor-180-hz": "monitor-34-ultrawide",

  "smart-led-desk-lamp-1-s": "lamp-smart-led",
  "hue-signe-gradient-lamp": "lamp-smart-led",
  "metal-monitor-light-bar": "lamp-smart-led",

  "ergonomic-laptop-stand": "laptop-stand",

  "logitech-mx-keyboard": "keyboard-mx",
  "apple-magic-keyboard": "keyboard-mx",

  "nespresso-essenza-coffee-machine": "coffee-machine",
  "nespresso-inissia": "coffee-machine",
  "capsule-coffee-machine": "coffee-machine",
  "bosch-coffee-maker": "coffee-machine",

  "marshall-woburn-ii-bluetooth": "speaker-marshall",
  "apple-home-pod": "speaker-marshall",
};

/**
 * Products the room never draws, so adding one puts it straight in the cart.
 *
 * monis.rent rents plenty of things with no isometric presence: a cable, a spare
 * filter, a pack of sticky notes, a controller that lives in your hands. The
 * smallest thing the grid can hold is a 20 cm tile, and none of these would read
 * as anything but a speck or a lie about its size.
 *
 * Slugs rather than categories, because "office accessories" holds a monitor
 * stand and an HDMI cable alike. Anything absent from this list is placeable,
 * which is the safe default: it falls back to a generic block and can be dragged
 * around like everything else.
 */
export const CART_ONLY_SLUGS: ReadonlySet<string> = new Set([
  // Cables, adapters and power.
  "6-in-1-converter-hub",
  "display-port-1-4-4-k-cable",
  "extension-cable",
  "gigabit-lan-cable",
  "hdmi-2-0-cable",
  "international-power-strip",
  "mini-display-port-to-hdmi-adapter",
  "smart-power-strip-6",
  "thunderbolt-5-usb-c-cable",
  "usb-c-3-1-100-w-10-gbps-cable",
  "usb-c-to-display-port-cable",
  "usb-c-to-hdmi-display-cable",
  "wi-fi-range-extender",
  "xlr-female-to-3-5mm-cable",

  // Held in the hand or worn, so they are never sitting in the room.
  "apple-magic-mouse",
  "apple-magic-trackpad",
  "babyliss-hair-dryer",
  "insta360-action-camera",
  "logitech-4-k-webcam",
  "logitech-mx-master-mouse-s3",
  "logitech-mx-mouse",
  "logitech-wireless-headphones",
  "massage-gun",
  "padel-racket",
  "ps-5-wireless-controller",
  "sony-psvr-2-vr-headset",
  "steam-iron",
  "switch-2-controller-pack",

  // Consumables, spares and flat stationery.
  "air-purifier-filter",
  "coffee-filter-papers",
  "flip-chart-paper",
  "hanger-bundle",
  "mouse-pad",
  "padel-balls",
  "post-it-notes",
  "ps-5-games",
  "whiteboard-magnets",
  "whiteboard-marker-and-eraser-set",
  "workshop-voting-stickers",
]);

/**
 * What a placeable product without bespoke art is drawn as: a stand-in block
 * sized for the kind of thing its category holds. The catalogue runs to a
 * hundred-odd products and only a handful have their own art, so this is what
 * lets any of them be dropped into the room.
 */
const GENERIC_BY_CATEGORY: Readonly<Record<string, string>> = {
  monitors: "generic-screen",
  furniture: "generic-floor-large",
  "office-accessories": "generic-desk-small",
  computer: "generic-desk-medium",
  gaming: "generic-desk-medium",
  "smart-home": "generic-floor-small",
  "audio-and-video": "generic-desk-tall",
  "health-and-fitness": "generic-floor-wide",
};

/**
 * A product whose categories carry no rule stands on the floor rather than on a
 * desk. A desk stand-in would demand a desk before it could be added at all,
 * which is a poor guess to make on a category nobody has looked at yet.
 */
const GENERIC_FALLBACK = "generic-floor-small";

/** The parts of a product that decide how it is drawn. */
export type ArtSubject = {
  slug: string;
  categoryIds: string[];
};

/**
 * The asset a product is drawn with, or undefined when it is cart-only.
 */
export function artFor({ slug, categoryIds }: ArtSubject): string | undefined {
  if (CART_ONLY_SLUGS.has(slug)) return undefined;

  const bespoke = ART_BY_SLUG[slug];
  if (bespoke) return bespoke;

  for (const id of categoryIds) {
    const generic = GENERIC_BY_CATEGORY[id];
    if (generic) return generic;
  }

  return GENERIC_FALLBACK;
}
