// Waste sorting guide data
export const CAT_META = {
  recycle: { label: "Recyclable", color: "var(--moss)" },
  compost: { label: "Compostable", color: "var(--clay)" },
  trash:   { label: "Trash", color: "var(--stone)" },
  hazard:  { label: "Hazardous — special drop-off", color: "var(--rust)" },
};

export const ITEMS = [
  ["Cardboard box","recycle"],["Cereal box","recycle"],["Newspaper","recycle"],["Magazine","recycle"],
  ["Office paper","recycle"],["Aluminum can","recycle"],["Steel/tin can","recycle"],["Glass bottle","recycle"],
  ["Glass jar","recycle"],["Plastic bottle (PET)","recycle"],["Milk jug (HDPE)","recycle"],["Yogurt cup","recycle"],
  ["Detergent bottle","recycle"],["Milk carton","recycle"],["Aluminum foil (clean)","recycle"],["Wire hanger","recycle"],
  ["Paperback book","recycle"],["Textbook","recycle"],["Hardcover book (cover removed)","recycle"],
  ["Spiral notebook","trash"],["Sticky note pad","trash"],["Egg carton (cardboard)","compost"],["Food scraps","compost"],["Coffee grounds","compost"],
  ["Tea bags (no plastic)","compost"],["Paper towel (used)","compost"],["Yard waste / leaves","compost"],
  ["Wood scraps (untreated)","compost"],["Houseplant trimmings","compost"],["Pizza box (greasy)","trash"],
  ["Plastic bag","trash"],["Plastic film / wrap","trash"],["Styrofoam","trash"],["Chip bag","trash"],
  ["Candy wrapper","trash"],["Diaper","trash"],["Broken ceramic / mug","trash"],["Mirror / window glass","trash"],
  ["Wine cork","trash"],["Rubber band","trash"],["Dryer lint","trash"],
  ["Straws","trash"],["Toothbrush","trash"],["Broken umbrella","trash"],["Battery (single-use)","hazard"],
  ["Rechargeable battery","hazard"],["Light bulb (CFL/LED)","hazard"],["Electronics / e-waste","hazard"],
  ["Phone / laptop","hazard"],["Paint can","hazard"],["Motor oil","hazard"],["Propane tank","hazard"],
  ["Pesticides","hazard"],["Cleaning chemicals","hazard"],["Medication (expired)","hazard"],
  ["Thermometer (mercury)","hazard"],["Fire extinguisher","hazard"],["Fluorescent tube","hazard"],
  ["Pure water sachet (nylon)","recycle","Rinse and drop at a WeCyclers or PET point — don't burn"],
  ["Cellophane shopping bag / \"nylon\"","trash","Most local systems don't process this yet"],
  ["Scrap metal / iron rod","recycle","Sell to a local scrap dealer (aluminum, iron, copper)"],
  ["Used generator part","hazard","Take to a scrap or e-waste dealer, not the bin"],
  ["Used engine oil","hazard","Return to a mechanic workshop or licensed collector"],
  ["Old phone / computer parts","hazard","Drop at an e-waste point (e.g. Computer Village collection)"],
  ["Groundnut oil bottle","recycle"],["Cooking ash","compost"],
  ["Plantain / banana peel","compost"],["Cassava peel","compost"],["Corn husk","compost"],
];

export const ITEM_NOTES = {};
ITEMS.forEach(([name, _cat, note]) => { if (note) ITEM_NOTES[name] = note; });

export const RESOURCES = [
  { title: "Lagos Waste Management Authority (LAWMA)", note: "Official body handling refuse collection and licensing in Lagos State", color: "var(--moss)" },
  { title: "Wecyclers", note: "Social enterprise collecting recyclables from households for cash/rewards, partnered with LAWMA", color: "var(--moss)" },
  { title: "Your state's waste authority", note: "Outside Lagos, check your state environmental protection agency for local rules", color: "var(--stone)" },
  { title: "Campus sustainability clubs", note: "Many Nigerian universities have environmental or sustainability societies — a natural first partner for cleanups", color: "var(--indigo)" },
  { title: "Local environmental NGOs", note: "Search for community clean-up or conservation groups active in your city", color: "var(--indigo)" },
];
