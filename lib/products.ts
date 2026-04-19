// Single source of truth for products.
// To add a product: add an entry here, then update the DB CHECK constraint in supabase-schema.sql.

export const PRODUCTS = [
  { id: "vetra",      label: "Vetra",      iconPath: "/products/vetra.svg" },
  { id: "gym_pocket", label: "Gym Pocket", iconPath: "/products/gym-pocket.svg" },
  { id: "trackit",    label: "TrackIt",    iconPath: "/products/trackit.svg" },
  { id: "aqua",       label: "Aqua",       iconPath: "/products/aqua.svg" },
  { id: "lumos",      label: "Lumos",      iconPath: "/products/lumos.svg" },
  { id: "shyft",      label: "Shyft",      iconPath: "/products/shyft.svg" },
  { id: "other",      label: "Other",      iconPath: null },
] as const;

export type TicketProduct = (typeof PRODUCTS)[number]["id"];

// Zod needs a non-empty tuple — cast is safe because PRODUCTS is non-empty.
export const PRODUCT_IDS = PRODUCTS.map((p) => p.id) as unknown as [
  TicketProduct,
  ...TicketProduct[],
];

export const TICKET_PRODUCT_LABELS: Record<TicketProduct, string> =
  Object.fromEntries(PRODUCTS.map((p) => [p.id, p.label])) as Record<
    TicketProduct,
    string
  >;

export const TICKET_PRODUCT_ICON_PATHS: Partial<Record<TicketProduct, string>> =
  Object.fromEntries(
    PRODUCTS.filter((p) => p.iconPath !== null).map((p) => [p.id, p.iconPath]),
  );
